import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { adminPainelQuery } from "@/lib/painel-queries";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/ui/page-header";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { ClientesTab } from "@/components/admin/ClientesTab";
import { VendedoresTab } from "@/components/admin/VendedoresTab";
import { PlanosTab } from "@/components/admin/PlanosTab";
import { CuponsTab } from "@/components/admin/CuponsTab";
import { CnaesTab } from "@/components/admin/CnaesTab";
import { PermissoesTab } from "@/components/admin/PermissoesTab";
import { ConfigTab } from "@/components/admin/ConfigTab";
import { AuditoriaTab } from "@/components/admin/AuditoriaTab";
import { TelemetriaAuthTab } from "@/components/admin/TelemetriaAuthTab";
import { AuditoriaTutoriaisTab } from "@/components/admin/AuditoriaTutoriaisTab";
import { AdminsTab } from "@/components/admin/AdminsTab";
import { MensagensRapidasTab } from "@/components/admin/MensagensRapidasTab";
import { SegurancaTab } from "@/components/admin/SegurancaTab";

import { SECOES_CONFIG_META } from "@/lib/admin-nav";
import { ConfiguracoesPage, type SecaoConfiguracao } from "@/components/admin/ConfiguracoesPage";
import { useDadosAdmin } from "@/lib/use-dados-admin";

const adminSearchSchema = z.object({
  tab: z.string().optional(),
  secao: z.string().optional(),
});

export const Route = createFileRoute("/admin")({
  // A sessão do usuário vive no navegador: sem SSR o loader nunca roda como
  // anônimo (o que causava "permission denied for table vendedores").
  ssr: false,
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
  const { planos, vendedores, clientes, admins, config, recarregar } = useDadosAdmin();
  const { user } = useAuth();

  const secoesConfig: SecaoConfiguracao[] = SECOES_CONFIG_META.map((meta) => ({
    ...meta,
    render: () => {
      switch (meta.value) {
        case "cupons":
          return <CuponsTab />;
        case "planos":
          return <PlanosTab planos={planos} onChanged={recarregar} />;
        case "vendedores":
          return <VendedoresTab vendedores={vendedores} onChanged={recarregar} />;
        case "cnaes":
          return <CnaesTab />;
        case "permissoes":
          return <PermissoesTab />;
        case "geral":
          return <ConfigTab config={config} onSaved={recarregar} />;
        case "auditoria":
          return <AuditoriaTab />;
        case "telemetria":
          return <TelemetriaAuthTab />;
        case "tutoriais":
          return <AuditoriaTutoriaisTab />;
        case "admins":
          return <AdminsTab admins={admins} onChanged={recarregar} />;
        case "mensagens":
          return <MensagensRapidasTab />;
        case "seguranca":
          return <SegurancaTab />;
        default:
          return null;
      }
    },
  }));

  const renderTab = () => {
    switch (tab) {
      case "dashboard":
        return <AdminDashboard />;
      case "clientes":
        return <ClientesTab clientes={clientes} vendedores={vendedores} planos={planos} onChanged={recarregar} />;
      case "config":
        return <ConfiguracoesPage secoes={secoesConfig} secaoInicial={secao} />;
      default:
        return <AdminDashboard />;
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
