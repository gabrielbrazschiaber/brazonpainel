import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codigoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Código de cupom inválido."),
});

/**
 * Validação pública do cupom (usada na página de cadastro/compra).
 * Sem cliente ainda existente: valida apenas código, validade e limite de usos.
 */
export const validarCupomPublico = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => codigoSchema.parse(data))
  .handler(async ({ data }) => {
    const { buscarCupomAtivo, MENSAGENS_CUPOM } = await import("./cupons.server");
    const res = await buscarCupomAtivo(data.codigo);
    if ("motivo" in res) {
      return { valido: false as const, mensagem: MENSAGENS_CUPOM[res.motivo] };
    }
    return {
      valido: true as const,
      codigo: res.cupom.codigo,
      descricao: res.cupom.descricao,
      valor_desconto: res.cupom.valor_desconto,
      apenas_primeira_mensalidade: res.cupom.apenas_primeira_mensalidade,
    };
  });

/**
 * Validação do cupom para o cliente autenticado (checa reuso, cupom ativo
 * já existente e se ainda é a primeira mensalidade).
 */
export const validarMeuCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => codigoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const { validarCupomParaCliente, MENSAGENS_CUPOM } = await import("./cupons.server");
    const res = await validarCupomParaCliente(data.codigo, cliente?.id ?? null);

    if ("motivo" in res) {
      return { valido: false as const, mensagem: MENSAGENS_CUPOM[res.motivo] };
    }
    return {
      valido: true as const,
      codigo: res.cupom.codigo,
      descricao: res.cupom.descricao,
      valor_desconto: res.cupom.valor_desconto,
      apenas_primeira_mensalidade: res.cupom.apenas_primeira_mensalidade,
    };
  });

function formatarDestaque(
  data: {
    codigo: string;
    descricao: string | null;
    valor_desconto: number | string;
    apenas_primeira_mensalidade: boolean;
    validade: string | null;
  } | null,
) {
  if (!data) return null;
  if (data.validade && new Date(data.validade).getTime() <= Date.now()) return null;
  return {
    codigo: data.codigo,
    descricao: data.descricao,
    valor_desconto: Number(data.valor_desconto),
    apenas_primeira_mensalidade: data.apenas_primeira_mensalidade,
  };
}

const CAMPOS_DESTAQUE =
  "codigo, descricao, valor_desconto, apenas_primeira_mensalidade, validade, ativo";

/**
 * Cupom em destaque para o usuário logado.
 * Vendedor vê o cupom dele ou um cupom global; nunca o cupom de outro vendedor.
 */
export const cupomEmDestaque = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: vend } = await supabase
      .from("vendedores")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let query = supabaseAdmin.from("cupons").select(CAMPOS_DESTAQUE).eq("ativo", true);
    query = vend?.id
      ? query.or(`vendedor_id.eq.${vend.id},vendedor_id.is.null`)
      : query.is("vendedor_id", null);

    const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    return formatarDestaque(data);
  });

/** Variante pública: apenas cupons globais (sem vendedor dono). */
export const cupomEmDestaquePublico = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("cupons")
    .select(CAMPOS_DESTAQUE)
    .eq("ativo", true)
    .is("vendedor_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return formatarDestaque(data);
});
