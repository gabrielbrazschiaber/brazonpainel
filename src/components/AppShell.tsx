import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type AppNavItem, type AppAcaoPrincipal } from "@/components/AppSidebar";
import { AvisosSino } from "@/components/AvisosSino";
import { SairButton } from "@/components/SairButton";
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
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar
          items={items}
          tab={tab}
          onTab={onTab}
          onConta={onConta}
          acaoPrincipal={acaoPrincipal}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border/60 px-2 pt-[env(safe-area-inset-top)] sm:gap-2 sm:px-4">
            <SidebarTrigger className="h-10 w-10 shrink-0" aria-label="Abrir menu" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{contexto}</p>
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {profile?.nome || profile?.email}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              {headerExtra}
              <AvisosSino />
              <SairButton variante="icone" />
            </div>
          </header>

          <div className={`mx-auto w-full ${larguraMax} px-3 py-5 sm:px-4 sm:py-6`}>{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
