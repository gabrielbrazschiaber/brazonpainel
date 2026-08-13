import { supabase } from "@/integrations/supabase/client";

/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined;
  
  // No servidor, usamos o cliente admin para garantir que o envio ocorra
  // mesmo que existam restrições de rede ou CORS no lado do cliente.
  return supabaseAdmin.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}
