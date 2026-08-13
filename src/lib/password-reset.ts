/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 * 
 * Executa no SERVIDOR para garantir conectividade direta com o Auth do Supabase.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  // No Lovable Cloud, o supabaseAdmin injeta automaticamente 'apikey' e 'Authorization'
  // via wrapper de fetch (src/integrations/supabase/client.server.ts).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  console.log(`[password-reset] Solicitando reset para ${emailLimpo} via supabaseAdmin...`);

  try {
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






