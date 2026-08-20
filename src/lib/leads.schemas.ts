import { z } from "zod";
import { LEAD_ESTAGIOS, LEAD_ORIGENS, LEAD_SITUACAO, REUNIAO_STATUS, apenasDigitos } from "@/lib/leads";

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const telefoneSchema = z
  .string()
  .trim()
  .min(1, "Informe o telefone")
  .refine((v) => {
    const d = apenasDigitos(v);
    return d.length >= 10 && d.length <= 11;
  }, "Telefone deve ter DDD + número (10 ou 11 dígitos)");

const emailSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v === null || v === undefined || z.string().email().safeParse(v).success, {
    message: "E-mail inválido",
  });

const dataOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const listarLeadsSchema = z.object({
  estagio: z.union([z.enum(LEAD_ESTAGIOS), z.array(z.enum(LEAD_ESTAGIOS))]).optional(),
  situacao_contato: z.union([z.enum(LEAD_SITUACAO), z.array(z.enum(LEAD_SITUACAO))]).optional(),
  segmento: z.string().trim().max(120).optional(),
  origem: z.union([z.enum(LEAD_ORIGENS), z.array(z.enum(LEAD_ORIGENS))]).optional(),
  busca: z.string().trim().max(120).optional(),
  dias: z.number().int().min(0).max(3650).optional(),
  vendedor_id: z.string().uuid().optional(),
  apenas_follow_up: z.boolean().optional(),
  /** Só leads com follow-up vencido (antes de hoje). */
  apenas_atrasados: z.boolean().optional(),
  /** Só leads com dados faltando (completude < 4). */
  apenas_incompletos: z.boolean().optional(),
  /** Filtra por lote de importação. */
  importacao_id: z.string().uuid().optional(),
  /** Ordenação da lista. */
  ordem: z.enum(["recentes", "completude"]).optional(),
  /** Paginação: página 0-based e tamanho da página. */
  pagina: z.number().int().min(0).max(1000).optional(),
  por_pagina: z.number().int().min(1).max(100).optional(),
});

export const salvarLeadSchema = z
  .object({
    id: z.string().uuid().optional(),
    vendedor_id: z.string().uuid().optional(),
    nome_contato: z.string().trim().min(2, "Informe o nome do contato").max(120),
    empresa: texto(120),
    cargo: texto(120),
    telefone: telefoneSchema,
    email: emailSchema,
    segmento: texto(120),
    origem: z.enum(LEAD_ORIGENS).default("prospeccao_ativa"),
    estagio: z.enum(LEAD_ESTAGIOS).default("contatado"),
    valor_estimado: z.number().min(0).max(99999999).default(0),
    motivo_perda: texto(500),
    observacoes: texto(4000),
    contatado_em: dataOpcional,
    proximo_contato: dataOpcional,
  })
  .refine(
    (d) => !(d.estagio === "perdido" || d.estagio === "nao_interessado") || Boolean(d.motivo_perda),
    { message: "Informe o motivo da perda", path: ["motivo_perda"] },
  );

export const mudarEstagioSchema = z
  .object({
    id: z.string().uuid(),
    estagio: z.enum(LEAD_ESTAGIOS),
    motivo_perda: texto(500),
  })
  .refine(
    (d) => !(d.estagio === "perdido" || d.estagio === "nao_interessado") || Boolean(d.motivo_perda),
    { message: "Informe o motivo da perda", path: ["motivo_perda"] },
  );

export const atividadeSchema = z.object({
  lead_id: z.string().uuid(),
  corpo: z.string().trim().min(1, "Escreva a nota").max(4000),
});

export const leadIdSchema = z.object({ lead_id: z.string().uuid() });
export const idSchema = z.object({ id: z.string().uuid() });

export const salvarReuniaoSchema = z.object({
  id: z.string().uuid().optional(),
  lead_id: z.string().uuid(),
  agendada_para: z.string().trim().min(1, "Informe a data e hora"),
  status: z.enum(REUNIAO_STATUS).default("marcada"),
  notas: texto(2000),
  /** Nova data obrigatória quando o status for 'remarcada'. */
  nova_data: z.string().trim().optional(),
});

export const followUpsSchema = z.object({
  vendedor_id: z.string().uuid().optional(),
  limite: z.number().int().min(1).max(100).optional(),
});

export const reagendarFollowUpSchema = z.object({
  id: z.string().uuid(),
  proximo_contato: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

export const RESULTADOS_FOLLOW_UP = [
  "mensagem_enviada",
  "respondeu",
  "nao_respondeu",
  "sem_whatsapp",
  "lead_inexistente",
  "adiar",
  "reativar",
] as const;
export type ResultadoFollowUp = (typeof RESULTADOS_FOLLOW_UP)[number];

export const registrarFollowUpSchema = z
  .object({
    lead_id: z.string().uuid(),
    resultado: z.enum(RESULTADOS_FOLLOW_UP),
    nota: texto(2000),
    novo_estagio: z.enum(LEAD_ESTAGIOS).optional(),
    adiar_dias: z.number().int().min(1).max(180).optional(),
    mensagem_id: z.string().uuid().optional(),
    prazo_dias: z.number().int().min(1).max(30).default(2),
    motivo: texto(500),
  })
  .refine((d) => d.resultado !== "respondeu" || Boolean(d.novo_estagio), {
    message: "Informe o novo estágio do lead",
    path: ["novo_estagio"],
  })
  .refine((d) => d.resultado !== "adiar" || Boolean(d.adiar_dias), {
    message: "Informe em quantos dias adiar",
    path: ["adiar_dias"],
  })
  .refine((d) => !(["sem_whatsapp", "lead_inexistente"].includes(d.resultado)) || (d.motivo?.length ?? 0) <= 500, {
    message: "Motivo deve ter no máximo 500 caracteres",
    path: ["motivo"],
  });

export const reativarCadenciaSchema = z.object({ lead_id: z.string().uuid() });

export const dashboardSchema = z.object({
  dias: z.number().int().min(0).max(3650).optional(),
  vendedor_id: z.string().uuid().optional(),
});

export const registrarEnvioMensagemSchema = z.object({
  lead_id: z.string().uuid(),
  mensagem_id: z.string().uuid(),
});

export const mensagemRapidaSchema = z.object({
  id: z.string().uuid().optional(),
  texto: z.string().trim().min(1, "O texto não pode estar vazio").max(2000),
  ordem: z.number().int().default(0),
});

export type SalvarLeadInput = z.input<typeof salvarLeadSchema>;
