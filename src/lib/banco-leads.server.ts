/** Lógica server-only do Banco de Leads (repositório central de leads). */
import type { z } from "zod";
import { escopoComercial } from "@/lib/leads.server";
import { apenasDigitos, SEGMENTOS_SUGERIDOS, type LeadOrigem } from "@/lib/leads";
import { opcoesUnicas, ordenarPtBr } from "@/lib/escopo";
import { avisoCriticoCnpj, normalizarCnpj } from "@/lib/leads-import";
import { HORAS_RESERVA_PADRAO, type BancoLeadStatus } from "@/lib/banco-leads";
import type {
  listarBancoLeadsSchema,
  salvarBancoLeadSchema,
  criarLoteBancoSchema,
  importarBlocoBancoSchema,
  puxarLeadsSchema,
  definirEscopoVendedorSchema,
} from "@/lib/banco-leads.schemas";

// Cliente tipado do usuário logado (RLS ativa). Tipo frouxo de propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

const CHUNK = 200;
const PRAZO_PADRAO = 7;

const CAMPOS =
  "id, nome_contato, empresa, cargo, telefone, email, segmento, cidade, estado, origem, observacoes, status, puxado_por, puxado_em, lead_id, lote_id, reservado_segmento, reservado_estado, reservado_cnae, bloqueado_ate, vezes_devolvido, cnpj, razao_social, nome_fantasia, socios, data_abertura, porte, cnae_codigo, cnae_descricao, created_at, updated_at";

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
  reservado_cnae: string | null;
  bloqueado_ate: string | null;
  vezes_devolvido: number;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  socios: string | null;
  data_abertura: string | null;
  porte: string | null;
  cnae_codigo: string | null;
  cnae_descricao: string | null;
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

async function prazoDevolucao(): Promise<number> {
  // Lido com credencial de servidor: `configuracoes` guarda segredos e por RLS
  // só admin lê. O vendedor recebe apenas este número já tratado.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
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
  if (filtros.cnae) q = q.eq("cnae_codigo", filtros.cnae.replace(/\D/g, ""));
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
    // Lotes só são legíveis por admin (RLS). Para o vendedor buscamos com
    // credencial de servidor e devolvemos somente o rótulo da fonte —
    // nome do arquivo e metadados de importação nunca saem daqui.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const leitor = isAdmin ? supabase : supabaseAdmin;
    const { data: lotes } = await leitor
      .from("banco_leads_lotes")
      .select("id, fonte, arquivo_nome")
      .in("id", loteIds);
    for (const l of lotes ?? []) {
      fontes.set(l.id, isAdmin ? l.fonte || l.arquivo_nome : l.fonte || "Importação");
    }
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
    prazo_devolucao: await prazoDevolucao(),
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
    // CNPJ passa pela mesma normalização da importação (zeros à esquerda, etc.).
    cnpj: campos.cnpj === undefined ? undefined : normalizarCnpj(campos.cnpj).cnpj,
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

/** Horas de reserva configuradas (padrão 48h, entre 1 e 720). */
async function horasReserva(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("configuracoes")
    .select("horas_reserva_lote")
    .limit(1)
    .maybeSingle();
  const horas = Number(data?.horas_reserva_lote ?? HORAS_RESERVA_PADRAO);
  if (!Number.isFinite(horas)) return HORAS_RESERVA_PADRAO;
  return Math.min(720, Math.max(1, Math.trunc(horas)));
}

export interface LoteCriado {
  lote_id: string;
  /** Reserva aplicada às linhas deste lote (ISO) ou null quando não há reserva. */
  bloqueado_ate: string | null;
  horas_reserva: number;
}

/**
 * Passo 1 da importação: cria o lote. As linhas sobem depois em blocos, para
 * suportar planilhas de até 20.000 linhas sem estourar a requisição.
 */
export async function criarLoteBancoServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof criarLoteBancoSchema>,
): Promise<LoteCriado> {
  await exigirAdmin(supabase, userId);

  const reservaSegmento = dados.reservado_segmento ?? null;
  const reservaEstado = dados.reservado_estado ? dados.reservado_estado.toUpperCase() : null;
  const reservaCnae = dados.reservado_cnae ?? null;
  const temReserva = Boolean(reservaSegmento || reservaEstado || reservaCnae);
  const horas = dados.horas_reserva ?? (await horasReserva(supabase));
  const bloqueadoAte = temReserva
    ? new Date(Date.now() + horas * 60 * 60 * 1000).toISOString()
    : null;

  const { data: lote, error } = await supabase
    .from("banco_leads_lotes")
    .insert({
      autor_id: userId,
      arquivo_nome: dados.arquivo_nome,
      fonte: dados.fonte,
      reservado_segmento: reservaSegmento,
      reservado_estado: reservaEstado,
      reservado_cnae: reservaCnae,
      horas_reserva: temReserva ? horas : null,
      total_linhas: dados.total_linhas ?? 0,
    })
    .select("id")
    .maybeSingle();
  if (error || !lote) throw new Error(error?.message ?? "Não foi possível criar o lote.");

  const { registrarAuditoria } = await import("@/lib/audit.server");
  await registrarAuditoria({
    actorId: userId,
    acao: "criar_lote_banco_leads",
    entidade: "banco_leads_lotes",
    entidadeId: lote.id as string,
    detalhes: {
      fonte: dados.fonte,
      arquivo: dados.arquivo_nome,
      reserva: { segmento: reservaSegmento, estado: reservaEstado, cnae: reservaCnae, horas },
    },
  });

  return { lote_id: lote.id as string, bloqueado_ate: bloqueadoAte, horas_reserva: horas };
}

interface LoteContexto {
  origem: LeadOrigem;
  reservado_segmento: string | null;
  reservado_estado: string | null;
  reservado_cnae: string | null;
  bloqueado_ate: string | null;
}

async function contextoDoLote(
  supabase: Sb,
  loteId: string,
  origem: LeadOrigem,
): Promise<LoteContexto> {
  const { data, error } = await supabase
    .from("banco_leads_lotes")
    .select("reservado_segmento, reservado_estado, reservado_cnae, horas_reserva, created_at")
    .eq("id", loteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lote não encontrado.");

  const horas = Number(data.horas_reserva ?? 0);
  const bloqueadoAte =
    horas > 0
      ? new Date(new Date(data.created_at as string).getTime() + horas * 3600000).toISOString()
      : null;

  return {
    origem,
    reservado_segmento: (data.reservado_segmento as string | null) ?? null,
    reservado_estado: (data.reservado_estado as string | null) ?? null,
    reservado_cnae: (data.reservado_cnae as string | null) ?? null,
    bloqueado_ate: bloqueadoAte,
  };
}

/**
 * Passo 2: grava um bloco de linhas. Revalida tudo no servidor — o que o
 * navegador manda nunca é confiável — e autocadastra os CNAEs encontrados.
 */
export async function importarBlocoBancoServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof importarBlocoBancoSchema>,
): Promise<{ importados: number; ignorados: number; erros: { linha: number; motivo: string }[] }> {
  await exigirAdmin(supabase, userId);
  const ctx = await contextoDoLote(supabase, dados.lote_id, dados.origem);

  const erros: { linha: number; motivo: string }[] = [];
  let ignorados = 0;
  const vistos = new Set<string>();
  const validas: Record<string, unknown>[] = [];

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

    // Revalidação de CNPJ no servidor: nunca confiamos no que vem do cliente.
    // Validação final do lote: aviso crítico não entra no banco.
    const critico = avisoCriticoCnpj(l.cnpj);
    if (critico) {
      erros.push({ linha: l.linha, motivo: critico });
      ignorados += 1;
      continue;
    }
    const { cnpj } = normalizarCnpj(l.cnpj);
    const cnae = (l.cnae_codigo ?? "").replace(/\D/g, "");

    validas.push({
      nome_contato: nome.slice(0, 120),
      empresa: (l.empresa ?? l.razao_social ?? null)?.slice(0, 120) ?? null,
      cargo: l.cargo ? l.cargo.slice(0, 120) : null,
      telefone: tel,
      email: l.email && EMAIL_RE.test(l.email) ? l.email : null,
      segmento: l.segmento ?? null,
      cidade: l.cidade ?? null,
      estado: l.estado ? l.estado.toUpperCase().slice(0, 2) : null,
      origem: ctx.origem,
      observacoes: l.observacoes ?? null,
      cnpj: cnpj,
      razao_social: l.razao_social ?? null,
      nome_fantasia: l.nome_fantasia ?? null,
      socios: l.socios ?? null,
      data_abertura: l.data_abertura ?? null,
      porte: l.porte ?? null,
      cnae_codigo: cnae.length === 7 ? cnae : null,
      cnae_descricao: l.cnae_descricao ?? null,
      reservado_segmento: ctx.reservado_segmento,
      reservado_estado: ctx.reservado_estado,
      reservado_cnae: ctx.reservado_cnae,
      bloqueado_ate: ctx.bloqueado_ate,
      criado_por_id: userId,
      lote_id: dados.lote_id,
      linha_arquivo: l.linha,
    });
  }

  // Autocadastro dos CNAEs vistos no bloco (com segmento sugerido).
  const { registrarCnaesServer } = await import("@/lib/cnaes.server");
  await registrarCnaesServer(
    supabase,
    validas
      .filter((v) => v.cnae_codigo)
      .map((v) => ({
        codigo: v.cnae_codigo as string,
        descricao: (v.cnae_descricao as string | null) ?? null,
        segmento_sugerido: (v.segmento as string | null) ?? null,
      })),
  );

  let importados = 0;
  for (const bloco of chunks(validas, CHUNK)) {
    const payload = bloco.map(({ linha_arquivo: _ignora, ...campos }) => campos);
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
        erros.push({ linha: Number(bloco[i]?.linha_arquivo ?? 0), motivo: mensagemErro(e1) });
      } else {
        importados += 1;
      }
    }
  }

  return { importados, ignorados, erros: erros.slice(0, 50) };
}

/** Passo 3: fecha o lote com os totais reais gravados. */
export async function finalizarLoteBancoServer(
  supabase: Sb,
  userId: string,
  loteId: string,
): Promise<ResultadoImportacaoBanco> {
  await exigirAdmin(supabase, userId);

  const { count: importados } = await supabase
    .from("banco_leads")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId);

  const { data: lote } = await supabase
    .from("banco_leads_lotes")
    .select("total_linhas")
    .eq("id", loteId)
    .maybeSingle();

  const total = Number(lote?.total_linhas ?? 0);
  const gravados = Number(importados ?? 0);
  const ignorados = Math.max(0, total - gravados);

  await supabase
    .from("banco_leads_lotes")
    .update({ importados: gravados, ignorados })
    .eq("id", loteId)
    .select("id");

  return { lote_id: loteId, importados: gravados, ignorados, erros: [] };
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
      cnaes: dados.cnaes,
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
  cnaes: string[];
}

export async function listarEscoposVendedoresServer(
  supabase: Sb,
  userId: string,
): Promise<EscopoVendedor[]> {
  await exigirAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("vendedores")
    .select("id, segmentos, estados, cnaes")
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as {
    id: string;
    segmentos: string[];
    estados: string[];
    cnaes: string[] | null;
  }[];
  const nomes = await nomesDosVendedores(linhas.map((l) => l.id));
  return linhas
    .map((l) => ({
      id: l.id,
      nome: nomes.get(l.id) ?? "Vendedor",
      segmentos: l.segmentos ?? [],
      estados: l.estados ?? [],
      cnaes: l.cnaes ?? [],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface OpcoesEscopo {
  /** Segmentos sugeridos do sistema + os que já existem no banco e no catálogo de CNAEs. */
  segmentos: string[];
  /** CNAEs ativos do catálogo, para reserva e escopo. */
  cnaes: { codigo: string; descricao: string | null; segmento_sugerido: string | null }[];
}

/**
 * Opções reais para os selects de reserva e para o escopo do vendedor.
 * Sem isso, o admin só via "Sem reserva" — não havia lista para comparar.
 */
export async function opcoesEscopoServer(supabase: Sb, userId: string): Promise<OpcoesEscopo> {
  await exigirAdmin(supabase, userId);

  const [resBanco, resCnaes] = await Promise.all([
    supabase.from("banco_leads").select("segmento").not("segmento", "is", null).limit(2000),
    supabase
      .from("cnaes")
      .select("codigo, descricao, segmento_sugerido")
      .eq("ativo", true)
      .order("total_leads", { ascending: false })
      .limit(1000),
  ]);

  const cnaes = ((resCnaes.data ?? []) as OpcoesEscopo["cnaes"]).map((c) => ({
    codigo: c.codigo,
    descricao: c.descricao ?? null,
    segmento_sugerido: c.segmento_sugerido ?? null,
  }));

  const brutos = [
    ...SEGMENTOS_SUGERIDOS,
    ...((resBanco.data ?? []) as { segmento: string | null }[]).map((l) => l.segmento),
    ...cnaes.map((c) => c.segmento_sugerido),
  ];

  return { segmentos: ordenarPtBr(opcoesUnicas(brutos)), cnaes };
}
