import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, MessagesSquare, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrazonSymbol } from "@/components/BrazonLogo";
import { useSair } from "@/lib/use-sair";
import { ChatSheet } from "@/components/chat/ChatSheet";
import { useChatNaoLidas } from "@/lib/use-chat-nao-lidas";

export interface AppNavItem {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Se presente, o item navega para esta rota em vez de trocar de aba. */
  to?: string;
}

export interface AppAcaoPrincipal {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface AppSidebarProps {
  items: readonly AppNavItem[];
  /** aba ativa (quando a tela usa Tabs internas, como o admin) */
  tab?: string;
  onTab?: (value: string) => void;
  /** abre o dialog "Minha conta"; se ausente, o item não é renderizado */
  onConta?: () => void;
  /** ação extra destacada no topo (ex.: "Cadastrar cliente" do vendedor) */
  acaoPrincipal?: AppAcaoPrincipal;
}

/**
 * Sidebar única dos painéis (admin, vendedor e cliente).
 * No mobile ela vira um drawer: qualquer ação (navegar, minha conta, sair)
 * fecha o drawer automaticamente para não cobrir o conteúdo.
 */
export function AppSidebar({ items, tab, onTab, onConta, acaoPrincipal }: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { sair, saindo } = useSair();
  const [chatAberto, setChatAberto] = React.useState(false);
  const { naoLidas, atualizar } = useChatNaoLidas({ pausado: chatAberto });
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  function fecharSeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  // Ao girar a tela ou redimensionar, fecha o drawer para evitar
  // um menu preso cobrindo o conteúdo em paisagem.
  React.useEffect(() => {
    const onResize = () => setOpenMobile(false);
    window.addEventListener("orientationchange", onResize);
    return () => window.removeEventListener("orientationchange", onResize);
  }, [setOpenMobile]);

  React.useEffect(() => {
    if (!isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  // Qualquer navegação (inclusive por itens com rota `to`) fecha o drawer.
  React.useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center justify-center">
          <BrazonSymbol className="h-8 w-8" />
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto overscroll-contain">
        {acaoPrincipal && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      fecharSeMobile();
                      acaoPrincipal.onClick();
                    }}
                    tooltip={acaoPrincipal.label}
                    className="h-10 bg-primary/10 font-medium text-primary hover:bg-primary/20 hover:text-primary md:h-8"
                  >
                    <acaoPrincipal.icon className="h-4 w-4" />
                    <span>{acaoPrincipal.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.value}>
                  {item.to ? (
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.to}
                      tooltip={item.label}
                      className="h-10 md:h-8"
                    >
                      <Link to={item.to} onClick={fecharSeMobile}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      isActive={tab === item.value}
                      onClick={() => {
                        onTab?.(item.value);
                        fecharSeMobile();
                      }}
                      tooltip={item.label}
                      className="h-10 md:h-8"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Atalhos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    fecharSeMobile();
                    setChatAberto(true);
                  }}
                  tooltip="Chat com a equipe"
                  className="h-10 md:h-8"
                >
                  <MessagesSquare className="h-4 w-4" />
                  <span>Chat com a equipe</span>
                  {naoLidas > 0 && (
                    <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                      {naoLidas > 9 ? "9+" : naoLidas}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <SidebarMenu>
          {onConta && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  onConta();
                  fecharSeMobile();
                }}
                tooltip="Minha conta"
                className="h-10 md:h-8"
              >
                <UserCog className="h-4 w-4" />
                <span>Minha conta</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                fecharSeMobile();
                void sair();
              }}
              disabled={saindo}
              tooltip="Sair"
              aria-label="Sair da conta"
              className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive md:h-8"
            >
              <LogOut className="h-4 w-4" />
              <span>{saindo ? "Saindo..." : "Sair"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      {chatAberto && (
        <ChatSheet
          aberto={chatAberto}
          onOpenChange={(v) => {
            setChatAberto(v);
            if (!v) void atualizar();
          }}
          aoMudarNaoLidas={atualizar}
        />
      )}
    </Sidebar>
  );
}
