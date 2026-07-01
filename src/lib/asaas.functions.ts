import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const gerarCobrancaSchema = z.object({
  plano_id: z.string().uuid(),
  tipoPagamento: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]),
});

/**
 * Cliente autenticado gera uma cobrança no Asaas para renovar a assinatura.
 * O valor é sempre calculado no servidor (plano + serviço extra), nunca confiando no cliente.
 */
export const gerarCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => gerarCobrancaSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Busca o cliente do usuário autenticado (RLS garante que é o dele).
    const { data: cliente, error: cliErr } = await supabase
      .from("clientes")
      .select("id, plano_id, servico_extra_valor")
      .eq("user_id", userId)
      .maybeSingle();

    if (cliErr || !cliente) {
      throw new Error("Cliente não encontrado para o usuário atual.");
    }

    // 2. Busca o plano escolhido (valor da fonte da verdade: o banco).
    const { data: plano, error: planoErr } = await supabase
      .from("planos")
      .select("id, nome, valor, ativo")
      .eq("id", data.plano_id)
      .maybeSingle();

    if (planoErr || !plano || !plano.ativo) {
      throw new Error("Plano inválido ou indisponível.");
    }

    const valorTotal = Number(plano.valor) + Number(cliente.servico_extra_valor ?? 0);

    // 3. Vencimento padrão: 3 dias a partir de hoje (formato YYYY-MM-DD).
    const venc = new Date();
    venc.setDate(venc.getDate() + 3);
    const dataVencimento = venc.toISOString().split("T")[0];

    // 4. Gera a cobrança via Asaas (importado dentro do handler — server-only).
    const { gerarCobrancaAsaas } = await import("./asaas.server");

    const resultado = await gerarCobrancaAsaas({
      clienteId: cliente.id,
      valor: valorTotal,
      tipoPagamento: data.tipoPagamento,
      dataVencimento,
      descricao: `Renovação Brazon - ${plano.nome}`,
    });

    return {
      invoiceUrl: resultado.invoiceUrl as string | null,
      bankSlipUrl: resultado.bankSlipUrl as string | null,
      pixCopyPaste: resultado.pixCopyPaste as string | null,
      status: resultado.status as string,
    };
  });

/**
 * Admin testa a chave/ambiente do Asaas configurado.
 */
export const testarChaveAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Apenas administradores podem testar a chave do Asaas.");
    }

    const { testarConexaoAsaas } = await import("./asaas.server");
    return await testarConexaoAsaas();
  });
