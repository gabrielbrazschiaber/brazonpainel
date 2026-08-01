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

import { validarLoteExportado } from "@/lib/telemetry-schema";
import {
  enfileirar as enfileirarNoBuffer,
  registrarEnviador,
  tamanho as tamanhoBuffer,
} from "@/lib/telemetry-buffer";

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

/** Filtra eventos inválidos (fora do contrato), avisando no console. */
function filtrarValidos(eventos: EventoExportado[]): EventoExportado[] {
  const resultado = validarLoteExportado(eventos);
  if (resultado.ok) return eventos;

  const indicesInvalidos = new Set(resultado.invalidos.map((i) => i.indice));
  for (const item of resultado.invalidos) {
    console.warn(
      "[telemetria] evento exportado inválido descartado",
      { faltando: item.faltando, invalidos: item.invalidos },
      eventos[item.indice],
    );
  }
  return eventos.filter((_, indice) => !indicesInvalidos.has(indice));
}

/** Envia (sem retry) um lote para todos os destinos. Lança se algum falhar. */
async function enviarParaDestinos(eventos: EventoExportado[]): Promise<void> {
  const alvos = destinos();
  if (alvos.length === 0) return;

  const body = JSON.stringify(paraPayload(eventos));
  const resultados = await Promise.allSettled(
    alvos.map(({ url, headers }) =>
      fetch(url, { method: "POST", headers, body, keepalive: true, mode: "cors" }).then((r) => {
        if (!r.ok) throw new Error(`telemetria: destino respondeu ${r.status}`);
      }),
    ),
  );

  const falhou = resultados.some((r) => r.status === "rejected");
  if (falhou) throw new Error("telemetria: falha ao enviar para um ou mais destinos");
}

/** Envia um lote para todos os destinos configurados. Nunca lança. */
export async function exportarEventos(eventos: EventoExportado[]): Promise<void> {
  if (eventos.length === 0) return;
  const validos = filtrarValidos(eventos);
  if (validos.length === 0) return;
  if (destinos().length === 0) return;

  try {
    await enviarParaDestinos(validos);
  } catch {
    // Falha de rede/HTTP: preserva o lote no buffer durável em vez de perder.
    enfileirarNoBuffer(validos);
    // Reenvio fica a cargo do buffer (backoff exponencial + volta de rede/foco).
    registrarEnviador(enviarParaDestinos);
  }
}

/** Estado da exportação de telemetria, para diagnóstico (painéis internos, debug). */
export function estadoExportacao(): { ativo: boolean; pendentes: number } {
  return { ativo: exportacaoExternaAtiva(), pendentes: tamanhoBuffer() };
}
