import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Regras de cupom de desconto.
 *
 * Toda validação acontece no servidor: o navegador nunca decide valor de
 * desconto nem elegibilidade. O cupom "100OFF" (R$ 100,00) é válido apenas
 * na PRIMEIRA mensalidade e apenas uma vez por cliente.
 */

export interface CupomValido {
  id: string;
  codigo: string;
  descricao: string | null;
  valor_desconto: number;
  apenas_primeira_mensalidade: boolean;
}

export type MotivoCupom =
  | "codigo_invalido"
  | "expirado"
  | "esgotado"
  | "ja_utilizado"
  | "cliente_ja_tem_cupom"
  | "nao_e_primeira_mensalidade";

export const MENSAGENS_CUPOM: Record<MotivoCupom, string> = {
  codigo_invalido: "Cupom inválido ou indisponível.",
  expirado: "Este cupom expirou.",
  esgotado: "Este cupom atingiu o limite de utilizações.",
  ja_utilizado: "Você já utilizou este cupom.",
  cliente_ja_tem_cupom: "Sua conta já possui um cupom de desconto aplicado.",
  nao_e_primeira_mensalidade:
    "O cupom 100OFF vale somente para a primeira mensalidade da sua assinatura.",
};

/** Normaliza o código digitado (case-insensitive, sem espaços). */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, "");
}

/** Busca o cupom ativo e dentro da validade/limite de usos. */
export async function buscarCupomAtivo(
  codigo: string
): Promise<{ cupom: CupomValido } | { motivo: MotivoCupom }> {
  const cod = normalizarCodigo(codigo);
  if (!cod) return { motivo: "codigo_invalido" };

  const { data } = await supabaseAdmin
    .from("cupons")
    .select("id, codigo, descricao, valor_desconto, apenas_primeira_mensalidade, ativo, validade, max_usos, usos")
    .ilike("codigo", cod)
    .maybeSingle();

  if (!data || !data.ativo) return { motivo: "codigo_invalido" };
  if (data.validade && new Date(data.validade).getTime() <= Date.now()) {
    return { motivo: "expirado" };
  }
  if (data.max_usos !== null && Number(data.usos) >= Number(data.max_usos)) {
    return { motivo: "esgotado" };
  }

  return {
    cupom: {
      id: data.id,
      codigo: data.codigo,
      descricao: data.descricao,
      valor_desconto: Number(data.valor_desconto),
      apenas_primeira_mensalidade: data.apenas_primeira_mensalidade,
    },
  };
}

/**
 * Valida o cupom para um cliente específico (elegibilidade completa).
 * Um cliente só pode ter um cupom e, no caso do cupom de primeira
 * mensalidade, ele precisa ainda não ter nenhum pagamento confirmado.
 */
export async function validarCupomParaCliente(
  codigo: string,
  clienteId: string | null
): Promise<{ cupom: CupomValido } | { motivo: MotivoCupom }> {
  const base = await buscarCupomAtivo(codigo);
  if ("motivo" in base) return base;
  if (!clienteId) return base;

  const { data: usoExistente } = await supabaseAdmin
    .from("cupom_usos")
    .select("id, cupom_id")
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (usoExistente) {
    return {
      motivo: usoExistente.cupom_id === base.cupom.id ? "ja_utilizado" : "cliente_ja_tem_cupom",
    };
  }

  if (base.cupom.apenas_primeira_mensalidade) {
    const { count } = await supabaseAdmin
      .from("pagamentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .eq("status", "pago");

    if ((count ?? 0) > 0) return { motivo: "nao_e_primeira_mensalidade" };
  }

  return base;
}

/**
 * Calcula o valor com desconto, nunca abaixo do mínimo aceito pelo Asaas.
 */
export function aplicarDesconto(valor: number, desconto: number): number {
  const MIN = 5;
  const final = Math.round((valor - desconto) * 100) / 100;
  return final < MIN ? MIN : final;
}

/**
 * Registra o uso do cupom com o máximo de contexto possível: cliente, cupom,
 * pagamento gerado, plano, vendedor responsável, valores e origem do uso.
 * O índice único por cliente é a proteção real contra corrida/fraude.
 */
export async function registrarUsoCupom(params: {
  cupomId: string;
  clienteId: string;
  userId: string | null;
  valorDesconto: number;
  pagamentoId?: string | null;
  asaasPaymentId?: string | null;
  asaasSubscriptionId?: string | null;
  codigo?: string | null;
  valorOriginal?: number | null;
  origem?: "cadastro_publico" | "renovacao_cliente" | "admin" | "vendedor" | "desconhecida";
}): Promise<boolean> {
  // Contexto extra do cliente (vendedor e plano no momento do uso).
  const { data: cli } = await supabaseAdmin
    .from("clientes")
    .select("vendedor_id, plano_id")
    .eq("id", params.clienteId)
    .maybeSingle();

  const { data: cupomInfo } = await supabaseAdmin
    .from("cupons")
    .select("codigo")
    .eq("id", params.cupomId)
    .maybeSingle();

  const valorOriginal = Number(params.valorOriginal ?? 0);
  const valorFinal = Math.max(0, Math.round((valorOriginal - params.valorDesconto) * 100) / 100);

  const { error } = await supabaseAdmin.from("cupom_usos").insert({
    cupom_id: params.cupomId,
    cliente_id: params.clienteId,
    user_id: params.userId,
    valor_desconto: params.valorDesconto,
    pagamento_id: params.pagamentoId ?? null,
    asaas_payment_id: params.asaasPaymentId ?? null,
    asaas_subscription_id: params.asaasSubscriptionId ?? null,
    codigo: params.codigo ?? cupomInfo?.codigo ?? null,
    vendedor_id: cli?.vendedor_id ?? null,
    plano_id: cli?.plano_id ?? null,
    valor_original: valorOriginal,
    valor_final: valorOriginal > 0 ? valorFinal : 0,
    origem: params.origem ?? "desconhecida",
  });

  if (error) {
    console.error("[Cupom] Uso não registrado (provável duplicidade):", error.message);
    return false;
  }


  const { data: atual } = await supabaseAdmin
    .from("cupons")
    .select("usos")
    .eq("id", params.cupomId)
    .maybeSingle();

  await supabaseAdmin
    .from("cupons")
    .update({ usos: Number(atual?.usos ?? 0) + 1 })
    .eq("id", params.cupomId);

  // O cupom pendente já foi consumido.
  await supabaseAdmin
    .from("clientes")
    .update({ cupom_pendente_id: null })
    .eq("id", params.clienteId);

  return true;
}

/** Desfaz a reserva de um cupom quando a cobrança não foi concluída. */
export async function liberarCupomPendente(clienteId: string) {
  await supabaseAdmin.from("clientes").update({ cupom_pendente_id: null }).eq("id", clienteId);
}
