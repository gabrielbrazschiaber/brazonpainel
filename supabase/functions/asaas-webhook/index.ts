import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

// Definição dos tipos do Supabase de acordo com as migrações
type PagamentoStatus = 'pago' | 'pendente' | 'vencido';
type ClienteStatus = 'ativo' | 'vencido' | 'inadimplente' | 'cancelado';

// Guarda apenas os campos necessários para auditoria/diagnóstico.
// O payload bruto do Asaas contém dados pessoais e financeiros do pagador
// que não precisam ser persistidos.
// Avança o vencimento do cliente em 1 mês a partir do vencimento da cobrança paga
// (ciclo MONTHLY da assinatura). Se o Asaas não informar dueDate, usa a data de hoje.
function proximoVencimento(dueDate?: string | null): string {
  const base = dueDate ? new Date(`${dueDate}T12:00:00Z`) : new Date()
  if (Number.isNaN(base.getTime())) return new Date().toISOString().split('T')[0]
  const dia = base.getUTCDate()
  const proximo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 12))
  // Preserva o dia do mês sem "estourar" para o mês seguinte (ex.: 31 -> 28/29).
  const ultimoDia = new Date(Date.UTC(proximo.getUTCFullYear(), proximo.getUTCMonth() + 1, 0, 12)).getUTCDate()
  proximo.setUTCDate(Math.min(dia, ultimoDia))
  return proximo.toISOString().split('T')[0]
}

// deno-lint-ignore no-explicit-any
function resumirPayload(payload: any) {
  if (!payload || typeof payload !== 'object') return null
  const p = payload.payment ?? {}
  return {
    event: payload.event ?? null,
    payment: {
      id: p.id ?? null,
      status: p.status ?? null,
      value: p.value ?? null,
      billingType: p.billingType ?? null,
      dueDate: p.dueDate ?? null,
      paymentDate: p.paymentDate ?? null,
      externalReference: p.externalReference ?? null,
    },
  }
}

// deno-lint-ignore no-explicit-any
async function logWebhook(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  event: string | null,
  paymentId: string | null,
  status: string | null,
  payload: unknown,
  processingResult: string,
  errorMessage: string | null,
) {
  try {
    await supabase.from('asaas_webhook_logs').insert({
      event: event ?? null,
      payment_id: paymentId ?? null,
      status: status ?? null,
      payload: resumirPayload(payload),
      processing_result: processingResult,
      error_message: errorMessage,
    })
  } catch (e) {
    console.warn('[Asaas Webhook] Falha ao gravar log do webhook:', e)
  }
}


Deno.serve(async (req) => {
  // Apenas aceita requisições POST
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 })
  }

  // Autenticação do webhook: o Asaas envia o token configurado no cabeçalho
  // "asaas-access-token". Rejeitamos qualquer requisição sem o token correto.
  const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
  if (!expectedToken) {
    console.error('[Asaas Webhook] ASAAS_WEBHOOK_TOKEN ausente no ambiente.')
    return new Response('Erro interno de configuração', { status: 500 })
  }
  const receivedToken =
    req.headers.get('asaas-access-token') ?? req.headers.get('asaas-webhook-token')
  if (!receivedToken || receivedToken !== expectedToken) {
    console.warn('[Asaas Webhook] Token de autenticação inválido ou ausente.')
    return new Response('Não autorizado', { status: 401 })
  }

  try {
    const payload = await req.json()
    console.log('[Asaas Webhook] Evento recebido:', payload.event)


    const event = payload.event
    const payment = payload.payment

    if (!event || !payment) {
      return new Response('Payload inválido', { status: 400 })
    }

    const asaasPaymentId = payment.id
    const asaasStatus = payment.status

    // Inicializa o cliente do Supabase com a Service Role Key para ignorar RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Asaas Webhook] Variáveis do Supabase ausentes no ambiente.')
      return new Response('Erro interno de configuração', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      }
    })

    // Mapeamento do status de pagamento do Asaas para o banco local
    let mappedPaymentStatus: PagamentoStatus = 'pendente'
    if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasStatus)) {
      mappedPaymentStatus = 'pago'
    } else if (['OVERDUE', 'RESTORED'].includes(asaasStatus)) {
      mappedPaymentStatus = 'vencido'
    } else if (['REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'].includes(asaasStatus)) {
      mappedPaymentStatus = 'vencido' // Revertido/Estornado
    }

    console.log(`[Asaas Webhook] Pagamento ${asaasPaymentId}: Status Asaas: ${asaasStatus} -> Mapeado para: ${mappedPaymentStatus}`)

    let processingResult = 'OK'
    let errorMessage: string | null = null

    // 1. Atualizar a tabela de pagamentos local buscando pelo ID de pagamento do Asaas
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
      console.error('[Asaas Webhook] Erro ao atualizar tabela pagamentos:', paymentErr.message)
      processingResult = 'ERROR'
      errorMessage = paymentErr.message
      await logWebhook(supabase, event, asaasPaymentId, asaasStatus, payload, processingResult, errorMessage)
      return new Response(JSON.stringify({ error: paymentErr.message }), { status: 500 })
    }

    // Se o pagamento local existir no banco
    if (updatedPayments && updatedPayments.length > 0) {
      const record = updatedPayments[0]
      console.log(`[Asaas Webhook] Pagamento local ${record.id} atualizado.`)

      // Mapeamento do status do cliente com base no pagamento
      let clienteStatus: ClienteStatus = 'ativo'
      if (mappedPaymentStatus === 'pago') {
        clienteStatus = 'ativo'
      } else if (mappedPaymentStatus === 'vencido') {
        clienteStatus = 'vencido'
      }

      // 2. Atualizar o status do cliente (e avançar o vencimento quando pago)
      const { error: clientErr } = await supabase
        .from('clientes')
        .update({
          status: clienteStatus,
          ...(mappedPaymentStatus === 'pago'
            ? { data_vencimento: proximoVencimento(payment.dueDate) }
            : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', record.cliente_id)

      if (clientErr) {
        console.error('[Asaas Webhook] Erro ao atualizar status do cliente:', clientErr.message)
        processingResult = 'ERROR'
        errorMessage = clientErr.message
      } else {
        console.log(`[Asaas Webhook] Status do cliente ${record.cliente_id} atualizado para ${clienteStatus}.`)
      }

      // 3. Registrar auditoria (opcional - usando banco de dados de auditoria)
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
            status_mapeado: mappedPaymentStatus
          }
        })
      } catch (auditErr) {
        console.warn('[Asaas Webhook] Erro ao registrar log de auditoria:', auditErr)
      }
    } else {
      // Cobranças de ciclos futuros são criadas pelo Asaas (assinatura recorrente)
      // e ainda não existem localmente: registramos aqui.
      const clienteRef = payment.externalReference ?? null
      let clienteId: string | null = null

      if (clienteRef) {
        const { data: cli } = await supabase
          .from('clientes')
          .select('id')
          .eq('id', clienteRef)
          .maybeSingle()
        clienteId = cli?.id ?? null
      }

      if (!clienteId && payment.subscription) {
        const { data: cli } = await supabase
          .from('clientes')
          .select('id')
          .eq('asaas_subscription_id', payment.subscription)
          .maybeSingle()
        clienteId = cli?.id ?? null
      }

      if (clienteId) {
        const { error: insErr } = await supabase.from('pagamentos').insert({
          cliente_id: clienteId,
          valor: Number(payment.value ?? 0),
          status: mappedPaymentStatus,
          data_pagamento:
            mappedPaymentStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
          asaas_payment_id: asaasPaymentId,
          asaas_subscription_id: payment.subscription ?? null,
          invoice_url: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
        })

        if (insErr) {
          console.error('[Asaas Webhook] Erro ao criar pagamento recorrente:', insErr.message)
          processingResult = 'ERROR'
          errorMessage = insErr.message
        } else {
          processingResult = 'CREATED'
          const clienteStatus: ClienteStatus =
            mappedPaymentStatus === 'vencido' ? 'vencido' : 'ativo'
          await supabase
            .from('clientes')
            .update({
              status: clienteStatus,
              ...(mappedPaymentStatus === 'pago'
                ? { data_vencimento: proximoVencimento(payment.dueDate) }
                : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', clienteId)
        }
      } else {
        console.warn(`[Asaas Webhook] Nenhum cliente correspondente para o pagamento ${asaasPaymentId}`)
        processingResult = 'NOT_FOUND'
        errorMessage = `Nenhum cliente local encontrado para ${asaasPaymentId}`
      }
    }


    await logWebhook(supabase, event, asaasPaymentId, asaasStatus, payload, processingResult, errorMessage)


    return new Response(JSON.stringify({ success: true, processed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[Asaas Webhook] Erro geral de processamento:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
