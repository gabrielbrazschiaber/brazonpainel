import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CampoProps {
  /** rótulo claro, sempre visível (nunca só placeholder) */
  rotulo: string;
  /** texto de apoio curto: formato esperado, exemplo, consequência */
  ajuda?: string;
  /** mensagem de validação inline — quando presente o campo fica em estado de erro */
  erro?: string;
  obrigatorio?: boolean;
  className?: string;
  /** recebe os ids de acessibilidade para amarrar rótulo, ajuda e erro ao controle */
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
  }) => ReactNode;
}

/**
 * Campo de formulário padrão do sistema.
 *
 * Hierarquia única: rótulo → controle → ajuda → erro. O erro substitui
 * visualmente a ajuda para não empilhar mensagens, e é anunciado por leitor de
 * tela via aria-describedby + aria-invalid.
 */
export function Campo({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  className,
  children,
}: CampoProps) {
  const base = useId();
  const id = `${base}-campo`;
  const idAjuda = `${base}-ajuda`;
  const idErro = `${base}-erro`;
  const descrito = [ajuda && !erro ? idAjuda : null, erro ? idErro : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {rotulo}
        {obrigatorio && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
        {obrigatorio && <span className="sr-only">(obrigatório)</span>}
      </Label>

      {children({
        id,
        "aria-describedby": descrito || undefined,
        "aria-invalid": Boolean(erro),
      })}

      {ajuda && !erro && (
        <p id={idAjuda} className="text-xs leading-relaxed text-muted-foreground">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} role="alert" className="text-xs font-medium leading-relaxed text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Rodapé de formulário: ordem de ações previsível (cancelar à esquerda, confirmar à direita). */
export function AcoesFormulario({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
