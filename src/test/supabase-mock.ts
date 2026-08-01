import { vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

export type RespostaTabela = () => Promise<{ data: unknown; error: unknown }>;

type Respostas = Record<string, RespostaTabela>;

export function criarSessao(userId: string): Session {
  return {
    access_token: `token-${userId}`,
    refresh_token: "r",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: userId, email: `${userId}@brazon.test` },
  } as unknown as Session;
}

export function espera<T>(valor: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

/**
 * Mock controlável do cliente Supabase para exercitar o AuthProvider:
 * permite atrasar/derrubar a consulta de `user_roles` e disparar eventos de
 * troca de conta sem recarregar a página.
 */
export function criarSupabaseMock() {
  const listeners: ((evento: string, session: Session | null) => void)[] = [];
  let sessaoAtual: Session | null = null;
  let respostas: Respostas = {};

  function builder(tabela: string) {
    const resultado = () => (respostas[tabela] ?? (async () => ({ data: [], error: null })))();
    const obj = {
      select: () => obj,
      eq: () => obj,
      in: () => obj,
      maybeSingle: () => resultado(),
      then: (res: unknown, rej: unknown) => resultado().then(res as never, rej as never),
    };
    return obj as never;
  }

  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: sessaoAtual } })),
      onAuthStateChange: vi.fn((cb: (evento: string, session: Session | null) => void) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((tabela: string) => builder(tabela)),
  };

  return {
    supabase,
    definirSessao(s: Session | null) {
      sessaoAtual = s;
    },
    definirRespostas(r: Respostas) {
      respostas = r;
    },
    /** Simula onAuthStateChange (login, troca de conta, logout). */
    emitir(evento: string, s: Session | null) {
      sessaoAtual = s;
      listeners.forEach((cb) => cb(evento, s));
    },
  };
}

export const perfilOk =
  (userId: string): RespostaTabela =>
  async () => ({
    data: { id: userId, email: `${userId}@brazon.test`, nome: "Teste" },
    error: null,
  });

export const papeis =
  (roles: string[], atrasoMs = 0): RespostaTabela =>
  () =>
    espera({ data: roles.map((role) => ({ role })), error: null }, atrasoMs);

export const papeisErro =
  (atrasoMs = 0): RespostaTabela =>
  () =>
    espera({ data: null, error: { message: "network down" } }, atrasoMs);
