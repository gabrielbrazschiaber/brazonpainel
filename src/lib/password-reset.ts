/**
 * Envia um e-mail com link para o usuário definir/redefinir a senha.
 * Usado tanto no "Esqueci minha senha" quanto ao criar novos usuários,
 * evitando expor qualquer senha em respostas do servidor.
 * 
 * Executa no SERVIDOR para garantir conectividade direta com o Auth do Supabase.
 */
export async function enviarLinkDefinicaoSenha(email: string) {
  const emailLimpo = email.trim().toLowerCase();
  
  // No Lovable Cloud, as credenciais estão disponíveis via process.env
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://svdrarqtkfbzmxzivibr.supabase.co";
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[password-reset] SUPABASE_SERVICE_ROLE_KEY não configurada.");
    throw new Error("Configuração do servidor incompleta.");
  }

  const redirectTo = "https://painel.brazoncrm.com.br/redefinir-senha";
  console.log(`[password-reset] Solicitando reset para ${emailLimpo} via fetch manual...`);

  try {
    // Usamos o fetch nativo configurado exatamente como o cliente gerado faria.
    // Chaves sb_secret_ são opacas e devem ir no cabeçalho 'apikey'.
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        email: emailLimpo,
        gotrue_meta_security: { reauthentication_token: "" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[password-reset] Erro no fetch manual (${response.status}):`, errText);
      return { data: null, error: { message: errText || "Falha na comunicação com o Auth" } };
    }

    console.log(`[password-reset] Reset solicitado com sucesso para ${emailLimpo}`);
    return { data: {}, error: null };
  } catch (err) {
    console.error("[password-reset] Erro crítico no envio manual:", err);
    throw err;
  }
}





