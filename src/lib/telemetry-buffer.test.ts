import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { enfileirar, tamanho, flush, _resetBufferParaTestes } from "@/lib/telemetry-buffer";
import type { EventoExportado } from "@/lib/telemetry-export";

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

describe("telemetry-buffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    _resetBufferParaTestes();
  });

  afterEach(() => {
    _resetBufferParaTestes();
    vi.useRealTimers();
  });

  it("persiste eventos enfileirados em localStorage", () => {
    enfileirar([evento()]);
    expect(tamanho()).toBe(1);
    const bruto = window.localStorage.getItem("brazon:telemetria-fila");
    expect(bruto).toBeTruthy();
  });

  it("respeita o cap de ~200 eventos, descartando os mais antigos", () => {
    const muitos = Array.from({ length: 250 }, (_, i) => evento({ trace_id: `t-${i}` }));
    enfileirar(muitos);
    expect(tamanho()).toBe(200);
  });

  it("drena a fila quando um flush bem-sucedido acontece", async () => {
    enfileirar([evento()]);
    const enviar = vi.fn().mockResolvedValue(undefined);
    await flush(enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(tamanho()).toBe(0);
  });

  it("mantém eventos na fila e reagenda com backoff quando o envio falha", async () => {
    enfileirar([evento()]);
    const enviar = vi.fn().mockRejectedValue(new Error("rede fora do ar"));
    await flush(enviar);
    expect(tamanho()).toBe(1);
    // Reagendamento não deve disparar antes do próximo passo do backoff.
    await vi.advanceTimersByTimeAsync(500);
    expect(enviar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it("não entra em loop de tentativas simultâneas (backoff não gira sem parar)", async () => {
    enfileirar([evento()]);
    const enviar = vi.fn().mockRejectedValue(new Error("falha"));
    await flush(enviar);
    // Chamar flush novamente enquanto já há um timer agendado não deve disparar de imediato.
    await flush(enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
