import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Estados de carregamento padronizados.
 *
 * Regra do design system: nunca mostrar spinner sozinho em área de conteúdo —
 * o esqueleto reproduz a estrutura final e evita salto de layout.
 */

export function ListaEsqueleto({ linhas = 4, className }: { linhas?: number; className?: string }) {
  return (
    <Card className={cn("space-y-3 p-4 sm:p-5", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </Card>
  );
}

export function CardsEsqueleto({
  quantidade = 3,
  className,
}: {
  quantidade?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando indicadores…</span>
      {Array.from({ length: quantidade }).map((_, i) => (
        <Card key={i} className="space-y-3 p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-full" />
        </Card>
      ))}
    </div>
  );
}

export function TabelaEsqueleto({
  linhas = 6,
  colunas = 4,
  className,
}: {
  linhas?: number;
  colunas?: number;
  className?: string;
}) {
  return (
    <Card className={cn("space-y-2 p-4 sm:p-5", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando dados…</span>
      <div className="flex gap-3">
        {Array.from({ length: colunas }).map((_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </Card>
  );
}
