/** Helpers de UI da cadência de follow-up (client-safe). */
import type { LeadEstagio } from "@/lib/leads";
import type { FollowUp } from "@/lib/leads.functions";

/** Opções de adiamento manual (adiar não gasta tentativa). */
export const ADIAMENTOS = [3, 7, 15, 30] as const;

/** Estágios oferecidos quando o lead respondeu ao contato. */
export const ESTAGIOS_RESPOSTA: readonly LeadEstagio[] = [
  "interessado",
  "em_negociacao",
  "nao_interessado",
  "ganho",
  "perdido",
];

/** Soma dias a hoje e devolve no formato AAAA-MM-DD (fuso local). */
export function dataRelativa(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Dias inteiros desde a data informada (null quando não houver). */
export function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** "3ª tentativa · último contato há 4 dias" */
export function resumoCadencia(item: FollowUp): string {
  const tentativa =
    item.follow_ups_feitos > 0
      ? `${item.follow_ups_feitos}ª tentativa`
      : "Sem tentativa registrada";
  const dias = diasDesde(item.ultimo_contato_em);
  if (dias === null) return tentativa;
  const quando =
    dias === 0 ? "último contato hoje" : `último contato há ${dias} dia${dias === 1 ? "" : "s"}`;
  return `${tentativa} · ${quando}`;
}
