import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Cliente Supabase do próprio usuário (RLS ativa), como entregue pelo
 * middleware `requireSupabaseAuth` em `context.supabase`.
 *
 * Existe para que helpers server-only tenham um tipo real em vez de `any` —
 * assim erros de nome de tabela/coluna aparecem no typecheck e não em produção.
 */
export type ClienteSupabaseUsuario = SupabaseClient<Database>;
