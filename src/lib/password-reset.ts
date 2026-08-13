export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  
  // Usamos uma URL absoluta de redirecionamento que esteja na whitelist do Supabase.
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  // No Lovable Cloud, o supabaseAdmin injeta automaticamente 'apikey' e 'Authorization'
  // necessários para bypassar RLS e usar a API de Admin via wrapper de fetch.
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
