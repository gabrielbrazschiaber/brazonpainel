import * as React from "react";

/**
 * Bloqueia o scroll da página enquanto `ativo` for verdadeiro e restaura
 * exatamente os estilos anteriores (e a posição de rolagem) ao desativar.
 * Usa `position: fixed` para funcionar também no Safari iOS, onde apenas
 * `overflow: hidden` no body não impede o "rubber band" scroll.
 */
export function useBodyScrollLock(ativo: boolean) {
  React.useEffect(() => {
    if (!ativo || typeof document === "undefined") return;

    const body = document.body;
    const anterior = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const scrollY = window.scrollY;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      body.style.overflow = anterior.overflow;
      body.style.position = anterior.position;
      body.style.top = anterior.top;
      body.style.left = anterior.left;
      body.style.right = anterior.right;
      body.style.width = anterior.width;
      window.scrollTo(0, scrollY);
    };
  }, [ativo]);
}
