/**
 * Relatório de conferência da importação (avisos e erros por linha).
 * Gerado 100% no navegador: CSV para planilha e PDF via janela de impressão.
 */

export interface LinhaRelatorio {
  linha: number;
  contato: string;
  telefone: string;
  cnpj: string;
  situacao: string;
  erro: string | null;
  avisos: string[];
  /** true quando a linha tem aviso crítico (CNPJ irrecuperável ou dígito inválido). */
  critico: boolean;
  /** true quando a linha foi removida da confirmação. */
  excluida: boolean;
}

export interface CabecalhoRelatorio {
  arquivo: string;
  fonte: string;
  geradoEm: Date;
  total: number;
  validas: number;
  comAvisos: number;
  comCriticos: number;
  comErros: number;
}

const COLUNAS = [
  "Linha",
  "Contato",
  "Telefone",
  "CNPJ",
  "Situação",
  "Erro",
  "Avisos",
  "Crítico",
  "Excluída da importação",
];

function celulaCsv(valor: string): string {
  const t = valor ?? "";
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV com ponto e vírgula (padrão do Excel pt-BR) e BOM para acentos. */
export function montarCsvRelatorio(
  cabecalho: CabecalhoRelatorio,
  linhas: LinhaRelatorio[],
): string {
  const meta = [
    ["Arquivo", cabecalho.arquivo],
    ["Fonte", cabecalho.fonte],
    ["Gerado em", cabecalho.geradoEm.toLocaleString("pt-BR")],
    ["Total de linhas", String(cabecalho.total)],
    ["Válidas", String(cabecalho.validas)],
    ["Com avisos", String(cabecalho.comAvisos)],
    ["Com avisos críticos", String(cabecalho.comCriticos)],
    ["Com erros", String(cabecalho.comErros)],
  ].map((par) => par.map(celulaCsv).join(";"));

  const corpo = linhas.map((l) =>
    [
      String(l.linha),
      l.contato,
      l.telefone,
      l.cnpj,
      l.situacao,
      l.erro ?? "",
      l.avisos.join(" | "),
      l.critico ? "Sim" : "Não",
      l.excluida ? "Sim" : "Não",
    ]
      .map(celulaCsv)
      .join(";"),
  );

  return [...meta, "", COLUNAS.join(";"), ...corpo].join("\r\n");
}

export function nomeArquivoRelatorio(arquivo: string, ext: "csv" | "pdf"): string {
  const base = (arquivo || "importacao").replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-");
  const dia = new Date().toISOString().slice(0, 10);
  return `relatorio-importacao-${base}-${dia}.${ext}`;
}

export function baixarCsvRelatorio(
  cabecalho: CabecalhoRelatorio,
  linhas: LinhaRelatorio[],
): void {
  const csv = `\uFEFF${montarCsvRelatorio(cabecalho, linhas)}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoRelatorio(cabecalho.arquivo, "csv");
  a.click();
  URL.revokeObjectURL(url);
}

function escapar(valor: string): string {
  return (valor ?? "").replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c,
  );
}

/** HTML do relatório, usado na impressão/salvar como PDF. */
export function montarHtmlRelatorio(
  cabecalho: CabecalhoRelatorio,
  linhas: LinhaRelatorio[],
): string {
  const linhasHtml = linhas
    .map(
      (l) => `<tr class="${l.erro ? "erro" : l.critico ? "critico" : ""}">
        <td>${l.linha}</td>
        <td>${escapar(l.contato)}</td>
        <td>${escapar(l.telefone)}</td>
        <td>${escapar(l.cnpj)}</td>
        <td>${escapar(l.situacao)}</td>
        <td>${escapar(l.erro ?? "")}</td>
        <td>${escapar(l.avisos.join(" • "))}</td>
        <td>${l.excluida ? "Excluída" : "Mantida"}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório de importação — ${escapar(cabecalho.arquivo)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#18181b;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px}
  p.meta{color:#52525b;margin:0 0 16px}
  ul.resumo{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:12px;margin:0 0 16px}
  ul.resumo li{border:1px solid #e4e4e7;border-radius:6px;padding:6px 10px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #e4e4e7;padding:5px 6px;text-align:left;vertical-align:top}
  th{background:#f4f4f5}
  tr.erro td{background:#fef2f2}
  tr.critico td{background:#fffbeb}
  @page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>Relatório de importação — Banco de Leads</h1>
<p class="meta">Arquivo: ${escapar(cabecalho.arquivo)} · Fonte: ${escapar(cabecalho.fonte || "—")} · Gerado em ${cabecalho.geradoEm.toLocaleString("pt-BR")}</p>
<ul class="resumo">
  <li><strong>${cabecalho.total}</strong> linha(s) no arquivo</li>
  <li><strong>${cabecalho.validas}</strong> válida(s)</li>
  <li><strong>${cabecalho.comAvisos}</strong> com aviso</li>
  <li><strong>${cabecalho.comCriticos}</strong> com aviso crítico</li>
  <li><strong>${cabecalho.comErros}</strong> com erro</li>
</ul>
<table><thead><tr>
  <th>Linha</th><th>Contato</th><th>Telefone</th><th>CNPJ</th><th>Situação</th>
  <th>Erro</th><th>Avisos</th><th>Confirmação</th>
</tr></thead><tbody>${linhasHtml}</tbody></table>
</body></html>`;
}

/** Abre a janela de impressão do navegador para salvar em PDF. */
export function imprimirRelatorioPdf(
  cabecalho: CabecalhoRelatorio,
  linhas: LinhaRelatorio[],
): boolean {
  const janela = window.open("", "_blank", "width=1100,height=800");
  if (!janela) return false;
  janela.document.write(montarHtmlRelatorio(cabecalho, linhas));
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 300);
  return true;
}
