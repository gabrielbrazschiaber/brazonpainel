/**
 * Helpers client-safe do catálogo de CNAEs.
 *
 * O CNAE chega das planilhas em formatos variados ("47.11-3/02", "4711302",
 * "4711302 - Comércio varejista"), então tudo é normalizado para 7 dígitos.
 */

/** Só os 7 dígitos do CNAE. Devolve "" quando não dá para aproveitar. */
export function normalizarCnae(valor: string | null | undefined): string {
  const d = (valor ?? "").toString().replace(/\D/g, "");
  if (d.length < 5) return "";
  // Planilhas às vezes trazem o CNAE de 5 dígitos (classe) — completa com zeros.
  return d.slice(0, 7).padEnd(7, "0");
}

/** "4711302" -> "47.11-3/02" */
export function formatarCnae(codigo: string | null | undefined): string {
  const d = normalizarCnae(codigo);
  if (!d) return "—";
  return `${d.slice(0, 2)}.${d.slice(2, 4)}-${d.slice(4, 5)}/${d.slice(5, 7)}`;
}

/**
 * Palavras-chave que apontam para um segmento comercial.
 * A ordem importa: a primeira palavra encontrada na descrição decide.
 */
const PALAVRAS_SEGMENTO: readonly (readonly [string, string])[] = [
  ["restaurante", "Alimentação"],
  ["lanchonete", "Alimentação"],
  ["padaria", "Alimentação"],
  ["pizzaria", "Alimentação"],
  ["bar ", "Alimentação"],
  ["alimento", "Alimentação"],
  ["bebida", "Alimentação"],
  ["mercado", "Comércio"],
  ["supermercado", "Comércio"],
  ["comercio", "Comércio"],
  ["varejista", "Comércio"],
  ["atacadista", "Comércio"],
  ["loja", "Comércio"],
  ["cabeleireiro", "Beleza e estética"],
  ["estetica", "Beleza e estética"],
  ["barbearia", "Beleza e estética"],
  ["salao", "Beleza e estética"],
  ["clinica", "Saúde"],
  ["medic", "Saúde"],
  ["odontolog", "Saúde"],
  ["dentist", "Saúde"],
  ["farmacia", "Saúde"],
  ["laboratorio", "Saúde"],
  ["veterinar", "Saúde"],
  ["escola", "Educação"],
  ["ensino", "Educação"],
  ["curso", "Educação"],
  ["educac", "Educação"],
  ["construc", "Construção"],
  ["obra", "Construção"],
  ["engenharia", "Construção"],
  ["material de construcao", "Construção"],
  ["transporte", "Transporte"],
  ["logistica", "Transporte"],
  ["frete", "Transporte"],
  ["informatica", "Tecnologia"],
  ["software", "Tecnologia"],
  ["tecnologia", "Tecnologia"],
  ["desenvolvimento de programa", "Tecnologia"],
  ["fabricacao", "Indústria"],
  ["industria", "Indústria"],
  ["metalurgic", "Indústria"],
  ["confeccao", "Indústria"],
  ["servico", "Serviços"],
  ["consultoria", "Serviços"],
  ["contabil", "Serviços"],
  ["advocacia", "Serviços"],
  ["manutencao", "Serviços"],
  ["reparacao", "Serviços"],
];

function semAcento(valor: string): string {
  return (valor ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Sugere um segmento a partir da descrição do CNAE. "" quando não dá. */
export function sugerirSegmentoPorCnae(descricao: string | null | undefined): string {
  const texto = semAcento(descricao ?? "");
  if (!texto.trim()) return "";
  for (const [palavra, segmento] of PALAVRAS_SEGMENTO) {
    if (texto.includes(palavra)) return segmento;
  }
  return "";
}

export interface Cnae {
  id: string;
  codigo: string;
  descricao: string | null;
  segmento_sugerido: string | null;
  total_leads: number;
  ativo: boolean;
  created_at: string;
}

/** Rótulo curto para selects: "47.11-3/02 · Supermercados". */
export function rotuloCnae(cnae: Pick<Cnae, "codigo" | "descricao">): string {
  const desc = (cnae.descricao ?? "").trim();
  return desc ? `${formatarCnae(cnae.codigo)} · ${desc}` : formatarCnae(cnae.codigo);
}
