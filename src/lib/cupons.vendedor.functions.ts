import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Valor fixo de desconto dos cupons criados por vendedores (primeira mensalidade). */
export const VALOR_CUPOM_VENDEDOR = 100;

const criarSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, "Use apenas letras e números."),
});

/** Confirma que o usuário logado é um vendedor ativo e devolve o id do vendedor. */
async function vendedorAtual(supabase: any, userId: string) {
  const { data: vend } = await supabase
    .from("vendedores")
    .select("id, ativo")
    .eq("user_id", userId)
    .maybeSingle();
  if (!vend || !vend.ativo) throw new Error("Cadastro de vendedor não encontrado ou inativo.");
  return vend.id as string;
}

/** Vendedor cria um cupom próprio com desconto fixo de R$ 100 na primeira mensalidade. */
export const criarCupomVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const vendedorId = await vendedorAtual(supabase, userId);

    const codigo = data.codigo.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existente } = await supabaseAdmin
      .from("cupons")
      .select("id")
      .ilike("codigo", codigo)
      .maybeSingle();
    if (existente) throw new Error("Este código já está em uso. Escolha outro.");

    const { error } = await supabaseAdmin.from("cupons").insert({
      codigo,
      descricao: `R$ ${VALOR_CUPOM_VENDEDOR},00 de desconto na primeira mensalidade`,
      tipo: "valor_fixo",
      valor_desconto: VALOR_CUPOM_VENDEDOR,
      apenas_primeira_mensalidade: true,
      ativo: true,
      vendedor_id: vendedorId,
    });
    if (error) throw new Error("Não foi possível criar o cupom.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "vendedor",
      acao: "criar_cupom",
      entidade: "cupom",
      entidadeId: null,
      detalhes: { codigo, valor_desconto: VALOR_CUPOM_VENDEDOR },
    });

    return { ok: true, codigo };
  });

/** Lista os cupons criados pelo vendedor logado, com o total de usos. */
export const listarMeusCupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const vendedorId = await vendedorAtual(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cupons } = await supabaseAdmin
      .from("cupons")
      .select("id, codigo, valor_desconto, ativo, usos, created_at")
      .eq("vendedor_id", vendedorId)
      .order("created_at", { ascending: false });

    const lista = cupons ?? [];
    const resultado = [] as Array<{
      id: string;
      codigo: string;
      valor_desconto: number;
      ativo: boolean;
      usos: number;
      clientes: number;
    }>;

    for (const c of lista) {
      const { count } = await supabaseAdmin
        .from("cupom_usos")
        .select("id", { count: "exact", head: true })
        .eq("cupom_id", c.id);
      resultado.push({
        id: c.id,
        codigo: c.codigo,
        valor_desconto: Number(c.valor_desconto),
        ativo: c.ativo,
        usos: Number(c.usos ?? 0),
        clientes: count ?? 0,
      });
    }

    return resultado;
  });

const alternarSchema = z.object({ cupom_id: z.string().uuid(), ativo: z.boolean() });

/** Ativa/desativa um cupom do próprio vendedor. */
export const alternarMeuCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => alternarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const vendedorId = await vendedorAtual(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: upd } = await supabaseAdmin
      .from("cupons")
      .update({ ativo: data.ativo })
      .eq("id", data.cupom_id)
      .eq("vendedor_id", vendedorId)
      .select("id")
      .maybeSingle();
    if (!upd) throw new Error("Cupom não encontrado.");

    return { ok: true };
  });
