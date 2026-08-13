import { supabase } from "@/integrations/supabase/client";

/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : "https://painel.brazoncrm.com.br/redefinir-senha";
  
  // Usamos o cliente Supabase padrão importado do arquivo de integração
  return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}
