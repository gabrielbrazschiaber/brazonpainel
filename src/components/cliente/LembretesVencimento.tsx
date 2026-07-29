import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, X } from "lucide-react";
import { meusLembretes, marcarLembreteLido, type LembreteCliente } from "@/lib/lembretes.functions";
import { formatDate } from "@/lib/format";

/**
 * Mostra os lembretes automáticos de vencimento em aberto do cliente.
 * Os lembretes são gerados pela rotina diária conforme os dias de aviso
 * configurados pela administração.
 */
export function LembretesVencimento() {
  const carregar = useServerFn(meusLembretes);
  const marcarLido = useServerFn(marcarLembreteLido);
  const [lembretes, setLembretes] = useState<LembreteCliente[]>([]);

  useEffect(() => {
    let ativo = true;
    carregar({})
      .then((res) => {
        if (ativo) setLembretes(res ?? []);
      })
      .catch(() => {
        /* silencioso: lembrete é informativo */
      });
    return () => {
      ativo = false;
    };
  }, [carregar]);

  async function dispensar(id: string) {
    setLembretes((l) => l.filter((x) => x.id !== id));
    try {
      await marcarLido({ data: { id } });
    } catch {
      /* já removido da tela */
    }
  }

  if (!lembretes.length) return null;

  return (
    <div className="mt-6 space-y-3">
      {lembretes.map((l) => (
        <div
          key={l.id}
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4"
        >
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Lembrete de vencimento</p>
            <p className="mt-1 text-sm text-muted-foreground">{l.mensagem}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vencimento: {formatDate(l.vencimento)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispensar(l.id)}
            aria-label="Dispensar lembrete"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
