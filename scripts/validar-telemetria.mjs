#!/usr/bin/env bun
/**
 * Modo de validação de CI para os eventos de telemetria exportados.
 *
 * Lê um arquivo JSON (array) ou NDJSON (`--ndjson`) com eventos exportados e
 * valida cada um contra o contrato único de `src/lib/telemetry-schema.ts`
 * (reimportado diretamente, já que `bun` executa TypeScript nativamente).
 *
 * Uso:
 *   bun scripts/validar-telemetria.mjs [caminho] [--ndjson]
 *
 * Padrão do caminho: tests/e2e/artifacts/telemetria-exportada.json
 *
 * Sai com código 1 e relatório em pt-BR se algum evento estiver faltando
 * `trace_id`, `app_version` ou `rota` (ou qualquer outro campo do contrato).
 * Sai com código 0 quando todos os eventos são válidos.
 */
import { readFileSync, existsSync } from "node:fs";
import { validarLoteExportado } from "../src/lib/telemetry-schema.ts";

const argumentos = process.argv.slice(2);
const usaNdjson = argumentos.includes("--ndjson");
const caminho =
  argumentos.find((a) => !a.startsWith("--")) ?? "tests/e2e/artifacts/telemetria-exportada.json";

function carregarEventos(caminhoArquivo, ndjson) {
  const bruto = readFileSync(caminhoArquivo, "utf-8");
  if (ndjson) {
    return bruto
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0)
      .map((linha) => JSON.parse(linha));
  }
  const dados = JSON.parse(bruto);
  if (!Array.isArray(dados)) {
    throw new Error("o arquivo JSON precisa conter um array de eventos exportados");
  }
  return dados;
}

function principal() {
  if (!existsSync(caminho)) {
    console.error(`[telemetria] arquivo não encontrado: ${caminho}`);
    process.exit(1);
  }

  let eventos;
  try {
    eventos = carregarEventos(caminho, usaNdjson);
  } catch (erro) {
    console.error(`[telemetria] falha ao ler/parsear "${caminho}": ${erro.message}`);
    process.exit(1);
  }

  if (eventos.length === 0) {
    console.log(`[telemetria] "${caminho}" não contém eventos — nada para validar. OK.`);
    process.exit(0);
  }

  const resultado = validarLoteExportado(eventos);

  if (resultado.ok) {
    console.log(
      `[telemetria] OK — ${resultado.validos}/${resultado.total} eventos válidos em "${caminho}".`,
    );
    process.exit(0);
  }

  console.error(
    `[telemetria] FALHOU — ${resultado.invalidos.length}/${resultado.total} eventos inválidos em "${caminho}":`,
  );
  for (const item of resultado.invalidos) {
    const partes = [];
    if (item.faltando.length > 0) partes.push(`faltando: ${item.faltando.join(", ")}`);
    if (item.invalidos.length > 0) partes.push(`inválidos: ${item.invalidos.join(", ")}`);
    console.error(`  - evento[${item.indice}]: ${partes.join(" | ")}`);
  }
  process.exit(1);
}

principal();
