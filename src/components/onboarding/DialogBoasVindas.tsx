import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tutorial } from "@/lib/onboarding";
import type { AppRole } from "@/lib/permissions";

const PANORAMA: Record<AppRole, string[]> = {
  admin: [
    "Dashboard, Clientes, Tarefas, Comercial, Novidades e Configurações no menu lateral.",
    "Cobrança recorrente mensal integrada à plataforma de pagamento.",
    "Chat com a equipe e sino de avisos sempre à mão no topo.",
  ],
  vendedor: [
    "Painel com sua carteira, comissão estimada, cupons e link de indicação.",
    "Comercial para prospectar leads e trabalhar a fila de follow-up.",
    "Tarefas com as contratações e solicitações que precisam de você.",
  ],
  cliente: [
    "Minha assinatura: status, plano, vencimento e faturas.",
    "Solicitações: peça alteração de plano, vencimento ou segunda via.",
    "Chat para falar direto com o suporte.",
  ],
};

interface Props {
  tutorial: Tutorial;
  papel: AppRole | null;
  onComecar: () => void;
  onAgoraNao: () => void;
}

/** Dialog de primeiro acesso, com o panorama do papel do usuário. */
export function DialogBoasVindas({ tutorial, papel, onComecar, onAgoraNao }: Props) {
  const itens = papel ? PANORAMA[papel] : [];

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onAgoraNao()}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-lg"
        data-onboarding="boas-vindas"
      >
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <DialogTitle>{tutorial.titulo}</DialogTitle>
          <DialogDescription>
            Em menos de um minuto mostramos onde fica cada coisa. Você pode sair a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          {itens.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onAgoraNao} data-onboarding-acao="agora-nao">
            Agora não
          </Button>
          <Button onClick={onComecar} data-onboarding-acao="comecar">
            Começar tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
