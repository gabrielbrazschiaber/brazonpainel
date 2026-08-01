import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AJUDA_CAMPOS } from "@/lib/onboarding";

interface Props {
  /** Chave do catálogo AJUDA_CAMPOS (ex.: "cliente.cpf_cnpj"). */
  ajuda: keyof typeof AJUDA_CAMPOS | string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Label + ícone de ajuda dos campos que mais confundem.
 * Usa Popover para funcionar também no toque, onde tooltip não abre.
 */
export function CampoComAjuda({ ajuda, htmlFor, children, className }: Props) {
  const texto = AJUDA_CAMPOS[ajuda];

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{children}</Label>
      {texto && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Ajuda: ${typeof children === "string" ? children : ajuda}`}
              className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="max-w-xs text-sm leading-snug">
            {texto}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
