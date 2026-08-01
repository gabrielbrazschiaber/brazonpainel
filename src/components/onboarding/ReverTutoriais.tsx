import * as React from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHAVE_BOAS_VINDAS } from "@/lib/onboarding";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";

/**
 * "Rever tutoriais": reinicia tudo ou apenas uma tela.
 * É o único caminho para um tutorial já visto voltar a aparecer.
 */
export function ReverTutoriais({
  compacto = false,
  onFeito,
}: {
  compacto?: boolean;
  onFeito?: () => void;
}) {
  const { tutoriais, reiniciar } = useOnboarding();
  const [escolha, setEscolha] = React.useState<string>("todos");
  const [salvando, setSalvando] = React.useState(false);

  if (tutoriais.length === 0) return null;

  async function aplicar(chave?: string) {
    setSalvando(true);
    try {
      const feito = await reiniciar(chave);
      if (!feito) {
        toast.info("Este tutorial não está disponível para o seu acesso.");
        return;
      }
      toast.success(chave ? "Tutorial reiniciado." : "Todos os tutoriais foram reiniciados.");
      onFeito?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reiniciar.");
    } finally {
      setSalvando(false);
    }
  }

  if (compacto) {
    return (
      <Button
        variant="outline"
        className="w-full"
        disabled={salvando}
        onClick={() => void aplicar()}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Rever todos os tutoriais
      </Button>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="rever-tutorial">Rever tutoriais</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={escolha} onValueChange={setEscolha}>
          <SelectTrigger id="rever-tutorial" className="sm:flex-1">
            <SelectValue placeholder="Escolha o que rever" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tutoriais</SelectItem>
            {tutoriais.map((t) => (
              <SelectItem key={t.chave} value={t.chave}>
                {t.chave === CHAVE_BOAS_VINDAS ? "Boas-vindas" : t.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={salvando}
          onClick={() => void aplicar(escolha === "todos" ? undefined : escolha)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {salvando ? "Reiniciando..." : "Rever"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O tutorial escolhido aparece de novo na próxima vez que você abrir a tela.
      </p>
    </div>
  );
}
