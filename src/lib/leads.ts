/** Constantes compartilhadas do módulo comercial (client-safe). */

export const LEAD_ESTAGIOS = [
  "contatado",
  "interessado",
  "nao_interessado",
  "em_negociacao",
  "ganho",
  "perdido",
] as const;
export type LeadEstagio = (typeof LEAD_ESTAGIOS)[number];

export const LEAD_ORIGENS = [
  "prospeccao_ativa",
  "indicacao",
  "inbound",
  "evento",
  "rede_social",
  "outro",
] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export const REUNIAO_STATUS = [
  "marcada",
  "realizada",
  "remarcada",
  "no_show",
  "cancelada",
] as const;
export type ReuniaoStatus = (typeof REUNIAO_STATUS)[number];

export const ESTAGIO_LABEL: Record<LeadEstagio, string> = {
  contatado: "Contatado",
  interessado: "Interessado",
  nao_interessado: "Não interessado",
  em_negociacao: "Em negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const ORIGEM_LABEL: Record<LeadOrigem, string> = {
  prospeccao_ativa: "Prospecção ativa",
  indicacao: "Indicação",
  inbound: "Inbound",
  evento: "Evento",
  rede_social: "Rede social",
  outro: "Outro",
};

export const REUNIAO_LABEL: Record<ReuniaoStatus, string> = {
  marcada: "Marcada",
  realizada: "Realizada",
  remarcada: "Remarcada",
  no_show: "No-show",
  cancelada: "Cancelada",
};

/** Não contam como pipeline aberto no dashboard. */
export const ESTAGIOS_FECHADOS: readonly LeadEstagio[] = ["ganho", "perdido", "nao_interessado"];

/** Únicos estágios sem follow-up: ganho deu certo, perdido o cliente não quer. */
export const ESTAGIOS_SEM_FOLLOW_UP: readonly LeadEstagio[] = ["ganho", "perdido"];

/** Estágios que exigem motivo da perda. */
export const ESTAGIOS_COM_MOTIVO: readonly LeadEstagio[] = ["perdido", "nao_interessado"];

export function estagioClasse(estagio: LeadEstagio): string {
  switch (estagio) {
    case "interessado":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30";
    case "em_negociacao":
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30";
    case "ganho":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
    case "perdido":
    case "nao_interessado":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Sugestões iniciais de segmento — texto livre, sem migration para criar novos. */
export const SEGMENTOS_SUGERIDOS = [
  "Comércio",
  "Serviços",
  "Indústria",
  "Saúde",
  "Educação",
  "Alimentação",
  "Beleza e estética",
  "Construção",
  "Tecnologia",
  "Transporte",
  "Outro",
] as const;

export function apenasDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

export function linkWhatsApp(telefone: string | null | undefined): string {
  const d = apenasDigitos(telefone);
  // Se já tem 55 no início, não duplica
  const numero = d.startsWith("55") ? d : `55${d}`;
  return `https://api.whatsapp.com/send?phone=${numero}`;
}

/** Divisão segura: nunca Infinity nem NaN. */
export function razao(numerador: number, denominador: number): number | null {
  if (!denominador) return null;
  return numerador / denominador;
}

export function percentual(valor: number | null): string {
  if (valor === null) return "—";
  return `${(valor * 100).toFixed(valor * 100 >= 10 ? 0 : 1)}%`;
}
