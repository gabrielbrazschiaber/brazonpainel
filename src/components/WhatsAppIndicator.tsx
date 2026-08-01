import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { linkWhatsApp } from "@/lib/leads";
import {
  WHATSAPP_CORES,
  mensagemTooltipWhatsApp,
  statusWhatsApp,
  type WhatsAppStatus,
} from "@/lib/whatsapp";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export { statusWhatsApp, type WhatsAppStatus };

const tamanhos = {
  sm: "h-6 w-6 [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
} as const;

export function WhatsAppIndicator({
  telefone,
  status,
  size = "md",
  className,
}: {
  telefone: string | null | undefined;
  /** Status pré-calculado no carregamento da lista (evita recomputar por linha). */
  status?: WhatsAppStatus;
  size?: keyof typeof tamanhos;
  className?: string;
}) {
  const st = status ?? statusWhatsApp(telefone);
  const ativo = st === "ativo";
  const mensagem = mensagemTooltipWhatsApp(telefone);

  const icone = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border transition-colors",
        tamanhos[size],
        WHATSAPP_CORES[st],
        className,
      )}
      aria-label={mensagem}
    >
      <MessageCircle aria-hidden />
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
              onClick={(e) => e.stopPropagation()}
            >
              {icone}
            </a>
          ) : (
            <span className="inline-flex">{icone}</span>
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-center">{mensagem}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
