/** Lógica server-only do catálogo de CNAEs. */
import { normalizarCnae } from "@/lib/cnaes";
import type { Cnae } from "@/lib/cnaes";

// Cliente do usuário logado (RLS ativa). Tipo frouxo de propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

const CAMPOS = "id, codigo, descricao, segmento_sugerido, total_leads, ativo, created_at";

export type { Cnae };

export interface FiltroCnaes {
  busca?: string;
  apenas_ativos?: boolean;
  limite?: number;
}

export async function listarCnaesServer(supabase: Sb, filtros: FiltroCnaes): Promise<Cnae[]> {
  let q = supabase.from("cnaes").select(CAMPOS);
  if (filtros.apenas_ativos) q = q.eq("ativo", true);
  const busca = (filtros.busca ?? "").trim();
  if (busca) {
    const digitos = busca.replace(/\D/g, "");
    const alvos = [`descricao.ilike.%${busca.replace(/[%,]/g, " ")}%`];
    if (digitos) alvos.push(`codigo.ilike.%${digitos}%`);
    q = q.or(alvos.join(","));
  }
  const { data, error } = await q
    .order("total_leads", { ascending: false })
    .order("codigo", { ascending: true })
    .limit(Math.min(1000, Math.max(1, filtros.limite ?? 500)));
  if (error) throw new Error(error.message);
  return (data ?? []) as Cnae[];
}

/** Segmentos já sugeridos no catálogo — alimenta os selects de reserva. */
export async function segmentosDoCatalogoServer(supabase: Sb): Promise<string[]> {
  const { data } = await supabase
    .from("cnaes")
    .select("segmento_sugerido")
    .not("segmento_sugerido", "is", null)
    .limit(1000);
  const set = new Set<string>();
  for (const linha of (data ?? []) as { segmento_sugerido: string | null }[]) {
    const s = (linha.segmento_sugerido ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export interface SalvarCnaeInput {
  codigo: string;
  descricao?: string | null;
  segmento_sugerido?: string | null;
  ativo?: boolean;
}

export async function salvarCnaeServer(
  supabase: Sb,
  userId: string,
  dados: SalvarCnaeInput,
): Promise<{ codigo: string }> {
  const codigo = normalizarCnae(dados.codigo);
  if (!codigo) throw new Error("Código de CNAE inválido.");

  const payload = {
    codigo,
    descricao: (dados.descricao ?? "").trim() || null,
    segmento_sugerido: (dados.segmento_sugerido ?? "").trim() || null,
    ativo: dados.ativo ?? true,
  };

  const { error } = await supabase.from("cnaes").upsert(payload, { onConflict: "codigo" });
  if (error) throw new Error(error.message);

  const { registrarAuditoria } = await import("@/lib/audit.server");
  await registrarAuditoria({
    actorId: userId,
    acao: "salvar_cnae",
    entidade: "cnaes",
    entidadeId: codigo,
    detalhes: { segmento: payload.segmento_sugerido, ativo: payload.ativo },
  });

  return { codigo };
}

export async function excluirCnaeServer(
  supabase: Sb,
  userId: string,
  id: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("cnaes")
    .delete()
    .eq("id", id)
    .select("id, codigo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("CNAE não encontrado.");

  const { registrarAuditoria } = await import("@/lib/audit.server");
  await registrarAuditoria({
    actorId: userId,
    acao: "excluir_cnae",
    entidade: "cnaes",
    entidadeId: data.codigo as string,
  });

  return { id: data.id as string };
}

/**
 * Autocadastro: registra os CNAEs vistos na planilha antes de importar as
 * linhas. O gatilho no banco também cuida disso, mas aqui já gravamos o
 * segmento sugerido pelas palavras-chave da descrição.
 */
export async function registrarCnaesServer(
  supabase: Sb,
  cnaes: { codigo: string; descricao?: string | null; segmento_sugerido?: string | null }[],
): Promise<number> {
  const unicos = new Map<string, { codigo: string; descricao: string | null; segmento: string | null }>();
  for (const c of cnaes) {
    const codigo = normalizarCnae(c.codigo);
    if (!codigo || unicos.has(codigo)) continue;
    unicos.set(codigo, {
      codigo,
      descricao: (c.descricao ?? "").trim() || null,
      segmento: (c.segmento_sugerido ?? "").trim() || null,
    });
  }
  if (unicos.size === 0) return 0;

  const codigos = Array.from(unicos.keys());
  const { data: existentes } = await supabase.from("cnaes").select("codigo").in("codigo", codigos);
  const jaTem = new Set(((existentes ?? []) as { codigo: string }[]).map((c) => c.codigo));

  const novos = Array.from(unicos.values())
    .filter((c) => !jaTem.has(c.codigo))
    .map((c) => ({
      codigo: c.codigo,
      descricao: c.descricao,
      segmento_sugerido: c.segmento,
      total_leads: 0,
    }));
  if (novos.length === 0) return 0;

  const { error } = await supabase.from("cnaes").upsert(novos, { onConflict: "codigo" });
  if (error) throw new Error(error.message);
  return novos.length;
}
