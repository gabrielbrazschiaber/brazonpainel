/**
 * Parsing e normalização de planilhas de leads — 100% no navegador.
 * Nenhum arquivo é enviado ao servidor: só o array de linhas já normalizado.
 */
import * as XLSX from "xlsx";
import Papa from "papaparse";

export const MAX_LINHAS = 2000;
export const MAX_BYTES = 5 * 1024 * 1024;

/** Campos de destino aceitos na importação. */
export const CAMPOS_IMPORT = [
  { campo: "nome_contato", label: "Nome do contato", obrigatorio: true },
  { campo: "telefone", label: "Telefone", obrigatorio: true },
  { campo: "empresa", label: "Empresa", obrigatorio: false },
  { campo: "cargo", label: "Cargo", obrigatorio: false },
  { campo: "email", label: "E-mail", obrigatorio: false },
  { campo: "segmento", label: "Segmento", obrigatorio: false },
  { campo: "observacoes", label: "Observações", obrigatorio: false },
  { campo: "valor_estimado", label: "Valor estimado", obrigatorio: false },
] as const;

export type CampoImport = (typeof CAMPOS_IMPORT)[number]["campo"];
/** "" significa "Ignorar esta coluna". */
export type DestinoColuna = CampoImport | "";

const SINONIMOS: Record<CampoImport, string[]> = {
  nome_contato: [
    "nome",
    "contato",
    "cliente",
    "responsavel",
    "nomedocontato",
    "nomecompleto",
    "leads",
    "lead",
  ],
  telefone: ["telefone", "tel", "celular", "whatsapp", "fone", "contatotelefonico", "numero"],
  empresa: ["empresa", "razaosocial", "negocio", "estabelecimento", "loja", "fantasia"],
  cargo: ["cargo", "funcao", "posicao"],
  email: ["email", "mail", "correio"],
  segmento: ["segmento", "ramo", "area", "nicho", "categoria", "setor"],
  observacoes: ["observacao", "observacoes", "obs", "anotacoes", "anotacao", "notas", "nota"],
  valor_estimado: ["valor", "ticket", "valorestimado", "potencial", "ticketmedio"],
};

/** minúsculas, sem acento, sem espaço/pontuação. */
export function normalizarChave(valor: string): string {
  return (valor ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Sugestão automática de destino para cada coluna do arquivo. */
export function sugerirMapa(cabecalhos: string[]): DestinoColuna[] {
  const usados = new Set<CampoImport>();
  return cabecalhos.map((h) => {
    const chave = normalizarChave(h);
    if (!chave) return "";
    for (const { campo } of CAMPOS_IMPORT) {
      if (usados.has(campo)) continue;
      const lista = SINONIMOS[campo];
      if (lista.includes(chave) || lista.some((s) => chave === s || chave.startsWith(s))) {
        usados.add(campo);
        return campo;
      }
    }
    return "";
  });
}

/** Nome de exibição de coluna sem cabeçalho: A, B, ... Z, AA... */
export function letraColuna(indice: number): string {
  let n = indice;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// ---------------------------------------------------------------------------
// Normalização de valores
// ---------------------------------------------------------------------------

/** Só dígitos, sem o 55 do país quando o resultado tiver 12 ou 13 dígitos. */
export function normalizarTelefone(valor: string | null | undefined): string {
  let d = (valor ?? "").toString().replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d;
}

export function telefoneValido(digitos: string): boolean {
  return digitos.length === 10 || digitos.length === 11;
}

export function formatarTelefone(valor: string | null | undefined): string {
  const d = normalizarTelefone(valor);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return (valor ?? "").toString().trim();
}

/** trim + espaços colapsados; Title Case só quando vem TODO EM MAIÚSCULAS. */
export function normalizarNome(valor: string | null | undefined): string {
  const t = (valor ?? "").toString().replace(/\s+/g, " ").trim();
  if (!t) return "";
  const temMinuscula = /[a-zà-ú]/.test(t);
  if (temMinuscula) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((p) =>
      p.length <= 2 && ["de", "da", "do", "e", "das", "dos"].includes(p)
        ? p
        : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(" ");
}

export function normalizarEmail(valor: string | null | undefined): string {
  return (valor ?? "").toString().trim().toLowerCase();
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(valor);
}

/** Aceita "1.234,56" e "1234.56". Vazio vira 0. */
export function normalizarValor(valor: string | null | undefined): number {
  const bruto = (valor ?? "").toString().trim();
  if (!bruto) return 0;
  let limpo = bruto.replace(/[^\d.,-]/g, "");
  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");
  if (temVirgula && temPonto) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (temVirgula) limpo = limpo.replace(",", ".");
  const n = Number(limpo);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Casa o segmento (case-insensitive) com os já usados, evitando duplicatas. */
export function canonizarSegmento(valor: string, existentes: string[]): string {
  const t = (valor ?? "").toString().replace(/\s+/g, " ").trim();
  if (!t) return "";
  const chave = normalizarChave(t);
  const achado = existentes.find((s) => normalizarChave(s) === chave);
  return achado ?? t;
}

// ---------------------------------------------------------------------------
// Leitura do arquivo
// ---------------------------------------------------------------------------

export interface ArquivoLido {
  nome: string;
  /** Cabeçalhos exibidos (originais ou "Coluna A"). */
  cabecalhos: string[];
  temCabecalho: boolean;
  /** Linhas de dados (sem o cabeçalho). */
  matriz: string[][];
}

function limparMatriz(bruta: unknown[][]): string[][] {
  return bruta
    .map((linha) => (linha ?? []).map((c) => (c === null || c === undefined ? "" : String(c))))
    .filter((linha) => linha.some((c) => c.trim() !== ""));
}

export async function lerArquivo(file: File): Promise<ArquivoLido> {
  if (file.size > MAX_BYTES) {
    throw new Error("Arquivo acima de 5 MB. Divida a planilha em partes menores.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    throw new Error("Formato não aceito. Envie um arquivo .xlsx, .xls ou .csv.");
  }

  let bruta: string[][] = [];
  if (ext === "csv") {
    const texto = await file.text();
    const r = Papa.parse<string[]>(texto, { skipEmptyLines: true });
    bruta = limparMatriz((r.data ?? []) as unknown[][]);
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const nomeAba = wb.SheetNames[0];
    if (!nomeAba) throw new Error("A planilha está vazia.");
    const ws = wb.Sheets[nomeAba];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    bruta = limparMatriz(json as unknown[][]);
  }

  if (bruta.length === 0) throw new Error("Nenhuma linha encontrada no arquivo.");

  const largura = bruta.reduce((m, l) => Math.max(m, l.length), 0);
  const primeira = bruta[0] ?? [];
  const sugestao = sugerirMapa(primeira);
  const temCabecalho = sugestao.some((s) => s !== "");

  const matriz = (temCabecalho ? bruta.slice(1) : bruta).map((l) => {
    const linha = [...l];
    while (linha.length < largura) linha.push("");
    return linha;
  });

  if (matriz.length === 0) throw new Error("O arquivo só tem cabeçalho, sem linhas de dados.");
  if (matriz.length > MAX_LINHAS) {
    throw new Error(
      `A planilha tem ${matriz.length} linhas. O limite é ${MAX_LINHAS} por arquivo — divida em partes menores.`,
    );
  }

  const cabecalhos = Array.from({ length: largura }, (_, i) => {
    const original = (primeira[i] ?? "").toString().trim();
    return temCabecalho && original ? original : `Coluna ${letraColuna(i)}`;
  });

  return { nome: file.name, cabecalhos, temCabecalho, matriz };
}

// ---------------------------------------------------------------------------
// Linhas e classificação
// ---------------------------------------------------------------------------

export type StatusLinha = "ok" | "erro" | "duplicado_arquivo" | "duplicado_base";
export type AcaoLinha = "criar" | "atualizar" | "ignorar";

export interface LeadExistente {
  telefone: string;
  lead_id: string;
  nome_contato: string;
  empresa: string | null;
}

export interface LinhaImport {
  /** Chave estável para React. */
  id: string;
  /** Número da linha no arquivo, contando o cabeçalho. */
  linha: number;
  nome_contato: string;
  telefone: string;
  empresa: string;
  cargo: string;
  email: string;
  segmento: string;
  observacoes: string;
  valor_estimado: string;
  status: StatusLinha;
  erros: string[];
  avisos: string[];
  acao: AcaoLinha;
  /** true quando o usuário mexeu no Select de ação e não queremos sobrescrever. */
  acaoManual: boolean;
  existente?: LeadExistente;
}

const VAZIO = {
  nome_contato: "",
  telefone: "",
  empresa: "",
  cargo: "",
  email: "",
  segmento: "",
  observacoes: "",
  valor_estimado: "",
};

/** Monta as linhas cruas a partir do mapeamento escolhido. */
export function montarLinhas(
  arquivo: ArquivoLido,
  mapa: DestinoColuna[],
  segmentosExistentes: string[],
): LinhaImport[] {
  const offset = arquivo.temCabecalho ? 2 : 1;
  return arquivo.matriz.map((celulas, i) => {
    const campos = { ...VAZIO } as Record<CampoImport, string>;
    mapa.forEach((destino, col) => {
      if (!destino) return;
      const valor = (celulas[col] ?? "").toString();
      campos[destino] = campos[destino] ? `${campos[destino]} ${valor}`.trim() : valor;
    });
    return {
      id: `l${i}`,
      linha: i + offset,
      nome_contato: normalizarNome(campos.nome_contato),
      telefone: formatarTelefone(campos.telefone),
      empresa: normalizarNome(campos.empresa),
      cargo: (campos.cargo ?? "").trim(),
      email: normalizarEmail(campos.email),
      segmento: canonizarSegmento(campos.segmento, segmentosExistentes),
      observacoes: (campos.observacoes ?? "").trim(),
      valor_estimado: campos.valor_estimado?.trim() ? String(normalizarValor(campos.valor_estimado)) : "",
      status: "ok",
      erros: [],
      avisos: [],
      acao: "criar",
      acaoManual: false,
    } satisfies LinhaImport;
  });
}

/** Ação padrão sugerida para um status. */
export function acaoPadrao(status: StatusLinha): AcaoLinha {
  if (status === "ok") return "criar";
  return "ignorar";
}

/**
 * Reclassifica TODAS as linhas: valida campos, marca duplicados dentro do
 * arquivo e contra a base. Preserva a ação quando o usuário a definiu à mão.
 */
export function reclassificar(
  linhas: LinhaImport[],
  base: Map<string, LeadExistente>,
): LinhaImport[] {
  const contagem = new Map<string, number>();
  for (const l of linhas) {
    const d = normalizarTelefone(l.telefone);
    if (telefoneValido(d)) contagem.set(d, (contagem.get(d) ?? 0) + 1);
  }
  const jaVisto = new Set<string>();

  return linhas.map((l) => {
    const erros: string[] = [];
    const avisos: string[] = [];

    const nome = l.nome_contato.trim();
    if (nome.length < 2) erros.push("Nome do contato obrigatório (mínimo 2 letras)");
    if (nome.length > 120) erros.push("Nome com mais de 120 caracteres");

    const digitos = normalizarTelefone(l.telefone);
    if (!digitos) erros.push("Telefone obrigatório");
    else if (!telefoneValido(digitos)) erros.push("Telefone deve ter DDD + número (10 ou 11 dígitos)");

    if (l.email && !emailValido(l.email)) avisos.push("E-mail inválido, será ignorado");
    if (l.empresa.length > 120) avisos.push("Empresa muito longa, será cortada");

    let status: StatusLinha = erros.length > 0 ? "erro" : "ok";
    let existente: LeadExistente | undefined;

    if (status === "ok") {
      if (jaVisto.has(digitos)) status = "duplicado_arquivo";
      else {
        jaVisto.add(digitos);
        const achado = base.get(digitos);
        if (achado) {
          status = "duplicado_base";
          existente = achado;
        }
      }
      if (status === "duplicado_arquivo" && (contagem.get(digitos) ?? 0) > 1) {
        // mantém marcado; a primeira ocorrência segue válida
      }
    }

    const acao = l.acaoManual && l.status === status ? l.acao : acaoPadrao(status);

    return { ...l, erros, avisos, status, existente, acao };
  });
}

export interface ResumoLinhas {
  ok: number;
  erro: number;
  duplicado_arquivo: number;
  duplicado_base: number;
  aImportar: number;
  aAtualizar: number;
}

export function resumir(linhas: LinhaImport[]): ResumoLinhas {
  const r: ResumoLinhas = {
    ok: 0,
    erro: 0,
    duplicado_arquivo: 0,
    duplicado_base: 0,
    aImportar: 0,
    aAtualizar: 0,
  };
  for (const l of linhas) {
    r[l.status] += 1;
    if (l.acao === "criar" && l.status !== "erro") r.aImportar += 1;
    if (l.acao === "atualizar" && l.status === "duplicado_base") r.aAtualizar += 1;
  }
  return r;
}

/** Payload enviado ao servidor: só as linhas que serão gravadas. */
export function paraEnvio(linhas: LinhaImport[]) {
  return linhas
    .filter((l) => l.acao !== "ignorar" && l.status !== "erro")
    .filter((l) => l.acao !== "atualizar" || Boolean(l.existente))
    .map((l) => ({
      linha: l.linha,
      nome_contato: l.nome_contato.trim(),
      telefone: normalizarTelefone(l.telefone),
      empresa: l.empresa.trim() || null,
      cargo: l.cargo.trim() || null,
      email: l.email && emailValido(l.email) ? l.email : null,
      segmento: l.segmento.trim() || null,
      observacoes: l.observacoes.trim() || null,
      valor_estimado: normalizarValor(l.valor_estimado),
      acao: l.acao,
      ...(l.acao === "atualizar" && l.existente ? { lead_id: l.existente.lead_id } : {}),
    }));
}

/** Modelo .xlsx gerado no navegador. */
export function baixarModelo(): void {
  const dados = [
    ["Nome", "Telefone", "Empresa", "Cargo", "E-mail", "Segmento", "Observações", "Valor"],
    ["Maria Souza", "(11) 98765-4321", "Padaria Central", "Proprietária", "maria@exemplo.com", "Alimentação", "Indicada por cliente", "350,00"],
    ["João Lima", "(21) 99888-7766", "", "", "", "", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws["!cols"] = dados[0].map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, "modelo-leads-brazon.xlsx");
}
