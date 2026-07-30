/** Validações compartilhadas do chat (rodam no cliente e no servidor). */

export const PREVIA_TAMANHO = 120;

export function exigirTexto(valor: unknown, campo: string, min: number, max: number): string {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (texto.length < min || texto.length > max) {
    throw new Error(`${campo} deve ter entre ${min} e ${max} caracteres.`);
  }
  return texto;
}

export function exigirUuid(valor: unknown, campo: string): string {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(texto)) {
    throw new Error(`${campo} inválido.`);
  }
  return texto;
}
