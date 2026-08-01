import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  /** ícone opcional exibido junto ao rótulo de contexto */
  eyebrowIcon?: ComponentType<{ className?: string }>;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  /** conteúdo extra abaixo da descrição (chips, códigos, avisos curtos) */
  extra?: ReactNode;
  className?: string;
}

/** Cabeçalho de página padronizado: contexto, título, apoio e ações à direita. */
export function PageHeader({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  titulo,
  descricao,
  acoes,
  extra,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="eyebrow flex items-center gap-1.5">
            {EyebrowIcon && <EyebrowIcon className="h-3.5 w-3.5" />}
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
        {descricao && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{descricao}</p>
        )}
        {extra}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}
