/** Leads: listagem, CRUD, atividades e reuniões. */
import {
  CAMPOS_LEAD,
  escopoComercial,
  hojeISO,
  dataLimite,
  nomesVendedores,
  nomesDeUsuarios,
} from "@/lib/leads-base.server";
import type { Sb, Lead } from "@/lib/leads-base.server";
import { ESTAGIOS_SEM_FOLLOW_UP, apenasDigitos } from "@/lib/leads";
import type { ReuniaoStatus } from "@/lib/leads";
import type { z } from "zod";
import type {
  listarLeadsSchema,
  salvarLeadSchema,
  mudarEstagioSchema,
  salvarReuniaoSchema,
} from "@/lib/leads.schemas";

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

  if (filtros.apenas_follow_up || filtros.apenas_atrasados) {
    query = query
      .not("proximo_contato", "is", null)
      .not("estagio", "in", `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`);
    query = filtros.apenas_atrasados
      ? query.lt("proximo_contato", hojeISO())
      : query.lte("proximo_contato", hojeISO());
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

export async function registrarEnvioMensagemServer(
  supabase: Sb,
  userId: string,
  dados: { lead_id: string; mensagem_id: string },
) {
  await escopoComercial(supabase, userId);

  // Busca o histórico atual
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("mensagens_enviadas")
    .eq("id", dados.lead_id)
    .single();

  if (leadError) throw new Error(leadError.message);

  const historico = Array.isArray(lead.mensagens_enviadas) ? lead.mensagens_enviadas : [];
  
  // Evita duplicatas no histórico de IDs
  if (!historico.includes(dados.mensagem_id)) {
    const novoHistorico = [...historico, dados.mensagem_id];
    
    const { error: updateError } = await supabase
      .from("leads")
      .update({ mensagens_enviadas: novoHistorico })
      .eq("id", dados.lead_id);

    if (updateError) throw new Error(updateError.message);
  }

  return { ok: true };
}
