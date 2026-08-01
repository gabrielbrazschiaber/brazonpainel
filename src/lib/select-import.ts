/**
 * Regras dos <Select> da importação de planilhas.
 *
 * O Radix quebra a tela inteira quando um <Select.Item /> recebe value="" —
 * a exceção sobe até o limite de erro e o painel mostra "Não foi possível
 * carregar esta parte da tela". Como as opções vêm de dados vivos (cabeçalhos
 * da planilha, segmentos, CNAEs), o valor vazio é sempre possível: por isso
 * todo valor passa por aqui antes de virar item do select.
 */

/** Sentinela de "nenhuma reserva" nos selects de reserva do lote. */
export const SEM_RESERVA = "__sem__";
/** Sentinela de "não importar esta coluna" no mapeamento. */
export const IGNORAR_COLUNA = "__ignorar__";

export interface OpcaoSelect {
  value: string;
  label: string;
}

/** true quando o valor pode virar <SelectItem value={...}> sem quebrar o Radix. */
export function valorSelectValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim() !== "";
}

/**
 * Valor do <Select> a partir de um estado que aceita vazio.
 * Vazio (ou nulo) vira o sentinela, nunca "".
 */
export function valorSelect(bruto: string | null | undefined, sentinela: string): string {
  return valorSelectValido(bruto) ? bruto : sentinela;
}

/** Volta do sentinela para o valor de domínio ("" = nada escolhido). */
export function valorDoSelect(escolhido: string, sentinela: string): string {
  return escolhido === sentinela || !valorSelectValido(escolhido) ? "" : escolhido;
}

/**
 * Saneia uma lista de opções: descarta vazios, espaços em branco, duplicados e
 * colisões com os sentinelas (que duplicariam a linha "Sem reserva"/"Ignorar").
 */
export function opcoesSelectSeguras(
  opcoes: readonly (OpcaoSelect | string | null | undefined)[],
  sentinelas: readonly string[] = [SEM_RESERVA, IGNORAR_COLUNA],
): OpcaoSelect[] {
  const vistos = new Set<string>();
  const saida: OpcaoSelect[] = [];
  for (const bruta of opcoes) {
    const opcao: OpcaoSelect | null =
      typeof bruta === "string"
        ? { value: bruta.trim(), label: bruta.trim() }
        : bruta
          ? { value: (bruta.value ?? "").trim(), label: bruta.label }
          : null;
    if (!opcao || !valorSelectValido(opcao.value)) continue;
    if (sentinelas.includes(opcao.value) || vistos.has(opcao.value)) continue;
    vistos.add(opcao.value);
    saida.push({ value: opcao.value, label: opcao.label || opcao.value });
  }
  return saida;
}

/**
 * Explicação em português do erro de <Select.Item /> com value vazio, para o
 * limite de erro deixar de mostrar só a mensagem crua da biblioteca.
 * Devolve null para qualquer outro erro.
 */
export function explicacaoErroSelect(erro: unknown): string | null {
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? "");
  if (!/Select\.Item/i.test(mensagem) || !/empty string/i.test(mensagem)) return null;
  return (
    "Uma das listas de seleção recebeu uma opção sem valor — normalmente uma coluna " +
    "sem cabeçalho na planilha, ou um segmento/CNAE cadastrado em branco. " +
    "Para corrigir: reabra a importação, confira o mapeamento de colunas (deixe as " +
    "colunas sem título em “Ignorar coluna”) e, se o problema continuar, remova os " +
    "segmentos ou CNAEs vazios no cadastro antes de importar."
  );
}
