import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Menu, MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChatSheet } from "@/components/chat/ChatSheet";
import { useChatNaoLidas } from "@/lib/use-chat-nao-lidas";

/**
 * Menu lateral com os atalhos de Tarefas e Chat com a equipe,
 * liberando espaço na barra superior.
 */
export function MenuLateral() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);
  const { naoLidas, atualizar } = useChatNaoLidas({ pausado: chatAberto });

  return (
    <>
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 shrink-0 sm:h-9 sm:w-9"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
            {naoLidas > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Atalhos do painel</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            <Button
              asChild
              variant="ghost"
              className="h-11 justify-start"
              onClick={() => setMenuAberto(false)}
            >
              <Link to="/tarefas">
                <ClipboardList className="mr-2 h-4 w-4" />
                Tarefas
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="h-11 justify-start"
              onClick={() => {
                setMenuAberto(false);
                setChatAberto(true);
              }}
            >
              <MessagesSquare className="mr-2 h-4 w-4" />
              Chat com a equipe
              {naoLidas > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                  {naoLidas > 9 ? "9+" : naoLidas}
                </span>
              )}
            </Button>
          </nav>
        </SheetContent>
      </Sheet>

      {chatAberto && (
        <ChatSheet
        aberto={chatAberto}
        onOpenChange={(v) => {
          setChatAberto(v);
          if (!v) void atualizar();
        }}
          aoMudarNaoLidas={atualizar}
        />
      )}
    </>
  );
}
