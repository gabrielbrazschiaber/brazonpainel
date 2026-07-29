import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Período em dias (0 ou ausente = todo o histórico). */
function validarPeriodo(input: unknown): { dias: number | null } {
  const raw = (input as { dias?: unknown } | undefined)?.dias;
  const n = typeof raw === "number" ? Math.floor(raw) : 0;
  return { dias: n > 0 ? Math.min(n, 3650) : null };
}

/** Métricas do link de indicação do vendedor logado. */
export const meusReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validarPeriodo)
  .handler(async ({ data, context }) => {
    const { calcularReferrals } = await import("./referrals.server");
    return calcularReferrals(context.supabase, context.userId, data.dias);
  });

/** Lista detalhada dos leads vindos do link de indicação. */
export const meusLeadsReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validarPeriodo)
  .handler(async ({ data, context }) => {
    const { listarLeadsReferral } = await import("./referrals.server");
    return listarLeadsReferral(context.supabase, context.userId, data.dias);
  });
