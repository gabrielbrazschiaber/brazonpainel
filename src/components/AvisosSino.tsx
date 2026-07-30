import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ClipboardList, Loader2, Megaphone, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { marcarNovidadesVistas } from "@/lib/novidades.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Novidade {
  id: string;
  titulo: string;
  conteudo: string;
  versao: string | null;
  tipo: "novidade" | "comunicado";
  data_publicacao: string | null;
  created_at: string;
}

/**
 * Sino único: reúne as notificações pessoais e as novidades/comunicados
 * do Brazon em um só painel com abas.
 */
export function AvisosSino() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const marcarVistas = useServerFn(marcarNovidadesVistas);

  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<"notificacoes" | "novidades">("notificacoes");
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [novidades, setNovidades] = useState<Novidade[]>([]);
  const [vistasEm, setVistasEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const montado = useRef(true);

  const carregar = useCallback(async () => {
    if (!userId) return;
    const [notif, novs, prof] = await Promise.all([
      supabase
        .from("notificacoes")
        .select("id,titulo,mensagem,link,tarefa_id,lida_em,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("novidades")
        .select("id,titulo,conteudo,versao,tipo,data_publicacao,created_at")
        .eq("publicado", true)
        .order("data_publicacao", { ascending: false })
        .limit(50),
      supabase.from("profiles").select("novidades_vistas_em").eq("id", userId).maybeSingle(),
    ]);
    if (!montado.current) return;
    if (!notif.error) setNotificacoes((notif.data ?? []) as Notificacao[]);
    setNovidades((novs.data ?? []) as Novidade[]);
    setVistasEm(
      (prof.data as { novidades_vistas_em: string | null } | null)?.novidades_vistas_em ?? null,
    );
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    montado.current = true;
    if (!userId) return;
    void carregar();
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

  const notifNaoLidas = notificacoes.filter((n) => !n.lida_em).length;
  const novasNovidades = novidades.filter((n) => {
    if (!n.data_publicacao) return false;
    if (!vistasEm) return true;
    return new Date(n.data_publicacao).getTime() > new Date(vistasEm).getTime();
  }).length;
  const total = notifNaoLidas + novasNovidades;

  async function marcarNotificacoes() {
    if (notifNaoLidas === 0 || !userId) return;
    const agora = new Date().toISOString();
    const anteriores = notificacoes;
    setNotificacoes((atuais) => atuais.map((n) => (n.lida_em ? n : { ...n, lida_em: agora })));
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida_em: agora })
      .eq("user_id", userId)
      .is("lida_em", null);
    if (error && montado.current) setNotificacoes(anteriores);
  }

  async function marcarNovidades() {
    if (novasNovidades === 0) return;
    try {
      await marcarVistas({});
      if (montado.current) setVistasEm(new Date().toISOString());
    } catch {
      /* ignora — indicador some no próximo carregamento */
    }
  }

  async function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) return;
    if (aba === "notificacoes") await marcarNotificacoes();
    else await marcarNovidades();
  }

  async function handleAba(v: string) {
    const nova = v === "novidades" ? "novidades" : "notificacoes";
    setAba(nova);
    if (nova === "novidades") await marcarNovidades();
    else await marcarNotificacoes();
  }

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Avisos" className="relative">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Avisos
          </SheetTitle>
          <SheetDescription>Notificações pessoais e novidades do Brazon.</SheetDescription>
        </SheetHeader>

        <Tabs value={aba} onValueChange={handleAba} className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="notificacoes" className="flex-1">
                Notificações
                {notifNaoLidas > 0 && (
                  <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {notifNaoLidas > 9 ? "9+" : notifNaoLidas}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="novidades" className="flex-1">
                Novidades
                {novasNovidades > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {novasNovidades > 9 ? "9+" : novasNovidades}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="notificacoes"
            className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4"
          >
            {carregando ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notificacoes.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma notificação por enquanto.
              </p>
            ) : (
              <ul className="space-y-3">
                {notificacoes.map((n) => (
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
          </TabsContent>

          <TabsContent value="novidades" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {novidades.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma novidade por enquanto.
              </p>
            ) : (
              <ul className="space-y-3">
                {novidades.map((n) => {
                  const isNova =
                    !!n.data_publicacao &&
                    (!vistasEm ||
                      new Date(n.data_publicacao).getTime() > new Date(vistasEm).getTime());
                  const quando = n.data_publicacao ?? n.created_at;
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "rounded-lg border border-border/60 p-3 transition",
                        isNova ? "bg-muted/60" : "bg-card",
                      )}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            n.tipo === "comunicado"
                              ? "border-warning/40 bg-warning/15 text-warning-foreground"
                              : "border-primary/30 bg-primary/10 text-primary",
                          )}
                        >
                          {n.tipo === "comunicado" ? (
                            <Megaphone className="h-3 w-3" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          {n.tipo === "comunicado" ? "Comunicado" : "Novidade"}
                        </span>
                        {n.versao && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {n.versao}
                          </span>
                        )}
                        {isNova && (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            Nova
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{n.titulo}</h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(quando), { locale: ptBR, addSuffix: true })}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">
                        {n.conteudo}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
