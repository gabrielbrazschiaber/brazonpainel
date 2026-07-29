import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const criarSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, "Use apenas letras e números."),
});

/** Vendedor cria um cupom próprio com desconto fixo de R$ 100 na primeira mensalidade. */
export const criarCupomVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { criarCupomDoVendedor } = await import("./cupons.vendedor.server");
    return criarCupomDoVendedor(context.supabase, context.userId, data.codigo);
  });

/** Lista os cupons criados pelo vendedor logado, com o total de usos. */
export const listarMeusCupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarCuponsDoVendedor } = await import("./cupons.vendedor.server");
    return listarCuponsDoVendedor(context.supabase, context.userId);
  });

/** Ativa/desativa um cupom do próprio vendedor. */
export const alternarMeuCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ cupom_id: z.string().uuid(), ativo: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { alternarCupomDoVendedor } = await import("./cupons.vendedor.server");
    return alternarCupomDoVendedor(context.supabase, context.userId, data.cupom_id, data.ativo);
  });
