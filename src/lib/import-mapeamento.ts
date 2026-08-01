/**
 * Auto-mapeamento de colunas de planilha com estimativa de confiança.
 * Puro (sem React/DOM) para poder ser testado isoladamente.
 */

import { normalizarChave } from "@/lib/leads-import";

export type NivelConfianca = "alta" | "media" | "baixa" | "nenhuma";

export interface SugestaoColuna<C extends string> {
  /** Índice da coluna no arquivo. */
  indice: number;
  /** Cabeçalho original exibido. */
  cabecalho: string;
  /** Campo de destino sugerido ("" = ignorar). */
  destino: C | "";
  /** 0 a 100. */
  confianca: number;
  nivel: NivelConfianca;
  /** Explicação curta da regra que gerou a sugestão. */
  motivo: string;
}

export function nivelDe(confianca: number): NivelConfianca {
  if (confianca >= 90) return "alta";
  if (confianca >= 70) return "media";
  if (confianca > 0) return "baixa";
  return "nenhuma";
}

export const ROTULO_NIVEL: Record<NivelConfianca, string> = {
  alta: "Confiança alta",
  media: "Confiança média",
  baixa: "Confiança baixa",
  nenhuma: "Sem correspondência",
};

/**
 * Casa cada cabeçalho com um campo de destino, sem repetir campo, e devolve
 * a confiança da escolha:
 * - 100: nome do cabeçalho igual a um sinônimo conhecido;
 * -  85: cabeçalho começa com um sinônimo;
 * -  70: cabeçalho contém um sinônimo (mínimo 4 letras);
 * -   0: nenhuma correspondência (coluna ignorada).
 */
export function sugerirComConfianca<C extends string>(
  cabecalhos: string[],
  campos: readonly C[],
  sinonimos: Record<C, string[]>,
): SugestaoColuna<C>[] {
  const usados = new Set<C>();

  const avaliar = (chave: string): { destino: C | ""; confianca: number; motivo: string } => {
    if (!chave) return { destino: "", confianca: 0, motivo: "Coluna sem cabeçalho" };
    const candidatos: { campo: C; confianca: number; motivo: string }[] = [];
    for (const campo of campos) {
      if (usados.has(campo)) continue;
      for (const s of sinonimos[campo] ?? []) {
        if (chave === s) {
          candidatos.push({ campo, confianca: 100, motivo: `Cabeçalho igual a "${s}"` });
          break;
        }
        if (chave.startsWith(s)) {
          candidatos.push({ campo, confianca: 85, motivo: `Cabeçalho começa com "${s}"` });
          break;
        }
        if (s.length >= 4 && chave.includes(s)) {
          candidatos.push({ campo, confianca: 70, motivo: `Cabeçalho contém "${s}"` });
          break;
        }
      }
    }
    if (candidatos.length === 0) {
      return { destino: "", confianca: 0, motivo: "Nenhum campo conhecido com este nome" };
    }
    candidatos.sort((a, b) => b.confianca - a.confianca);
    const melhor = candidatos[0];
    return { destino: melhor.campo, confianca: melhor.confianca, motivo: melhor.motivo };
  };

  return cabecalhos.map((cabecalho, indice) => {
    const { destino, confianca, motivo } = avaliar(normalizarChave(cabecalho));
    if (destino) usados.add(destino);
    return { indice, cabecalho, destino, confianca, nivel: nivelDe(confianca), motivo };
  });
}

export interface ResumoConfianca {
  /** Média das confianças das colunas reconhecidas (0 quando nenhuma). */
  media: number;
  nivel: NivelConfianca;
  reconhecidas: number;
  ignoradas: number;
  /** Campos obrigatórios que ficaram sem coluna. */
  faltando: string[];
}

/** Confiança geral do mapeamento; campos obrigatórios em falta derrubam a nota. */
export function resumirConfianca<C extends string>(
  sugestoes: SugestaoColuna<C>[],
  faltandoObrigatorios: string[] = [],
): ResumoConfianca {
  const reconhecidas = sugestoes.filter((s) => s.destino !== "");
  const soma = reconhecidas.reduce((t, s) => t + s.confianca, 0);
  const bruta = reconhecidas.length === 0 ? 0 : Math.round(soma / reconhecidas.length);
  const media = faltandoObrigatorios.length > 0 ? Math.min(bruta, 40) : bruta;
  return {
    media,
    nivel: nivelDe(media),
    reconhecidas: reconhecidas.length,
    ignoradas: sugestoes.length - reconhecidas.length,
    faltando: faltandoObrigatorios,
  };
}
