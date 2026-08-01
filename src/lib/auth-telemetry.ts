/**
 * Telemetria de autenticação: mede quanto tempo a sessão e o papel levam para
 * resolver e registra explicitamente a diferença entre "falhou" e "não tem
 * papel". Sem isso, um falso positivo de bloqueio ("Acesso não liberado")
 * é indistinguível de uma conta realmente sem perfil.
 *
 * Não envia dados pessoais: apenas ids técnicos, durações e desfechos.
 */

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
  | { tipo: "papel_retry"; userId: string | null }
  | { tipo: "troca_de_conta"; deUserId: string | null; paraUserId: string };

export type MotivoCarga = "inicial" | "troca_de_conta" | "retry" | "auth_event";

type EventoRegistrado = AuthTelemetryEvent & { emMs: number; rota: string };

const MAX_EVENTOS = 50;
const eventos: EventoRegistrado[] = [];

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

const agora = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

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

/** Registra um evento de telemetria de auth (memória + Sentry + console opcional). */
export function registrarAuthTelemetria(evento: AuthTelemetryEvent): void {
  const registrado: EventoRegistrado = {
    ...evento,
    emMs: Date.now(),
    rota: typeof window === "undefined" ? "ssr" : window.location.pathname,
  };

  eventos.push(registrado);
  if (eventos.length > MAX_EVENTOS) eventos.shift();

  if (typeof window === "undefined") return;
  window.__brazonAuthTelemetry = eventos;

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
    // eslint-disable-next-line no-console
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
