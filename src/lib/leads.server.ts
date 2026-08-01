/** Lógica server-only do módulo comercial (leads, reuniões e dashboard). */
import {
  ESTAGIOS_FECHADOS,
  ESTAGIOS_SEM_FOLLOW_UP,
  apenasDigitos,
  razao,
  type LeadEstagio,
  type LeadOrigem,
  type ReuniaoStatus,
} from "@/lib/leads";
import type { z } from "zod";
import type {
import type { ClienteSupabaseUsuario } from "@/lib/supabase-tipos";
  listarLeadsSchema,
  salvarLeadSchema,
  mudarEstagioSchema,
  salvarReuniaoSchema,
  dashboardSchema,
  followUpsSchema,
  reagendarFollowUpSchema,
  registrarFollowUpSchema,
  reativarCadenciaSchema,
} from "@/lib/leads.schemas";

// Cliente tipado do usuário logado (RLS ativa). Tipo frouxo de propósito.
type Sb = ClienteSupabaseUsuario;

export interface Escopo {
  isAdmin: boolean;
  vendedorId: string | null;
}

const CAMPOS_LEAD =
  "id, vendedor_id, nome_contato, empresa, cargo, telefone, email, segmento, origem, estagio, valor_estimado, motivo_perda, observacoes, proximo_contato, follow_ups_feitos, ultimo_contato_em, cadencia_encerrada, cliente_id, contatado_em, fechado_em, importacao_id, completude, created_at, updated_at";

export interface Lead {
  id: string;
  vendedor_id: string;
  nome_contato: string;
  empresa: string | null;
  cargo: string | null;
  telefone: string;
  email: string | null;
  segmento: string | null;
  origem: LeadOrigem;
  estagio: LeadEstagio;
  valor_estimado: number;
  motivo_perda: string | null;
  observacoes: string | null;
  proximo_contato: string | null;
  /** Tentativas de contato SEM resposta já registradas. */
  follow_ups_feitos: number;
  ultimo_contato_em: string | null;
  cadencia_encerrada: boolean;
  cliente_id: string | null;
  contatado_em: string;
  fechado_em: string | null;
  importacao_id: string | null;
  /** 0 a 4: empresa, cargo, e-mail e segmento preenchidos. */
  completude: number;
  created_at: string;
  updated_at: string;
  reunioes_count: number;
  vendedor_nome?: string | null;
}

export async function escopoComercial(supabase: Sb, userId: string): Promise<Escopo> {
  const [{ data: isAdmin }, { data: vendedorId }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("current_vendedor_id"),
  ]);
  const escopo: Escopo = {
    isAdmin: isAdmin === true,
    vendedorId: (vendedorId as string | null) ?? null,
  };
  if (!escopo.isAdmin && !escopo.vendedorId) {
    throw new Error("Acesso restrito à equipe comercial.");
  }
  return escopo;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dataLimite(dias: number | null | undefined): string | null {
  if (!dias || dias <= 0) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Nomes de vendedores (perfis) resolvidos em lote via cliente administrativo. */
async function nomesVendedores(vendedorIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(vendedorIds.filter(Boolean)));
  if (unicos.length === 0) return mapa;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: vends } = await supabaseAdmin
    .from("vendedores")
    .select("id, user_id")
    .in("id", unicos);
  const userIds = (vends ?? []).map((v: { user_id: string }) => v.user_id);
  const { data: perfis } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, email")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const porUser = new Map<string, string>();
  for (const p of perfis ?? []) {
    porUser.set(p.id, (p.nome || "").trim() || p.email);
  }
  for (const v of vends ?? []) {
    mapa.set(v.id, porUser.get(v.user_id) ?? "Vendedor");
  }
  return mapa;
}

export async function nomesDeUsuarios(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return mapa;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("id, nome, email").in("id", unicos);
  for (const p of data ?? []) mapa.set(p.id, (p.nome || "").trim() || p.email);
  return mapa;
}

/** Vendedores ativos, para o filtro do admin. */
export async function listarVendedoresServer(supabase: Sb, userId: string) {
  const { isAdmin } = await escopoComercial(supabase, userId);
  if (!isAdmin) return [] as { id: string; nome: string }[];
  const { data, error } = await supabase.from("vendedores").select("id").eq("ativo", true);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((v: { id: string }) => v.id);
  const nomes = await nomesVendedores(ids);
  return ids
    .map((id: string) => ({ id, nome: nomes.get(id) ?? "Vendedor" }))
    .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface ListaLeads {
  leads: Lead[];
  /** Total de leads que atendem aos filtros (todas as páginas). */
  total: number;
  pagina: number;
  temMais: boolean;
}

export async function listarLeadsServer(
  supabase: Sb,
  userId: string,
  filtros: z.infer<typeof listarLeadsSchema>,
): Promise<ListaLeads> {
  const escopo = await escopoComercial(supabase, userId);

  const porPagina = filtros.por_pagina ?? 25;
  const pagina = filtros.pagina ?? 0;
  const inicio = pagina * porPagina;

  let query = supabase.from("leads").select(CAMPOS_LEAD, { count: "exact" });

  // Ordenação: mais recentes (padrão) ou mais incompletos primeiro.
  query =
    filtros.ordem === "completude"
      ? query.order("completude", { ascending: true }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });

  // Busca 1 registro extra para saber se existe próxima página.
  query = query.range(inicio, inicio + porPagina);

  // Vendedor: a RLS já limita aos seus; o vendedor_id recebido é ignorado.
  if (escopo.isAdmin && filtros.vendedor_id) {
    query = query.eq("vendedor_id", filtros.vendedor_id);
  }
  if (filtros.estagio) query = query.eq("estagio", filtros.estagio);
  if (filtros.origem) query = query.eq("origem", filtros.origem);
  if (filtros.segmento) query = query.eq("segmento", filtros.segmento);
  if (filtros.importacao_id) query = query.eq("importacao_id", filtros.importacao_id);
  if (filtros.apenas_incompletos) query = query.lt("completude", 4);

  const limite = dataLimite(filtros.dias);
  if (limite) query = query.gte("contatado_em", limite);

  if (filtros.apenas_follow_up) {
    query = query
      .not("proximo_contato", "is", null)
      .lte("proximo_contato", hojeISO())
      .not("estagio", "in", `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`);
  }

  if (filtros.busca) {
    const termo = filtros.busca.replace(/[%,]/g, " ").trim();
    const digitos = apenasDigitos(termo);
    const partes = [`nome_contato.ilike.%${termo}%`, `empresa.ilike.%${termo}%`];
    if (digitos.length >= 3) partes.push(`telefone.ilike.%${digitos}%`);
    query = query.or(partes.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as Lead[];
  const temMais = linhas.length > porPagina;
  const leads = temMais ? linhas.slice(0, porPagina) : linhas;
  const ids = leads.map((l) => l.id);

  // Contagem de reuniões em UMA consulta agregada.
  const contagem = new Map<string, number>();
  if (ids.length > 0) {
    const { data: reunioes } = await supabase
      .from("lead_reunioes")
      .select("lead_id")
      .in("lead_id", ids);
    for (const r of reunioes ?? []) {
      contagem.set(r.lead_id, (contagem.get(r.lead_id) ?? 0) + 1);
    }
  }

  const nomes = escopo.isAdmin
    ? await nomesVendedores(leads.map((l) => l.vendedor_id))
    : new Map<string, string>();

  return {
    leads: leads.map((l) => ({
      ...l,
      valor_estimado: Number(l.valor_estimado ?? 0),
      completude: Number(l.completude ?? 0),
      reunioes_count: contagem.get(l.id) ?? 0,
      vendedor_nome: nomes.get(l.vendedor_id) ?? null,
    })),
    total: count ?? leads.length,
    pagina,
    temMais,
  };
}

/** Segmentos já usados pelo vendedor (ou por todos, no caso do admin). */
export async function listarSegmentosServer(supabase: Sb, userId: string) {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase.from("leads").select("segmento").limit(1000);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const l of data ?? []) {
    const s = (l.segmento ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function salvarLeadServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof salvarLeadSchema>,
) {
  const escopo = await escopoComercial(supabase, userId);

  // Nunca aceita vendedor_id do navegador, exceto admin (validando existência).
  let vendedorId = escopo.vendedorId;
  if (escopo.isAdmin && dados.vendedor_id) {
    const { data: vend } = await supabase
      .from("vendedores")
      .select("id")
      .eq("id", dados.vendedor_id)
      .maybeSingle();
    if (!vend) throw new Error("Vendedor informado não existe.");
    vendedorId = vend.id;
  }

  const payload: Record<string, unknown> = {
    nome_contato: dados.nome_contato,
    empresa: dados.empresa ?? null,
    cargo: dados.cargo ?? null,
    telefone: dados.telefone,
    email: dados.email ?? null,
    segmento: dados.segmento ?? null,
    origem: dados.origem,
    estagio: dados.estagio,
    valor_estimado: dados.valor_estimado,
    motivo_perda: dados.motivo_perda ?? null,
    observacoes: dados.observacoes ?? null,
    proximo_contato: dados.proximo_contato ?? null,
  };
  if (dados.contatado_em) payload.contatado_em = dados.contatado_em;

  try {
    if (dados.id) {
      const { data, error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", dados.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");
      return { id: data.id as string };
    }

    if (!vendedorId) throw new Error("Informe o vendedor responsável pelo lead.");
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...payload, vendedor_id: vendedorId })
      .select("id")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Não foi possível salvar o lead.");
    return { id: data.id as string };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "23505") {
      throw new Error("Você já tem um lead cadastrado com este telefone.");
    }
    throw new Error(err?.message || "Não foi possível salvar o lead.");
  }
}

export async function mudarEstagioServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof mudarEstagioSchema>,
) {
  await escopoComercial(supabase, userId);
  const patch: Record<string, unknown> = { estagio: dados.estagio };
  if (dados.motivo_perda !== undefined) patch.motivo_perda = dados.motivo_perda ?? null;

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", dados.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");
  return { ok: true };
}

export async function excluirLeadServer(supabase: Sb, userId: string, id: string) {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");
  return { ok: true };
}

export async function registrarAtividadeServer(
  supabase: Sb,
  userId: string,
  dados: { lead_id: string; corpo: string },
) {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase
    .from("lead_atividades")
    .insert({
      lead_id: dados.lead_id,
      autor_id: userId,
      tipo: "nota",
      corpo: dados.corpo,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");
  return { ok: true };
}

export interface Atividade {
  id: string;
  tipo: string;
  de: string | null;
  para: string | null;
  corpo: string | null;
  created_at: string;
  autor_nome: string;
}

export async function listarAtividadesServer(
  supabase: Sb,
  userId: string,
  leadId: string,
): Promise<Atividade[]> {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase
    .from("lead_atividades")
    .select("id, tipo, de, para, corpo, created_at, autor_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const linhas = data ?? [];
  const nomes = await nomesDeUsuarios(linhas.map((l: { autor_id: string }) => l.autor_id));
  return linhas.map((l: Atividade & { autor_id: string }) => ({
    id: l.id,
    tipo: l.tipo,
    de: l.de,
    para: l.para,
    corpo: l.corpo,
    created_at: l.created_at,
    autor_nome: nomes.get(l.autor_id) ?? "Equipe",
  }));
}

export interface Reuniao {
  id: string;
  lead_id: string;
  agendada_para: string;
  status: ReuniaoStatus;
  remarcada_de: string | null;
  notas: string | null;
  created_at: string;
}

export async function listarReunioesServer(
  supabase: Sb,
  userId: string,
  leadId: string,
): Promise<Reuniao[]> {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase
    .from("lead_reunioes")
    .select("id, lead_id, agendada_para, status, remarcada_de, notas, created_at")
    .eq("lead_id", leadId)
    .order("agendada_para", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Reuniao[];
}

export async function salvarReuniaoServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof salvarReuniaoSchema>,
) {
  // A trigger do banco define vendedor_id a partir do lead; enviamos o próprio
  // vendedor apenas para satisfazer o NOT NULL / WITH CHECK da RLS.
  const escopo = await escopoComercial(supabase, userId);
  const { data: lead } = await supabase
    .from("leads")
    .select("id, vendedor_id")
    .eq("id", dados.lead_id)
    .maybeSingle();
  if (!lead) throw new Error("Lead não encontrado ou você não tem permissão.");
  const vendedorId = escopo.isAdmin ? lead.vendedor_id : escopo.vendedorId;

  let reuniaoId = dados.id ?? null;

  if (dados.id) {
    const { data, error } = await supabase
      .from("lead_reunioes")
      .update({
        agendada_para: dados.agendada_para,
        status: dados.status,
        notas: dados.notas ?? null,
      })
      .eq("id", dados.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Reunião não encontrada ou você não tem permissão.");
  } else {
    const { data, error } = await supabase
      .from("lead_reunioes")
      .insert({
        lead_id: dados.lead_id,
        vendedor_id: vendedorId,
        agendada_para: dados.agendada_para,
        status: dados.status,
        notas: dados.notas ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    reuniaoId = data.id as string;
  }

  // Remarcada: nasce uma nova reunião 'marcada' apontando para a antiga,
  // preservando o histórico e permitindo contar remarcações.
  if (dados.status === "remarcada") {
    if (!dados.nova_data) throw new Error("Informe a nova data da reunião remarcada.");
    const { error } = await supabase.from("lead_reunioes").insert({
      lead_id: dados.lead_id,
      vendedor_id: vendedorId,
      agendada_para: dados.nova_data,
      status: "marcada",
      remarcada_de: reuniaoId,
    });
    if (error) throw new Error(error.message);
  }

  await supabase.from("lead_atividades").insert({
    lead_id: dados.lead_id,
    autor_id: userId,
    tipo: "reuniao",
    para: dados.status,
    corpo:
      dados.status === "remarcada"
        ? `Reunião remarcada para ${dados.nova_data}`
        : `Reunião ${dados.status} em ${dados.agendada_para}`,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Dashboard: tudo agregado no servidor.
// ---------------------------------------------------------------------------

interface LeadAgregado {
  estagio: LeadEstagio;
  segmento: string | null;
  valor_estimado: number;
  contatado_em: string;
  vendedor_id: string;
  follow_ups_feitos?: number | null;
}

function contarFunil(leads: LeadAgregado[]) {
  const conta = (e: LeadEstagio) => leads.filter((l) => l.estagio === e).length;
  const contatados = leads.length;
  const interessados = conta("interessado");
  const nao_interessados = conta("nao_interessado");
  const em_negociacao = conta("em_negociacao");
  const ganhos = conta("ganho");
  const perdidos = conta("perdido");
  const valor_ganho = leads
    .filter((l) => l.estagio === "ganho")
    .reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0);
  const pipeline_aberto = leads
    .filter((l) => !ESTAGIOS_FECHADOS.includes(l.estagio))
    .reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0);

  return {
    contatados,
    interessados,
    nao_interessados,
    em_negociacao,
    ganhos,
    perdidos,
    taxa_interesse: razao(interessados, contatados),
    taxa_fechamento: razao(ganhos, contatados),
    taxa_negociacao: razao(ganhos, em_negociacao),
    leads_por_venda: razao(contatados, ganhos),
    valor_ganho,
    ticket_medio: razao(valor_ganho, ganhos),
    pipeline_aberto,
  };
}

function contarReunioes(rows: { status: ReuniaoStatus }[]) {
  const conta = (s: ReuniaoStatus) => rows.filter((r) => r.status === s).length;
  const marcadas = rows.length;
  const realizadas = conta("realizada");
  const remarcadas = conta("remarcada");
  const no_show = conta("no_show");
  const canceladas = conta("cancelada");
  return {
    marcadas,
    realizadas,
    remarcadas,
    no_show,
    canceladas,
    taxa_comparecimento: razao(realizadas, realizadas + no_show),
    taxa_no_show: razao(no_show, marcadas),
  };
}

export async function dashboardComercialServer(
  supabase: Sb,
  userId: string,
  filtros: z.infer<typeof dashboardSchema>,
) {
  const escopo = await escopoComercial(supabase, userId);
  const vendedorFiltro = escopo.isAdmin ? filtros.vendedor_id : undefined;
  const dias = filtros.dias && filtros.dias > 0 ? filtros.dias : null;

  const inicio = dataLimite(dias);
  const inicioAnterior = dias ? dataLimite(dias * 2) : null;

  const base = () => {
    let q = supabase
      .from("leads")
      .select("estagio, segmento, valor_estimado, contatado_em, vendedor_id, follow_ups_feitos")
      .limit(5000);
    if (vendedorFiltro) q = q.eq("vendedor_id", vendedorFiltro);
    return q;
  };

  const seisMeses = new Date();
  seisMeses.setDate(1);
  seisMeses.setHours(0, 0, 0, 0);
  seisMeses.setMonth(seisMeses.getMonth() - 5);
  const inicioSerie = seisMeses.toISOString().slice(0, 10);

  let qReunioes = supabase.from("lead_reunioes").select("status, agendada_para").limit(5000);
  if (vendedorFiltro) qReunioes = qReunioes.eq("vendedor_id", vendedorFiltro);

  const [atual, anterior, serie, reunioes] = await Promise.all([
    inicio ? base().gte("contatado_em", inicio) : base(),
    inicio && inicioAnterior
      ? base().gte("contatado_em", inicioAnterior).lt("contatado_em", inicio)
      : Promise.resolve({ data: [], error: null }),
    base().gte("contatado_em", inicioSerie),
    qReunioes,
  ]);

  for (const r of [atual, serie, reunioes]) {
    if ((r as { error?: { message: string } }).error) {
      throw new Error((r as { error: { message: string } }).error.message);
    }
  }

  const leadsAtuais = ((atual.data ?? []) as LeadAgregado[]).map((l) => ({
    ...l,
    valor_estimado: Number(l.valor_estimado ?? 0),
  }));
  const leadsAnteriores = (anterior.data ?? []) as LeadAgregado[];

  const funil = contarFunil(leadsAtuais);
  const funilAnterior = contarFunil(leadsAnteriores);

  // Reuniões do período (por agendada_para).
  const todasReunioes = (reunioes.data ?? []) as {
    status: ReuniaoStatus;
    agendada_para: string;
  }[];
  const limiteReuniao = inicio ? new Date(`${inicio}T00:00:00`).getTime() : null;
  const reunioesPeriodo = limiteReuniao
    ? todasReunioes.filter((r) => new Date(r.agendada_para).getTime() >= limiteReuniao)
    : todasReunioes;
  const metricasReunioes = contarReunioes(reunioesPeriodo);

  // Segmentos: conversão por segmento no período.
  const porSegmento = new Map<string, { total: number; ganhos: number }>();
  for (const l of leadsAtuais) {
    const chave = (l.segmento ?? "").trim() || "Sem segmento";
    const atualSeg = porSegmento.get(chave) ?? { total: 0, ganhos: 0 };
    atualSeg.total += 1;
    if (l.estagio === "ganho") atualSeg.ganhos += 1;
    porSegmento.set(chave, atualSeg);
  }
  const segmentos = Array.from(porSegmento.entries())
    .map(([segmento, v]) => ({
      segmento,
      total: v.total,
      ganhos: v.ganhos,
      taxa: razao(v.ganhos, v.total),
    }))
    .sort((a, b) => (b.taxa ?? 0) - (a.taxa ?? 0) || b.total - a.total);

  // Série de 6 meses.
  const meses: { mes: string; rotulo: string; contatados: number; ganhos: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    meses.push({
      mes,
      rotulo: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      contatados: 0,
      ganhos: 0,
    });
  }
  const indice = new Map(meses.map((m, i) => [m.mes, i]));
  for (const l of (serie.data ?? []) as LeadAgregado[]) {
    const chave = (l.contatado_em ?? "").slice(0, 7);
    const i = indice.get(chave);
    if (i === undefined) continue;
    meses[i].contatados += 1;
    if (l.estagio === "ganho") meses[i].ganhos += 1;
  }

  // Ranking apenas para admin.
  let ranking: {
    vendedor_id: string;
    nome: string;
    contatados: number;
    ganhos: number;
    taxa: number | null;
    valor_ganho: number;
  }[] = [];
  if (escopo.isAdmin) {
    const porVendedor = new Map<string, { contatados: number; ganhos: number; valor: number }>();
    for (const l of leadsAtuais) {
      const v = porVendedor.get(l.vendedor_id) ?? { contatados: 0, ganhos: 0, valor: 0 };
      v.contatados += 1;
      if (l.estagio === "ganho") {
        v.ganhos += 1;
        v.valor += Number(l.valor_estimado ?? 0);
      }
      porVendedor.set(l.vendedor_id, v);
    }
    const nomes = await nomesVendedores(Array.from(porVendedor.keys()));
    ranking = Array.from(porVendedor.entries())
      .map(([vendedor_id, v]) => ({
        vendedor_id,
        nome: nomes.get(vendedor_id) ?? "Vendedor",
        contatados: v.contatados,
        ganhos: v.ganhos,
        taxa: razao(v.ganhos, v.contatados),
        valor_ganho: v.valor,
      }))
      .sort((a, b) => b.ganhos - a.ganhos || (b.taxa ?? 0) - (a.taxa ?? 0));
  }

  // Card extra: leads com dados faltando. Não entra em nenhuma outra métrica.
  let qIncompletos = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .lt("completude", 4);
  if (vendedorFiltro) qIncompletos = qIncompletos.eq("vendedor_id", vendedorFiltro);
  const { count: incompletos } = await qIncompletos;

  // Cadência: contadores independentes do período (é operação do dia a dia).
  const hoje = hojeISO();
  const semFollowUp = `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`;
  const contarCadencia = (aplicar: (q: ReturnType<typeof supabase.from>) => unknown) => {
    let q = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("estagio", "in", semFollowUp);
    if (vendedorFiltro) q = q.eq("vendedor_id", vendedorFiltro);
    return aplicar(q) as Promise<{ count: number | null }>;
  };

  const [atrasadosRes, hojeRes, encerradasRes] = await Promise.all([
    contarCadencia((q) => q.not("proximo_contato", "is", null).lt("proximo_contato", hoje)),
    contarCadencia((q) => q.eq("proximo_contato", hoje)),
    contarCadencia((q) => q.eq("cadencia_encerrada", true)),
  ]);

  // "Toques até fechar": média de tentativas dos leads ganhos no período.
  const ganhos = leadsAtuais.filter((l) => l.estagio === "ganho");
  const media_tentativas_ate_ganho = razao(
    ganhos.reduce((s, l) => s + Number(l.follow_ups_feitos ?? 0), 0),
    ganhos.length,
  );

  return {
    isAdmin: escopo.isAdmin,
    incompletos: incompletos ?? 0,
    dias: dias ?? 0,
    funil,
    anterior: funilAnterior,
    reunioes: metricasReunioes,
    segmentos,
    serie: meses,
    ranking,
    follow_ups_atrasados: atrasadosRes.count ?? 0,
    follow_ups_hoje: hojeRes.count ?? 0,
    cadencias_encerradas: encerradasRes.count ?? 0,
    media_tentativas_ate_ganho,
  };
}

export type DashboardComercial = Awaited<ReturnType<typeof dashboardComercialServer>>;

/* ------------------------------------------------------------------ *
 * Follow-ups: atrasados, de hoje e próximos, priorizados
 * ------------------------------------------------------------------ */

export interface FollowUp {
  id: string;
  nome_contato: string;
  empresa: string | null;
  telefone: string;
  email: string | null;
  segmento: string | null;
  origem: LeadOrigem;
  estagio: LeadEstagio;
  valor_estimado: number;
  proximo_contato: string;
  observacoes: string | null;
  vendedor_id: string;
  vendedor_nome?: string | null;
  /** Dias de atraso (0 = follow-up é hoje; negativo = ainda vai vencer). */
  atraso: number;
  /** Pontuação de prioridade (maior = mais urgente). */
  prioridade: number;
  /** Tentativas SEM resposta já registradas. */
  follow_ups_feitos: number;
  ultimo_contato_em: string | null;
  cadencia_encerrada: boolean;
}

export interface PainelFollowUps {
  isAdmin: boolean;
  hojeISO: string;
  atrasados: FollowUp[];
  hoje: FollowUp[];
  /** Follow-ups agendados entre amanhã e +7 dias. */
  proximos: FollowUp[];
  totalAtrasados: number;
  totalHoje: number;
  totalProximos: number;
  /** Leads com cadência encerrada e estágio ainda aberto. */
  totalEncerrados: number;
}

/** Peso do estágio na priorização: quanto mais perto do fechamento, mais urgente. */
const PESO_ESTAGIO: Record<string, number> = {
  em_negociacao: 40,
  interessado: 25,
  contatado: 10,
  nao_interessado: 2,
};

function diasEntre(deISO: string, ateISO: string): number {
  const a = new Date(`${deISO}T00:00:00`).getTime();
  const b = new Date(`${ateISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Soma dias a uma data ISO (AAAA-MM-DD) sem depender de fuso. */
function somarDias(baseISO: string, dias: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Prioridade = atraso + estágio + valor estimado (com teto), tudo em pontos. */
function pontuar(atraso: number, estagio: LeadEstagio, valor: number): number {
  const pAtraso = Math.min(atraso, 30) * 4;
  const pEstagio = PESO_ESTAGIO[estagio] ?? 0;
  const pValor = Math.min(valor / 100, 30);
  return Math.round(pAtraso + pEstagio + pValor);
}

const CAMPOS_FOLLOW_UP =
  "id, vendedor_id, nome_contato, empresa, telefone, email, segmento, origem, estagio, valor_estimado, observacoes, proximo_contato, follow_ups_feitos, ultimo_contato_em, cadencia_encerrada";

const SEM_FOLLOW_UP_SQL = `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`;

function mapearFollowUp(
  l: Record<string, unknown>,
  hoje: string,
  nomes: Map<string, string>,
): FollowUp {
  const proximo = String(l.proximo_contato);
  const atraso = diasEntre(proximo, hoje);
  const valor = Number(l.valor_estimado ?? 0);
  return {
    id: String(l.id),
    nome_contato: String(l.nome_contato),
    empresa: (l.empresa as string | null) ?? null,
    telefone: String(l.telefone ?? ""),
    email: (l.email as string | null) ?? null,
    segmento: (l.segmento as string | null) ?? null,
    origem: l.origem as LeadOrigem,
    estagio: l.estagio as LeadEstagio,
    valor_estimado: valor,
    proximo_contato: proximo,
    observacoes: (l.observacoes as string | null) ?? null,
    vendedor_id: String(l.vendedor_id),
    vendedor_nome: nomes.get(String(l.vendedor_id)) ?? null,
    atraso,
    prioridade: pontuar(Math.max(0, atraso), l.estagio as LeadEstagio, valor),
    follow_ups_feitos: Number(l.follow_ups_feitos ?? 0),
    ultimo_contato_em: (l.ultimo_contato_em as string | null) ?? null,
    cadencia_encerrada: Boolean(l.cadencia_encerrada),
  };
}

export async function followUpsServer(
  supabase: Sb,
  userId: string,
  filtros: z.infer<typeof followUpsSchema>,
): Promise<PainelFollowUps> {
  const escopo = await escopoComercial(supabase, userId);
  const hoje = hojeISO();
  const limite = filtros.limite ?? 50;
  const fim = somarDias(hoje, 7);

  let query = supabase
    .from("leads")
    .select(CAMPOS_FOLLOW_UP)
    .not("proximo_contato", "is", null)
    .lte("proximo_contato", fim)
    .not("estagio", "in", SEM_FOLLOW_UP_SQL)
    .order("proximo_contato", { ascending: true })
    .limit(400);

  let queryEncerrados = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("cadencia_encerrada", true)
    .not("estagio", "in", SEM_FOLLOW_UP_SQL);

  // Vendedor: a RLS já restringe aos leads dele; o filtro é só para o admin.
  if (escopo.isAdmin && filtros.vendedor_id) {
    query = query.eq("vendedor_id", filtros.vendedor_id);
    queryEncerrados = queryEncerrados.eq("vendedor_id", filtros.vendedor_id);
  }

  const [{ data, error }, { count: encerrados }] = await Promise.all([query, queryEncerrados]);
  if (error) throw new Error(error.message);

  const nomes = escopo.isAdmin
    ? await nomesVendedores((data ?? []).map((l: { vendedor_id: string }) => l.vendedor_id))
    : new Map<string, string>();

  const itens: FollowUp[] = (data ?? []).map((l: Record<string, unknown>) =>
    mapearFollowUp(l, hoje, nomes),
  );

  const ordenar = (a: FollowUp, b: FollowUp) =>
    b.prioridade - a.prioridade || b.valor_estimado - a.valor_estimado;
  const porData = (a: FollowUp, b: FollowUp) =>
    a.proximo_contato.localeCompare(b.proximo_contato) || ordenar(a, b);

  const atrasados = itens.filter((i) => i.atraso > 0).sort(ordenar);
  const deHoje = itens.filter((i) => i.atraso === 0).sort(ordenar);
  const proximos = itens.filter((i) => i.atraso < 0).sort(porData);

  return {
    isAdmin: escopo.isAdmin,
    hojeISO: hoje,
    atrasados: atrasados.slice(0, limite),
    hoje: deHoje.slice(0, limite),
    proximos: proximos.slice(0, limite),
    totalAtrasados: atrasados.length,
    totalHoje: deHoje.length,
    totalProximos: proximos.length,
    totalEncerrados: encerrados ?? 0,
  };
}

/** Reagenda o próximo contato do lead (RLS garante o escopo). */
export async function reagendarFollowUpServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof reagendarFollowUpSchema>,
) {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase
    .from("leads")
    .update({ proximo_contato: dados.proximo_contato, cadencia_encerrada: false })
    .eq("id", dados.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");
  return { id: data.id as string };
}

/** Pergunta a data seguinte à régua do banco (fonte única da cadência). */
async function proximaData(
  supabase: Sb,
  estagio: LeadEstagio,
  tentativas: number,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("lead_proximo_follow_up", {
    _estagio: estagio,
    _tentativas: tentativas,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

const RESULTADO_LABEL: Record<string, string> = {
  sem_resposta: "Sem resposta",
  respondeu: "Respondeu",
  adiar: "Adiado",
};

/**
 * Registra o resultado de um toque de follow-up.
 * A régua de datas vive no banco: aqui só decidimos tentativas e adiamentos.
 */
export async function registrarFollowUpServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof registrarFollowUpSchema>,
) {
  await escopoComercial(supabase, userId);

  const { data: lead, error: erroLead } = await supabase
    .from("leads")
    .select("id, estagio, follow_ups_feitos")
    .eq("id", dados.lead_id)
    .maybeSingle();
  if (erroLead) throw new Error(erroLead.message);
  if (!lead) throw new Error("Lead não encontrado ou você não tem permissão.");

  const patch: Record<string, unknown> = { ultimo_contato_em: new Date().toISOString() };
  let detalhe = "";

  if (dados.resultado === "respondeu") {
    if (!dados.novo_estagio) throw new Error("Informe o novo estágio do lead.");
    // A trigger do banco zera as tentativas e recalcula a próxima data.
    patch.estagio = dados.novo_estagio;
    detalhe = `novo estágio: ${dados.novo_estagio}`;
  } else if (dados.resultado === "adiar") {
    if (!dados.adiar_dias) throw new Error("Informe em quantos dias adiar.");
    // Adiar não gasta tentativa.
    patch.proximo_contato = somarDias(hojeISO(), dados.adiar_dias);
    patch.cadencia_encerrada = false;
    detalhe = `adiado ${dados.adiar_dias} dia(s)`;
  } else {
    const tentativas = Number(lead.follow_ups_feitos ?? 0) + 1;
    const proxima = await proximaData(supabase, lead.estagio as LeadEstagio, tentativas);
    patch.follow_ups_feitos = tentativas;
    patch.proximo_contato = proxima;
    patch.cadencia_encerrada = proxima === null;
    detalhe = proxima
      ? `${tentativas}ª tentativa · próximo contato ${proxima}`
      : `${tentativas}ª tentativa · cadência encerrada`;
  }

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", dados.lead_id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");

  await supabase.from("lead_atividades").insert({
    lead_id: dados.lead_id,
    autor_id: userId,
    tipo: "contato",
    para: dados.resultado,
    corpo: [`${RESULTADO_LABEL[dados.resultado]} — ${detalhe}`, dados.nota ?? ""]
      .filter(Boolean)
      .join("\n"),
  });

  return { id: data.id as string };
}

/** Traz de volta um lead com a cadência encerrada, zerando as tentativas. */
export async function reativarCadenciaServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof reativarCadenciaSchema>,
) {
  await escopoComercial(supabase, userId);

  const { data: lead, error: erroLead } = await supabase
    .from("leads")
    .select("id, estagio")
    .eq("id", dados.lead_id)
    .maybeSingle();
  if (erroLead) throw new Error(erroLead.message);
  if (!lead) throw new Error("Lead não encontrado ou você não tem permissão.");
  if (ESTAGIOS_SEM_FOLLOW_UP.includes(lead.estagio as LeadEstagio)) {
    throw new Error("Leads ganhos ou perdidos não recebem follow-up.");
  }

  const proxima = await proximaData(supabase, lead.estagio as LeadEstagio, 0);
  const { data, error } = await supabase
    .from("leads")
    .update({
      follow_ups_feitos: 0,
      cadencia_encerrada: false,
      proximo_contato: proxima,
      ultimo_contato_em: new Date().toISOString(),
    })
    .eq("id", dados.lead_id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");

  await supabase.from("lead_atividades").insert({
    lead_id: dados.lead_id,
    autor_id: userId,
    tipo: "contato",
    para: "reativado",
    corpo: `Cadência reativada · próximo contato ${proxima ?? "—"}`,
  });

  return { id: data.id as string };
}

/** Contador leve para o badge da sidebar: atrasados + de hoje. */
export async function contarFollowUpsServer(supabase: Sb, userId: string) {
  const escopo = await escopoComercial(supabase, userId).catch(() => null);
  if (!escopo) return { atrasados: 0, hoje: 0, total: 0 };
  const hoje = hojeISO();
  const semFollowUp = `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`;
  const contar = (aplicar: (q: unknown) => unknown) => {
    const q = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("estagio", "in", semFollowUp);
    return aplicar(q) as Promise<{ count: number | null }>;
  };
  const [atrasados, deHoje] = await Promise.all([
    contar((q) => (q as Sb).not("proximo_contato", "is", null).lt("proximo_contato", hoje)),
    contar((q) => (q as Sb).eq("proximo_contato", hoje)),
  ]);
  const a = atrasados.count ?? 0;
  const h = deHoje.count ?? 0;
  return { atrasados: a, hoje: h, total: a + h };
}
