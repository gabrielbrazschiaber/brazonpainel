import * as React from "react";

const MOBILE_BREAKPOINT = 768;
/** Altura mínima para tratar como desktop: telefones em paisagem ficam abaixo disso. */
const SHORT_SCREEN_HEIGHT = 500;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px), (max-height: ${SHORT_SCREEN_HEIGHT}px) and (pointer: coarse)`;

/**
 * Retorna true em telas estreitas OU em telas baixas com toque (celular em paisagem).
 * Assim o menu do admin continua sendo um drawer em qualquer orientação.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
