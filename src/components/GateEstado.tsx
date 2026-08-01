import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useSair } from "@/lib/use-sair";
import { Button } from "@/components/ui/button";
import { registrarAuthTelemetria } from "@/lib/auth-telemetry";

/** Estado neutro de carregamento — nunca insinua bloqueio de acesso. */
export function GateSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label="Carregando"
      data-gate-estado="carregando"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** Conta autenticada, porém sem papel atribuído: evita spinner infinito. */
export function GateSemPapel() {
  const { sair, saindo } = useSair();
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      data-gate-estado="sem_papel"
    >
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

/**
 * Falha de rede/consulta ao verificar o papel. Nunca confundir com ausência de
 * perfil: aqui o usuário provavelmente TEM acesso, então oferecemos retry.
 */
export function GateFalhaConexao() {
  const { refresh, user } = useAuth();
  const [tentando, setTentando] = useState(false);
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      data-gate-estado="erro"
    >
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
            registrarAuthTelemetria({ tipo: "papel_retry", userId: user?.id ?? null });
            void refresh().finally(() => setTentando(false));
          }}
        >
          {tentando ? "Tentando..." : "Tentar novamente"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Envelope único para todo gate que depende do papel do usuário.
 * Ordem obrigatória: carregando → erro → sem papel → conteúdo.
 * `pronto` deve ser true somente quando a rota já pode renderizar o conteúdo.
 */
export function GateDependenteDePapel({
  pronto,
  children,
}: {
  pronto: boolean;
  children: ReactNode;
}) {
  const { loading, session, estadoPapel, roleResolvido } = useAuth();

  if (loading || !session) return <GateSpinner />;
  if (estadoPapel === "erro") return <GateFalhaConexao />;
  if (!roleResolvido) return <GateSpinner />;
  if (estadoPapel === "sem_papel") return <GateSemPapel />;
  if (!pronto) return <GateSpinner />;
  return <>{children}</>;
}
