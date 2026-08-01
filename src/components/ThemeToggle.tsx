import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTema } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

/** Botão de alternância entre tema claro e escuro. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { tema, alternarTema } = useTema();
  const escuro = tema === "escuro";
  const rotulo = escuro ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={alternarTema}
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={escuro}
      className={cn("h-10 w-10 shrink-0", className)}
    >
      {escuro ? (
        <Sun className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
      ) : (
        <Moon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
      )}
    </Button>
  );
}
