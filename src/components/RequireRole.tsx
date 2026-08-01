import { useEffect, useState, type ReactNode } from "react";
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

/** Falha de rede ao consultar o papel: nunca confundir com ausência de perfil. */
function FalhaConexao() {
  const { refresh } = useAuth();
  const [tentando, setTentando] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Falha de conexão</h1>
        <p className="text-sm text-muted-foreground">
          Não conseguimos verificar seu perfil de acesso agora. Confira sua conexão e
          tente novamente.
        </p>
        <Button
          disabled={tentando}
          onClick={() => {
            setTentando(true);
            void refresh().finally(() => setTentando(false));
          }}
        >
          {tentando ? "Tentando..." : "Tentar novamente"}
        </Button>
      </div>
    </div>
  );
}

export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const { loading, session, role: userRole, estadoPapel, roleResolvido } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/login", replace: true });
      // Só redireciona por papel diferente quando o papel está resolvido.
    } else if (roleResolvido && userRole && userRole !== role) {
      void navigate({ to: roleHome(userRole), replace: true });
    }
  }, [loading, session, roleResolvido, userRole, role, navigate]);

  // Enquanto carrega, sem sessão ou papel incorreto: mostra apenas spinner.
  // NUNCA renderiza o conteúdo protegido, nem tela de bloqueio, antes da
  // verificação do papel ser concluída.
  if (loading || !session) return <Spinner />;
  if (estadoPapel === "erro") return <FalhaConexao />;
  if (!roleResolvido) return <Spinner />;
  if (estadoPapel === "sem_papel") return <SemPapel />;
  if (userRole !== role) return <Spinner />;

  return <TermosGate>{children}</TermosGate>;
}
