import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, roleHome, type AppRole } from "@/lib/auth";

export function RequireRole({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const { loading, session, role: userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
    } else if (userRole && userRole !== role) {
      navigate({ to: roleHome(userRole) });
    }
  }, [loading, session, userRole, role, navigate]);

  // Enquanto carrega, sem sessão ou papel incorreto: mostra apenas spinner.
  // NUNCA renderiza o conteúdo protegido antes da verificação ser concluída.
  if (loading || !session || !userRole || userRole !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

