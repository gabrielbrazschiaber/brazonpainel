// Rotinas de 2FA que só rodam no servidor.
// Nunca importe este arquivo em componentes ou no escopo de módulo de um
// *.functions.ts — carregue dentro do handler com await import(...).

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem caracteres ambíguos
const QTD_CODIGOS = 10;

/** Gera códigos de recuperação legíveis no formato XXXX-XXXX. */
export function gerarCodigosRecuperacao(): string[] {
  const codigos: string[] = [];
  for (let i = 0; i < QTD_CODIGOS; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const letras = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
    codigos.push(`${letras.slice(0, 4)}-${letras.slice(4, 8)}`);
  }
  return codigos;
}

/** Normaliza o código digitado pelo usuário (maiúsculas, sem separadores). */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Resumo criptográfico do código — só o hash é guardado no banco. */
export async function hashCodigo(codigo: string): Promise<string> {
  const dados = new TextEncoder().encode(normalizarCodigo(codigo));
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Substitui os códigos do usuário por um conjunto novo e devolve os códigos em texto. */
export async function regravarCodigos(userId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const codigos = gerarCodigosRecuperacao();
  await supabaseAdmin.from("mfa_codigos_recuperacao").delete().eq("user_id", userId);
  const linhas = await Promise.all(
    codigos.map(async (c) => ({ user_id: userId, codigo_hash: await hashCodigo(c) })),
  );
  const { error } = await supabaseAdmin.from("mfa_codigos_recuperacao").insert(linhas);
  if (error) throw new Error("Não foi possível gerar os códigos de recuperação.");
  return codigos;
}

/** Quantos códigos ainda não foram usados. */
export async function contarCodigosDisponiveis(userId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("mfa_codigos_recuperacao")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("usado_em", null);
  return count ?? 0;
}

/** Marca um código como usado. Devolve false quando o código não existe/já foi usado. */
export async function consumirCodigo(userId: string, codigo: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await hashCodigo(codigo);
  const { data } = await supabaseAdmin
    .from("mfa_codigos_recuperacao")
    .update({ usado_em: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("codigo_hash", hash)
    .is("usado_em", null)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/** Remove todos os fatores TOTP de um usuário. Devolve quantos foram removidos. */
export async function removerTodosFatores(userId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error("Não foi possível listar os fatores do usuário.");
  const fatores = data?.factors ?? [];
  for (const f of fatores) {
    await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
  }
  return fatores.length;
}

/** true quando o usuário tem pelo menos um fator TOTP verificado. */
export async function temFatorVerificado(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  return (data?.factors ?? []).some((f) => f.status === "verified");
}

/** Política global de obrigatoriedade do 2FA. */
export async function lerPoliticaMfa(): Promise<{ admin: boolean; vendedor: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("configuracoes")
    .select("mfa_obrigatorio_admin,mfa_obrigatorio_vendedor")
    .limit(1)
    .maybeSingle();
  return {
    admin: data?.mfa_obrigatorio_admin ?? false,
    vendedor: data?.mfa_obrigatorio_vendedor ?? false,
  };
}
