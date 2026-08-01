/**
 * Catálogo de solicitações do cliente.
 * Fonte única (client-safe) usada pela página /solicitacoes e pela fila /tarefas.
 */

export type CategoriaSolicitacao =
  | "alterar_plano"
  | "servico_adicional"
  | "segunda_via"
  | "alterar_vencimento"
  | "atualizar_dados"
  | "cancelar_assinatura"
  | "outra";

export interface CampoSolicitacao {
  nome: string;
  label: string;
  tipo: "texto" | "textarea" | "select_plano" | "dia_mes" | "select_motivo";
  obrigatorio: boolean;
  ajuda?: string;
}

export interface ItemCatalogo {
  categoria: CategoriaSolicitacao;
  titulo: string;
  descricao: string;
  icone: string;
  prioridade: "baixa" | "media" | "alta";
  campos: CampoSolicitacao[];
  avisoAntes?: string;
}

export const MOTIVOS_CANCELAMENTO = [
  "Preço",
  "Não estou usando",
  "Faltou um recurso",
  "Problema no atendimento",
  "Vou usar outro serviço",
  "Outro",
] as const;

export const AVISO_RENOVACAO =
  "Você não precisa pedir renovação — sua assinatura é mensal e a cobrança é gerada automaticamente todo mês.";

export const CATALOGO_SOLICITACOES: ItemCatalogo[] = [
  {
    categoria: "alterar_plano",
    titulo: "Alterar plano",
    descricao: "Fazer upgrade ou downgrade da sua assinatura",
    icone: "ArrowUpDown",
    prioridade: "media",
    campos: [
      { nome: "plano_id", label: "Plano desejado", tipo: "select_plano", obrigatorio: true },
      { nome: "motivo", label: "Motivo / observação", tipo: "textarea", obrigatorio: false },
    ],
  },
  {
    categoria: "servico_adicional",
    titulo: "Serviço adicional",
    descricao: "Contratar um serviço extra que soma à mensalidade",
    icone: "PackagePlus",
    prioridade: "media",
    campos: [
      { nome: "necessidade", label: "O que você precisa", tipo: "textarea", obrigatorio: true },
    ],
  },
  {
    categoria: "segunda_via",
    titulo: "Segunda via de cobrança",
    descricao: "Reenviar o boleto ou PIX da fatura em aberto",
    icone: "Receipt",
    prioridade: "alta",
    campos: [{ nome: "observacao", label: "Observação", tipo: "textarea", obrigatorio: false }],
    avisoAntes:
      "Se você já tem uma fatura em aberto, o link de pagamento está disponível na sua área do cliente.",
  },
  {
    categoria: "alterar_vencimento",
    titulo: "Alterar vencimento",
    descricao: "Mudar o dia do mês em que a cobrança é gerada",
    icone: "CalendarClock",
    prioridade: "media",
    campos: [
      {
        nome: "dia",
        label: "Dia desejado",
        tipo: "dia_mes",
        obrigatorio: true,
        ajuda: "Entre 1 e 28",
      },
      { nome: "motivo", label: "Motivo", tipo: "textarea", obrigatorio: false },
    ],
  },
  {
    categoria: "atualizar_dados",
    titulo: "Atualizar meus dados",
    descricao: "Corrigir CPF/CNPJ, telefone ou e-mail",
    icone: "UserPen",
    prioridade: "media",
    campos: [
      {
        nome: "correcao",
        label: "O que precisa ser corrigido",
        tipo: "textarea",
        obrigatorio: true,
      },
    ],
  },
  {
    categoria: "cancelar_assinatura",
    titulo: "Cancelar assinatura",
    descricao: "Encerrar sua assinatura mensal",
    icone: "CircleX",
    prioridade: "alta",
    campos: [
      { nome: "motivo", label: "Motivo", tipo: "select_motivo", obrigatorio: true },
      { nome: "detalhes", label: "Detalhes", tipo: "textarea", obrigatorio: false },
    ],
    avisoAntes:
      "Ao cancelar, você perde o acesso ao final do período já pago. Não há reembolso de valores já faturados.",
  },
  {
    categoria: "outra",
    titulo: "Outra solicitação",
    descricao: "Descreva livremente o que precisa",
    icone: "MessageSquarePlus",
    prioridade: "media",
    campos: [
      { nome: "solicitacao", label: "Sua solicitação", tipo: "textarea", obrigatorio: true },
    ],
  },
];

export function itemPorCategoria(c: CategoriaSolicitacao): ItemCatalogo | undefined {
  return CATALOGO_SOLICITACOES.find((i) => i.categoria === c);
}

export function rotuloCategoria(c: string): string {
  return CATALOGO_SOLICITACOES.find((i) => i.categoria === c)?.titulo ?? "Solicitação";
}
