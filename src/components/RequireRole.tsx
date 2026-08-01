import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, roleHome, type AppRole } from "@/lib/auth";
import { TermosGate } from "@/components/TermosGate";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import {
  GateDependenteDePapel,
  GateFalhaConexao,
  GateSemPapel,
  GateSpinner,
} from "@/components/GateEstado";

// Reexports mantidos para compatibilidade com consumidores existentes.
export { GateFalhaConexao, GateSemPapel, GateSpinner };

export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const { loading, session, role: userRole, roleResolvido } = useAuth();
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

  return (
    <GateDependenteDePapel pronto={userRole === role}>
      <TermosGate>
        <OnboardingProvider>{children}</OnboardingProvider>
      </TermosGate>
    </GateDependenteDePapel>
  );
}
