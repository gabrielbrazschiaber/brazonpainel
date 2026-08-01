/**
 * Trace ID único por execução de navegador.
 *
 * Serve para correlacionar ponta a ponta um incidente de gate:
 *  - artefatos do E2E (vídeo, screenshot, dump de HTML) usam o trace no nome;
 *  - cada evento de `auth_telemetria` grava o mesmo valor em `trace_id`;
 *  - o destino externo (Sentry/Datadog) recebe o mesmo campo.
 *
 * No E2E o valor é injetado antes do carregamento da página em
 * `window.__brazonTraceId` (ou no localStorage), então o mesmo trace vale para
 * todas as navegações daquele cenário. Fora do teste, geramos um id por aba.
 */

const CHAVE = "brazon:trace-id";

let cache: string | null = null;

declare global {
  interface Window {
    __brazonTraceId?: string;
  }
}

function gerar(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `t-${Date.now().toString(36)}-${aleatorio}`;
}

/** Trace ID atual (estável dentro da aba/execução). */
export function traceId(): string {
  if (cache) return cache;
  if (typeof window === "undefined") return "ssr";

  // 1) injetado pelo E2E antes do carregamento da página
  if (window.__brazonTraceId) {
    cache = window.__brazonTraceId;
    return cache;
  }

  // 2) persistido na aba (sobrevive a reload, que é o cenário de flash)
  try {
    const salvo = window.sessionStorage.getItem(CHAVE) ?? window.localStorage.getItem(CHAVE);
    if (salvo) {
      cache = salvo;
      window.__brazonTraceId = salvo;
      return cache;
    }
  } catch {
    /* storage bloqueado: segue com id em memória */
  }

  const novo = gerar();
  cache = novo;
  window.__brazonTraceId = novo;
  try {
    window.sessionStorage.setItem(CHAVE, novo);
  } catch {
    /* silencioso por design */
  }
  return novo;
}

/** Usado em testes para isolar execuções. */
export function _resetTraceIdCache(): void {
  cache = null;
}
