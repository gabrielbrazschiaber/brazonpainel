import { useCallback, useEffect, useState } from "react";
import { Bell, Megaphone, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { marcarNovidadesVistas } from "@/lib/novidades.functions";
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

interface Novidade {
  id: string;
  titulo: string;
  conteudo: string;
  versao: string | null;
  tipo: "novidade" | "comunicado";
  data_publicacao: string | null;
  created_at: string;
}

export function NovidadesSino() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [novidades, setNovidades] = useState<Novidade[]>([]);
  const [vistasEm, setVistasEm] = useState<string | null>(null);
  const marcarVistas = useServerFn(marcarNovidadesVistas);

  const carregar = useCallback(async () => {
    if (!user) return;
    const [{ data: novs }, { data: prof }] = await Promise.all([
      supabase
        .from("novidades")
        .select("id,titulo,conteudo,versao,tipo,data_publicacao,created_at")
        .eq("publicado", true)
        .order("data_publicacao", { ascending: false })
        .limit(50),
      supabase.from("profiles").select("novidades_vistas_em").eq("id", user.id).maybeSingle(),
    ]);
    setNovidades((novs ?? []) as Novidade[]);
    setVistasEm((prof as { novidades_vistas_em: string | null } | null)?.novidades_vistas_em ?? null);
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const naoLidas = novidades.filter((n) => {
    if (!n.data_publicacao) return false;
    if (!vistasEm) return true;
    return new Date(n.data_publicacao).getTime() > new Date(vistasEm).getTime();
  }).length;

  async function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v && naoLidas > 0) {
      try {
        await marcarVistas({});
        setVistasEm(new Date().toISOString());
      } catch {
        /* ignora — indicador só some no próximo carregamento */
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Novidades" className="relative">
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Novidades
          </SheetTitle>
          <SheetDescription>Atualizações e comunicados do Brazon.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
