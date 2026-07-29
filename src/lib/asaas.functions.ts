import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";

const gerarCobrancaSchema = z.object({
  plano_id: z.string().uuid(),
  tipoPagamento: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]),
  cupom: z.string().trim().max(40).optional().nullable(),
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
      .select("id, plano_id, servico_extra_valor, cupom_pendente_id, asaas_subscription_id")
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

    // 3. Cupom: validado inteiramente no servidor. O código informado tem
    //    prioridade; sem código, usa o cupom reservado no cadastro.
    const {
      validarCupomParaCliente,
      registrarUsoCupom,
      buscarCupomAtivo,
      MENSAGENS_CUPOM,
    } = await import("./cupons.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let codigoCupom = (data.cupom ?? "").trim();
    if (!codigoCupom && cliente.cupom_pendente_id) {
      const { data: pend } = await supabaseAdmin
        .from("cupons")
        .select("codigo")
        .eq("id", cliente.cupom_pendente_id)
        .maybeSingle();
      codigoCupom = pend?.codigo ?? "";
    }

    let cupomAplicado: { id: string; codigo: string; valor: number } | null = null;
    if (codigoCupom) {
      const res = await validarCupomParaCliente(codigoCupom, cliente.id);
      if ("motivo" in res) {
        // Uso indevido/duplicado do cupom bloqueia a operação com mensagem clara.
        throw new Error(MENSAGENS_CUPOM[res.motivo]);
      }
      // Cupom de primeira mensalidade só vale quando ainda não há assinatura.
      if (res.cupom.apenas_primeira_mensalidade && cliente.asaas_subscription_id) {
        throw new Error(MENSAGENS_CUPOM.nao_e_primeira_mensalidade);
      }
      cupomAplicado = {
        id: res.cupom.id,
        codigo: res.cupom.codigo,
        valor: res.cupom.valor_desconto,
      };
    } else {
      // Mantém o comportamento silencioso quando não há cupom informado.
      void buscarCupomAtivo;
    }

    // 4. Primeiro vencimento: 3 dias a partir de hoje (os próximos ciclos são mensais).
    const venc = new Date();
    venc.setDate(venc.getDate() + 3);
    const dataVencimento = venc.toISOString().split("T")[0];

    // 5. Gera a cobrança via Asaas (importado dentro do handler — server-only).
    const { gerarCobrancaAsaas } = await import("./asaas.server");

    const resultado = await gerarCobrancaAsaas({
      clienteId: cliente.id,
      valor: valorTotal,
      tipoPagamento: data.tipoPagamento,
      dataVencimento,
      descricao: `Assinatura mensal Brazon - ${plano.nome}`,
      descontoPrimeiraMensalidade: cupomAplicado?.valor ?? 0,
    });

    // 6. Só registra o uso do cupom se o desconto realmente entrou na cobrança.
    let descontoAplicado = 0;
    if (cupomAplicado && Number(resultado.descontoAplicado ?? 0) > 0) {
      const registrado = await registrarUsoCupom({
        cupomId: cupomAplicado.id,
        clienteId: cliente.id,
        userId,
        valorDesconto: Number(resultado.descontoAplicado),
        pagamentoId: resultado.pagamentoIdLocal ?? null,
        asaasPaymentId: resultado.asaasPaymentId ?? null,
      });
      if (registrado) descontoAplicado = Number(resultado.descontoAplicado);
    }

    return {
      invoiceUrl: resultado.invoiceUrl as string | null,
      bankSlipUrl: resultado.bankSlipUrl as string | null,
      pixCopyPaste: resultado.pixCopyPaste as string | null,
      status: resultado.status as string,
      recorrente: true as const,
      assinaturaId: resultado.assinaturaId as string,
      cupom: descontoAplicado > 0 ? cupomAplicado!.codigo : null,
      descontoAplicado,
    };
  });


/**
 * Admin testa a chave/ambiente do Asaas configurado.
 */
export const testarChaveAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { testarConexaoAsaas } = await import("./asaas.server");
    return await testarConexaoAsaas();
  });
