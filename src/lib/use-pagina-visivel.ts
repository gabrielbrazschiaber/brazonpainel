import { useEffect, useState } from "react";

/**
 * Indica se a aba do navegador está visível.
 * Usado para desligar assinaturas de realtime e polling quando o usuário
 * está em outra aba/minimizado, reduzindo consumo de rede e de conexões.
 */
export function usePaginaVisivel() {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const atualizar = () => setVisivel(document.visibilityState === "visible");
    atualizar();
    document.addEventListener("visibilitychange", atualizar);
    window.addEventListener("focus", atualizar);
    window.addEventListener("blur", atualizar);
    return () => {
      document.removeEventListener("visibilitychange", atualizar);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("blur", atualizar);
    };
  }, []);

  return visivel;
}
