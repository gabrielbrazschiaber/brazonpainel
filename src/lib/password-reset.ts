export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  console.log(`[password-reset] Solicitando reset para ${emailLimpo} via supabaseAdmin...`);

  try {
    // Usamos resetPasswordForEmail que é o método padrão da lib
    const result = await supabaseAdmin.auth.resetPasswordForEmail(emailLimpo, { redirectTo });
    
    if (result.error) {
      console.error(`[password-reset] Erro ao enviar para ${emailLimpo}:`, result.error.message);
    } else {
      console.log(`[password-reset] Link enviado com sucesso para ${emailLimpo}`);
    }

    return result;
  } catch (err: any) {
    console.error("[password-reset] Erro crítico no envio:", err.message || err);
    return { data: null, error: { message: err.message || String(err) } };
  }
}
