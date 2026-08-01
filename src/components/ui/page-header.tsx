import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  className?: string;
}

/** Cabeçalho de página padronizado: contexto, título, apoio e ações à direita. */
export function PageHeader({ eyebrow, titulo, descricao, acoes, className }: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h2>
        {descricao && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
