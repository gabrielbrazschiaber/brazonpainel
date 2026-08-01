/**
 * Fonte única do status de WhatsApp (client-safe).
 *
 * O status é derivado do próprio telefone, então formulários e listas mostram
 * sempre o mesmo resultado — sem depender de estado local de cada tela.
 */
import { apenasDigitos } from "@/lib/leads";

export type WhatsAppStatus = "ativo" | "incerto" | "invalido";

export const WHATSAPP_MENSAGEM: Record<WhatsAppStatus, string> = {
  ativo: "Cliente possui WhatsApp ativo — clique para abrir a conversa",
  incerto: "Número fixo: não foi possível confirmar WhatsApp",
  invalido: "Informe o telefone com DDD para verificar o WhatsApp",
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
 * Heurística: só celular brasileiro válido (DDD + 9 dígitos iniciando em 9)
 * conta como WhatsApp ativo. Fixo fica "incerto"; incompleto, "inválido".
 */
export function statusWhatsApp(telefone: string | null | undefined): WhatsAppStatus {
  const nacional = telefoneNacional(telefone);
  if (nacional.length === 11 && nacional[2] === "9") return "ativo";
  if (nacional.length === 10) return "incerto";
  return "invalido";
}

export function temWhatsApp(telefone: string | null | undefined): boolean {
  return statusWhatsApp(telefone) === "ativo";
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
