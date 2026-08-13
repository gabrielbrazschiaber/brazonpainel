/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 * 
 * Executa no SERVIDOR para garantir conectividade direta com o Auth do Supabase.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  
  // No Lovable Cloud (Edge Functions / Serverless), process.env pode se comportar de forma
  // diferente dependendo do contexto. Tentamos as duas formas de obter as variáveis.
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://svdrarqtkfbzmxzivibr.supabase.co";
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[password-reset] SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
    throw new Error("Configuração do servidor incompleta (service role).");
  }

  // Importação dinâmica do createClient para evitar que o bundle do cliente tente carregar dependências pesadas
  const { createClient } = await import("@supabase/supabase-js");

  // Criamos um cliente específico para esta operação para evitar estados compartilhados
  // que possam herdar cabeçalhos ou proxies que falham no ambiente restrito do worker.
  const authAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  console.log(`[password-reset] Enviando link para ${emailLimpo} com redirect ${redirectTo}`);
  
  const result = await authAdminClient.auth.resetPasswordForEmail(emailLimpo, { redirectTo });
  
  if (result.error) {
    console.error(`[password-reset] Erro ao enviar para ${emailLimpo}:`, result.error.message);
  } else {
    console.log(`[password-reset] Link enviado com sucesso para ${emailLimpo}`);
  }

  return result;
}


