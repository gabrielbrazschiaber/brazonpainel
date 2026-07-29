import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface ConfigAsaas {
  apiKey: string;
  baseUrl: string;
}

// Lê a resposta como JSON com mensagem clara caso o Asaas retorne HTML (URL/chave inválida)
async function lerJson(response: Response, contexto: string) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`[Asaas] Resposta não-JSON (${contexto}):`, text.slice(0, 300));
    throw new Error(
      `Erro Asaas (${contexto}): resposta inesperada do servidor. Verifique a chave de API e o ambiente (sandbox/produção) nas Configurações.`
    );
  }
}

const URL_PRODUCAO = 'https://api.asaas.com/v3';
const URL_SANDBOX = 'https://api-sandbox.asaas.com/v3';

// O Asaas exige um cabeçalho User-Agent em todas as requisições.
function asaasHeaders(apiKey: string, comBody = false): Record<string, string> {
  const headers: Record<string, string> = {
    'access_token': apiKey,
    'User-Agent': 'BrazonPainel/1.0'
  };
  if (comBody) headers['Content-Type'] = 'application/json';
  return headers;
}

// Descobre em qual ambiente a chave é válida, testando um endpoint leve.
// Isso evita o erro "invalid_environment" quando o toggle sandbox/produção
// não corresponde à chave informada.
async function resolverBaseUrl(apiKey: string, preferido: string): Promise<string> {
  const ordem = preferido === URL_PRODUCAO
    ? [URL_PRODUCAO, URL_SANDBOX]
    : [URL_SANDBOX, URL_PRODUCAO];

  let ultimoErro = '';
  for (const base of ordem) {
    try {
      const resp = await fetch(`${base}/myAccount`, {
        headers: asaasHeaders(apiKey)
      });
      if (resp.ok) {
        return base;
      }
      const txt = await resp.text();
      ultimoErro = txt.slice(0, 200);
      // 401/invalid_environment => chave não é deste ambiente; tenta o outro
      if (resp.status === 401 || txt.includes('invalid_environment')) {
        continue;
      }
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
    }
  }
  console.error('[Asaas] Chave não reconhecida em nenhum ambiente. Detalhe:', ultimoErro);
  throw new Error(
    'Chave de API do Asaas inválida ou não reconhecida em nenhum ambiente (sandbox/produção). Verifique a chave nas Configurações.'
  );
}

// Busca as configurações do Asaas (do env ou da tabela configuracoes)
async function obterConfigAsaas(): Promise<ConfigAsaas> {
  // 1. Tenta obter do Environment do servidor
  const envKey = process.env.ASAAS_API_KEY;
  const envAmbiente = process.env.ASAAS_AMBIENTE || 'sandbox';

  if (envKey) {
    const preferido = envAmbiente === 'producao' ? URL_PRODUCAO : URL_SANDBOX;
    return {
      apiKey: envKey,
      baseUrl: await resolverBaseUrl(envKey, preferido)
    };
  }

  // 2. Fallback: Busca da tabela configuracoes no banco de dados
  const { data: config, error } = await supabaseAdmin
    .from('configuracoes')
    .select('asaas_api_key, asaas_ambiente')
    .limit(1)
    .maybeSingle();

  if (error || !config || !config.asaas_api_key) {
    throw new Error('Configuração do Asaas (API Key) não encontrada no servidor ou banco de dados.');
  }

  const preferido = config.asaas_ambiente === 'producao' ? URL_PRODUCAO : URL_SANDBOX;
  return {
    apiKey: config.asaas_api_key,
    baseUrl: await resolverBaseUrl(config.asaas_api_key, preferido)
  };
}

// Cria ou retorna o ID do cliente no Asaas
async function obterOuCriarClienteAsaas(
  clienteId: string,
  nome: string,
  email: string,
  cpfCnpj: string,
  telefone: string | null,
  asaasCustomerIdExistente: string | null,
  config: ConfigAsaas
): Promise<string> {
  if (asaasCustomerIdExistente) {
    return asaasCustomerIdExistente;
  }

  console.log(`[Asaas] Criando cliente ${nome} (${email}) no painel do Asaas...`);

  const response = await fetch(`${config.baseUrl}/customers`, {
    method: 'POST',
    headers: asaasHeaders(config.apiKey, true),
    body: JSON.stringify({
      name: nome,
      email: email,
      cpfCnpj: cpfCnpj,
      ...(telefone ? { mobilePhone: telefone } : {}),
      externalReference: clienteId,
      notificationDisabled: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Asaas] Falha ao criar cliente:', errorText);
    // Detalhe do provedor fica apenas no log do servidor.
    throw new Error(
      'Não foi possível registrar seus dados na plataforma de pagamento. Confira o CPF/CNPJ cadastrado e tente novamente.'
    );
  }

  const data = await lerJson(response, 'Criar Cliente');
  const asaasCustomerId = data.id;

  // Atualiza no banco de dados local
  const { error: updateErr } = await supabaseAdmin
    .from('clientes')
    .update({ asaas_customer_id: asaasCustomerId })
    .eq('id', clienteId);

  if (updateErr) {
    console.error('[Asaas] Erro ao salvar asaas_customer_id localmente:', updateErr.message);
  }

  return asaasCustomerId;
}

export interface CobrancaParams {
  clienteId: string;
  valor: number;
  tipoPagamento: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  dataVencimento: string; // Formato YYYY-MM-DD
  descricao?: string;
}

// Busca a cobrança em aberto de uma assinatura (a próxima a ser paga).
async function buscarCobrancaAtualDaAssinatura(
  subscriptionId: string,
  config: ConfigAsaas
) {
  const resp = await fetch(
    `${config.baseUrl}/subscriptions/${subscriptionId}/payments?limit=20`,
    { headers: asaasHeaders(config.apiKey) }
  );
  if (!resp.ok) {
    console.error('[Asaas] Falha ao listar cobranças da assinatura:', (await resp.text()).slice(0, 300));
    return null;
  }
  const lista = await lerJson(resp, 'Listar Cobranças da Assinatura');
  const pagamentos: any[] = Array.isArray(lista?.data) ? lista.data : [];
  const abertos = pagamentos
    .filter((p) => ['PENDING', 'AWAITING_RISK_ANALYSIS', 'OVERDUE'].includes(p.status))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  return abertos[0] ?? pagamentos[0] ?? null;
}

// O objeto de cobrança do Asaas não traz o código PIX copia-e-cola;
// ele vem de um endpoint específico do QR Code.
async function obterPixCopiaECola(
  paymentId: string | null | undefined,
  billingType: string,
  config: ConfigAsaas
): Promise<string | null> {
  if (!paymentId || billingType !== 'PIX') return null;
  try {
    const resp = await fetch(`${config.baseUrl}/payments/${paymentId}/pixQrCode`, {
      headers: asaasHeaders(config.apiKey),
    });
    if (!resp.ok) {
      console.error('[Asaas] Falha ao obter QR Code PIX:', (await resp.text()).slice(0, 300));
      return null;
    }
    const qr = await lerJson(resp, 'QR Code PIX');
    return (qr?.payload as string) ?? null;
  } catch (e) {
    console.error('[Asaas] Erro ao obter QR Code PIX:', e instanceof Error ? e.message : e);
    return null;
  }
}

// Registra (ou atualiza) o pagamento localmente para não duplicar linhas.
async function registrarPagamentoLocal(
  clienteId: string,
  subscriptionId: string,
  pagamentoAsaas: any
) {
  if (!pagamentoAsaas?.id) return null;

  const invoiceUrl = pagamentoAsaas.invoiceUrl || pagamentoAsaas.bankSlipUrl || null;

  const { data: existente } = await supabaseAdmin
    .from('pagamentos')
    .select('id')
    .eq('asaas_payment_id', pagamentoAsaas.id)
    .maybeSingle();

  if (existente) {
    await supabaseAdmin
      .from('pagamentos')
      .update({ invoice_url: invoiceUrl, asaas_subscription_id: subscriptionId })
      .eq('id', existente.id);
    return existente.id;
  }

  const { data: novo, error } = await supabaseAdmin
    .from('pagamentos')
    .insert({
      cliente_id: clienteId,
      valor: Number(pagamentoAsaas.value ?? 0),
      status: 'pendente',
      asaas_payment_id: pagamentoAsaas.id,
      asaas_subscription_id: subscriptionId,
      invoice_url: invoiceUrl,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Asaas] Erro ao registrar pagamento local:', error.message);
    return null;
  }
  return novo.id;
}

// Cria (ou reaproveita) uma ASSINATURA MENSAL recorrente no Asaas e devolve
// a cobrança em aberto do ciclo atual para o cliente pagar.
export async function gerarCobrancaAsaas(params: CobrancaParams) {
  const config = await obterConfigAsaas();

  // 1. Busca os dados do cliente no banco
  const { data: cliente, error: cliErr } = await supabaseAdmin
    .from('clientes')
    .select('id, user_id, asaas_customer_id, asaas_subscription_id, cpf_cnpj, telefone')
    .eq('id', params.clienteId)
    .maybeSingle();

  if (cliErr || !cliente) {
    throw new Error(`Cliente não encontrado para cobrança: ${params.clienteId}`);
  }

  const cpfCnpj = (cliente.cpf_cnpj || '').replace(/\D/g, '');
  if (!cpfCnpj) {
    throw new Error(
      'É necessário cadastrar o CPF ou CNPJ do cliente antes de gerar a cobrança. Peça ao seu vendedor para preencher esse dado.'
    );
  }

  // O perfil (nome/email) está ligado por user_id, não por uma FK direta de clientes.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('nome, email')
    .eq('id', cliente.user_id)
    .maybeSingle();

  const nome = profile?.nome || 'Cliente Brazon';
  const email = profile?.email || '';
  const telefone = (cliente.telefone || '').replace(/\D/g, '') || null;

  // 2. Obtém ou cria o cliente no Asaas
  const asaasCustomerId = await obterOuCriarClienteAsaas(
    cliente.id,
    nome,
    email,
    cpfCnpj,
    telefone,
    cliente.asaas_customer_id,
    config
  );

  const descricao = params.descricao || 'Assinatura mensal Brazon';

  // 3. Se já existe assinatura ativa, reaproveita (mantendo a recorrência)
  //    e apenas garante que o valor/forma de pagamento estejam atualizados.
  if (cliente.asaas_subscription_id) {
    const respAssinatura = await fetch(
      `${config.baseUrl}/subscriptions/${cliente.asaas_subscription_id}`,
      { headers: asaasHeaders(config.apiKey) }
    );

    if (respAssinatura.ok) {
      const assinatura = await lerJson(respAssinatura, 'Consultar Assinatura');

      if (assinatura.status === 'ACTIVE' && !assinatura.deleted) {
        // Mantém valor e forma de pagamento sincronizados com o plano atual.
        if (
          Number(assinatura.value) !== Number(params.valor) ||
          assinatura.billingType !== params.tipoPagamento
        ) {
          const upd = await fetch(`${config.baseUrl}/subscriptions/${assinatura.id}`, {
            method: 'POST',
            headers: asaasHeaders(config.apiKey, true),
            body: JSON.stringify({
              value: params.valor,
              billingType: params.tipoPagamento,
              description: descricao,
              updatePendingPayments: true,
            }),
          });
          if (!upd.ok) {
            console.error('[Asaas] Falha ao atualizar assinatura:', (await upd.text()).slice(0, 300));
          }
        }

        const atual = await buscarCobrancaAtualDaAssinatura(assinatura.id, config);
        if (atual) {
          const pagamentoIdLocal = await registrarPagamentoLocal(cliente.id, assinatura.id, atual);
          return {
            pagamentoIdLocal,
            assinaturaId: assinatura.id,
            recorrente: true,
            asaasPaymentId: atual.id,
            invoiceUrl: atual.invoiceUrl ?? null,
            bankSlipUrl: atual.bankSlipUrl ?? null,
            pixCopyPaste: await obterPixCopiaECola(atual.id, params.tipoPagamento, config),
            status: atual.status,
          };
        }
      }
    } else {
      console.error(
        '[Asaas] Assinatura anterior inválida, criando uma nova:',
        (await respAssinatura.text()).slice(0, 300)
      );
    }
  }

  // 4. Cria a ASSINATURA mensal recorrente no Asaas
  console.log(
    `[Asaas] Criando assinatura mensal de ${params.valor} via ${params.tipoPagamento} para ${nome}...`
  );

  const response = await fetch(`${config.baseUrl}/subscriptions`, {
    method: 'POST',
    headers: asaasHeaders(config.apiKey, true),
    body: JSON.stringify({
      customer: asaasCustomerId,
      billingType: params.tipoPagamento,
      value: params.valor,
      nextDueDate: params.dataVencimento,
      cycle: 'MONTHLY',
      description: descricao,
      externalReference: cliente.id,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Asaas] Falha ao criar assinatura:', errorText);
    // Detalhe do provedor fica apenas no log do servidor.
    throw new Error(
      'Não foi possível gerar a cobrança recorrente no momento. Tente novamente em instantes ou fale com seu vendedor.'
    );
  }

  const assinatura = await lerJson(response, 'Criar Assinatura');

  // 5. Guarda a assinatura no cliente para os próximos ciclos
  const { error: updErr } = await supabaseAdmin
    .from('clientes')
    .update({ asaas_subscription_id: assinatura.id })
    .eq('id', cliente.id);
  if (updErr) {
    console.error('[Asaas] Erro ao salvar asaas_subscription_id:', updErr.message);
  }

  // 6. Busca a primeira cobrança gerada pela assinatura
  const primeira = await buscarCobrancaAtualDaAssinatura(assinatura.id, config);
  const pagamentoIdLocal = primeira
    ? await registrarPagamentoLocal(cliente.id, assinatura.id, primeira)
    : null;

  return {
    pagamentoIdLocal,
    assinaturaId: assinatura.id,
    recorrente: true,
    asaasPaymentId: primeira?.id ?? null,
    invoiceUrl: primeira?.invoiceUrl ?? null,
    bankSlipUrl: primeira?.bankSlipUrl ?? null,
    pixCopyPaste: await obterPixCopiaECola(primeira?.id, params.tipoPagamento, config),
    status: primeira?.status ?? assinatura.status,
  };
}


// Testa a chave/ambiente do Asaas consultando os dados da conta.
export async function testarConexaoAsaas() {
  const config = await obterConfigAsaas();
  const response = await fetch(`${config.baseUrl}/myAccount`, {
    headers: asaasHeaders(config.apiKey)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro Asaas (Testar Chave): ${errorText.slice(0, 300)}`);
  }

  const data = await lerJson(response, 'Testar Chave');
  const ambiente = config.baseUrl === URL_PRODUCAO ? 'producao' : 'sandbox';
  return {
    ok: true,
    ambiente,
    nomeConta: data.name || data.email || 'Conta Asaas',
    email: data.email || null
  };
}
