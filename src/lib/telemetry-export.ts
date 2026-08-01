/**
 * Exportação dos eventos de auth-telemetria para um destino EXTERNO.
 *
 * Mesmos campos gravados em `auth_telemetria` (tipo, motivo, rota, duração,
 * papel, erro, app_version, trace_id), para que um incidente possa ser
 * rastreado no Sentry/Datadog com o mesmo trace do vídeo do E2E.
 *
 * Configuração (todas opcionais — sem configuração nada é enviado):
 *  - VITE_TELEMETRY_EXPORT_URL   → endpoint HTTP genérico (POST JSON array)
 *  - VITE_TELEMETRY_EXPORT_TOKEN → enviado em `Authorization: Bearer ...`
 *  - VITE_DATADOG_CLIENT_TOKEN   → usa a intake de logs do browser do Datadog
 *  - VITE_DATADOG_SITE           → padrão `datadoghq.com`
 *  - VITE_TELEMETRY_SERVICE      → nome do serviço (padrão `brazon-painel`)
 *
 * Nunca envia dados pessoais: só ids técnicos, durações e desfechos.
 * Falhas de rede são silenciosas — telemetria jamais quebra a aplicação.
 */

const env = import.meta.env as unknown as Record<string, string | undefined>;

const URL_GENERICA = env["VITE_TELEMETRY_EXPORT_URL"];
const TOKEN_GENERICO = env["VITE_TELEMETRY_EXPORT_TOKEN"];
const DD_TOKEN = env["VITE_DATADOG_CLIENT_TOKEN"];
const DD_SITE = env["VITE_DATADOG_SITE"] ?? "datadoghq.com";
export const TELEMETRY_SERVICE = env["VITE_TELEMETRY_SERVICE"] ?? "brazon-painel";

export interface EventoExportado {
  tipo: string;
  motivo: string | null;
  rota: string;
  duracao_ms: number | null;
  papel: string | null;
  erro: string | null;
  app_version: string;
  trace_id: string;
  user_id: string | null;
  em: string;
}

/** Há algum destino externo configurado? */
export function exportacaoExternaAtiva(): boolean {
  return Boolean(URL_GENERICA || DD_TOKEN);
}

function destinos(): { url: string; headers: Record<string, string> }[] {
  const lista: { url: string; headers: Record<string, string> }[] = [];
  if (URL_GENERICA) {
    lista.push({
      url: URL_GENERICA,
      headers: {
        "content-type": "application/json",
        ...(TOKEN_GENERICO ? { authorization: `Bearer ${TOKEN_GENERICO}` } : {}),
      },
    });
  }
  if (DD_TOKEN) {
    lista.push({
      url: `https://browser-intake-${DD_SITE}/api/v2/logs?dd-api-key=${encodeURIComponent(
        DD_TOKEN,
      )}&ddsource=browser&service=${encodeURIComponent(TELEMETRY_SERVICE)}`,
      headers: { "content-type": "application/json" },
    });
  }
  return lista;
}

function paraPayload(eventos: EventoExportado[]) {
  return eventos.map((e) => ({
    service: TELEMETRY_SERVICE,
    ddsource: "browser",
    status: e.tipo === "papel_erro" ? "error" : "info",
    message: `auth.${e.tipo}`,
    ...e,
  }));
}

/** Envia um lote para todos os destinos configurados. Nunca lança. */
export async function exportarEventos(eventos: EventoExportado[]): Promise<void> {
  if (eventos.length === 0) return;
  const alvos = destinos();
  if (alvos.length === 0) return;

  const body = JSON.stringify(paraPayload(eventos));
  await Promise.all(
    alvos.map(async ({ url, headers }) => {
      try {
        await fetch(url, { method: "POST", headers, body, keepalive: true, mode: "cors" });
      } catch {
        /* silencioso por design */
      }
    }),
  );
}
