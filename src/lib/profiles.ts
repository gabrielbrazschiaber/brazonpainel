import { supabase } from "@/integrations/supabase/client";

export interface PerfilBasico {
  id: string;
  nome: string | null;
  email: string;
}

/**
 * Busca perfis por id com deduplicação e em lotes.
 *
 * Motivo: `.in("id", ids)` com listas grandes estoura o tamanho da URL e o
 * limite padrão de linhas do PostgREST, fazendo nomes sumirem silenciosamente
 * nas tabelas de admin/vendedor.
 */
export async function buscarPerfis(ids: (string | null | undefined)[]) {
  const unicos = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  const mapa = new Map<string, PerfilBasico>();
  const TAMANHO_LOTE = 200;

  for (let i = 0; i < unicos.length; i += TAMANHO_LOTE) {
    const lote = unicos.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await supabase.from("profiles").select("id,nome,email").in("id", lote);
    if (error) throw new Error(error.message);
    for (const p of data ?? []) mapa.set(p.id, p as PerfilBasico);
  }

  return mapa;
}
