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
  throw new Error(
    `Chave de API do Asaas inválida ou não reconhecida em nenhum ambiente (sandbox/produção). Verifique a chave nas Configurações. Detalhe: ${ultimoErro}`
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
  asaasCustomerIdExistente: string | null,
  config: ConfigAsaas
): Promise<string> {
  if (asaasCustomerIdExistente) {
    return asaasCustomerIdExistente;
  }

  console.log(`[Asaas] Criando cliente ${nome} (${email}) no painel do Asaas...`);

  const response = await fetch(`${config.baseUrl}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': config.apiKey
    },
    body: JSON.stringify({
      name: nome,
      email: email,
      externalReference: clienteId,
      notificationDisabled: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Asaas] Falha ao criar cliente:', errorText);
    throw new Error(`Erro Asaas (Criar Cliente): ${errorText.slice(0, 300)}`);
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

// Gera uma cobrança no Asaas e registra na tabela de pagamentos do banco
export async function gerarCobrancaAsaas(params: CobrancaParams) {
  const config = await obterConfigAsaas();

  // 1. Busca os dados do cliente no banco
  const { data: cliente, error: cliErr } = await supabaseAdmin
    .from('clientes')
    .select('id, user_id, asaas_customer_id')
    .eq('id', params.clienteId)
    .maybeSingle();

  if (cliErr || !cliente) {
    throw new Error(`Cliente não encontrado para cobrança: ${params.clienteId}`);
  }

  // O perfil (nome/email) está ligado por user_id, não por uma FK direta de clientes.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('nome, email')
    .eq('id', cliente.user_id)
    .maybeSingle();

  const nome = profile?.nome || 'Cliente Brazon';
  const email = profile?.email || '';


  // 2. Obtém ou cria o cliente no Asaas
  const asaasCustomerId = await obterOuCriarClienteAsaas(
    cliente.id,
    nome,
    email,
    cliente.asaas_customer_id,
    config
  );

  // 3. Cria a cobrança no Asaas
  console.log(`[Asaas] Gerando cobrança de ${params.valor} via ${params.tipoPagamento} para ${nome}...`);

  const response = await fetch(`${config.baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': config.apiKey
    },
    body: JSON.stringify({
      customer: asaasCustomerId,
      billingType: params.tipoPagamento,
      value: params.valor,
      dueDate: params.dataVencimento,
      description: params.descricao || 'Mensalidade da assinatura Brazon',
      externalReference: cliente.id
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Asaas] Falha ao criar cobrança:', errorText);
    throw new Error(`Erro Asaas (Criar Cobrança): ${errorText.slice(0, 300)}`);
  }

  const data = await lerJson(response, 'Criar Cobrança');

  // 4. Registra o pagamento pendente localmente no banco
  const { data: novoPagamento, error: pagErr } = await supabaseAdmin
    .from('pagamentos')
    .insert({
      cliente_id: cliente.id,
      valor: params.valor,
      status: 'pendente',
      asaas_payment_id: data.id
    })
    .select()
    .single();

  if (pagErr) {
    console.error('[Asaas] Erro ao registrar pagamento local:', pagErr.message);
  }

  // 5. Retorna as informações úteis (ex: link de checkout, código pix, etc.)
  return {
    pagamentoIdLocal: novoPagamento?.id || null,
    asaasPaymentId: data.id,
    invoiceUrl: data.invoiceUrl, // URL da fatura para o cliente pagar
    bankSlipUrl: data.bankSlipUrl || null, // Se boleto, link do PDF
    pixCopyPaste: data.pixCopyPaste || null, // Se Pix, código copia e cola
    status: data.status
  };
}
