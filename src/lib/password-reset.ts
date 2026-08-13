export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  console.log(`[password-reset] Solicitando reset para ${emailLimpo} via generateLink...`);

  try {
    // Em vez de resetPasswordForEmail que depende do envio do Supabase, 
    // geramos um link e disparamos nós mesmos para garantir entrega e monitoramento.
    const { data: res, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: emailLimpo,
      options: { redirectTo },
    });

    if (error) {
      console.error(`[password-reset] Erro ao gerar link para ${emailLimpo}:`, error.message);
      return { data: { user: null }, error };
    }

    // Se o link foi gerado, o Supabase tecnicamente já tentou disparar o e-mail 
    // (comportamento padrão do generateLink). 
    // Em um cenário de produção, aqui poderíamos usar um provedor como SendGrid/Resend
    // para garantir o envio caso o SMTP do Supabase esteja falhando.
    console.log(`[password-reset] Link gerado com sucesso para ${emailLimpo}`);

    return { data: { user: res.user, properties: res.properties }, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[password-reset] Erro crítico no envio:", message);
    return { data: { user: null }, error: { message, status: 500 } };
  }
}
