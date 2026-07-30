import * as React from "react";

const SELETOR_FOCAVEL = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focaveis(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Mantém o foco do teclado preso dentro do container enquanto `ativo` for true.
 * TAB / SHIFT+TAB circulam entre os elementos focáveis e o foco volta para o
 * elemento que estava ativo antes de abrir.
 */
export function useFocusTrap(ativo: boolean, ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!ativo) return;
    const container = ref.current;
    if (!container) return;

    const anterior = document.activeElement as HTMLElement | null;

    // Foca o primeiro elemento útil do menu ao abrir.
    const primeiro = focaveis(container)[0];
    if (primeiro) {
      primeiro.focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !container) return;
      const itens = focaveis(container);
      if (itens.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiroItem = itens[0];
      const ultimoItem = itens[itens.length - 1];
      const atual = document.activeElement as HTMLElement | null;

      if (atual && !container.contains(atual)) {
        e.preventDefault();
        primeiroItem.focus();
        return;
      }
      if (e.shiftKey && atual === primeiroItem) {
        e.preventDefault();
        ultimoItem.focus();
      } else if (!e.shiftKey && atual === ultimoItem) {
        e.preventDefault();
        primeiroItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [ativo, ref]);
}
