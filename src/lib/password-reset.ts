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
  // Forçamos o uso do cliente admin gerado para garantir que os cabeçalhos apikey e Authorization
  // sejam injetados corretamente pelo wrapper de fetch do projeto.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // O redirectTo DEVE estar na whitelist de Redirect URLs do Supabase.
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  console.log(`[password-reset] Solicitando reset para ${emailLimpo} via supabaseAdmin...`);

  try {
    // Usamos o supabaseAdmin que já tem o fetch configurado para lidar com as novas chaves
    // opacas (sb_secret_...) injetando o cabeçalho 'apikey'.
    const result = await supabaseAdmin.auth.resetPasswordForEmail(emailLimpo, { redirectTo });
    
    if (result.error) {
      console.error(`[password-reset] Erro ao enviar para ${emailLimpo}:`, result.error.message);
    } else {
      console.log(`[password-reset] Link enviado com sucesso para ${emailLimpo}`);
    }

    return result;
  } catch (err) {
    console.error("[password-reset] Erro crítico no envio:", err);
    throw err;
  }
}




