import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listarConversas } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { ChatSheet } from "./ChatSheet";

export function ChatBotao() {
  const [aberto, setAberto] = useState(false);
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

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative h-10 w-10 p-0 sm:w-auto sm:px-3"
        onClick={() => setAberto(true)}
        aria-label="Chat com a equipe"
      >
        <MessagesSquare className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Chat com a equipe</span>
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      <ChatSheet
        aberto={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) void atualizar();
        }}
        aoMudarNaoLidas={atualizar}
      />
    </>
  );
}
