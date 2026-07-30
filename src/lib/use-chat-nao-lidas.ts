import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listarConversas } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { usePaginaVisivel } from "@/lib/use-pagina-visivel";
import { useAuth } from "@/lib/auth";

type Opcoes = {
  /** Quando true, o chat está aberto e o polling de fundo é suspenso. */
  pausado?: boolean;
  /** Abre o chat a partir do toast de nova mensagem. */
  aoAbrirChat?: () => void;
};

const PREVIA_MAX = 90;

function previa(corpo: unknown) {
  const texto = typeof corpo === "string" ? corpo.trim() : "";
  if (!texto) return undefined;
  return texto.length > PREVIA_MAX ? `${texto.slice(0, PREVIA_MAX)}…` : texto;
}

/**
 * Conta as mensagens não lidas do chat.
 * Atualiza em tempo real (realtime) quando chegam novas mensagens, avisa com
 * um toast quando o chat está fechado e mantém apenas um polling lento de
 * segurança (5 min) enquanto a aba está visível.
 */
export function useChatNaoLidas(opcoes: Opcoes = {}) {
  const { pausado = false, aoAbrirChat } = opcoes;
  const visivel = usePaginaVisivel();
  const inativo = pausado || !visivel;
  const [naoLidas, setNaoLidas] = useState(0);
  const montado = useRef(true);
  const buscar = useServerFn(listarConversas);
  const { user } = useAuth();
  const meuId = user?.id ?? null;

  // Refs para não recriar a assinatura realtime a cada render.
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;
  const abrirRef = useRef(aoAbrirChat);
  abrirRef.current = aoAbrirChat;

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

  // Realtime: novas mensagens recontam o badge e avisam com toast.
  // Fica ativo mesmo com o chat aberto (o contador precisa acompanhar),
  // mas o toast só aparece quando o chat está fechado.
  useEffect(() => {
    if (!visivel) return;

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
        (payload) => {
          const nova = payload.new as {
            autor_id?: string | null;
            corpo?: string | null;
            sistema?: boolean | null;
          };

          // Mensagem própria não conta como novidade.
          if (meuId && nova.autor_id === meuId) return;

          agendar();

          if (!pausadoRef.current && !nova.sistema) {
            toast.message("Nova mensagem no chat", {
              description: previa(nova.corpo),
              action: abrirRef.current
                ? { label: "Abrir", onClick: () => abrirRef.current?.() }
                : undefined,
            });
          }
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
  }, [atualizar, visivel, meuId]);

  return { naoLidas, atualizar };
}
