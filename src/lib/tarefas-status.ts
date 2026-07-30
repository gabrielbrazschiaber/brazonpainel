export type TarefaStatusValor =
  | "aberta"
  | "em_andamento"
  | "aguardando_cliente"
  | "concluida"
  | "cancelada";

export const TAREFA_STATUS: TarefaStatusValor[] = [
  "aberta",
  "em_andamento",
  "aguardando_cliente",
  "concluida",
  "cancelada",
];

export const TAREFA_STATUS_LABEL: Record<TarefaStatusValor, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/** Transições permitidas para a equipe (vendedor). */
const TRANSICOES: Record<TarefaStatusValor, TarefaStatusValor[]> = {
  aberta: ["em_andamento", "aguardando_cliente", "cancelada"],
  em_andamento: ["aberta", "aguardando_cliente", "concluida", "cancelada"],
  aguardando_cliente: ["em_andamento", "concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

/** Transições extras que só o admin pode fazer (reabrir tarefas finalizadas). */
const TRANSICOES_ADMIN: Record<TarefaStatusValor, TarefaStatusValor[]> = {
  aberta: [],
  em_andamento: [],
  aguardando_cliente: [],
  concluida: ["em_andamento", "aberta"],
  cancelada: ["aberta", "em_andamento"],
};

/** Lista de status para os quais é possível mudar a partir do status atual. */
export function transicoesPermitidas(
  atual: TarefaStatusValor,
  isAdmin: boolean,
): TarefaStatusValor[] {
  const base = TRANSICOES[atual] ?? [];
  return isAdmin ? [...base, ...TRANSICOES_ADMIN[atual]] : base;
}

export function transicaoPermitida(
  atual: TarefaStatusValor,
  novo: TarefaStatusValor,
  isAdmin: boolean,
): boolean {
  if (atual === novo) return true;
  return transicoesPermitidas(atual, isAdmin).includes(novo);
}

/** Mensagem clara para o usuário quando a transição é bloqueada. */
export function mensagemTransicaoInvalida(
  atual: TarefaStatusValor,
  novo: TarefaStatusValor,
  isAdmin: boolean,
): string {
  const de = TAREFA_STATUS_LABEL[atual];
  const para = TAREFA_STATUS_LABEL[novo];
  if (atual === "concluida" || atual === "cancelada") {
    return isAdmin
      ? `Não é possível mudar de "${de}" para "${para}".`
      : `A tarefa está "${de}" e só um administrador pode reabri-la.`;
  }
  const opcoes = transicoesPermitidas(atual, isAdmin)
    .map((s) => TAREFA_STATUS_LABEL[s])
    .join(", ");
  return `Não é possível mudar de "${de}" para "${para}". Status permitidos: ${opcoes || "nenhum"}.`;
}
