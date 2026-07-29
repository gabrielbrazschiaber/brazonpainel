// Catálogo de permissões do sistema (client-safe).
// A fonte da verdade é o enum app_permission no banco — este arquivo apenas
// dá rótulos legíveis e agrupamento para a interface.

import type { Database } from "@/integrations/supabase/types";

export type AppPermission = Database["public"]["Enums"]["app_permission"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export interface GrupoPermissao {
  grupo: string;
  itens: { permissao: AppPermission; label: string; descricao: string }[];
}

export const CATALOGO_PERMISSOES: GrupoPermissao[] = [
  {
    grupo: "Clientes",
    itens: [
      { permissao: "clientes.ler", label: "Ver clientes", descricao: "Listar e abrir cadastros de clientes." },
      { permissao: "clientes.criar", label: "Criar cliente", descricao: "Cadastrar novos clientes com login." },
      { permissao: "clientes.editar", label: "Editar cliente", descricao: "Alterar dados, plano e serviço extra." },
      { permissao: "clientes.excluir", label: "Excluir cliente", descricao: "Remover o cliente e o login dele." },
    ],
  },
  {
    grupo: "Vendedores e administradores",
    itens: [
      { permissao: "vendedores.ler", label: "Ver vendedores", descricao: "Listar vendedores e comissões." },
      { permissao: "vendedores.criar", label: "Criar vendedor/admin", descricao: "Cadastrar novos acessos internos." },
      { permissao: "vendedores.editar", label: "Editar vendedor/admin", descricao: "Alterar dados e comissão." },
      { permissao: "vendedores.excluir", label: "Excluir vendedor/admin", descricao: "Remover acessos internos." },
    ],
  },
  {
    grupo: "Financeiro",
    itens: [
      { permissao: "planos.gerenciar", label: "Gerenciar planos", descricao: "Criar, editar e desativar planos." },
      { permissao: "pagamentos.ler", label: "Ver pagamentos", descricao: "Consultar cobranças e histórico." },
      { permissao: "pagamentos.editar_status", label: "Alterar status de pagamento", descricao: "Marcar como pago ou simulação." },
      { permissao: "cupons.gerenciar", label: "Gerenciar cupons", descricao: "Criar, bloquear e acompanhar cupons de desconto." },
      { permissao: "asaas.sincronizar", label: "Sincronizar Asaas", descricao: "Gerar cobrança e reprocessar a fila." },
    ],
  },
  {
    grupo: "Sistema",
    itens: [
      { permissao: "configuracoes.gerenciar", label: "Gerenciar configurações", descricao: "Chave Asaas, webhook e ajustes gerais." },
      { permissao: "novidades.gerenciar", label: "Gerenciar novidades", descricao: "Publicar comunicados e novidades." },
      { permissao: "auditoria.ler", label: "Ver auditoria", descricao: "Consultar o histórico de alterações." },
    ],
  },
];

export const TODAS_PERMISSOES: AppPermission[] = CATALOGO_PERMISSOES.flatMap((g) =>
  g.itens.map((i) => i.permissao),
);

/** Permissões que nunca podem ser removidas do papel admin (evita travar o sistema). */
export const PERMISSOES_BLOQUEADAS: Record<string, AppPermission[]> = {
  admin: ["configuracoes.gerenciar"],
};

export const PAPEIS_EDITAVEIS: AppRole[] = ["vendedor", "admin"];

export const ROTULO_PAPEL: Record<AppRole, string> = {
  cliente: "Cliente",
  vendedor: "Vendedor",
  admin: "Administrador",
};

export function rotuloPermissao(p: AppPermission): string {
  for (const g of CATALOGO_PERMISSOES) {
    const item = g.itens.find((i) => i.permissao === p);
    if (item) return item.label;
  }
  return p;
}
