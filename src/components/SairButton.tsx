import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useSair } from "@/lib/use-sair";

interface SairButtonProps {
  /**
   * "icone"  -> apenas o ícone (cabeçalhos compactos / mobile)
   * "texto"  -> ícone + rótulo "Sair" (telas com espaço)
   * "menu"   -> item de largura total, para menus laterais/drawers
   */
  variante?: "icone" | "texto" | "menu";
  className?: string;
}

/**
 * Botão padrão de "Sair" usado em todas as telas autenticadas.
 * Abre uma confirmação antes de encerrar a sessão e volta para /login
 * via roteador (sem recarregar a página).
 */
export function SairButton({ variante = "icone", className }: SairButtonProps) {
  const { sair, saindo } = useSair();

  const trigger =
    variante === "icone" ? (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sair da conta"
        title="Sair"
        disabled={saindo}
        className={cn(
          "h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-9",
          className,
        )}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        aria-label="Sair da conta"
        disabled={saindo}
        className={cn(
          "h-10 gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-9",
          variante === "menu" && "w-full justify-start",
          className,
        )}
      >
        <LogOut className="h-4 w-4" />
        <span>Sair</span>
      </Button>
    );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
          <AlertDialogDescription>
            Sua sessão será encerrada neste dispositivo e você voltará para a tela de
            login.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void sair()} disabled={saindo}>
            {saindo ? "Saindo..." : "Sair"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
