import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Métricas do link de indicação do vendedor logado. */
export const meusReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { calcularReferrals } = await import("./referrals.server");
    return calcularReferrals(context.supabase, context.userId);
  });
