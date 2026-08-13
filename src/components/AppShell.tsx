import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type AppNavItem, type AppAcaoPrincipal } from "@/components/AppSidebar";
import { AvisosSino } from "@/components/AvisosSino";
import { SairButton } from "@/components/SairButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErroLimite } from "@/components/ErroLimite";
import { PularParaConteudo } from "@/components/PularParaConteudo";

import { useAuth } from "@/lib/auth";

interface AppShellProps {
  items: readonly AppNavItem[];
  tab?: string;
  onTab?: (value: string) => void;
  onConta?: () => void;
  acaoPrincipal?: AppAcaoPrincipal;
  /** texto pequeno acima do nome no header */
  contexto: string;
  /** slot à direita do header, antes do sino de avisos */
  headerExtra?: ReactNode;
  /** largura máxima do conteúdo */
  larguraMax?: string;
  children: ReactNode;
}

/** Layout padrão dos painéis: sidebar + header fixo + conteúdo. */
export function AppShell({
  items,
  tab,
  onTab,
  onConta,
  acaoPrincipal,
  contexto,
  headerExtra,
  larguraMax = "max-w-6xl",
  children,
}: AppShellProps) {
  const { profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <PularParaConteudo />
        <AppSidebar
          items={items}
          tab={tab}
          onTab={onTab}
          onConta={onConta}
          acaoPrincipal={acaoPrincipal}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/60 px-2 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-5">
            <SidebarTrigger className="h-10 w-10 shrink-0" aria-label="Abrir menu" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow truncate">{contexto}</p>
              {/* Identidade da sessão: o <h1> da página fica no conteúdo. */}
              <p className="truncate text-sm font-semibold leading-tight text-foreground sm:text-base">
                {profile?.nome || profile?.email}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
              {headerExtra}
              <ThemeToggle />
              <span data-tour="avisos" className="inline-flex">
                <AvisosSino />
              </span>
              <SairButton variante="icone" />
            </div>
          </header>

          <main
            id="conteudo"
            className={`mx-auto w-full ${larguraMax} space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8`}
          >
            {/* Falha de um painel não derruba menu/cabeçalho nem a tela toda. */}
            <ErroLimite area={contexto}>{children}</ErroLimite>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
