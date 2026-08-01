import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, roleHome } from "@/lib/auth";
import { GateFalhaConexao, GateSpinner } from "@/components/GateEstado";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brazon — Gestão de Assinaturas" },
      {
        name: "description",
        content:
          "Brazon: plataforma de gestão de assinaturas com painéis para cliente, vendedor e administrador, cobranças recorrentes e acompanhamento comercial.",
      },
      { property: "og:title", content: "Brazon — Gestão de Assinaturas" },
      {
        property: "og:description",
        content: "Gestão de assinaturas, cobranças recorrentes e time comercial em um só painel.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { loading, session, role, roleResolvido, estadoPapel } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    // Só decide o destino depois que o papel estiver resolvido.
    if (roleResolvido) navigate({ to: roleHome(role) });
  }, [loading, session, role, roleResolvido, navigate]);

  // Mesma experiência dos outros gates quando a consulta de papel falha.
  if (session && estadoPapel === "erro") return <GateFalhaConexao />;
  return <GateSpinner />;
}
