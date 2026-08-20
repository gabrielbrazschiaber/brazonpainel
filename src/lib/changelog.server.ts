import { z } from "zod";
import { ChangelogAiResponse, changelogAiResponseSchema, Commit, calcularVersao, filtrarItensCliente } from "./changelog";

/**
 * Gera o conteúdo do changelog usando a IA configurada.
 */
export async function gerarChangelogServer(
  commits: Commit[],
  arquivos: string[],
  versao: string
): Promise<ChangelogAiResponse> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Obter configurações (exclusivamente no servidor)
  const { data: cfg } = await supabaseAdmin
    .from("configuracoes")
    .select("id, ia_provedor, ia_modelo, ia_api_key, changelog_ativo, changelog_versao_atual")
    .limit(1)
    .maybeSingle();

  const apiKey = cfg?.ia_api_key;
  const provedor = cfg?.ia_provedor ?? "openrouter";
  const modelo = cfg?.ia_modelo ?? "deepseek/deepseek-chat";

  // Fallback determinístico se não houver chave ou IA estiver desligada
  if (!apiKey || !cfg?.changelog_ativo) {
    return fallbackChangelog(versao, commits);
  }

  // 2. Preparar Prompt
  const promptSistema = `Você escreve notas de atualização para o Brazon, um sistema de gestão de assinaturas e leads usado por três perfis:

cliente — assinante final; só entende de assinatura, plano, vencimento, pagamento, boleto/PIX e comunicados. Nunca mencione a ele nada sobre leads, comissões, vendedores ou painel administrativo.
vendedor — usa a gestão comercial: leads, follow-up, WhatsApp, importação de planilha, metas, comissões, clientes dele.
admin — configura o sistema: permissões, usuários, planos, cupons, integrações, auditoria, segurança.

Receberá mensagens de commit técnicas e os arquivos alterados. Traduza para linguagem de usuário final em português do Brasil.

Regras obrigatórias:
- Nunca use jargão técnico: nada de refactor, hook, endpoint, schema, RLS, migration, componente, deploy, bug, null.
- Escreva o benefício, não a implementação. Exemplo errado: "corrigido null check no mapearFollowUp". Certo: "A lista de leads não trava mais quando um contato está sem telefone."
- Máximo 6 itens por público. Se houver mais, agrupe os menores em um item só.
- Decida o público pelo caminho dos arquivos: 
  - Vendedor: src/components/comercial/**, src/routes/comercial.tsx, src/lib/leads*, src/components/banco-leads/**
  - Cliente: src/routes/cliente.tsx, src/components/cliente/**, src/lib/asaas*, planos e pagamentos
  - Admin: src/components/admin/**, src/routes/admin.tsx, permissões, auditoria, segurança
  - Todos: Melhorias transversais (login, desempenho geral, notificações, tema)
- Um mesmo item pode ir para mais de um público, adaptando a redação a cada um.
- Se para um público não houver nada relevante, devolva a lista dele vazia. Não invente conteúdo para preencher.
- O título tem no máximo 60 caracteres, é concreto e não repete o número da versão.
- Responda exclusivamente com JSON válido.

JSON Output Format:
{
  "titulo": "string",
  "relevante": true,
  "publicos": {
    "cliente":  { "incluir": true, "itens": [{ "tipo": "novidade|melhoria|correcao", "texto": "string" }] },
    "vendedor": { "incluir": true, "itens": [...] },
    "admin":    { "incluir": true, "itens": [...] }
  }
}`;

  const promptUsuario = `Versão: ${versao}\nCommits:\n${commits.map(c => `- ${c.mensagem}`).join("\n")}\n\nArquivos alterados:\n${arquivos.join("\n")}`;

  // 3. Chamada à API da IA
  try {
    const rawResponse = await chamarApiIa(provedor, modelo, apiKey, promptSistema, promptUsuario);
    
    // Parser tolerante
    const jsonStr = extrairJson(rawResponse);
    const parsed = changelogAiResponseSchema.parse(JSON.parse(jsonStr));

    // 4. Filtro de Segurança (Pós-IA)
    if (parsed.publicos.cliente.incluir) {
      const { filtrados, descartados } = filtrarItensCliente(parsed.publicos.cliente.itens);
      parsed.publicos.cliente.itens = filtrados as any;
      if (filtrados.length === 0) parsed.publicos.cliente.incluir = false;
      
      // Log de descarte se necessário (pode ser injetado no deploy resumo_ia depois)
      if (descartados.length > 0) {
        (parsed as any).itens_filtrados = descartados;
      }
    }

    return parsed;
  } catch (error: any) {
    const msg = error.message?.toLowerCase() || "";
    const isConfigError = 
      msg.includes("unavailable") || 
      msg.includes("not found") || 
      msg.includes("no endpoints") || 
      msg.includes("invalid model") || 
      msg.includes("does not exist") ||
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("unauthorized");

    console.error(`[changelog] IA falhou (${isConfigError ? 'Config' : 'Temp'}):`, error.message);

    if (isConfigError) {
      await supabaseAdmin.from("configuracoes").update({ ia_teste_ok: false }).eq("id", cfg!.id);
      
      // Criar comunicado interno para admin
      await supabaseAdmin.from("novidades").insert({
        titulo: "Geração automática de notas indisponível",
        conteudo: `O sistema de changelog automático encontrou um erro de configuração:\n\n**Motivo:** ${error.message}\n\nPor favor, verifique a chave de API e o modelo nas configurações.`,
        tipo: "comunicado",
        publico_admin: true,
        publico_cliente: false,
        publico_vendedor: false,
        publicado: true,
        data_publicacao: new Date().toISOString(),
        versao: versao
      });
    }

    return fallbackChangelog(versao, commits, error.message);
  }
}

async function chamarApiIa(provedor: string, modelo: string, apiKey: string, promptSistema: string, promptUsuario: string): Promise<string> {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    deepseek: "https://api.deepseek.com/chat/completions",
    groq: "https://api.groq.com/openai/v1/chat/completions",
    google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    anthropic: "https://api.anthropic.com/v1/messages"
  };

  const url = urls[provedor] || urls.openrouter;
  const isAnthropic = provedor === "anthropic";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  if (provedor === "openrouter") {
    headers["HTTP-Referer"] = "https://brazoncrm.com.br";
    headers["X-Title"] = "Brazon CRM";
  }

  if (isAnthropic) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    delete headers["Authorization"];
  }

  const body = isAnthropic ? {
    model: modelo,
    max_tokens: 2000,
    system: promptSistema,
    messages: [{ role: "user", content: promptUsuario }],
    temperature: 0.3
  } : {
    model: modelo,
    messages: [
      { role: "system", content: promptSistema },
      { role: "user", content: promptUsuario }
    ],
    temperature: 0.3,
    max_tokens: 2000
  };

  // Retry logic (2 attempts with backoff)
  let attempts = 0;
  while (attempts < 2) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || JSON.stringify(data);
        const sanitizedMsg = errorMsg.replace(apiKey, "***");

        if (response.status === 429 || response.status >= 500) {
          attempts++;
          if (attempts < 2) {
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
        }
        
        // Erros 400, 401, 403, 404 param aqui
        throw new Error(sanitizedMsg);
      }

      return isAnthropic ? data.content[0].text : data.choices[0].message.content;
    } catch (e: any) {
      if (e.name === 'TimeoutError') throw new Error("O provedor não respondeu em 30 segundos.");
      if (attempts >= 1 || (e.message && !e.message.includes("429") && !e.message.includes("50"))) throw e;
      attempts++;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  throw new Error("Falha após tentativas de retry");
}

function extrairJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON não encontrado na resposta da IA");
  return match[0];
}

function fallbackChangelog(versao: string, commits: Commit[], erroIa?: string): ChangelogAiResponse {
  const itens = commits.map(c => ({
    tipo: "melhoria" as const,
    texto: c.mensagem.replace(/^(feat|fix|perf|docs|style|refactor|test|chore|ci|build)(\(.+\))?!?: /i, "").trim()
  })).filter(i => i.texto.length > 5);

  return {
    titulo: `Atualização ${versao}`,
    relevante: itens.length > 0,
    publicos: {
      cliente: { incluir: false, itens: [] },
      vendedor: { incluir: false, itens: [] },
      admin: { incluir: true, itens }
    },
    resumo_ia: { erro_original: erroIa } as any
  };
}
