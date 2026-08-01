/**
 * Camada isolada que fala com as bibliotecas de planilha (xlsx + papaparse).
 *
 * Fica em um módulo separado de propósito: `leads-import.ts` só carrega este
 * arquivo sob demanda (`await import`), então as ~450 kB de xlsx/papaparse
 * ficam fora do JS inicial das telas de leads e só baixam quando o usuário
 * realmente abre uma planilha ou pede o modelo.
 */
import * as XLSX from "xlsx";
import Papa from "papaparse";

function limparMatriz(bruta: unknown[][]): string[][] {
  return bruta
    .map((linha) => (linha ?? []).map((c) => (c === null || c === undefined ? "" : String(c))))
    .filter((linha) => linha.some((c) => c.trim() !== ""));
}

/** Lê CSV/XLSX e devolve a matriz de células já normalizada em texto. */
export async function lerMatriz(file: File, ext: string): Promise<string[][]> {
  if (ext === "csv") {
    const texto = await file.text();
    const r = Papa.parse<string[]>(texto, { skipEmptyLines: true });
    return limparMatriz((r.data ?? []) as unknown[][]);
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const nomeAba = wb.SheetNames[0];
  if (!nomeAba) throw new Error("A planilha está vazia.");
  const ws = wb.Sheets[nomeAba];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  return limparMatriz(json as unknown[][]);
}

/** Gera e baixa um .xlsx a partir de uma matriz de linhas. */
export function baixarPlanilha(dados: string[][], aba: string, arquivo: string): void {
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws["!cols"] = (dados[0] ?? []).map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba);
  XLSX.writeFile(wb, arquivo);
}
