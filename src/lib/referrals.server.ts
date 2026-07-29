import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SB = { from: (t: string) => any };

export interface ReferralMetrics {
  visitantes: number;
  leads: number;
  conversoes: number;
}

/**
 * Visitantes  = sessões distintas que abriram o link de indicação.
 * Leads       = clientes que se cadastraram pelo link.
 * Conversões  = desses leads, quantos já tiveram um pagamento confirmado.
 */
export async function calcularReferrals(
  supabase: SB,
  userId: string,
): Promise<ReferralMetrics> {
  const { data: vend } = await supabase
    .from("vendedores")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!vend) return { visitantes: 0, leads: 0, conversoes: 0 };
  const vendedorId = vend.id as string;

  const { count: visitantes } = await supabaseAdmin
    .from("referral_visitas")
    .select("id", { count: "exact", head: true })
    .eq("vendedor_id", vendedorId);

  const { data: leadsRows } = await supabaseAdmin
    .from("clientes")
    .select("id")
    .eq("vendedor_id", vendedorId)
    .eq("via_link", true);

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

  return { visitantes: visitantes ?? 0, leads: ids.length, conversoes };
}
