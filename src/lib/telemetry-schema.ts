/**
 * Contrato único do evento exportado de telemetria (`EventoExportado`).
 *
 * Fonte única de verdade para validação — usada tanto no runtime do browser
 * (src/lib/telemetry-export.ts) quanto no modo de validação de CI
 * (scripts/validar-telemetria.mjs, via `bun`).
 */

/** Todos os campos obrigatórios do contrato (podem ser `null`, mas devem existir). */
export const CAMPOS_OBRIGATORIOS = [
  "tipo",
  "motivo",
  "rota",
  "duracao_ms",
  "papel",
  "erro",
  "app_version",
  "trace_id",
  "user_id",
  "em",
] as const;

export type CampoObrigatorio = (typeof CAMPOS_OBRIGATORIOS)[number];

/** Campos que precisam ser string não-vazia (não podem ser `null`/vazios). */
export const CAMPOS_STRING_NAO_VAZIA = ["trace_id", "app_version", "rota"] as const;

export interface ResultadoValidacao {
  ok: boolean;
  /** Campos ausentes do objeto (chave nem existe). */
  faltando: string[];
  /** Campos presentes mas com valor inválido (ex.: string vazia onde é obrigatório). */
  invalidos: string[];
}

function ehStringNaoVazia(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Valida um único evento exportado contra o contrato. Nunca lança. */
export function validarEventoExportado(e: unknown): ResultadoValidacao {
  const faltando: string[] = [];
  const invalidos: string[] = [];

  if (typeof e !== "object" || e === null) {
    return { ok: false, faltando: [...CAMPOS_OBRIGATORIOS], invalidos: [] };
  }

  const registro = e as Record<string, unknown>;

  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (!(campo in registro)) {
      faltando.push(campo);
    }
  }

  for (const campo of CAMPOS_STRING_NAO_VAZIA) {
    if (campo in registro && !ehStringNaoVazia(registro[campo])) {
      invalidos.push(campo);
    }
  }

  return { ok: faltando.length === 0 && invalidos.length === 0, faltando, invalidos };
}

export interface ResultadoValidacaoLote {
  ok: boolean;
  total: number;
  validos: number;
  invalidos: { indice: number; faltando: string[]; invalidos: string[] }[];
}

/** Valida uma lista de eventos exportados. Nunca lança. */
export function validarLoteExportado(lista: unknown[]): ResultadoValidacaoLote {
  const invalidos: { indice: number; faltando: string[]; invalidos: string[] }[] = [];
  let validos = 0;

  lista.forEach((item, indice) => {
    const resultado = validarEventoExportado(item);
    if (resultado.ok) {
      validos += 1;
    } else {
      invalidos.push({ indice, faltando: resultado.faltando, invalidos: resultado.invalidos });
    }
  });

  return { ok: invalidos.length === 0, total: lista.length, validos, invalidos };
}
