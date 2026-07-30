/** Helpers server-only do chat interno. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface ClienteBasico {
  user_id: string;
  vendedor_id: string | null;
}

/**
 * Garante que cliente, vendedor responsável e quem abriu estejam na conversa.
 * Usa o client do usuário (RLS ativa) — nada de service role aqui.
 */
export async function garantirParticipantes(
  supabase: any,
  userId: string,
  conversaId: string,
  cliente: ClienteBasico,
) {
  const usuarios = new Set<string>([cliente.user_id, userId]);

  if (cliente.vendedor_id) {
    const { data: vend } = await supabase
      .from("vendedores")
      .select("user_id")
      .eq("id", cliente.vendedor_id)
      .limit(1)
      .maybeSingle();
    if (vend?.user_id) usuarios.add(vend.user_id);
  }

  await supabase
    .from("conversa_participantes")
    .upsert(
      Array.from(usuarios).map((user_id) => ({ conversa_id: conversaId, user_id })),
      { onConflict: "conversa_id,user_id", ignoreDuplicates: true },
    );
}

export interface ContatoEquipe {
  user_id: string;
  nome: string;
  email: string;
  papel: "admin" | "vendedor";
}

/** Admins e vendedores ativos, para o seletor de participantes da equipe. */
export async function contatosDaEquipe(excluirUserId: string): Promise<ContatoEquipe[]> {
  const [{ data: papeis }, { data: vendedoresAtivos }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "vendedor"]),
    supabaseAdmin.from("vendedores").select("user_id").eq("ativo", true),
  ]);

  const ativos = new Set((vendedoresAtivos ?? []).map((v) => v.user_id));
  const melhor = new Map<string, "admin" | "vendedor">();

  for (const r of papeis ?? []) {
    const papel = r.role as "admin" | "vendedor";
    if (r.user_id === excluirUserId) continue;
    if (papel === "admin") {
      melhor.set(r.user_id, "admin");
    } else if (ativos.has(r.user_id) && !melhor.has(r.user_id)) {
      melhor.set(r.user_id, "vendedor");
    }
  }

  const ids = Array.from(melhor.keys());
  if (ids.length === 0) return [];

  const { data: perfis } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, email")
    .in("id", ids);

  return (perfis ?? [])
    .map((p) => ({
      user_id: p.id,
      nome: (p.nome || "").trim() || p.email,
      email: p.email,
      papel: melhor.get(p.id) as "admin" | "vendedor",
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
