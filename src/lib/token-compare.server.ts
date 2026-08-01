import { createHash, timingSafeEqual } from "crypto";

/**
 * Comparação de segredos resistente a ataques de temporização.
 *
 * Compara os digests SHA-256 (sempre do mesmo tamanho) para que o tempo de
 * resposta não vaze quantos caracteres do token estão corretos.
 */
export function segredoConfere(enviado: string, esperado: string): boolean {
  if (!enviado || !esperado) return false;
  const a = createHash("sha256").update(enviado).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

/** Verifica o token enviado contra uma lista de segredos aceitos. */
export function algumSegredoConfere(enviado: string, aceitos: string[]): boolean {
  // Avalia todos os candidatos (sem short-circuit) para não vazar qual acertou.
  let ok = false;
  for (const aceito of aceitos) {
    if (segredoConfere(enviado, aceito)) ok = true;
  }
  return ok;
}
