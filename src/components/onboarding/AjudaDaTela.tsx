import * as React from "react";
import { toast } from "sonner";
import { HelpCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RESUMOS_TELA } from "@/lib/onboarding";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { ReverTutoriais } from "@/components/onboarding/ReverTutoriais";

/**
 * Botão de ajuda do cabeçalho (AppShell headerExtra). Nunca interrompe:
 * abre um resumo da tela e permite rever o tour daquela tela.
 */
export function AjudaDaTela({ chave }: { chave: string }) {
  const [aberto, setAberto] = React.useState(false);
  const { reiniciar, temTutorial } = useOnboarding();
  const [reiniciando, setReiniciando] = React.useState(false);
  const temTourDaTela = temTutorial(chave);
  const resumo = RESUMOS_TELA[chave];

  if (!resumo) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Ajuda desta tela"
        data-tour="ajuda-tela"
        onClick={() => setAberto(true)}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{resumo.titulo}</SheetTitle>
            <SheetDescription>{resumo.resumo}</SheetDescription>
          </SheetHeader>

          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {resumo.topicos.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-3 border-t border-border pt-4">
            {temTourDaTela && (
              <Button
                className="w-full"
                disabled={reiniciando}
                onClick={async () => {
                  // Reinicia SOMENTE a chave desta tela; os outros tutoriais
                  // permanecem como estão.
                  setReiniciando(true);
                  try {
                    const feito = await reiniciar(chave);
                    if (feito) {
                      setAberto(false);
                      toast.success("Tutorial desta tela reiniciado.");
                    } else {
                      toast.info("Esta tela não tem tutorial disponível para o seu acesso.");
                    }
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Não foi possível reiniciar o tutorial.",
                    );
                  } finally {
                    setReiniciando(false);
                  }
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {reiniciando ? "Reiniciando..." : "Rever tutorial desta tela"}
              </Button>
            )}
            <ReverTutoriais compacto onFeito={() => setAberto(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
