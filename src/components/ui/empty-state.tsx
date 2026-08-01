import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}

/** Estado vazio padronizado: ícone em círculo, título, apoio e ação opcional. */
export function EmptyState({ icon: Icon, titulo, descricao, acao, className }: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "fade-in-up flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <div className="space-y-1">
        <p className="section-title text-base">{titulo}</p>
        {descricao && (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {descricao}
          </p>
        )}
      </div>
      {acao && <div className="mt-1">{acao}</div>}
    </Card>
  );
}
