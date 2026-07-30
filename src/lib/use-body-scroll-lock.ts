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

/**
 * Seletores dos overlays que também travam/roubam o scroll:
 * dialogs, alert dialogs, sheets, drawers (vaul), popovers modais e menus.
 */
const SELETORES_OVERLAY = [
  '[data-state="open"][role="dialog"]',
  '[data-state="open"][role="alertdialog"]',
  '[data-state="open"][aria-modal="true"]',
  "[data-radix-dialog-content]",
  "[data-radix-alert-dialog-content]",
  "[vaul-drawer][data-state='open']",
  '[data-sonner-toast][data-expanded="true"]',
].join(",");

/** Detecta locks/overlays aplicados por outras libs (Radix, vaul, sonner). */
function outroOverlayAtivo() {
  if (typeof document === "undefined") return false;
  const body = document.body;
  if (body.hasAttribute("data-scroll-locked")) return true;
  if (body.style.pointerEvents === "none") return true;
  return document.querySelector(SELETORES_OVERLAY) !== null;
}

let observer: MutationObserver | null = null;

function pararObserver() {
  observer?.disconnect();
  observer = null;
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

function restaurarBody() {
  if (!estadoAnterior) return;
  const body = document.body;
  const { scrollY, ...estilos } = estadoAnterior;
  estadoAnterior = null;
  pararObserver();

  body.style.overflow = estilos.overflow;
  body.style.position = estilos.position;
  body.style.top = estilos.top;
  body.style.left = estilos.left;
  body.style.right = estilos.right;
  body.style.width = estilos.width;
  window.scrollTo(0, scrollY);
}

function liberarLock() {
  locks = Math.max(0, locks - 1);
  if (locks > 0 || !estadoAnterior) return;

  // Ainda há dialog/drawer/modal aberto por cima: mantém o body travado e
  // só restaura quando o último overlay sumir do DOM.
  if (outroOverlayAtivo()) {
    if (observer || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver(() => {
      if (locks === 0 && !outroOverlayAtivo()) restaurarBody();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "style", "data-scroll-locked", "aria-modal"],
    });
    return;
  }

  restaurarBody();
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
