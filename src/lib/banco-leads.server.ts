/** Lógica server-only do Banco de Leads (repositório central de leads). */
import type { z } from "zod";
import { escopoComercial } from "@/lib/leads.server";
import { apenasDigitos, type LeadOrigem } from "@/lib/leads";
import type { BancoLeadStatus } from "@/lib/banco-leads";
import type {
  listarBancoLeadsSchema,
  salvarBancoLeadSchema,
  importarBancoLeadsSchema,
  puxarLeadsSchema,
  definirEscopoVendedorSchema,
} from "@/lib/banco-leads.schemas";

// Cliente tipado do usuário logado (RLS ativa). Tipo frouxo de propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

const CHUNK = 200;
const PRAZO_PADRAO = 7;

const CAMPOS =
  "id, nome_contato, empresa, cargo, telefone, email, segmento, cidade, estado, origem, observacoes, status, puxado_por, puxado_em, lead_id, lote_id, reservado_segmento, reservado_estado, bloqueado_ate, vezes_devolvido, created_at, updated_at";

export interface BancoLead {
  id: string;
  nome_contato: string;
  empresa: string | null;
  cargo: string | null;
  /** Mascarado quando o vendedor ainda não puxou este lead. */
  telefone: string;
  email: string | null;
  segmento: string | null;
  cidade: string | null;
  estado: string | null;
  origem: LeadOrigem;
  observacoes: string | null;
  status: BancoLeadStatus;
  puxado_por: string | null;
  puxado_em: string | null;
  lead_id: string | null;
  lote_id: string | null;
  reservado_segmento: string | null;
  reservado_estado: string | null;
  bloqueado_ate: string | null;
  vezes_devolvido: number;
  created_at: string;
  updated_at: string;
  /** true quando telefone/e-mail vieram mascarados. */
  mascarado: boolean;
  vendedor_nome?: string | null;
  lote_fonte?: string | null;
}

export interface ListaBancoLeads {
  itens: BancoLead[];
  total: number;
  pagina: number;
  por_pagina: number;
  /** Prazo (dias) de devolução automática configurado. */
  prazo_devolucao: number;
}

/** "(11) ****-**21" — mantém DDD e os 2 últimos dígitos, nada mais. */
export function mascararTelefone(valor: string | null | undefined): string {
  const d = apenasDigitos(valor);
  if (d.length < 4) return "****";
  const ddd = d.slice(0, 2);
  const fim = d.slice(-2);
  return `(${ddd}) ****-**${fim}`;
}

/** "j****@g****.com" não ajuda ninguém: mostramos só o domínio genérico. */
export function mascararEmail(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return "e-mail oculto";
}

async function prazoDevolucao(supabase: Sb): Promise<number> {
  const { data } = await supabase
    .from("configuracoes")
    .select("dias_devolver_lead")
    .limit(1)
    .maybeSingle();
  const dias = Number(data?.dias_devolver_lead ?? PRAZO_PADRAO);
  if (!Number.isFinite(dias)) return PRAZO_PADRAO;
  return Math.min(30, Math.max(3, Math.trunc(dias)));
}

async function exigirAdmin(supabase: Sb, userId: string) {
  const escopo = await escopoComercial(supabase, userId);
  if (!escopo.isAdmin) throw new Error("Apenas administradores podem alterar o banco de leads.");
  return escopo;
}

/** Nomes dos vendedores que puxaram, resolvidos em lote. */
async function nomesDosVendedores(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return mapa;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: vends } = await supabaseAdmin
    .from("vendedores")
    .select("id, user_id")
    .in("id", unicos);
  const userIds = (vends ?? []).map((v: { user_id: string }) => v.user_id).filter(Boolean);
  const { data: perfis } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, email")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const porUser = new Map<string, string>();
  for (const p of perfis ?? []) porUser.set(p.id, (p.nome || "").trim() || p.email);
  for (const v of vends ?? []) mapa.set(v.id, porUser.get(v.user_id) ?? "Vendedor");
  return mapa;
}

export async function listarBancoLeadsServer(
  supabase: Sb,
  userId: string,
  filtros: z.infer<typeof listarBancoLeadsSchema>,
): Promise<ListaBancoLeads> {
  const { isAdmin, vendedorId } = await escopoComercial(supabase, userId);
  const pagina = filtros.pagina ?? 0;
  const porPagina = filtros.por_pagina ?? 25;

  let q = supabase.from("banco_leads").select(CAMPOS, { count: "exact" });

  if (filtros.status) q = q.eq("status", filtros.status);
  if (filtros.segmento) q = q.eq("segmento", filtros.segmento);
  if (filtros.cidade) q = q.ilike("cidade", `%${filtros.cidade}%`);
  if (filtros.estado) q = q.eq("estado", filtros.estado.toUpperCase());
  if (filtros.lote_id) q = q.eq("lote_id", filtros.lote_id);
  if (isAdmin && filtros.vendedor_id) q = q.eq("puxado_por", filtros.vendedor_id);
  if (filtros.meus) {
    if (!vendedorId)
      return { itens: [], total: 0, pagina, por_pagina: porPagina, prazo_devolucao: PRAZO_PADRAO };
    q = q.eq("puxado_por", vendedorId);
  }
  if (filtros.busca) {
    const termo = filtros.busca.replace(/[%,]/g, " ").trim();
    const digitos = apenasDigitos(termo);
    const alvos = [`nome_contato.ilike.%${termo}%`, `empresa.ilike.%${termo}%`];
    // Vendedor não pode buscar por telefone de lead não puxado: seria um oráculo.
    if (digitos.length >= 4 && isAdmin) alvos.push(`telefone.ilike.%${digitos}%`);
    q = q.or(alvos.join(","));
  }

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as BancoLead[];

  const nomes = isAdmin
    ? await nomesDosVendedores(linhas.map((l) => l.puxado_por ?? "").filter(Boolean))
    : new Map<string, string>();

  const loteIds = Array.from(new Set(linhas.map((l) => l.lote_id).filter(Boolean))) as string[];
  const fontes = new Map<string, string>();
  if (loteIds.length > 0) {
    const { data: lotes } = await supabase
      .from("banco_leads_lotes")
      .select("id, fonte, arquivo_nome")
      .in("id", loteIds);
    for (const l of lotes ?? []) fontes.set(l.id, l.fonte || l.arquivo_nome);
  }

  const itens = linhas.map((l) => {
    // Mascaramento NO SERVIDOR: o dado completo nunca sai daqui.
    const meu = Boolean(vendedorId && l.puxado_por === vendedorId);
    const mascarar = !isAdmin && !meu;
    return {
      ...l,
      telefone: mascarar ? mascararTelefone(l.telefone) : l.telefone,
      email: mascarar ? mascararEmail(l.email) : l.email,
      mascarado: mascarar,
      vendedor_nome: l.puxado_por ? (nomes.get(l.puxado_por) ?? null) : null,
      lote_fonte: l.lote_id ? (fontes.get(l.lote_id) ?? null) : null,
    } satisfies BancoLead;
  });

  return {
    itens,
    total: count ?? itens.length,
    pagina,
    por_pagina: porPagina,
    prazo_devolucao: await prazoDevolucao(supabase),
  };
}

/** Total disponível no banco, para o badge do módulo comercial. */
export async function contarDisponiveisServer(supabase: Sb, userId: string): Promise<number> {
  await escopoComercial(supabase, userId);
  const agora = new Date().toISOString();
  const { count, error } = await supabase
    .from("banco_leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "disponivel")
    .or(`bloqueado_ate.is.null,bloqueado_ate.lte.${agora}`);
  if (error) return 0;
  return count ?? 0;
}

function mensagemErro(error: { code?: string; message: string }): string {
  if (error.code === "23505" || /duplicate key/i.test(error.message)) {
    return "Este telefone já está no banco de leads.";
  }
  return error.message;
}

export async function salvarBancoLeadServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof salvarBancoLeadSchema>,
): Promise<{ id: string }> {
  await exigirAdmin(supabase, userId);
  const { id, ...campos } = dados;
  const payload = {
    ...campos,
    estado: campos.estado ? campos.estado.toUpperCase() : null,
    reservado_estado: campos.reservado_estado ? campos.reservado_estado.toUpperCase() : null,
  };

  if (id) {
    const { data, error } = await supabase
      .from("banco_leads")
      .update(payload)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(mensagemErro(error));
    if (!data) throw new Error("Lead não encontrado no banco de leads.");
    return { id: data.id as string };
  }

  const { data, error } = await supabase
    .from("banco_leads")
    .insert({ ...payload, criado_por_id: userId })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(mensagemErro(error));
  if (!data) throw new Error("Não foi possível salvar o lead.");
  return { id: data.id as string };
}

export interface ResultadoImportacaoBanco {
  lote_id: string;
  importados: number;
  ignorados: number;
  erros: { linha: number; motivo: string }[];
}

function chunks<T>(lista: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function importarBancoLeadsServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof importarBancoLeadsSchema>,
): Promise<ResultadoImportacaoBanco> {
  await exigirAdmin(supabase, userId);

  const erros: { linha: number; motivo: string }[] = [];
  let ignorados = 0;
  const vistos = new Set<string>();
  const reservaSegmento = dados.reservado_segmento ?? null;
  const reservaEstado = dados.reservado_estado ? dados.reservado_estado.toUpperCase() : null;

  const validas: Record<string, unknown>[] = [];

  // Revalidação no servidor: o que o navegador mandou não é confiável.
  for (const l of dados.linhas) {
    const nome = (l.nome_contato ?? "").trim();
    const tel = apenasDigitos(l.telefone);
    if (nome.length < 2) {
      erros.push({ linha: l.linha, motivo: "Nome do contato inválido" });
      ignorados += 1;
      continue;
    }
    if (tel.length < 10 || tel.length > 11) {
      erros.push({ linha: l.linha, motivo: "Telefone inválido" });
      ignorados += 1;
      continue;
    }
    if (vistos.has(tel)) {
      erros.push({ linha: l.linha, motivo: "Telefone repetido no arquivo" });
      ignorados += 1;
      continue;
    }
    vistos.add(tel);

    validas.push({
      nome_contato: nome.slice(0, 120),
      empresa: l.empresa ? l.empresa.slice(0, 120) : null,
      cargo: l.cargo ? l.cargo.slice(0, 120) : null,
      telefone: tel,
      email: l.email && EMAIL_RE.test(l.email) ? l.email : null,
      segmento: l.segmento ?? null,
      cidade: l.cidade ?? null,
      estado: l.estado ? l.estado.toUpperCase().slice(0, 2) : null,
      origem: dados.origem,
      observacoes: l.observacoes ?? null,
      reservado_segmento: reservaSegmento,
      reservado_estado: reservaEstado,
      criado_por_id: userId,
      linha_arquivo: l.linha,
    });
  }

  const { data: lote, error: erroLote } = await supabase
    .from("banco_leads_lotes")
    .insert({
      autor_id: userId,
      arquivo_nome: dados.arquivo_nome,
      fonte: dados.fonte,
      reservado_segmento: reservaSegmento,
      reservado_estado: reservaEstado,
      total_linhas: dados.total_linhas ?? dados.linhas.length,
    })
    .select("id")
    .maybeSingle();
  if (erroLote || !lote) throw new Error(erroLote?.message ?? "Não foi possível criar o lote.");
  const loteId = lote.id as string;

  let importados = 0;
  for (const bloco of chunks(validas, CHUNK)) {
    const payload = bloco.map(({ linha_arquivo: _ignora, ...campos }) => ({
      ...campos,
      lote_id: loteId,
    }));
    const { data, error } = await supabase.from("banco_leads").insert(payload).select("id");
    if (!error) {
      importados += data?.length ?? 0;
      continue;
    }
    // Telefone duplicado no banco: insere uma a uma para salvar o que der.
    for (const [i, item] of payload.entries()) {
      const { error: e1 } = await supabase.from("banco_leads").insert(item).select("id");
      if (e1) {
        ignorados += 1;
        erros.push({
          linha: Number(bloco[i]?.linha_arquivo ?? 0),
          motivo: mensagemErro(e1),
        });
      } else {
        importados += 1;
      }
    }
  }

  await supabase
    .from("banco_leads_lotes")
    .update({ importados, ignorados })
    .eq("id", loteId)
    .select("id");

  return { lote_id: loteId, importados, ignorados, erros: erros.slice(0, 50) };
}

export interface ResumoPuxada {
  puxados: number;
  indisponiveis: number;
  ja_na_carteira: number;
  lead_ids: string[];
}

export async function puxarLeadsServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof puxarLeadsSchema>,
): Promise<ResumoPuxada> {
  // NUNCA aceitamos vendedor_id do navegador: quem decide é current_vendedor_id().
  const { vendedorId } = await escopoComercial(supabase, userId);
  if (!vendedorId) throw new Error("Apenas vendedores podem puxar leads do banco.");

  const { data, error } = await supabase.rpc("puxar_banco_leads", { _ids: dados.ids });
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as { lead_id: string | null; resultado: string }[];
  return {
    puxados: linhas.filter((l) => l.resultado === "ok").length,
    indisponiveis: linhas.filter((l) => l.resultado === "indisponivel").length,
    ja_na_carteira: linhas.filter((l) => l.resultado === "ja_na_carteira").length,
    lead_ids: linhas.map((l) => l.lead_id).filter(Boolean) as string[],
  };
}

export async function devolverLeadServer(
  supabase: Sb,
  userId: string,
  bancoLeadId: string,
): Promise<{ status: string }> {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase.rpc("devolver_banco_lead", {
    _id: bancoLeadId,
    _automatico: false,
  });
  if (error) throw new Error(error.message);
  return { status: (data as string) ?? "disponivel" };
}

export interface SaldoPuxadas {
  restante: number;
  limite: number;
  renova_em: string | null;
}

export async function saldoPuxadasServer(supabase: Sb, userId: string): Promise<SaldoPuxadas> {
  const { vendedorId } = await escopoComercial(supabase, userId);
  if (!vendedorId) return { restante: 0, limite: 0, renova_em: null };
  const { data, error } = await supabase.rpc("saldo_puxadas");
  if (error) throw new Error(error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  return {
    restante: Number(linha?.restante ?? 0),
    limite: Number(linha?.limite ?? 0),
    renova_em: (linha?.renova_em as string | null) ?? null,
  };
}

export async function arquivarBancoLeadServer(
  supabase: Sb,
  userId: string,
  id: string,
): Promise<{ id: string }> {
  await exigirAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("banco_leads")
    .update({ status: "arquivado" })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado no banco de leads.");
  return { id: data.id as string };
}

export async function excluirBancoLeadServer(
  supabase: Sb,
  userId: string,
  id: string,
): Promise<{ id: string }> {
  await exigirAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("banco_leads")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado no banco de leads.");
  return { id: data.id as string };
}

export interface EstatisticasBanco {
  total: number;
  disponiveis: number;
  puxados: number;
  arquivados: number;
  bloqueados: number;
  por_segmento: { segmento: string; total: number }[];
  por_vendedor: { vendedor: string; total: number }[];
}

export async function estatisticasBancoServer(
  supabase: Sb,
  userId: string,
): Promise<EstatisticasBanco> {
  await exigirAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("banco_leads")
    .select("status, segmento, puxado_por, bloqueado_ate")
    .limit(20000);
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as {
    status: BancoLeadStatus;
    segmento: string | null;
    puxado_por: string | null;
    bloqueado_ate: string | null;
  }[];

  const agora = Date.now();
  const segmentos = new Map<string, number>();
  const vendedores = new Map<string, number>();
  let disponiveis = 0;
  let puxados = 0;
  let arquivados = 0;
  let bloqueados = 0;

  for (const l of linhas) {
    if (l.status === "disponivel") disponiveis += 1;
    if (l.status === "puxado") puxados += 1;
    if (l.status === "arquivado") arquivados += 1;
    if (l.bloqueado_ate && new Date(l.bloqueado_ate).getTime() > agora) bloqueados += 1;
    const seg = (l.segmento || "Sem segmento").trim();
    segmentos.set(seg, (segmentos.get(seg) ?? 0) + 1);
    if (l.puxado_por) vendedores.set(l.puxado_por, (vendedores.get(l.puxado_por) ?? 0) + 1);
  }

  const nomes = await nomesDosVendedores(Array.from(vendedores.keys()));

  return {
    total: linhas.length,
    disponiveis,
    puxados,
    arquivados,
    bloqueados,
    por_segmento: Array.from(segmentos, ([segmento, total]) => ({ segmento, total })).sort(
      (a, b) => b.total - a.total,
    ),
    por_vendedor: Array.from(vendedores, ([id, total]) => ({
      vendedor: nomes.get(id) ?? "Vendedor",
      total,
    })).sort((a, b) => b.total - a.total),
  };
}

export interface QualidadeLote {
  lote_id: string;
  fonte: string;
  arquivo_nome: string;
  created_at: string;
  entrados: number;
  puxados: number;
  ganhos: number;
  devolvidos: number;
  taxa: number | null;
}

export async function qualidadeDosLotesServer(
  supabase: Sb,
  userId: string,
): Promise<QualidadeLote[]> {
  await exigirAdmin(supabase, userId);

  const { data: lotes, error } = await supabase
    .from("banco_leads_lotes")
    .select("id, fonte, arquivo_nome, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const listaLotes = (lotes ?? []) as {
    id: string;
    fonte: string | null;
    arquivo_nome: string;
    created_at: string;
  }[];
  if (listaLotes.length === 0) return [];

  const ids = listaLotes.map((l) => l.id);
  const { data: linhas } = await supabase
    .from("banco_leads")
    .select("id, lote_id, status, lead_id, puxado_por, vezes_devolvido")
    .in("lote_id", ids)
    .limit(20000);

  const bancoLinhas = (linhas ?? []) as {
    id: string;
    lote_id: string;
    status: BancoLeadStatus;
    lead_id: string | null;
    puxado_por: string | null;
    vezes_devolvido: number;
  }[];

  // Ganhos: leads originados do banco que fecharam.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bancoIds = bancoLinhas.map((l) => l.id);
  const ganhosPorBanco = new Set<string>();
  for (const bloco of chunks(bancoIds, 500)) {
    if (bloco.length === 0) continue;
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("banco_lead_id, estagio")
      .in("banco_lead_id", bloco)
      .eq("estagio", "ganho");
    for (const l of leads ?? []) if (l.banco_lead_id) ganhosPorBanco.add(l.banco_lead_id);
  }

  const resumo = new Map<string, QualidadeLote>();
  for (const lote of listaLotes) {
    resumo.set(lote.id, {
      lote_id: lote.id,
      fonte: (lote.fonte || "").trim() || "Fonte não informada",
      arquivo_nome: lote.arquivo_nome,
      created_at: lote.created_at,
      entrados: 0,
      puxados: 0,
      ganhos: 0,
      devolvidos: 0,
      taxa: null,
    });
  }

  for (const l of bancoLinhas) {
    const item = resumo.get(l.lote_id);
    if (!item) continue;
    item.entrados += 1;
    // "Puxado alguma vez": está com alguém agora ou já foi devolvido.
    if (l.puxado_por || l.vezes_devolvido > 0) item.puxados += 1;
    item.devolvidos += l.vezes_devolvido;
    if (ganhosPorBanco.has(l.id)) item.ganhos += 1;
  }

  return Array.from(resumo.values())
    .map((l) => ({ ...l, taxa: l.puxados > 0 ? l.ganhos / l.puxados : null }))
    .sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1));
}

export async function definirEscopoVendedorServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof definirEscopoVendedorSchema>,
): Promise<{ id: string }> {
  await exigirAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("vendedores")
    .update({
      segmentos: dados.segmentos,
      estados: dados.estados.map((e) => e.toUpperCase()),
    })
    .eq("id", dados.vendedor_id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Vendedor não encontrado.");
  return { id: data.id as string };
}

export interface EscopoVendedor {
  id: string;
  nome: string;
  segmentos: string[];
  estados: string[];
}

export async function listarEscoposVendedoresServer(
  supabase: Sb,
  userId: string,
): Promise<EscopoVendedor[]> {
  await exigirAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("vendedores")
    .select("id, segmentos, estados")
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as { id: string; segmentos: string[]; estados: string[] }[];
  const nomes = await nomesDosVendedores(linhas.map((l) => l.id));
  return linhas
    .map((l) => ({
      id: l.id,
      nome: nomes.get(l.id) ?? "Vendedor",
      segmentos: l.segmentos ?? [],
      estados: l.estados ?? [],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
