import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, roleHome } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Assinaturas SaaS" },
      { name: "description", content: "Plataforma de gestão de assinaturas com clientes, vendedores e administração." },
      { property: "og:title", content: "Gestão de Assinaturas SaaS" },
      { property: "og:description", content: "Plataforma de gestão de assinaturas com clientes, vendedores e administração." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { loading, session, role } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (session) navigate({ to: roleHome(role) });
    else navigate({ to: "/login" });
  }, [loading, session, role, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
