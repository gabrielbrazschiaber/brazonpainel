import { z } from "zod";

/** Vencimento padrão: 30 dias a partir de hoje (YYYY-MM-DD). */
export function defaultVencimento() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/** Converte "1.234,56" ou "1234.56" em número. Vazio => 0. */
export function parseValorBR(valor: string): number {
  if (!valor.trim()) return 0;
  const n = Number(valor.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export const clienteFormSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(120),
    email: z.string().trim().min(1, "Informe o e-mail.").email("Informe um e-mail válido.").max(255),
    cpfCnpj: z.string().trim().max(20).default(""),
    telefone: z.string().trim().max(20).default(""),
    planoId: z.string().trim().default(""),
    servicoExtra: z.string().trim().max(200).default(""),
    servicoValor: z.string().trim().default(""),
    vencimento: z.string().trim().default(""),
    mensagem: z.string().trim().max(1000).default(""),
    anotacoes: z.string().trim().max(2000).default(""),
    senha: z.string().default(""),
    cupom: z.string().trim().max(40).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.senha && v.senha.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senha"],
        message: "A nova senha deve ter pelo menos 6 caracteres.",
      });
    }
    const valorExtra = parseValorBR(v.servicoValor);
    if (Number.isNaN(valorExtra) || valorExtra < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["servicoValor"],
        message: "Informe um valor de serviço extra válido.",
      });
      return;
    }
    if (v.servicoExtra && valorExtra <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["servicoValor"],
        message: "Informe o valor do serviço extra.",
      });
    }
  });

export type ClienteFormValues = z.infer<typeof clienteFormSchema>;

export const clienteFormVazio: ClienteFormValues = {
  nome: "",
  email: "",
  cpfCnpj: "",
  telefone: "",
  planoId: "",
  servicoExtra: "",
  servicoValor: "",
  vencimento: defaultVencimento(),
  mensagem: "",
  anotacoes: "",
  senha: "",
  cupom: "",
};

/** Campos comuns enviados ao servidor tanto na criação quanto na edição. */
export function clientePayloadComum(v: ClienteFormValues) {
  return {
    nome: v.nome,
    email: v.email,
    plano_id: v.planoId || null,
    servico_extra: v.servicoExtra || null,
    servico_extra_valor: parseValorBR(v.servicoValor),
    cpf_cnpj: v.cpfCnpj || null,
    telefone: v.telefone || null,
    anotacoes: v.anotacoes || null,
  };
}
