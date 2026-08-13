/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 * 
 * Executa no SERVIDOR para garantir conectividade direta com o Auth do Supabase.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  // O link de redirecionamento deve ser absoluto e apontar para a rota de redefinição.
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  console.log(`[password-reset] Enviando link para ${email} com redirect ${redirectTo}`);
  
  return supabaseAdmin.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}

