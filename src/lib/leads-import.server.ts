/** Lógica server-only da importação de leads em massa. */
import type { z } from "zod";
import { escopoComercial, nomesDeUsuarios } from "@/lib/leads.server";
import type { importarLeadsSchema, verificarDuplicadosSchema } from "@/lib/leads-import.schemas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

const CHUNK = 200;

function digitos(valor: string | null | undefined): string {
  let d = (valor ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d;
}

/** Resolve o vendedor de destino: vendedor usa o próprio; admin escolhe. */
async function vendedorDestino(
  supabase: Sb,
  userId: string,
  destinoRecebido?: string,
): Promise<string> {
  const escopo = await escopoComercial(supabase, userId);
  if (!escopo.isAdmin) {
    if (!escopo.vendedorId) throw new Error("Acesso restrito à equipe comercial.");
    return escopo.vendedorId;
  }
  if (!destinoRecebido) {
    if (escopo.vendedorId) return escopo.vendedorId;
    throw new Error("Escolha o vendedor de destino da importação.");
  }
  const { data } = await supabase
    .from("vendedores")
    .select("id")
    .eq("id", destinoRecebido)
    .maybeSingle();
  if (!data) throw new Error("Vendedor informado não existe.");
  return data.id as string;
}

export interface LeadExistenteServer {
  telefone: string;
  lead_id: string;
  nome_contato: string;
  empresa: string | null;
}

/** Duplicados na carteira: UMA consulta com .in(), nunca por linha. */
export async function verificarDuplicadosServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof verificarDuplicadosSchema>,
): Promise<LeadExistenteServer[]> {
  const destino = await vendedorDestino(supabase, userId, dados.destino_vendedor_id);
  const alvo = Array.from(new Set(dados.telefones.map(digitos).filter((d) => d.length >= 10)));
  if (alvo.length === 0) return [];

  const { data, error } = await supabase
    .from("leads")
    .select("id, nome_contato, empresa, telefone")
    .eq("vendedor_id", destino)
    .limit(5000);
  if (error) throw new Error(error.message);

  const procurados = new Set(alvo);
  const encontrados: LeadExistenteServer[] = [];
  for (const l of data ?? []) {
    const d = digitos(l.telefone);
    if (!procurados.has(d)) continue;
    encontrados.push({
      telefone: d,
      lead_id: l.id,
      nome_contato: l.nome_contato,
      empresa: l.empresa ?? null,
    });
  }
  return encontrados;
}

export interface ResultadoImportacao {
  importacao_id: string;
  importados: number;
  atualizados: number;
  ignorados: number;
  erros: { linha: number; motivo: string }[];
}

function chunks<T>(lista: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function importarLeadsServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof importarLeadsSchema>,
): Promise<ResultadoImportacao> {
  const destino = await vendedorDestino(supabase, userId, dados.destino_vendedor_id);

  const erros: { linha: number; motivo: string }[] = [];
  let ignorados = 0;

  // Revalidação no servidor — a validação do navegador não é confiável.
  const vistos = new Set<string>();
  const criar: z.infer<typeof importarLeadsSchema>["linhas"] = [];
  const atualizar: z.infer<typeof importarLeadsSchema>["linhas"] = [];

  for (const l of dados.linhas) {
    if (l.acao === "ignorar") {
      ignorados += 1;
      continue;
    }
    const nome = (l.nome_contato ?? "").trim();
    const tel = digitos(l.telefone);
    if (nome.length < 2 || nome.length > 120) {
      erros.push({ linha: l.linha, motivo: "Nome do contato inválido" });
      continue;
    }
    if (tel.length < 10 || tel.length > 11) {
      erros.push({ linha: l.linha, motivo: "Telefone inválido" });
      continue;
    }
    const email = l.email && EMAIL_RE.test(l.email) ? l.email.toLowerCase() : null;
    const limpo = { ...l, nome_contato: nome, telefone: tel, email };

    if (l.acao === "atualizar") {
      if (!l.lead_id) {
        erros.push({ linha: l.linha, motivo: "Lead existente não informado" });
        continue;
      }
      atualizar.push(limpo);
      continue;
    }
    if (vistos.has(tel)) {
      ignorados += 1;
      continue;
    }
    vistos.add(tel);
    criar.push(limpo);
  }

  // 1) Lote primeiro, para vincular os leads criados.
  const { data: lote, error: erroLote } = await supabase
    .from("lead_importacoes")
    .insert({
      vendedor_id: destino,
      autor_id: userId,
      arquivo_nome: dados.arquivo_nome,
      total_linhas: dados.total_linhas ?? dados.linhas.length,
    })
    .select("id")
    .single();
  if (erroLote || !lote) {
    throw new Error(erroLote?.message || "Não foi possível registrar a importação.");
  }
  const importacaoId = lote.id as string;

  const hoje = new Date().toISOString().slice(0, 10);
  const registros = criar.map((l) => ({
    vendedor_id: destino,
    importacao_id: importacaoId,
    nome_contato: l.nome_contato,
    telefone: l.telefone,
    empresa: l.empresa ?? null,
    cargo: l.cargo ?? null,
    email: l.email ?? null,
    segmento: l.segmento ?? null,
    observacoes: l.observacoes ?? null,
    valor_estimado: l.valor_estimado ?? 0,
    estagio: "contatado",
    origem: "prospeccao_ativa",
    contatado_em: hoje,
  }));

  const idsCriados: string[] = [];

  // 2) INSERT em lote, em blocos de 200. Se o bloco bater em telefone
  // duplicado (23505), reprocessa só aquele bloco linha a linha para não
  // perder as demais — o caminho normal segue sendo um insert por bloco.
  for (const bloco of chunks(registros, CHUNK)) {
    const { data, error } = await supabase.from("leads").insert(bloco).select("id");
    if (!error) {
      for (const r of data ?? []) idsCriados.push(r.id);
      continue;
    }
    const codigo = (error as { code?: string }).code;
    if (codigo !== "23505") throw new Error(error.message);

    for (let i = 0; i < bloco.length; i++) {
      const { data: um, error: e1 } = await supabase
        .from("leads")
        .insert(bloco[i])
        .select("id")
        .maybeSingle();
      if (e1) {
        if ((e1 as { code?: string }).code === "23505") ignorados += 1;
        else erros.push({ linha: criar[i]?.linha ?? 0, motivo: e1.message });
        continue;
      }
      if (um) idsCriados.push(um.id);
    }
  }

  // 3) Nota de importação em cada lead criado (em lote).
  if (idsCriados.length > 0) {
    const notas = idsCriados.map((id) => ({
      lead_id: id,
      autor_id: userId,
      tipo: "nota",
      corpo: `Importado da planilha ${dados.arquivo_nome}`,
    }));
    for (const bloco of chunks(notas, CHUNK)) {
      await supabase.from("lead_atividades").insert(bloco);
    }
  }

  // 4) Atualizações: preenchem SOMENTE os campos vazios do lead existente.
  let atualizados = 0;
  if (atualizar.length > 0) {
    const ids = atualizar.map((l) => l.lead_id as string);
    const { data: existentes } = await supabase
      .from("leads")
      .select("id, empresa, cargo, email, segmento, observacoes, valor_estimado")
      .in("id", ids);
    const mapa = new Map<string, Record<string, unknown>>();
    for (const e of existentes ?? []) mapa.set(e.id, e);

    for (const l of atualizar) {
      const atual = mapa.get(l.lead_id as string);
      if (!atual) {
        erros.push({ linha: l.linha, motivo: "Lead existente não encontrado" });
        continue;
      }
      const patch: Record<string, unknown> = {};
      const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
      if (vazio(atual.empresa) && l.empresa) patch.empresa = l.empresa;
      if (vazio(atual.cargo) && l.cargo) patch.cargo = l.cargo;
      if (vazio(atual.email) && l.email) patch.email = l.email;
      if (vazio(atual.segmento) && l.segmento) patch.segmento = l.segmento;
      if (vazio(atual.observacoes) && l.observacoes) patch.observacoes = l.observacoes;
      if (Number(atual.valor_estimado ?? 0) === 0 && (l.valor_estimado ?? 0) > 0) {
        patch.valor_estimado = l.valor_estimado;
      }
      if (Object.keys(patch).length === 0) {
        ignorados += 1;
        continue;
      }
      const { data, error } = await supabase
        .from("leads")
        .update(patch)
        .eq("id", l.lead_id)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        erros.push({ linha: l.linha, motivo: error?.message ?? "Sem permissão para atualizar" });
        continue;
      }
      atualizados += 1;
    }
  }

  const importados = idsCriados.length;

  await supabase
    .from("lead_importacoes")
    .update({ importados, atualizados, ignorados })
    .eq("id", importacaoId)
    .select("id");

  return { importacao_id: importacaoId, importados, atualizados, ignorados, erros };
}

export interface Importacao {
  id: string;
  arquivo_nome: string;
  total_linhas: number;
  importados: number;
  atualizados: number;
  ignorados: number;
  created_at: string;
  autor_nome: string;
  /** Ainda dentro da janela de 24h para desfazer. */
  pode_desfazer: boolean;
}

export async function listarImportacoesServer(supabase: Sb, userId: string): Promise<Importacao[]> {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase
    .from("lead_importacoes")
    .select(
      "id, arquivo_nome, total_linhas, importados, atualizados, ignorados, created_at, autor_id",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const linhas = data ?? [];
  const nomes = await nomesDeUsuarios(linhas.map((l: { autor_id: string }) => l.autor_id));
  const agora = Date.now();
  return linhas.map((l: Importacao & { autor_id: string }) => ({
    id: l.id,
    arquivo_nome: l.arquivo_nome,
    total_linhas: l.total_linhas,
    importados: l.importados,
    atualizados: l.atualizados,
    ignorados: l.ignorados,
    created_at: l.created_at,
    autor_nome: nomes.get(l.autor_id) ?? "Equipe",
    pode_desfazer: agora - new Date(l.created_at).getTime() < 24 * 3600 * 1000,
  }));
}

export interface ResultadoDesfazer {
  removidos: number;
  preservados: number;
}

/**
 * Desfazer só remove lead intocado: nas primeiras 24h, estágio 'contatado',
 * completude 0, sem reunião e sem atividade além da nota de importação.
 */
export async function desfazerImportacaoServer(
  supabase: Sb,
  userId: string,
  importacaoId: string,
): Promise<ResultadoDesfazer> {
  await escopoComercial(supabase, userId);

  const { data: lote, error: erroLote } = await supabase
    .from("lead_importacoes")
    .select("id, created_at")
    .eq("id", importacaoId)
    .maybeSingle();
  if (erroLote) throw new Error(erroLote.message);
  if (!lote) throw new Error("Importação não encontrada ou você não tem permissão.");
  if (Date.now() - new Date(lote.created_at).getTime() > 24 * 3600 * 1000) {
    throw new Error("O prazo de 24 horas para desfazer esta importação já passou.");
  }

  const { data: todos, error: erroTodos } = await supabase
    .from("leads")
    .select("id, estagio, completude")
    .eq("importacao_id", importacaoId);
  if (erroTodos) throw new Error(erroTodos.message);
  const total = (todos ?? []).length;
  if (total === 0) return { removidos: 0, preservados: 0 };

  const candidatos = (todos ?? [])
    .filter(
      (l: { estagio: string; completude: number }) =>
        l.estagio === "contatado" && Number(l.completude ?? 0) === 0,
    )
    .map((l: { id: string }) => l.id);

  const bloqueados = new Set<string>();
  if (candidatos.length > 0) {
    const [{ data: reunioes }, { data: atividades }] = await Promise.all([
      supabase.from("lead_reunioes").select("lead_id").in("lead_id", candidatos),
      supabase.from("lead_atividades").select("lead_id, tipo, corpo").in("lead_id", candidatos),
    ]);
    for (const r of reunioes ?? []) bloqueados.add(r.lead_id);
    const contagem = new Map<string, number>();
    for (const a of atividades ?? []) {
      const importada =
        a.tipo === "nota" && String(a.corpo ?? "").startsWith("Importado da planilha");
      if (!importada) bloqueados.add(a.lead_id);
      else contagem.set(a.lead_id, (contagem.get(a.lead_id) ?? 0) + 1);
    }
    for (const [id, n] of contagem) if (n > 1) bloqueados.add(id);
  }

  const remover = candidatos.filter((id: string) => !bloqueados.has(id));
  let removidos = 0;
  for (const bloco of chunks(remover, CHUNK)) {
    const { data, error } = await supabase.from("leads").delete().in("id", bloco).select("id");
    if (error) throw new Error(error.message);
    removidos += (data ?? []).length;
  }

  return { removidos, preservados: total - removidos };
}
