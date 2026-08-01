/**
 * Telemetria de autenticação: mede quanto tempo a sessão e o papel levam para
 * resolver e registra explicitamente a diferença entre "falhou" e "não tem
 * papel". Sem isso, um falso positivo de bloqueio ("Acesso não liberado")
 * é indistinguível de uma conta realmente sem perfil.
 *
 * Além do buffer em memória (usado por testes e suporte), os eventos relevantes
 * são gravados em `auth_telemetria` para o painel do admin comparar versões e
 * rotas ao longo do tempo.
 *
 * Não envia dados pessoais: apenas ids técnicos, durações e desfechos.
 */
import { supabase } from "@/integrations/supabase/client";
import { traceId } from "@/lib/telemetry-trace";
import { exportarEventos, type EventoExportado } from "@/lib/telemetry-export";

export type AuthTelemetryEvent =
  | { tipo: "sessao_resolvida"; comSessao: boolean; duracaoMs: number }
  | { tipo: "papel_inicio"; userId: string; motivo: MotivoCarga }
  | {
      tipo: "papel_resolvido";
      userId: string;
      papel: string;
      duracaoMs: number;
      motivo: MotivoCarga;
    }
  | { tipo: "papel_sem_papel"; userId: string; duracaoMs: number; motivo: MotivoCarga }
  | {
      tipo: "papel_erro";
      userId: string;
      duracaoMs: number;
      motivo: MotivoCarga;
      erro: string;
    }
  | {
      tipo: "papel_retry";
      userId: string | null;
      tentativa?: number;
      automatico?: boolean;
    }
  | { tipo: "troca_de_conta"; deUserId: string | null; paraUserId: string };

export type MotivoCarga = "inicial" | "troca_de_conta" | "retry" | "auth_event";

type EventoRegistrado = AuthTelemetryEvent & { emMs: number; rota: string; traceId: string };

const MAX_EVENTOS = 50;
const eventos: EventoRegistrado[] = [];

/** Versão do build — permite comparar regressões entre publicações. */
export const APP_VERSION: string =
  (import.meta.env["VITE_APP_VERSION"] as string | undefined) ??
  (import.meta.env.MODE === "production" ? "producao" : "desenvolvimento");

declare global {
  interface Window {
    __brazonAuthTelemetry?: EventoRegistrado[];
    /** Sentry (ou compatível) quando disponível na página. */
    Sentry?: {
      addBreadcrumb?: (b: Record<string, unknown>) => void;
      captureMessage?: (msg: string, ctx?: Record<string, unknown>) => void;
    };
  }
}

const agora = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Cronômetro simples: `const fim = iniciarMedicao(); fim() // ms` */
export function iniciarMedicao(): () => number {
  const t0 = agora();
  return () => Math.round(agora() - t0);
}

const DEBUG_KEY = "brazon:debug-auth";

function debugAtivo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

/* ------------------------------ persistência ------------------------------ */

interface LinhaTelemetria {
  user_id: string | null;
  tipo: string;
  motivo: string | null;
  rota: string;
  duracao_ms: number | null;
  papel: string | null;
  erro: string | null;
  app_version: string;
  user_agent: string | null;
  /** Correlaciona com os artefatos do E2E (vídeo/screenshot/dump). */
  trace_id: string;
}

/** `papel_inicio` é ruído: só o desfecho interessa para métricas. */
const TIPOS_PERSISTIDOS = new Set([
  "sessao_resolvida",
  "papel_resolvido",
  "papel_sem_papel",
  "papel_erro",
  "papel_retry",
  "troca_de_conta",
]);

const fila: LinhaTelemetria[] = [];
const LOTE_MAX = 20;
const ESPERA_MS = 3000;
let agendado: ReturnType<typeof setTimeout> | null = null;
let enviando = false;

function paraLinha(e: EventoRegistrado): LinhaTelemetria {
  const registro = e as Record<string, unknown>;
  const userId =
    e.tipo === "troca_de_conta"
      ? e.paraUserId
      : ((registro["userId"] as string | null | undefined) ?? null);
  return {
    user_id: userId ?? null,
    tipo: e.tipo,
    motivo: (registro["motivo"] as string | undefined) ?? null,
    rota: e.rota,
    duracao_ms: (registro["duracaoMs"] as number | undefined) ?? null,
    papel: (registro["papel"] as string | undefined) ?? null,
    erro: (registro["erro"] as string | undefined) ?? null,
    app_version: APP_VERSION,
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 300),
    trace_id: e.traceId,
  };
}

function paraExportado(l: LinhaTelemetria): EventoExportado {
  return {
    tipo: l.tipo,
    motivo: l.motivo,
    rota: l.rota,
    duracao_ms: l.duracao_ms,
    papel: l.papel,
    erro: l.erro,
    app_version: l.app_version,
    trace_id: l.trace_id,
    user_id: l.user_id,
    em: new Date().toISOString(),
  };
}

async function descarregar() {
  if (enviando || fila.length === 0) return;
  enviando = true;
  const lote = fila.splice(0, LOTE_MAX);
  try {
    // Telemetria nunca deve quebrar a aplicação nem tentar de novo em loop.
    await Promise.all([
      supabase.from("auth_telemetria").insert(lote),
      exportarEventos(lote.map(paraExportado)),
    ]);
  } catch {
    /* silencioso por design */
  } finally {
    enviando = false;
    if (fila.length > 0) agendarDescarga();
  }
}

function agendarDescarga() {
  if (agendado) return;
  agendado = setTimeout(() => {
    agendado = null;
    void descarregar();
  }, ESPERA_MS);
}

function enfileirar(e: EventoRegistrado) {
  if (typeof window === "undefined") return;
  if (!TIPOS_PERSISTIDOS.has(e.tipo)) return;
  fila.push(paraLinha(e));
  if (fila.length >= LOTE_MAX) void descarregar();
  else agendarDescarga();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void descarregar());
}

/* -------------------------------- registro -------------------------------- */

/** Registra um evento de telemetria de auth (memória + banco + externo + Sentry). */
export function registrarAuthTelemetria(evento: AuthTelemetryEvent): void {
  const registrado: EventoRegistrado = {
    ...evento,
    emMs: Date.now(),
    rota: typeof window === "undefined" ? "ssr" : window.location.pathname,
    traceId: traceId(),
  };

  eventos.push(registrado);
  if (eventos.length > MAX_EVENTOS) eventos.shift();

  if (typeof window === "undefined") return;
  window.__brazonAuthTelemetry = eventos;
  enfileirar(registrado);

  window.Sentry?.addBreadcrumb?.({
    category: "auth",
    level: evento.tipo === "papel_erro" ? "error" : "info",
    message: evento.tipo,
    data: registrado as unknown as Record<string, unknown>,
  });

  // Falha de resolução de papel é o sinal mais importante: sobe como evento.
  if (evento.tipo === "papel_erro") {
    window.Sentry?.captureMessage?.("auth.papel_erro", {
      level: "error",
      extra: registrado as unknown as Record<string, unknown>,
    });
    window.__lovableEvents?.captureException?.(
      new Error(`Falha ao resolver papel do usuário: ${evento.erro}`),
      { source: "auth_role_resolution", ...registrado },
      { mechanism: "manual", handled: true, severity: "warning" },
    );
  }

  if (debugAtivo()) {
    console.info("[auth]", evento.tipo, registrado);
  }
}

/** Eventos acumulados nesta sessão de navegador (usado em testes e suporte). */
export function lerAuthTelemetria(): EventoRegistrado[] {
  return [...eventos];
}

export function limparAuthTelemetria(): void {
  eventos.length = 0;
  if (typeof window !== "undefined") window.__brazonAuthTelemetry = eventos;
}
