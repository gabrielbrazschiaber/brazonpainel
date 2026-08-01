/** Constantes e helpers client-safe do Banco de Leads. */

export const BANCO_LEAD_STATUS = ["disponivel", "puxado", "arquivado"] as const;
export type BancoLeadStatus = (typeof BANCO_LEAD_STATUS)[number];

export const BANCO_STATUS_LABEL: Record<BancoLeadStatus, string> = {
  disponivel: "Disponível",
  puxado: "Puxado",
  arquivado: "Arquivado",
};

export function bancoStatusClasse(status: BancoLeadStatus): string {
  switch (status) {
    case "disponivel":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
    case "puxado":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Teto fixo de leads que um vendedor pode puxar por hora (validado no banco). */
export const LIMITE_PUXADAS_HORA = 20;

/** Limites da importação do banco de leads (planilhas grandes de CNPJ). */
export const MAX_LINHAS_BANCO = 20000;
export const MAX_BYTES_BANCO = 35 * 1024 * 1024;
/** Linhas enviadas por requisição — o resto sobe em blocos com progresso. */
export const BLOCO_IMPORT_BANCO = 500;

/** Horas de reserva padrão de um lote quando as configurações não dizem nada. */
export const HORAS_RESERVA_PADRAO = 48;

export const ESTADOS_BR = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Hora local formatada (HH:MM) de quando a cota volta a subir. */
export function horaRenovacao(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Dias restantes até a devolução automática de um lead puxado. */
export function diasParaDevolucao(puxadoEm: string | null, prazoDias: number): number | null {
  if (!puxadoEm) return null;
  const puxado = new Date(puxadoEm).getTime();
  if (Number.isNaN(puxado)) return null;
  const limite = puxado + prazoDias * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((limite - Date.now()) / (24 * 60 * 60 * 1000)));
}
