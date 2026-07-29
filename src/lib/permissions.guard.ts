// Verificação de permissão no servidor.
// Sempre usa o cliente Supabase do próprio usuário (com RLS ativa) — nunca o
// cliente privilegiado — para decidir se a ação é autorizada.

import type { AppPermission } from "@/lib/permissions";
import { rotuloPermissao } from "@/lib/permissions";

// Tipo intencionalmente frouxo: aceita o cliente tipado do usuário.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { rpc: any };

/**
 * Lança se o usuário não possuir a permissão. Só depois de passar por aqui é
 * que um handler pode carregar o cliente administrativo.
 */
export async function ensurePermission(
  supabase: SupabaseLike,
  userId: string,
  permissao: AppPermission,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _permission: permissao,
  });
  if (error || data !== true) {
    throw new Error(
      `Acesso negado: você não tem a permissão "${rotuloPermissao(permissao)}".`,
    );
  }
}

/** Versão booleana, para decisões condicionais dentro de um handler. */
export async function hasPermission(
  supabase: SupabaseLike,
  userId: string,
  permissao: AppPermission,
): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _permission: permissao,
  });
  return data === true;
}
