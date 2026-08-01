import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { apenasDigitos, linkWhatsApp } from "@/lib/leads";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Status = "ativo" | "incerto" | "invalido";

/**
 * Heurística de WhatsApp: o número só é tratado como ativo quando é celular
 * brasileiro válido (DDD + 9 dígitos iniciando em 9). Fixos e números
 * incompletos não recebem o destaque verde.
 */
export function statusWhatsApp(telefone: string | null | undefined): Status {
  const d = apenasDigitos(telefone);
  const nacional = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (nacional.length === 11 && nacional[2] === "9") return "ativo";
  if (nacional.length === 10) return "incerto";
  return "invalido";
}

const mensagem: Record<Status, string> = {
  ativo: "Cliente possui WhatsApp ativo — clique para abrir a conversa",
  incerto: "Número fixo: não foi possível confirmar WhatsApp",
  invalido: "Informe o telefone com DDD para verificar o WhatsApp",
};

const cores: Record<Status, string> = {
  ativo: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  incerto: "border-border bg-muted text-muted-foreground",
  invalido: "border-border bg-muted text-muted-foreground/60",
};

export function WhatsAppIndicator({
  telefone,
  className,
}: {
  telefone: string | null | undefined;
  className?: string;
}) {
  const status = statusWhatsApp(telefone);
  const ativo = status === "ativo";

  const icone = (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
        cores[status],
        className,
      )}
      aria-label={mensagem[status]}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
    </span>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {ativo ? (
            <a
              href={linkWhatsApp(telefone)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex"
            >
              {icone}
            </a>
          ) : (
            <span className="inline-flex">{icone}</span>
          )}
        </TooltipTrigger>
        <TooltipContent>{mensagem[status]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
