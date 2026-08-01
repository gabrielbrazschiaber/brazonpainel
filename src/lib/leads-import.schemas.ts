import { z } from "zod";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const telefoneDigitos = z
  .string()
  .trim()
  .regex(/^\d{10,11}$/, "Telefone deve ter DDD + número (10 ou 11 dígitos)");

export const verificarDuplicadosSchema = z.object({
  telefones: z.array(z.string().trim().max(20)).max(2000),
  destino_vendedor_id: z.string().uuid().optional(),
});

export const linhaImportSchema = z.object({
  linha: z.number().int().min(1).max(5000),
  nome_contato: z.string().trim().min(2, "Nome obrigatório").max(120),
  telefone: telefoneDigitos,
  empresa: opcional(120),
  cargo: opcional(120),
  email: opcional(200),
  segmento: opcional(120),
  observacoes: opcional(4000),
  valor_estimado: z.number().min(0).max(99999999).default(0),
  acao: z.enum(["criar", "atualizar", "ignorar"]),
  lead_id: z.string().uuid().optional(),
});

export const importarLeadsSchema = z.object({
  arquivo_nome: z.string().trim().min(1).max(200),
  destino_vendedor_id: z.string().uuid().optional(),
  total_linhas: z.number().int().min(0).max(5000).optional(),
  linhas: z.array(linhaImportSchema).min(1, "Nenhuma linha para importar").max(2000),
});

export const importacaoIdSchema = z.object({ importacao_id: z.string().uuid() });

export type LinhaImportInput = z.infer<typeof linhaImportSchema>;
