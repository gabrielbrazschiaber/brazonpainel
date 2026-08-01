import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ClienteSupabaseUsuario } from "@/lib/supabase-tipos";

type SB = ClienteSupabaseUsuario;

export interface ReferralMetrics {
  visitantes: number;
  leads: number;
  pendentes: number;
  conversoes: number;
}

/** Converte um período em dias na data-limite ISO (null = todo o histórico). */
export function inicioPeriodo(dias?: number | null): string | null {
  if (!dias || dias <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function vendedorDoUsuario(supabase: SB, userId: string) {
  const { data } = await supabase
    .from("vendedores")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Visitantes  = sessões distintas que abriram o link de indicação.
 * Leads       = clientes que se cadastraram pelo link.
 * Pendentes   = leads que ainda não tiveram pagamento confirmado.
 * Conversões  = leads que já tiveram um pagamento confirmado.
 */
export async function calcularReferrals(
  supabase: SB,
  userId: string,
  dias?: number | null,
): Promise<ReferralMetrics> {
  const vendedorId = await vendedorDoUsuario(supabase, userId);
  const vazio = { visitantes: 0, leads: 0, pendentes: 0, conversoes: 0 };
  if (!vendedorId) return vazio;

  const desde = inicioPeriodo(dias);

  let qVisitas = supabaseAdmin
    .from("referral_visitas")
    .select("id", { count: "exact", head: true })
    .eq("vendedor_id", vendedorId);
  if (desde) qVisitas = qVisitas.gte("created_at", desde);
  const { count: visitantes } = await qVisitas;

  let qLeads = supabaseAdmin
    .from("clientes")
    .select("id")
    .eq("vendedor_id", vendedorId)
    .eq("via_link", true);
  if (desde) qLeads = qLeads.gte("created_at", desde);
  const { data: leadsRows } = await qLeads;

  const ids = (leadsRows ?? []).map((c: { id: string }) => c.id);
  let conversoes = 0;
  if (ids.length) {
    const { data: pagos } = await supabaseAdmin
      .from("pagamentos")
      .select("cliente_id")
      .in("cliente_id", ids)
      .eq("status", "pago");
    conversoes = new Set((pagos ?? []).map((p: { cliente_id: string }) => p.cliente_id)).size;
  }

  return {
    visitantes: visitantes ?? 0,
    leads: ids.length,
    pendentes: ids.length - conversoes,
    conversoes,
  };
}

export interface ReferralLead {
  clienteId: string;
  nome: string;
  email: string;
  cadastradoEm: string;
  primeiroPagamentoEm: string | null;
  status: "visita" | "cadastro" | "pago";
}

/** Detalhe da jornada de cada lead vindo do link do vendedor. */
export async function listarLeadsReferral(
  supabase: SB,
  userId: string,
  dias?: number | null,
): Promise<ReferralLead[]> {
  const vendedorId = await vendedorDoUsuario(supabase, userId);
  if (!vendedorId) return [];

  const desde = inicioPeriodo(dias);
  let qLeads = supabaseAdmin
    .from("clientes")
    .select("id, user_id, created_at")
    .eq("vendedor_id", vendedorId)
    .eq("via_link", true)
    .order("created_at", { ascending: false });
  if (desde) qLeads = qLeads.gte("created_at", desde);
  const { data: leads } = await qLeads;

  const rows = leads ?? [];
  if (!rows.length) return [];

  const userIds = rows.map((c: { user_id: string }) => c.user_id).filter(Boolean);
  const clienteIds = rows.map((c: { id: string }) => c.id);

  const [{ data: perfis }, { data: pagos }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, nome, email").in("id", userIds),
    supabaseAdmin
      .from("pagamentos")
      .select("cliente_id, data_pagamento, created_at")
      .in("cliente_id", clienteIds)
      .eq("status", "pago")
      .order("created_at", { ascending: true }),
  ]);

  const perfilPorId = new Map(
    (perfis ?? []).map((p: { id: string; nome: string; email: string }) => [p.id, p]),
  );
  const primeiroPagamento = new Map<string, string>();
  for (const p of pagos ?? []) {
    if (!primeiroPagamento.has(p.cliente_id)) {
      primeiroPagamento.set(p.cliente_id, p.data_pagamento ?? p.created_at);
    }
  }

  return rows.map((c: { id: string; user_id: string; created_at: string }) => {
    const perfil = perfilPorId.get(c.user_id);
    const pagoEm = primeiroPagamento.get(c.id) ?? null;
    return {
      clienteId: c.id,
      nome: perfil?.nome || "—",
      email: perfil?.email || "—",
      cadastradoEm: c.created_at,
      primeiroPagamentoEm: pagoEm,
      status: pagoEm ? "pago" : "cadastro",
    } as ReferralLead;
  });
}
