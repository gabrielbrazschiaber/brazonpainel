import { supabase } from "@/integrations/supabase/client";

/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  // No servidor, não temos window.location.origin
  // Usamos o domínio fixo do projeto para garantir que o redirecionamento funcione.
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  console.log(`[password-reset] Enviando link para ${email} com redirect ${redirectTo}`);
  
  return supabaseAdmin.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}
