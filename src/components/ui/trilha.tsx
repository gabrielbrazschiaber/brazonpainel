import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrilhaItem {
  rotulo: string;
  /** ausente = página atual */
  para?: string;
}

/**
 * Trilha de navegação (breadcrumbs) das telas internas.
 * Ajuda a entender onde se está e reduz cliques para voltar ao painel.
 */
export function Trilha({ itens, className }: { itens: readonly TrilhaItem[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {itens.map((item, i) => {
          const ultimo = i === itens.length - 1;
          return (
            <li key={`${item.rotulo}-${i}`} className="flex min-w-0 items-center gap-1">
              {item.para && !ultimo ? (
                <Link
                  to={item.para}
                  className="truncate rounded px-1 py-0.5 transition-colors hover:text-foreground hover:underline"
                >
                  {item.rotulo}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="truncate px-1 py-0.5 font-medium text-foreground"
                >
                  {item.rotulo}
                </span>
              )}
              {!ultimo && (
                <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
