import { supabase } from "@/integrations/supabase/client";

/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[password-reset] Variáveis de ambiente Supabase ausentes");
    return { error: new Error("Configuração do servidor incompleta") };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  console.log(`[password-reset] Solicitando reset para ${email}`);
  
  return supabaseAdmin.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}
