import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { MessageSquare, Users } from "lucide-react";
import type { ConversaResumo } from "@/lib/chat.functions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ChatLista({
  conversas,
  onAbrir,
  vazio,
}: {
  conversas: ConversaResumo[];
  onAbrir: (conversa: ConversaResumo) => void;
  vazio: string;
}) {
  if (conversas.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{vazio}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {conversas.map((c) => {
        const nome =
          c.tipo === "atendimento"
            ? `Atendimento — ${c.cliente_nome ?? "cliente"}`
            : (c.titulo ?? "Conversa da equipe");
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onAbrir(c)}
              className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  c.tipo === "equipe" ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
                )}
              >
                {c.tipo === "equipe" ? (
                  <Users className="h-4 w-4" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{nome}</span>
                  {c.nao_lidas > 0 && (
                    <Badge className="h-5 shrink-0 px-1.5 text-[11px]">{c.nao_lidas}</Badge>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {c.ultima_mensagem_previa ?? "Sem mensagens ainda"}
                </span>
                {c.participantes_nomes.length > 0 && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {c.participantes_nomes.join(", ")}
                  </span>
                )}
              </span>

              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(c.ultima_mensagem_em), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
