import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.server";
import {
  PERMISSOES_BLOQUEADAS,
  TODAS_PERMISSOES,
  type AppPermission,
} from "@/lib/permissions";

const papelSchema = z.enum(["cliente", "vendedor", "admin"]);
const permissaoSchema = z.enum(TODAS_PERMISSOES as [AppPermission, ...AppPermission[]]);

const definirSchema = z.object({
  role: papelSchema,
  permissoes: z.array(permissaoSchema).max(50),
});

/** Permissões do usuário autenticado (usadas pela interface para esconder controles). */
export const minhasPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const lista = (roles ?? []).map((r) => r.role);
    if (lista.length === 0) return { permissoes: [] as AppPermission[] };

    const { data } = await supabase
      .from("role_permissions")
      .select("permission")
      .in("role", lista);
    const set = new Set((data ?? []).map((r) => r.permission as AppPermission));
    return { permissoes: Array.from(set) };
  });

/** Matriz completa papel -> permissões (somente quem administra configurações). */
export const listarPermissoesPapeis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permission");
    if (error) throw new Error(error.message);

    const matriz: Record<string, AppPermission[]> = {
      cliente: [],
      vendedor: [],
      admin: [],
    };
    for (const linha of data ?? []) {
      matriz[linha.role]?.push(linha.permission as AppPermission);
    }
    return { matriz };
  });

/** Substitui em lote as permissões de um papel. */
export const definirPermissoesPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => definirSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    // Permissões que não podem ser removidas deste papel.
    const obrigatorias = PERMISSOES_BLOQUEADAS[data.role] ?? [];
    const alvo = Array.from(new Set([...data.permissoes, ...obrigatorias]));

    const { data: atuais } = await supabase
      .from("role_permissions")
      .select("permission")
      .eq("role", data.role);
    const antes = (atuais ?? []).map((r) => r.permission as AppPermission);

    const adicionar = alvo.filter((p) => !antes.includes(p));
    const remover = antes.filter((p) => !alvo.includes(p));

    if (adicionar.length > 0) {
      const { error } = await supabase
        .from("role_permissions")
        .insert(adicionar.map((permission) => ({ role: data.role, permission })));
      if (error) throw new Error(error.message);
    }
    if (remover.length > 0) {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", data.role)
        .in("permission", remover);
      if (error) throw new Error(error.message);
    }

    if (adicionar.length > 0 || remover.length > 0) {
      const { registrarAuditoria } = await import("@/lib/audit.server");
      await registrarAuditoria({
        actorId: userId,
        actorEmail: context.claims?.email as string | undefined,
        actorRole: "admin",
        acao: "permissoes.atualizar",
        entidade: "role_permissions",
        entidadeId: null,
        detalhes: { papel: data.role, concedidas: adicionar, revogadas: remover },
      });
    }

    return { ok: true, concedidas: adicionar, revogadas: remover };
  });
