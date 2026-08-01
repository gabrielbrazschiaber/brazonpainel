import { Loader2 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode, lazy, Suspense } from "react";

import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
const AjudaDaTela = lazy(() =>
  import("@/components/onboarding/AjudaDaTela").then((m) => ({ default: m.AjudaDaTela })),
);
import { useTourDaTela } from "@/components/onboarding/OnboardingProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminDashboard = lazy(() =>
  import("@/components/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);
import { AdminErroLimite } from "@/components/admin/AdminErroLimite";
import { AdminsTab } from "@/components/admin/AdminsTab";
import { AuditoriaTab } from "@/components/admin/AuditoriaTab";
import { AuditoriaTutoriaisTab } from "@/components/admin/AuditoriaTutoriaisTab";
import { ClientesTab } from "@/components/admin/ClientesTab";
import { ConfigTab } from "@/components/admin/ConfigTab";
import { ConfiguracoesPage, type SecaoConfiguracao } from "@/components/admin/ConfiguracoesPage";
import { CuponsTab } from "@/components/admin/CuponsTab";
import { MinhaContaDialog } from "@/components/admin/MinhaContaDialog";
import { NovidadesTab } from "@/components/admin/NovidadesTab";
import { PermissoesTab } from "@/components/admin/PermissoesTab";
import { PlanosTab } from "@/components/admin/PlanosTab";
import { TelemetriaAuthTab } from "@/components/admin/TelemetriaAuthTab";
import { VendedoresTab } from "@/components/admin/VendedoresTab";

import { ADMIN_NAV_ITEMS, SECOES_CONFIG_META, abasInternas } from "@/lib/admin-nav";
import { useDadosAdmin } from "@/lib/use-dados-admin";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    secao: typeof search.secao === "string" ? search.secao : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Administração | Brazon" },
      {
        name: "description",
        content:
          "Painel administrativo Brazon: indicadores de receita, vendedores, planos, cupons, permissões e configurações do sistema.",
      },
      { property: "og:title", content: "Administração | Brazon" },
      {
        property: "og:description",
        content: "Indicadores, vendedores, planos e configurações do sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole role="admin">
      <AdminArea />
    </RequireRole>
  ),
});

/** Aba atual → chave do tour contextual daquela tela (vazio = sem tour). */
const TOUR_POR_ABA: Record<string, string> = {
  config: "tela:admin-configuracoes",
  clientes: "tela:admin-clientes",
  dashboard: "tela:admin-dashboard",
};

function AdminArea() {
  const [contaOpen, setContaOpen] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const { secao: secaoBuscada } = Route.useSearch();

  const chaveTour = TOUR_POR_ABA[tab] ?? "";

  return (
    <AppShell
      contexto="Administração"
      items={ADMIN_NAV_ITEMS}
      tab={tab}
      onTab={setTab}
      onConta={() => setContaOpen(true)}
      headerExtra={
        chaveTour ? (
          <Suspense fallback={null}>
            <AjudaDaTela chave={chaveTour} />
          </Suspense>
        ) : undefined
      }
    >
      {/* Qualquer exceção das abas do admin fica contida aqui, com Trace ID. */}
      <AdminErroLimite>
        {/* O menu e o cabeçalho já aparecem enquanto os dados carregam. */}
        <Suspense fallback={<CarregandoBloco />}>
          <AdminConteudo
            tab={tab}
            onTab={setTab}
            chaveTour={chaveTour}
            secaoBuscada={secaoBuscada}
            contaOpen={contaOpen}
            setContaOpen={setContaOpen}
          />
        </Suspense>
      </AdminErroLimite>
    </AppShell>
  );
}

interface AdminConteudoProps {
  tab: string;
  onTab: (v: string) => void;
  chaveTour: string;
  secaoBuscada?: string;
  contaOpen: boolean;
  setContaOpen: (v: boolean) => void;
}

function AdminConteudo({
  tab,
  onTab,
  chaveTour,
  secaoBuscada,
  contaOpen,
  setContaOpen,
}: AdminConteudoProps) {
  const { planos, vendedores, clientes, admins, config, recarregar } = useDadosAdmin();

  useTourDaTela(chaveTour, chaveTour !== "");

  // Seções internas de "Configurações": cada uma é renderizada sob demanda.
  const renderSecao: Record<string, () => ReactNode> = {
    cupons: () => <CuponsTab />,
    planos: () => <PlanosTab planos={planos} onChanged={recarregar} />,
    admins: () => <AdminsTab admins={admins} onChanged={recarregar} />,
    vendedores: () => <VendedoresTab vendedores={vendedores} onChanged={recarregar} />,
    permissoes: () => <PermissoesTab />,
    geral: () => <ConfigTab config={config} onSaved={recarregar} />,
    auditoria: () => <AuditoriaTab />,
    telemetria: () => <TelemetriaAuthTab />,
    tutoriais: () => <AuditoriaTutoriaisTab />,
  };

  const secoesConfig: SecaoConfiguracao[] = SECOES_CONFIG_META.map((meta) => ({
    ...meta,
    render: renderSecao[meta.value],
  }));

  return (
    <>
      <MinhaContaDialog open={contaOpen} onOpenChange={setContaOpen} onSaved={recarregar} />

      <Tabs value={tab} onValueChange={onTab}>
        <TabsList className="sr-only">
          {abasInternas(ADMIN_NAV_ITEMS).map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <Suspense fallback={<CarregandoBloco />}>
            <AdminDashboard />
          </Suspense>
        </TabsContent>
        <TabsContent value="clientes" className="mt-0">
          <ClientesTab
            clientes={clientes}
            vendedores={vendedores}
            planos={planos}
            onChanged={recarregar}
          />
        </TabsContent>
        <TabsContent value="novidades" className="mt-0">
          <NovidadesTab />
        </TabsContent>
        <TabsContent value="config" className="mt-0">
          <ConfiguracoesPage secoes={secoesConfig} secaoInicial={secaoBuscada} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CarregandoBloco() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
