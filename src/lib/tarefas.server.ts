/** Helpers server-only compartilhados pelo módulo de tarefas. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ClienteSupabaseUsuario } from "@/lib/supabase-tipos";

/** Contexto do usuário atual dentro do módulo de tarefas. */
export async function contexto(supabase: ClienteSupabaseUsuario, userId: string) {
  const [{ data: isAdmin }, { data: vendedorId }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("current_vendedor_id"),
  ]);
  return {
    isAdmin: isAdmin === true,
    vendedorId: (vendedorId as string | null) ?? null,
  };
}

/** Resolve nomes legíveis dos usuários citados nas tarefas visíveis. */
export async function nomesDeUsuarios(ids: string[]): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;

  const { data } = await supabaseAdmin.from("profiles").select("id, nome, email").in("id", unicos);

  for (const p of data ?? []) {
    mapa.set(p.id, (p.nome || "").trim() || p.email);
  }
  return mapa;
}

/** Papel principal (admin > vendedor > cliente) de cada usuário. */
export async function papeisDeUsuarios(
  ids: string[],
): Promise<Map<string, "admin" | "vendedor" | "cliente">> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  const mapa = new Map<string, "admin" | "vendedor" | "cliente">();
  if (unicos.length === 0) return mapa;

  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", unicos);

  const prioridade = { admin: 3, vendedor: 2, cliente: 1 } as const;
  for (const r of data ?? []) {
    const papel = r.role as "admin" | "vendedor" | "cliente";
    const atual = mapa.get(r.user_id);
    if (!atual || prioridade[papel] > prioridade[atual]) mapa.set(r.user_id, papel);
  }
  return mapa;
}
