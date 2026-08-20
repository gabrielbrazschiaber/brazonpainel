import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { adminPainelQuery } from "@/lib/painel-queries";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { AdminPainel } from "@/components/admin/AdminPainel";
import { ClientesTab } from "@/components/admin/ClientesTab";
import { VendedoresTab } from "@/components/admin/VendedoresTab";
import { PlanosTab } from "@/components/admin/PlanosTab";
import { CuponsTab } from "@/components/admin/CuponsTab";
import { CnaesTab } from "@/components/admin/CnaesTab";
import { PermissoesTab } from "@/components/admin/PermissoesTab";
import { ConfiguracoesGeraisTab } from "@/components/admin/ConfiguracoesGeraisTab";
import { AuditoriaTab } from "@/components/admin/AuditoriaTab";
import { TelemetriaAuthTab } from "@/components/admin/TelemetriaAuthTab";
import { TutoriaisAuditoriaTab } from "@/components/admin/TutoriaisAuditoriaTab";
import { AdminsTab } from "@/components/admin/AdminsTab";
import { MensagensRapidasTab } from "@/components/admin/MensagensRapidasTab";

import { SECOES_CONFIG_META } from "@/lib/admin-nav";
import { ConfiguracoesPage, type SecaoConfiguracao } from "@/components/admin/ConfiguracoesPage";

const adminSearchSchema = z.object({
  tab: z.string().optional(),
  secao: z.string().optional(),
});

export const Route = createFileRoute("/admin")({
  validateSearch: (search) => adminSearchSchema.parse(search),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(adminPainelQuery());
  },
});

export default function Admin() {
  return (
    <RequireRole role="admin">
      <Suspense fallback={<AdminSkeleton />}>
        <AdminContent />
      </Suspense>
    </RequireRole>
  );
}

function AdminContent() {
  const { tab = "dashboard", secao } = useSearch({ from: "/admin" });
  const { data: dados } = useSuspenseQuery(adminPainelQuery());
  const { user } = useAuth();

  const secoesConfig: SecaoConfiguracao[] = SECOES_CONFIG_META.map((meta) => ({
    ...meta,
    render: () => {
      switch (meta.value) {
        case "cupons":
          return <CuponsTab />;
        case "planos":
          return <PlanosTab />;
        case "vendedores":
          return <VendedoresTab />;
        case "cnaes":
          return <CnaesTab />;
        case "permissoes":
          return <PermissoesTab />;
        case "geral":
          return <ConfiguracoesGeraisTab />;
        case "auditoria":
          return <AuditoriaTab />;
        case "telemetria":
          return <TelemetriaAuthTab />;
        case "tutoriais":
          return <TutoriaisAuditoriaTab />;
        case "admins":
          return <AdminsTab />;
        case "mensagens":
          return <MensagensRapidasTab />;
        default:
          return null;
      }
    },
  }));

  const renderTab = () => {
    switch (tab) {
      case "dashboard":
        return <AdminPainel data={dados} />;
      case "clientes":
        return <ClientesTab />;
      case "config":
        return <ConfiguracoesPage secoes={secoesConfig} secaoInicial={secao} />;
      default:
        return <AdminPainel data={dados} />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Olá, ${user?.user_metadata?.nome?.split(" ")[0] || "Admin"}`}
        descricao="Gerencie planos, vendedores, clientes e as configurações do sistema Brazon."
      />
      {renderTab()}
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
