import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { EventoExportado } from "@/lib/telemetry-export";
import {
  _resetBufferParaTestes,
  tamanho as tamanhoInicial,
  flush as flushInicial,
} from "@/lib/telemetry-buffer";

/**
 * `VITE_TELEMETRY_EXPORT_URL` é lido uma única vez no topo do módulo (mesmo
 * padrão do restante do projeto), então o teste precisa stubar o env ANTES
 * de importar o módulo — daqui o `resetModules` + import dinâmico por teste.
 */
async function importarComEndpointConfigurado() {
  vi.stubEnv("VITE_TELEMETRY_EXPORT_URL", "https://exemplo.invalido/telemetria");
  vi.resetModules();
  const exportModule = await import("@/lib/telemetry-export");
  const bufferModule = await import("@/lib/telemetry-buffer");
  return { ...exportModule, tamanho: bufferModule.tamanho, flush: bufferModule.flush };
}

function evento(overrides: Partial<EventoExportado> = {}): EventoExportado {
  return {
    tipo: "sessao_resolvida",
    motivo: null,
    rota: "/painel",
    duracao_ms: 10,
    papel: null,
    erro: null,
    app_version: "1.0.0",
    trace_id: "t-1",
    user_id: null,
    em: new Date().toISOString(),
    ...overrides,
  };
}

describe("telemetry-export", () => {
  beforeEach(() => {
    window.localStorage.clear();
    _resetBufferParaTestes();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    _resetBufferParaTestes();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("descarta eventos inválidos (sem trace_id) e avisa no console, sem lançar", async () => {
    const { exportarEventos } = await importarComEndpointConfigurado();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const invalido = evento({ trace_id: "" });
    await expect(exportarEventos([invalido])).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("enfileira o lote no buffer quando o fetch falha e drena num flush posterior", async () => {
    const { exportarEventos, estadoExportacao, tamanho, flush } =
      await importarComEndpointConfigurado();
    const fetchMock = vi.fn().mockRejectedValue(new Error("rede fora do ar"));
    vi.stubGlobal("fetch", fetchMock);

    await exportarEventos([evento()]);

    expect(tamanho()).toBe(1);
    expect(estadoExportacao().pendentes).toBe(1);

    // Flush forçado = "a rede voltou": antecipa o envio sem esperar o backoff.
    const enviarComSucesso = vi.fn().mockResolvedValue(undefined);
    await flush(enviarComSucesso, true);

    expect(enviarComSucesso).toHaveBeenCalledTimes(1);
    expect(tamanho()).toBe(0);
  });

  it("enfileira o lote quando o destino responde HTTP não-ok", async () => {
    const { exportarEventos, tamanho } = await importarComEndpointConfigurado();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    await exportarEventos([evento()]);

    expect(tamanho()).toBe(1);
  });

  it("nunca lança mesmo sem nenhum destino configurado", async () => {
    vi.resetModules();
    const { exportarEventos } = await import("@/lib/telemetry-export");
    await expect(exportarEventos([evento()])).resolves.toBeUndefined();
  });
});
