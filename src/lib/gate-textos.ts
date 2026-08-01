/**
 * Fonte única dos estados dos gates de acesso: chave técnica (usada em
 * `data-gate-estado`, na telemetria e nos testes) + textos exibidos.
 *
 * Testes E2E leem as mensagens DESTE arquivo, então qualquer mudança de texto
 * se propaga sozinha para CI, telemetria e interface — nunca duplique string
 * de gate em outro lugar.
 */

export const GATE_ESTADOS = {
  carregando: "carregando",
  erro: "erro",
  semPapel: "sem_papel",
} as const;

export type GateEstadoChave = (typeof GATE_ESTADOS)[keyof typeof GATE_ESTADOS];

export const GATE_TEXTOS = {
  carregando: {
    /** Rótulo acessível do spinner — nunca insinua bloqueio. */
    aria: "Carregando",
  },
  sem_papel: {
    titulo: "Acesso não liberado",
    descricao:
      "Sua conta ainda não possui um perfil de acesso configurado. Fale com o administrador da plataforma para liberar seu acesso.",
    acao: "Sair da conta",
    acaoOcupado: "Saindo...",
  },
  erro: {
    titulo: "Falha de conexão",
    descricao:
      "Não conseguimos verificar seu perfil de acesso agora. Confira sua conexão e tente novamente.",
    acao: "Tentar novamente",
    acaoOcupado: "Tentando...",
    acaoAguardando: (segundos: number) => `Nova tentativa em ${segundos}s`,
    esgotado:
      "As tentativas automáticas terminaram. Recarregue a página ou tente novamente em alguns minutos.",
    recarregar: "Recarregar página",
  },
} as const;

/** Textos que NUNCA podem aparecer durante o carregamento (checado no E2E). */
export const GATE_TEXTOS_DE_BLOQUEIO: readonly string[] = [
  GATE_TEXTOS.sem_papel.titulo,
  GATE_TEXTOS.erro.titulo,
];

/** Retry do gate de erro: backoff exponencial com teto de tentativas. */
export const GATE_RETRY = {
  maxTentativas: 4,
  baseMs: 1000,
  tetoMs: 15000,
} as const;

/** 1s, 2s, 4s, 8s... limitado por `tetoMs`. */
export function atrasoBackoffMs(tentativa: number): number {
  const bruto = GATE_RETRY.baseMs * 2 ** Math.max(0, tentativa - 1);
  return Math.min(bruto, GATE_RETRY.tetoMs);
}
