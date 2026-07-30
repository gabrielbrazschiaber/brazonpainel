import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarConversas } from "@/lib/chat.functions";

/**
 * Conta as mensagens não lidas do chat, atualizando a cada 60s
 * apenas quando a aba está visível.
 */
export function useChatNaoLidas() {
  const [naoLidas, setNaoLidas] = useState(0);
  const montado = useRef(true);
  const buscar = useServerFn(listarConversas);

  const atualizar = useCallback(async () => {
    try {
      const lista = await buscar({ data: {} });
      if (!montado.current) return;
      setNaoLidas(lista.reduce((total, c) => total + (c.nao_lidas || 0), 0));
    } catch {
      /* silencioso: badge é informativo */
    }
  }, [buscar]);

  useEffect(() => {
    montado.current = true;
    void atualizar();
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void atualizar();
    }, 60000);
    return () => {
      montado.current = false;
      clearInterval(id);
    };
  }, [atualizar]);

  return { naoLidas, atualizar };
}
