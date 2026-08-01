import {
  Activity,
  ClipboardList,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Package,
  ScrollText,
  Settings,
  Shield,
  Target,
  TicketPercent,
  Tags,
  UserCircle,
  Users,
  Database,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppPermission, AppRole } from "@/lib/permissions";

export interface AdminNavItem {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Quando presente, o item navega para outra rota em vez de trocar de aba. */
  to?: string;
}

/** Itens do menu lateral do admin. */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "clientes", label: "Clientes", icon: UserCircle },
  { value: "tarefas", label: "Tarefas", icon: ClipboardList, to: "/tarefas" },
  { value: "comercial", label: "Comercial", icon: Target, to: "/comercial" },
  { value: "banco-leads", label: "Banco de Leads", icon: Database, to: "/banco-leads" },
  { value: "novidades", label: "Novidades", icon: Megaphone },
  { value: "config", label: "Configurações", icon: Settings },
];

/**
 * Abas internas do painel: itens que trocam de conteúdo na própria página.
 * Itens com rota (`to`) só existem na navegação lateral e nunca viram aba.
 */
export function abasInternas(items: readonly AdminNavItem[] = ADMIN_NAV_ITEMS) {
  return items.filter((item) => !item.to);
}

export interface SecaoConfigMeta {
  value: string;
  label: string;
  descricao: string;
  icon: LucideIcon;
  permissao: AppPermission;
  /** Quando presente, só estes papéis enxergam a seção (além da permissão). */
  roles?: readonly AppRole[];
}

/** Seções que vivem DENTRO de Configurações (inclusive Auditoria). */
export const SECOES_CONFIG_META: readonly SecaoConfigMeta[] = [
  {
    value: "cupons",
    label: "Cupons",
    descricao: "Descontos e histórico de uso",
    icon: TicketPercent,
    permissao: "cupons.gerenciar",
  },
  {
    value: "planos",
    label: "Planos",
    descricao: "Valores e disponibilidade",
    icon: Package,
    permissao: "planos.gerenciar",
  },
  {
    value: "admins",
    label: "Admins",
    descricao: "Acessos administrativos",
    icon: Shield,
    permissao: "vendedores.ler",
  },
  {
    value: "vendedores",
    label: "Vendedores",
    descricao: "Equipe de vendas e comissões",
    icon: Users,
    permissao: "vendedores.ler",
  },
  {
    value: "cnaes",
    label: "CNAEs",
    descricao: "Catálogo e segmento sugerido",
    icon: Tags,
    permissao: "configuracoes.gerenciar",
  },
  {
    value: "permissoes",
    label: "Permissões",
    descricao: "O que cada papel pode fazer",
    icon: KeyRound,
    permissao: "configuracoes.gerenciar",
  },
  {
    value: "geral",
    label: "Geral e integrações",
    descricao: "Dados do app, Asaas e webhook",
    icon: Settings,
    permissao: "configuracoes.gerenciar",
  },
  {
    value: "auditoria",
    label: "Auditoria",
    descricao: "Histórico de alterações",
    icon: ScrollText,
    permissao: "auditoria.ler",
    roles: ["admin"],
  },
  {
    value: "telemetria",
    label: "Acesso e sessão",
    descricao: "Métricas de login e regressões",
    icon: Activity,
    permissao: "auditoria.ler",
    roles: ["admin"],
  },
  {
    value: "tutoriais",
    label: "Tutoriais",
    descricao: "Auditoria do onboarding da equipe",
    icon: GraduationCap,
    permissao: "auditoria.ler",
    roles: ["admin"],
  },
];
