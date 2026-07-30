import * as React from "react";

/**
 * Lock de scroll com contagem de referências.
 *
 * Vários componentes podem pedir o lock ao mesmo tempo (drawer mobile + dialog
 * + sheet). Apenas o PRIMEIRO aplica os estilos e guarda o estado anterior;
 * apenas o ÚLTIMO a liberar restaura o body e a posição de rolagem. Assim o
 * body nunca é destravado enquanto ainda houver um overlay aberto.
 */
let locks = 0;
let estadoAnterior: {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  scrollY: number;
} | null = null;

/** Detecta locks aplicados por outras libs (Radix/react-remove-scroll). */
function outroLockAtivo() {
  return (
    document.body.hasAttribute("data-scroll-locked") ||
    document.body.style.pointerEvents === "none"
  );
}

function aplicarLock() {
  locks += 1;
  if (locks > 1) return;

  const body = document.body;
  const scrollY = window.scrollY;
  estadoAnterior = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    scrollY,
  };

  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
}

function liberarLock() {
  locks = Math.max(0, locks - 1);
  if (locks > 0 || !estadoAnterior) return;

  const body = document.body;
  const { scrollY, ...estilos } = estadoAnterior;
  estadoAnterior = null;

  body.style.overflow = estilos.overflow;
  body.style.position = estilos.position;
  body.style.top = estilos.top;
  body.style.left = estilos.left;
  body.style.right = estilos.right;
  body.style.width = estilos.width;

  // Se outra biblioteca ainda mantém a página travada (ex.: um dialog Radix
  // aberto por cima), não mexemos na posição — ela será restaurada por quem
  // ainda detém o lock ao fechar.
  if (!outroLockAtivo()) window.scrollTo(0, scrollY);
}

/**
 * Bloqueia o scroll da página enquanto `ativo` for verdadeiro, cooperando com
 * outros overlays via contagem de referências. Usa `position: fixed` para
 * funcionar também no Safari iOS.
 */
export function useBodyScrollLock(ativo: boolean) {
  React.useEffect(() => {
    if (!ativo || typeof document === "undefined") return;
    aplicarLock();
    return () => liberarLock();
  }, [ativo]);
}

/** Exposto para testes. */
export function __locksAtivos() {
  return locks;
}
