import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

type PagamentoStatus = 'pago' | 'pendente' | 'vencido';
type ClienteStatus = 'ativo' | 'vencido' | 'inadimplente' | 'cancelado';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Asaas Webhook] Variáveis do Supabase ausentes no ambiente.')
    return new Response('Erro interno de configuração', { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  let payload: Record<string, unknown> = {};

  try {
    payload = await req.json()
    console.log('[Asaas Webhook] Evento recebido:', JSON.stringify(payload, null, 2))

    const event = payload.event as string | undefined
    const payment = payload.payment as Record<string, unknown> | undefined

    if (!event || !payment) {
      // Loga o payload inválido para depuração
      await logWebhook(supabase, {
        event: event || 'UNKNOWN',
        paymentId: null,
        status: null,
        payload,
        result: 'REJECTED',
        error: 'Payload inválido: event ou payment ausente'
      })
      return new Response('Payload inválido', { status: 400 })
    }

    const asaasPaymentId = payment.id as string
    const asaasStatus = payment.status as string

    // Mapeamento do status de pagamento do Asaas para o banco local
    let mappedPaymentStatus: PagamentoStatus = 'pendente'
    if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasStatus)) {
      mappedPaymentStatus = 'pago'
    } else if (['OVERDUE', 'RESTORED'].includes(asaasStatus)) {
      mappedPaymentStatus = 'vencido'
    } else if (['REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'REFUND_REQUESTED'].includes(asaasStatus)) {
      mappedPaymentStatus = 'vencido'
    }

    console.log(`[Asaas Webhook] Pagamento ${asaasPaymentId}: ${asaasStatus} -> ${mappedPaymentStatus}`)

    // 1. Atualizar a tabela de pagamentos
    const { data: updatedPayments, error: paymentErr } = await supabase
      .from('pagamentos')
      .update({
        status: mappedPaymentStatus,
        data_pagamento: mappedPaymentStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString()
      })
      .eq('asaas_payment_id', asaasPaymentId)
      .select('id, cliente_id, valor')

    if (paymentErr) {
      console.error('[Asaas Webhook] Erro ao atualizar pagamentos:', paymentErr.message)
      await logWebhook(supabase, {
        event, paymentId: asaasPaymentId, status: asaasStatus, payload,
        result: 'ERROR', error: `Erro SQL pagamentos: ${paymentErr.message}`
      })
      return new Response(JSON.stringify({ error: paymentErr.message }), { status: 500 })
    }

    if (updatedPayments && updatedPayments.length > 0) {
      const record = updatedPayments[0]
      console.log(`[Asaas Webhook] Pagamento local ${record.id} atualizado.`)

      // 2. Atualizar status do cliente
      let clienteStatus: ClienteStatus = 'ativo'
      if (mappedPaymentStatus === 'vencido') clienteStatus = 'vencido'

      const { error: clientErr } = await supabase
        .from('clientes')
        .update({ status: clienteStatus, updated_at: new Date().toISOString() })
        .eq('id', record.cliente_id)

      if (clientErr) {
        console.error('[Asaas Webhook] Erro ao atualizar cliente:', clientErr.message)
      } else {
        console.log(`[Asaas Webhook] Cliente ${record.cliente_id} -> ${clienteStatus}`)
      }

      // 3. Auditoria
      try {
        await supabase.from('auditoria').insert({
          actor_id: null,
          actor_email: 'asaas-webhook',
          actor_role: null,
          acao: 'webhook_pagamento_processado',
          entidade: 'pagamento',
          entidade_id: record.id,
          detalhes: {
            asaas_payment_id: asaasPaymentId,
            evento: event,
            status_asaas: asaasStatus,
            status_mapeado: mappedPaymentStatus,
            valor: record.valor,
          }
        })
      } catch (auditErr) {
        console.warn('[Asaas Webhook] Erro ao registrar auditoria:', auditErr)
      }

      // 4. Log de webhook
      await logWebhook(supabase, {
        event, paymentId: asaasPaymentId, status: asaasStatus, payload,
        result: 'OK', error: null
      })
    } else {
      console.warn(`[Asaas Webhook] Nenhum pagamento local para asaas_payment_id: ${asaasPaymentId}`)
      await logWebhook(supabase, {
        event, paymentId: asaasPaymentId, status: asaasStatus, payload,
        result: 'NOT_FOUND', error: 'Pagamento local não encontrado'
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Asaas Webhook] Erro geral:', errorMsg)
    await logWebhook(
      createClient(supabaseUrl!, supabaseServiceKey!, { auth: { persistSession: false } }),
      {
        event: (payload?.event as string) || 'PARSE_ERROR',
        paymentId: null, status: null, payload,
        result: 'EXCEPTION', error: errorMsg
      }
    )
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// Registra o webhook na tabela de logs para depuração
async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  data: {
    event: string;
    paymentId: string | null;
    status: string | null;
    payload: unknown;
    result: string;
    error: string | null;
  }
) {
  try {
    await supabase.from('asaas_webhook_logs').insert({
      event: data.event,
      payment_id: data.paymentId,
      status: data.status,
      payload: data.payload,
      processing_result: data.result,
      error_message: data.error,
    })
  } catch (e) {
    console.warn('[Asaas Webhook] Falha ao gravar log:', e)
  }
}
