/**
 * Fonte única do status de WhatsApp (client-safe).
 *
 * O status é derivado do próprio telefone, então formulários e listas mostram
 * sempre o mesmo resultado — sem depender de estado local de cada tela.
 */
import { apenasDigitos } from "@/lib/leads";

export type WhatsAppStatus = "ativo" | "incerto" | "invalido";

export const WHATSAPP_MENSAGEM: Record<WhatsAppStatus, string> = {
  ativo: "Número de celular válido — WhatsApp ativo",
  incerto: "Número de telefone fixo — WhatsApp não confirmado",
  invalido: "Número incompleto ou inválido — WhatsApp ausente",
};

export const WHATSAPP_CORES: Record<WhatsAppStatus, string> = {
  ativo: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  incerto: "border-border bg-muted text-muted-foreground",
  invalido: "border-border bg-muted text-muted-foreground/60",
};

/** Normaliza para o formato nacional (DDD + número), removendo o +55. */
export function telefoneNacional(telefone: string | null | undefined): string {
  const d = apenasDigitos(telefone);
  return d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
}

/**
 * Heurística: considera WhatsApp ativo apenas se for um celular brasileiro válido
 * (11 dígitos, DDD 11-99 e nono dígito 9).
 */
export function statusWhatsApp(telefone: string | null | undefined): WhatsAppStatus {
  const d = apenasDigitos(telefone);
  // Se tem 13 dígitos e começa com 55, é um número com código do país.
  // Se tem 12 dígitos e começa com 55, pode ser um fixo com código do país ou celular sem o 9.
  const nacional = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;

  if (nacional.length === 11) {
    const ddd = parseInt(nacional.slice(0, 2), 10);
    // DDDs válidos no Brasil são de 11 a 99. O nono dígito (nacional[2]) deve ser 9.
    if (ddd >= 11 && ddd <= 99 && nacional[2] === "9") return "ativo";
  }

  if (nacional.length === 10) return "incerto";
  return "invalido";
}

export function temWhatsApp(telefone: string | null | undefined): boolean {
  return statusWhatsApp(telefone) === "ativo";
}

/**
 * Mensagem padronizada para o tooltip do indicador, explicando:
 * - se o número é celular válido (DDD + 9 dígitos);
 * - se o WhatsApp está ativo ou ausente/incerto.
 */
export function mensagemTooltipWhatsApp(telefone: string | null | undefined): string {
  const st = statusWhatsApp(telefone);
  const numero = telefoneNacional(telefone);

  if (st === "ativo") {
    return `Número de celular válido (${numero.slice(0, 2)} ${numero.slice(2, 3)} ${numero.slice(3, 7)}-${numero.slice(7)}) — WhatsApp ativo`;
  }

  if (st === "incerto") {
    return `Número de telefone fixo (${numero.slice(0, 2)} ${numero.slice(2, 6)}-${numero.slice(6)}) — WhatsApp não confirmado`;
  }

  if (!telefone || telefoneNacional(telefone).length === 0) {
    return "Telefone não informado — WhatsApp ausente";
  }

  return `Número incompleto ou inválido (${telefone.trim()}) — WhatsApp ausente`;
}

/**
 * Calcula o status de uma coleção carregada (leads, clientes) de uma vez,
 * para uso em `useMemo` logo após o carregamento dos dados.
 */
export function mapaWhatsApp<T extends { id: string; telefone?: string | null }>(
  itens: readonly T[],
): Map<string, WhatsAppStatus> {
  return new Map(itens.map((i) => [i.id, statusWhatsApp(i.telefone)]));
}
