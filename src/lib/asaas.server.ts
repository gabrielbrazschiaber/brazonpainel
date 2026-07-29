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
  /**
   * Desconto (R$) aplicado SOMENTE na primeira cobrança da assinatura.
   * Os ciclos seguintes continuam com o valor cheio do plano.
   */
  descontoPrimeiraMensalidade?: number;
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
            descontoAplicado: 0,

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
  let primeira = await buscarCobrancaAtualDaAssinatura(assinatura.id, config);

  // 6.1 Desconto da primeira mensalidade (cupom): altera só esta cobrança,
  //     mantendo o valor cheio nos ciclos seguintes da assinatura.
  let descontoAplicado = 0;
  const desconto = Number(params.descontoPrimeiraMensalidade ?? 0);
  if (primeira?.id && desconto > 0) {
    const { aplicarDesconto } = await import('@/lib/cupons.server');
    const valorComDesconto = aplicarDesconto(Number(primeira.value ?? params.valor), desconto);
    const respDesc = await fetch(`${config.baseUrl}/payments/${primeira.id}`, {
      method: 'POST',
      headers: asaasHeaders(config.apiKey, true),
      body: JSON.stringify({
        value: valorComDesconto,
        description: `${descricao} (cupom de desconto na 1ª mensalidade)`,
      }),
    });
    if (respDesc.ok) {
      primeira = await lerJson(respDesc, 'Aplicar Desconto');
      descontoAplicado = Number((Number(params.valor) - valorComDesconto).toFixed(2));
    } else {
      console.error('[Asaas] Falha ao aplicar desconto na 1ª cobrança:', (await respDesc.text()).slice(0, 300));
    }
  }

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
    descontoAplicado,
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

/**
 * Sincroniza o valor da assinatura recorrente no Asaas com o valor atual do
 * cliente (plano + serviço extra). Usado quando o admin altera plano/valor.
 * Retorna um resumo do que aconteceu; nunca lança para não bloquear o salvamento.
 *
 * Em falhas temporárias do Asaas (rede/timeout/429/5xx) a sincronização é
 * enfileirada para retry automático com backoff exponencial.
 */
export async function sincronizarAssinaturaCliente(
  clienteId: string,
  opcoes: { enfileirarSeFalhar?: boolean } = {}
): Promise<{
  sincronizado: boolean;
  motivo?: string;
  valor?: number;
  enfileirado?: boolean;
}> {
  const { enfileirarSeFalhar = true } = opcoes;
  const {
    enfileirarSincronizacao,
    concluirSincronizacao,
    ehFalhaTransitoria,
    statusEhTransitorio,
  } = await import('@/lib/asaas-queue.server');

  const finalizar = async (
    resultado: { sincronizado: boolean; motivo?: string; valor?: number }
  ) => {
    if (resultado.sincronizado) {
      await concluirSincronizacao(clienteId);
      return resultado;
    }
    if (enfileirarSeFalhar && ehFalhaTransitoria(resultado.motivo)) {
      await enfileirarSincronizacao(clienteId, resultado.motivo ?? 'erro');
      return { ...resultado, enfileirado: true };
    }
    return resultado;
  };

  try {
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, asaas_subscription_id, servico_extra_valor, planos(nome, valor)')
      .eq('id', clienteId)
      .maybeSingle();

    if (!cliente) return { sincronizado: false, motivo: 'cliente_nao_encontrado' };
    if (!cliente.asaas_subscription_id) {
      return { sincronizado: false, motivo: 'sem_assinatura' };
    }

    const plano = (cliente as unknown as { planos: { nome: string; valor: number } | null }).planos;
    const valor = Number(plano?.valor ?? 0) + Number(cliente.servico_extra_valor ?? 0);
    if (!(valor > 0)) return { sincronizado: false, motivo: 'valor_invalido' };

    const config = await obterConfigAsaas();

    const respAssinatura = await fetch(
      `${config.baseUrl}/subscriptions/${cliente.asaas_subscription_id}`,
      { headers: asaasHeaders(config.apiKey) }
    );
    if (!respAssinatura.ok) {
      const detalhe = (await respAssinatura.text()).slice(0, 300);
      console.error('[Asaas] Falha ao consultar assinatura ao sincronizar:', detalhe);
      return finalizar({
        sincronizado: false,
        motivo: statusEhTransitorio(respAssinatura.status)
          ? 'asaas_indisponivel'
          : 'assinatura_invalida',
      });
    }

    const assinatura = await lerJson(respAssinatura, 'Consultar Assinatura');
    if (assinatura.deleted || assinatura.status !== 'ACTIVE') {
      return { sincronizado: false, motivo: 'assinatura_inativa' };
    }
    if (Number(assinatura.value) === Number(valor)) {
      return finalizar({ sincronizado: true, valor });
    }

    const upd = await fetch(`${config.baseUrl}/subscriptions/${assinatura.id}`, {
      method: 'POST',
      headers: asaasHeaders(config.apiKey, true),
      body: JSON.stringify({
        value: valor,
        description: plano?.nome ? `Assinatura ${plano.nome} - Brazon` : 'Assinatura mensal Brazon',
        updatePendingPayments: true,
      }),
    });
    if (!upd.ok) {
      const detalhe = (await upd.text()).slice(0, 300);
      console.error('[Asaas] Falha ao sincronizar assinatura:', detalhe);
      return finalizar({
        sincronizado: false,
        motivo: statusEhTransitorio(upd.status) ? 'asaas_indisponivel' : 'falha_asaas',
      });
    }

    // Atualiza a cobrança em aberto localmente (valor e link da fatura).
    const atual = await buscarCobrancaAtualDaAssinatura(assinatura.id, config);
    if (atual) {
      await registrarPagamentoLocal(cliente.id, assinatura.id, atual);
      await supabaseAdmin
        .from('pagamentos')
        .update({ valor: Number(atual.value ?? valor) })
        .eq('asaas_payment_id', atual.id);
    }

    return finalizar({ sincronizado: true, valor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Asaas] Erro ao sincronizar assinatura:', msg);
    // Erros de rede/timeout são transitórios; configuração ausente não é.
    const configAusente = msg.includes('Configuração do Asaas');
    return finalizar({
      sincronizado: false,
      motivo: configAusente ? 'sem_configuracao' : 'erro_rede',
    });
  }
}


/**
 * Provisiona o cliente na plataforma de pagamento logo no cadastro, salvando o
 * asaas_customer_id em `clientes`. Assim a primeira cobrança/assinatura pode ser
 * iniciada depois sem depender de criar o customer na hora.
 *
 * Nunca lança: falha aqui não pode impedir a criação da conta. O identificador
 * também é criado sob demanda ao gerar a cobrança, caso este passo falhe.
 */
export async function provisionarClienteAsaas(
  clienteId: string,
  opcoes: { enfileirarSeFalhar?: boolean } = {}
): Promise<{ provisionado: boolean; motivo?: string; asaasCustomerId?: string }> {
  const enfileirar = opcoes.enfileirarSeFalhar !== false;
  const agendarRetry = async (motivo: string) => {
    if (!enfileirar) return;
    try {
      const { enfileirarSincronizacao } = await import('@/lib/asaas-queue.server');
      await enfileirarSincronizacao(clienteId, motivo, 'cliente');
    } catch (e) {
      console.error(
        '[Asaas] Falha ao enfileirar provisionamento do cliente:',
        e instanceof Error ? e.message : e
      );
    }
  };
  try {
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, user_id, asaas_customer_id, cpf_cnpj, telefone')
      .eq('id', clienteId)
      .maybeSingle();

    if (!cliente) return { provisionado: false, motivo: 'cliente_nao_encontrado' };
    if (cliente.asaas_customer_id) {
      return { provisionado: true, asaasCustomerId: cliente.asaas_customer_id };
    }
    if (!cliente.cpf_cnpj) return { provisionado: false, motivo: 'sem_cpf_cnpj' };

    const { data: perfil } = await supabaseAdmin
      .from('profiles')
      .select('nome, email')
      .eq('id', cliente.user_id)
      .maybeSingle();

    if (!perfil?.email) {
      await agendarRetry('sem_email');
      return { provisionado: false, motivo: 'sem_email' };
    }

    const config = await obterConfigAsaas();
    const asaasCustomerId = await obterOuCriarClienteAsaas(
      cliente.id,
      perfil.nome || perfil.email,
      perfil.email,
      cliente.cpf_cnpj,
      cliente.telefone ?? null,
      null,
      config
    );

    // Deu certo: encerra qualquer retry pendente deste cliente.
    try {
      const { concluirSincronizacao } = await import('@/lib/asaas-queue.server');
      await concluirSincronizacao(clienteId, 'cliente');
    } catch {
      /* não bloqueia o fluxo */
    }

    return { provisionado: true, asaasCustomerId };
  } catch (err) {
    // Detalhe do provedor fica só no log do servidor.
    console.error(
      '[Asaas] Falha ao provisionar cliente no cadastro:',
      err instanceof Error ? err.message : err
    );
    await agendarRetry('falha_asaas');
    return { provisionado: false, motivo: 'falha_asaas' };
  }
}

/**
 * Cria automaticamente a ASSINATURA/cobrança inicial logo após o cadastro público,
 * usando o plano escolhido e o asaas_customer_id já provisionado.
 *
 * Nunca lança: uma falha aqui não pode invalidar a conta recém-criada — o cliente
 * ainda pode gerar a cobrança manualmente na área dele.
 */
export async function criarCobrancaInicialCadastro(
  clienteId: string,
  opcoes: { tipoPagamento?: 'PIX' | 'BOLETO' | 'CREDIT_CARD' } = {}
): Promise<{
  criada: boolean;
  motivo?: string;
  invoiceUrl?: string | null;
  valor?: number;
  descontoAplicado?: number;
  cupom?: string | null;
}> {
  try {
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, user_id, plano_id, servico_extra_valor, cupom_pendente_id, asaas_subscription_id')
      .eq('id', clienteId)
      .maybeSingle();

    if (!cliente) return { criada: false, motivo: 'cliente_nao_encontrado' };
    if (cliente.asaas_subscription_id) return { criada: false, motivo: 'ja_possui_assinatura' };
    if (!cliente.plano_id) return { criada: false, motivo: 'sem_plano' };

    const { data: plano } = await supabaseAdmin
      .from('planos')
      .select('id, nome, valor, ativo')
      .eq('id', cliente.plano_id)
      .maybeSingle();
    if (!plano || !plano.ativo) return { criada: false, motivo: 'plano_indisponivel' };

    const valorTotal = Number(plano.valor) + Number(cliente.servico_extra_valor ?? 0);

    // Cupom reservado no cadastro: validado de novo aqui, no servidor.
    const { validarCupomParaCliente, registrarUsoCupom } = await import('./cupons.server');
    let cupomAplicado: { id: string; codigo: string; valor: number } | null = null;
    if (cliente.cupom_pendente_id) {
      const { data: pend } = await supabaseAdmin
        .from('cupons')
        .select('codigo')
        .eq('id', cliente.cupom_pendente_id)
        .maybeSingle();
      if (pend?.codigo) {
        const res = await validarCupomParaCliente(pend.codigo, cliente.id);
        if (!('motivo' in res)) {
          cupomAplicado = {
            id: res.cupom.id,
            codigo: res.cupom.codigo,
            valor: res.cupom.valor_desconto,
          };
        }
      }
    }

    // Primeiro vencimento: 3 dias (os ciclos seguintes são mensais).
    const venc = new Date();
    venc.setDate(venc.getDate() + 3);

    const resultado = await gerarCobrancaAsaas({
      clienteId: cliente.id,
      valor: valorTotal,
      tipoPagamento: opcoes.tipoPagamento ?? 'PIX',
      dataVencimento: venc.toISOString().split('T')[0],
      descricao: `Assinatura mensal Brazon - ${plano.nome}`,
      descontoPrimeiraMensalidade: cupomAplicado?.valor ?? 0,
    });

    let descontoAplicado = 0;
    if (cupomAplicado && Number(resultado.descontoAplicado ?? 0) > 0) {
      const registrado = await registrarUsoCupom({
        cupomId: cupomAplicado.id,
        clienteId: cliente.id,
        userId: cliente.user_id,
        valorDesconto: Number(resultado.descontoAplicado),
        pagamentoId: resultado.pagamentoIdLocal ?? null,
        asaasPaymentId: resultado.asaasPaymentId ?? null,
      });
      if (registrado) descontoAplicado = Number(resultado.descontoAplicado);
    }

    return {
      criada: true,
      invoiceUrl: (resultado.invoiceUrl as string | null) ?? null,
      valor: valorTotal,
      descontoAplicado,
      cupom: descontoAplicado > 0 ? cupomAplicado!.codigo : null,
    };
  } catch (err) {
    console.error(
      '[Asaas] Falha ao criar cobrança inicial do cadastro:',
      err instanceof Error ? err.message : err
    );
    return { criada: false, motivo: 'falha_asaas' };
  }
}
