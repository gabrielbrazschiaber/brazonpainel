import { z } from "zod";
import { LEAD_ORIGENS, apenasDigitos } from "@/lib/leads";
import { BANCO_LEAD_STATUS, LIMITE_PUXADAS_HORA } from "@/lib/banco-leads";

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

export const listarBancoLeadsSchema = z.object({
  status: z.enum(BANCO_LEAD_STATUS).optional(),
  segmento: z.string().trim().max(120).optional(),
  cidade: z.string().trim().max(120).optional(),
  estado: z.string().trim().max(2).optional(),
  busca: z.string().trim().max(120).optional(),
  lote_id: z.string().uuid().optional(),
  vendedor_id: z.string().uuid().optional(),
  /** Só os leads que o vendedor logado puxou. */
  meus: z.boolean().optional(),
  pagina: z.number().int().min(0).max(1000).optional(),
  por_pagina: z.number().int().min(1).max(100).optional(),
});

export const salvarBancoLeadSchema = z.object({
  id: z.string().uuid().optional(),
  nome_contato: z.string().trim().min(2, "Informe o nome do contato").max(120),
  empresa: texto(120),
  cargo: texto(120),
  telefone: telefoneSchema,
  email: emailSchema,
  segmento: texto(120),
  cidade: texto(120),
  estado: texto(2),
  origem: z.enum(LEAD_ORIGENS).default("prospeccao_ativa"),
  observacoes: texto(4000),
  reservado_segmento: texto(120),
  reservado_estado: texto(2),
});

export const linhaBancoSchema = z.object({
  linha: z.number().int().min(1).max(5000),
  nome_contato: z.string().trim().min(2, "Nome obrigatório").max(120),
  telefone: z
    .string()
    .trim()
    .regex(/^\d{10,11}$/, "Telefone deve ter DDD + número"),
  empresa: texto(120),
  cargo: texto(120),
  email: texto(200),
  segmento: texto(120),
  cidade: texto(120),
  estado: texto(2),
  observacoes: texto(4000),
});

export const importarBancoLeadsSchema = z.object({
  arquivo_nome: z.string().trim().min(1).max(200),
  /** De onde veio a lista — obrigatório para medir a qualidade do lote. */
  fonte: z.string().trim().min(2, "Informe a fonte da lista").max(160),
  reservado_segmento: texto(120),
  reservado_estado: texto(2),
  origem: z.enum(LEAD_ORIGENS).default("prospeccao_ativa"),
  total_linhas: z.number().int().min(0).max(5000).optional(),
  linhas: z.array(linhaBancoSchema).min(1, "Nenhuma linha para importar").max(2000),
});

export const puxarLeadsSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, "Selecione pelo menos um lead")
    .max(LIMITE_PUXADAS_HORA, `Máximo de ${LIMITE_PUXADAS_HORA} leads por vez`),
});

export const bancoLeadIdSchema = z.object({ banco_lead_id: z.string().uuid() });

export const definirEscopoVendedorSchema = z.object({
  vendedor_id: z.string().uuid(),
  segmentos: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  estados: z.array(z.string().trim().length(2)).max(27).default([]),
});

export type SalvarBancoLeadInput = z.input<typeof salvarBancoLeadSchema>;
export type LinhaBancoInput = z.infer<typeof linhaBancoSchema>;
