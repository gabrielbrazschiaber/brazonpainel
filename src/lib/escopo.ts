/**
 * Escopo de atuação do vendedor (segmento / estado / CNAE).
 *
 * Regra única do sistema: **lista vazia = sem restrição naquela dimensão**.
 * Estes helpers são client-safe e são usados pelo formulário do vendedor,
 * pelos selects de reserva da importação e pelo resumo na tabela.
 */

/** Remove vazios, apara espaços e tira duplicados preservando a ordem. */
export function opcoesUnicas(valores: readonly (string | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of valores) {
    const v = (bruto ?? "").toString().trim();
    if (!v || vistos.has(v)) continue;
    vistos.add(v);
    saida.push(v);
  }
  return saida;
}

/** Ordena alfabeticamente em pt-BR (usado nas listas de opções). */
export function ordenarPtBr(valores: readonly string[]): string[] {
  return [...valores].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export const SEM_RESTRICAO = "Sem restrição — vê tudo";

/** Resumo curto do escopo, para caber na tabela de vendedores. */
export function resumoEscopo(escopo: {
  segmentos?: string[] | null;
  estados?: string[] | null;
  cnaes?: string[] | null;
}): string {
  const partes: string[] = [];
  const segmentos = escopo.segmentos ?? [];
  const estados = escopo.estados ?? [];
  const cnaes = escopo.cnaes ?? [];

  if (segmentos.length > 0) {
    partes.push(
      segmentos.length <= 2
        ? segmentos.join(", ")
        : `${segmentos.slice(0, 2).join(", ")} +${segmentos.length - 2}`,
    );
  }
  if (estados.length > 0) {
    partes.push(
      estados.length <= 4 ? estados.join("/") : `${estados.slice(0, 4).join("/")} +${estados.length - 4}`,
    );
  }
  if (cnaes.length > 0) {
    partes.push(`${cnaes.length} CNAE${cnaes.length === 1 ? "" : "s"}`);
  }

  return partes.length === 0 ? SEM_RESTRICAO : partes.join(" · ");
}
