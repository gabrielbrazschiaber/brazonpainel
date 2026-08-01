import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** título curto e humano — sem jargão técnico */
  titulo?: string;
  descricao?: string;
  /** código/trace opcional para o suporte */
  detalhe?: string;
  onTentarNovamente?: () => void;
  acao?: ReactNode;
  className?: string;
}

/**
 * Estado de erro padronizado dentro do conteúdo (não derruba a tela).
 * Mesmo tom e layout do EmptyState, com ação de recuperação previsível.
 */
export function ErrorState({
  titulo = "Não foi possível carregar",
  descricao = "Algo saiu diferente do esperado. Tente novamente — se continuar, avise o suporte.",
  detalhe,
  onTentarNovamente,
  acao,
  className,
}: ErrorStateProps) {
  return (
    <Card
      role="alert"
      className={cn(
        "fade-in-up flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="section-title text-base">{titulo}</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {descricao}
        </p>
      </div>
      {detalhe && (
        <code className="max-w-full break-all rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {detalhe}
        </code>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {onTentarNovamente && (
          <Button variant="outline" size="sm" onClick={onTentarNovamente}>
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
        {acao}
      </div>
    </Card>
  );
}
