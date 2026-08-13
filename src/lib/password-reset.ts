/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 * 
 * Executa no SERVIDOR para garantir conectividade direta com o Auth do Supabase.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  
  // No Lovable Cloud, as credenciais estão disponíveis via process.env
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://svdrarqtkfbzmxzivibr.supabase.co";
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[password-reset] SUPABASE_SERVICE_ROLE_KEY não configurada.");
    throw new Error("Configuração do servidor incompleta.");
  }

  // Importação dinâmica
  const { createClient } = await import("@supabase/supabase-js");

  // O redirectTo DEVE estar na whitelist de Redirect URLs do Supabase.
  // A URL "https://painel.brazoncrm.com.br/redefinir-senha" é a oficial.
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  console.log(`[password-reset] Solicitando reset para ${emailLimpo} via Admin API...`);

  // Usamos o fetch nativo para falar diretamente com o Auth do Supabase
  // Isso evita dependências de bibliotecas que podem ter problemas no worker.
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        email: emailLimpo,
        gotrue_meta_security: {
          reauthentication_token: ""
        }
      })
    });

    // Se o recover não aceitar redirectTo via POST direto (algumas versões do GoTrue pedem via query params ou config),
    // o padrão do Supabase Dashboard deve estar configurado para este domínio.
    // Mas vamos tentar também a forma padrão da lib caso o fetch falhe.
    
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[password-reset] Fetch direto falhou (${response.status}), tentando via lib:`, errText);
      
      const authAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      
      const result = await authAdminClient.auth.resetPasswordForEmail(emailLimpo, { redirectTo });
      return result;
    }

    console.log(`[password-reset] Chamada direta concluída para ${emailLimpo}`);
    return { data: {}, error: null };

  } catch (err) {
    console.error("[password-reset] Erro crítico no envio:", err);
    throw err;
  }
}



