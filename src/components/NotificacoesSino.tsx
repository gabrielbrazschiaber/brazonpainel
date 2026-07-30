import { useCallback, useEffect, useState } from "react";
import { BellRing, ClipboardList, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  tarefa_id: string | null;
  lida_em: string | null;
  created_at: string;
}

/** Sino de notificações pessoais (ex.: tarefa atribuída ao usuário). */
export function NotificacoesSino() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const montado = useRef(true);

  const carregar = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("notificacoes")
      .select("id,titulo,mensagem,link,tarefa_id,lida_em,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!montado.current) return;
    if (!error) setItens((data ?? []) as Notificacao[]);
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    montado.current = true;
    if (!userId) return;
    void carregar();
    // Só consulta com a aba visível: evita requisições inúteis em segundo plano.
    const tick = () => {
      if (document.visibilityState === "visible") void carregar();
    };
    const t = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      montado.current = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [carregar, userId]);

  const naoLidas = itens.filter((n) => !n.lida_em).length;

  async function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v && naoLidas > 0 && userId) {
      const agora = new Date().toISOString();
      const anteriores = itens;
      setItens((atuais) => atuais.map((n) => (n.lida_em ? n : { ...n, lida_em: agora })));
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida_em: agora })
        .eq("user_id", userId)
        .is("lida_em", null);
      // Se o backend recusar, desfaz a marcação otimista.
      if (error && montado.current) setItens(anteriores);
    }
  }


  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <BellRing className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            Notificações
          </SheetTitle>
          <SheetDescription>Tarefas atribuídas a você e avisos do sistema.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : itens.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma notificação por enquanto.
            </p>
          ) : (
            <ul className="space-y-3">
              {itens.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-lg border border-border/60 p-3",
                    n.lida_em ? "bg-card" : "bg-muted/60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                      {n.mensagem && (
                        <p className="mt-0.5 truncate text-sm text-foreground/90">{n.mensagem}</p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                      </p>
                      {n.link && (
                        <Link
                          to="/tarefas"
                          onClick={() => setOpen(false)}
                          className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                        >
                          Abrir tarefa
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
