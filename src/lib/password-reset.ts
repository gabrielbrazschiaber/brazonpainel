export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  
  // No Lovable Cloud, as chaves de serviço estão disponíveis no process.env
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://svdrarqtkfbzmxzivibr.supabase.co";
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_ROLE) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não encontrada no servidor.");
  }

  console.log(`[password-reset] Solicitando reset via GoTrue Admin API: ${emailLimpo}`);

  try {
    // Chamada direta para o GoTrue (Admin API do Supabase Auth)
    // O endpoint /recover suporta envio de reset para outros usuários se autenticado como admin.
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`
      },
      body: JSON.stringify({ 
        email: emailLimpo,
        gotrue_meta_security: { reauthentication_token: "" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[password-reset] Erro na API GoTrue (${response.status}):`, errText);
      return { data: null, error: { message: errText || "Falha ao solicitar reset" } };
    }

    console.log(`[password-reset] Reset processado com sucesso para ${emailLimpo}`);
    return { data: {}, error: null };
  } catch (err) {
    console.error("[password-reset] Erro crítico:", err);
    throw err;
  }
}

