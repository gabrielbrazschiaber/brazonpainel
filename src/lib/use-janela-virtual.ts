import { useCallback, useEffect, useRef, useState } from "react";

interface OpcoesJanela {
  /** Total de itens da lista completa. */
  total: number;
  /** Altura estimada de cada item, em pixels. */
  altura: number;
  /** Itens extras renderizados acima/abaixo da área visível. */
  folga?: number;
  /** Abaixo desse total a virtualização é desligada (custo > benefício). */
  minimo?: number;
}

export interface JanelaVirtual {
  /** Índice do primeiro item a renderizar. */
  inicio: number;
  /** Índice (exclusivo) do último item a renderizar. */
  fim: number;
  /** Espaço a reservar antes dos itens visíveis. */
  antes: number;
  /** Espaço a reservar depois dos itens visíveis. */
  depois: number;
  /** `false` quando a lista é pequena e renderiza inteira. */
  ativa: boolean;
  /** Ref para o elemento que envolve a lista (usado para medir a posição). */
  ref: (no: HTMLElement | null) => void;
}

/**
 * Virtualização simples baseada no scroll da janela.
 *
 * Listas grandes (leads, pagamentos) passam a montar apenas as linhas
 * visíveis, o que reduz re-renderizações e memória — diferença sentida
 * principalmente no celular. O espaço das linhas fora da janela é
 * preservado com espaçadores, mantendo a barra de rolagem correta.
 */
export function useJanelaVirtual({
  total,
  altura,
  folga = 6,
  minimo = 40,
}: OpcoesJanela): JanelaVirtual {
  const ativa = total > minimo;
  const noRef = useRef<HTMLElement | null>(null);
  const [janela, setJanela] = useState({ inicio: 0, fim: Math.min(total, minimo) });

  const medir = useCallback(() => {
    const no = noRef.current;
    if (!no || typeof window === "undefined") return;
    const caixa = no.getBoundingClientRect();
    const topoRelativo = -caixa.top;
    const visiveis = Math.ceil(window.innerHeight / altura) + folga * 2;
    const primeiro = Math.max(0, Math.floor(topoRelativo / altura) - folga);
    setJanela({ inicio: primeiro, fim: Math.min(total, primeiro + visiveis) });
  }, [altura, folga, total]);

  const ref = useCallback(
    (no: HTMLElement | null) => {
      noRef.current = no;
      if (no) medir();
    },
    [medir],
  );

  useEffect(() => {
    if (!ativa) return;
    medir();
    const aoRolar = () => medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, [ativa, medir]);

  if (!ativa) {
    return { inicio: 0, fim: total, antes: 0, depois: 0, ativa: false, ref };
  }

  const inicio = Math.min(janela.inicio, Math.max(0, total - 1));
  const fim = Math.max(inicio + 1, Math.min(janela.fim, total));
  return {
    inicio,
    fim,
    antes: inicio * altura,
    depois: Math.max(0, (total - fim) * altura),
    ativa: true,
    ref,
  };
}
