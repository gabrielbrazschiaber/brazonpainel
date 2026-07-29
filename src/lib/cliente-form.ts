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

/** Mantém apenas dígitos (CPF/CNPJ, telefone). */
export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/** CPF (11) ou CNPJ (14) — valida o tamanho e rejeita dígitos repetidos. */
export function cpfCnpjValido(v: string): boolean {
  const d = somenteDigitos(v);
  if (d.length !== 11 && d.length !== 14) return false;
  return !/^(\d)\1+$/.test(d);
}

/** Telefone brasileiro com DDD: 10 ou 11 dígitos. */
export function telefoneValido(v: string): boolean {
  const d = somenteDigitos(v);
  return d.length === 10 || d.length === 11;
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
    const erro = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (!v.cpfCnpj.trim()) {
      erro("cpfCnpj", "Informe o CPF ou CNPJ do cliente.");
    } else if (!cpfCnpjValido(v.cpfCnpj)) {
      erro("cpfCnpj", "CPF deve ter 11 dígitos e CNPJ 14 dígitos.");
    }

    if (v.telefone.trim() && !telefoneValido(v.telefone)) {
      erro("telefone", "Informe o telefone com DDD (10 ou 11 dígitos).");
    }

    if (!v.planoId.trim()) {
      erro("planoId", "Selecione o plano do cliente.");
    }

    if (v.senha && v.senha.length < 6) {
      erro("senha", "A nova senha deve ter pelo menos 6 caracteres.");
    }

    const valorExtra = parseValorBR(v.servicoValor);
    if (Number.isNaN(valorExtra) || valorExtra < 0) {
      erro("servicoValor", "Informe um valor de serviço extra válido.");
    } else if (v.servicoExtra && valorExtra <= 0) {
      erro("servicoValor", "Informe o valor do serviço extra.");
    } else if (!v.servicoExtra && valorExtra > 0) {
      erro("servicoExtra", "Descreva o serviço extra cobrado.");
    }
  });

/** Regras extras aplicadas somente ao cadastrar (vencimento obrigatório e futuro). */
export function validarCadastro(v: ClienteFormValues): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!v.vencimento) {
    erros.vencimento = "Informe a data do primeiro vencimento.";
  } else {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const d = new Date(`${v.vencimento}T00:00:00`);
    if (Number.isNaN(d.getTime())) erros.vencimento = "Data de vencimento inválida.";
    else if (d < hoje) erros.vencimento = "O vencimento não pode ser uma data passada.";
  }
  return erros;
}

/** Converte os erros do zod em um mapa campo → mensagem. */
export function errosPorCampo(issues: { path: (string | number)[]; message: string }[]) {
  const mapa: Record<string, string> = {};
  for (const i of issues) {
    const campo = String(i.path[0] ?? "");
    if (campo && !mapa[campo]) mapa[campo] = i.message;
  }
  return mapa;
}


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
