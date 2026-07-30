import * as React from "react";
import { ClipboardList, LogOut, MessagesSquare, UserCog } from "lucide-react";
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

export interface AdminNavItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface AdminSidebarProps {
  items: readonly AdminNavItem[];
  tab: string;
  onTab: (value: string) => void;
  onConta: () => void;
}

/**
 * Sidebar do painel admin.
 * No mobile ela vira um drawer: qualquer ação (navegar, minha conta, sair)
 * fecha o drawer automaticamente para não cobrir o conteúdo.
 */
export function AdminSidebar({ items, tab, onTab, onConta }: AdminSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { sair, saindo } = useSair();
  const [chatAberto, setChatAberto] = React.useState(false);
  const { naoLidas, atualizar } = useChatNaoLidas();

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center justify-center">
          <BrazonSymbol className="h-8 w-8" />
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto overscroll-contain">
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    isActive={tab === item.value}
                    onClick={() => {
                      onTab(item.value);
                      fecharSeMobile();
                    }}
                    tooltip={item.label}
                    className="h-10 md:h-8"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
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
                <SidebarMenuButton asChild tooltip="Tarefas" className="h-10 md:h-8">
                  <a href="/tarefas" onClick={fecharSeMobile}>
                    <ClipboardList className="h-4 w-4" />
                    <span>Tarefas</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
