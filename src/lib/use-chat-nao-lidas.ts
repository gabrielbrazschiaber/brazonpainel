import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarConversas } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { usePaginaVisivel } from "@/lib/use-pagina-visivel";


type Opcoes = {
  /** Quando true, o chat está aberto e o polling de fundo é suspenso. */
  pausado?: boolean;
};

/**
 * Conta as mensagens não lidas do chat.
 * Atualiza em tempo real (realtime) quando chegam novas mensagens e mantém
 * apenas um polling lento de segurança (5 min) enquanto a aba está visível.
 * Com o chat aberto (`pausado`), o polling de fundo é totalmente suspenso.
 */
export function useChatNaoLidas(opcoes: Opcoes = {}) {
  const { pausado = false } = opcoes;
  const visivel = usePaginaVisivel();
  const inativo = pausado || !visivel;
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
    return () => {
      montado.current = false;
    };
  }, []);

  // Primeira carga + polling lento de segurança.
  // Suspenso com o chat aberto ou com a aba do navegador em segundo plano.
  useEffect(() => {
    if (inativo) return;
    void atualizar();
    const id = setInterval(() => {
      void atualizar();
    }, 300000);
    return () => clearInterval(id);
  }, [atualizar, inativo]);

  // Realtime: novas mensagens disparam a recontagem (com pequeno debounce).
  // A assinatura só existe enquanto a aba está visível e o chat fechado.
  useEffect(() => {
    if (inativo) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void atualizar();
      }, 800);
    };

    const canal = supabase
      .channel("chat-nao-lidas")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversa_mensagens" },
        agendar,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
  }, [atualizar, inativo]);

  return { naoLidas, atualizar };
}
