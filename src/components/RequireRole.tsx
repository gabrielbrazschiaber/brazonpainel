import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, roleHome, type AppRole } from "@/lib/auth";
import { TermosGate } from "@/components/TermosGate";
import { Button } from "@/components/ui/button";
import { useSair } from "@/lib/use-sair";

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** Conta autenticada, porém sem papel atribuído: evita spinner infinito. */
function SemPapel() {
  const { sair, saindo } = useSair();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Acesso não liberado</h1>
        <p className="text-sm text-muted-foreground">
          Sua conta ainda não possui um perfil de acesso configurado. Fale com o
          administrador da plataforma para liberar seu acesso.
        </p>
        <Button onClick={() => void sair()} disabled={saindo}>
          {saindo ? "Saindo..." : "Sair da conta"}
        </Button>
      </div>
    </div>
  );
}

export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const { loading, session, role: userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/login", replace: true });
    } else if (userRole && userRole !== role) {
      void navigate({ to: roleHome(userRole), replace: true });
    }
  }, [loading, session, userRole, role, navigate]);

  // Enquanto carrega, sem sessão ou papel incorreto: mostra apenas spinner.
  // NUNCA renderiza o conteúdo protegido antes da verificação ser concluída.
  if (loading || !session) return <Spinner />;
  if (!userRole) return <SemPapel />;
  if (userRole !== role) return <Spinner />;

  return <TermosGate>{children}</TermosGate>;
}
