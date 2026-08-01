import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VALOR_CUPOM_VENDEDOR } from "./cupons.vendedor";
import { registrarAuditoria } from "./audit.server";
import type { ClienteSupabaseUsuario } from "@/lib/supabase-tipos";

type SB = ClienteSupabaseUsuario;

/** Confirma que o usuário logado é um vendedor ativo e devolve o id do vendedor. */
async function vendedorAtual(supabase: SB, userId: string): Promise<string> {
  const { data: vend } = await supabase
    .from("vendedores")
    .select("id, ativo")
    .eq("user_id", userId)
    .maybeSingle();
  if (!vend || !vend.ativo) throw new Error("Cadastro de vendedor não encontrado ou inativo.");
  return vend.id as string;
}

export async function criarCupomDoVendedor(supabase: SB, userId: string, codigoBruto: string) {
  const vendedorId = await vendedorAtual(supabase, userId);
  const codigo = codigoBruto.trim().toUpperCase();

  const { data: existente } = await supabaseAdmin
    .from("cupons")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle();
  if (existente) throw new Error("Este código já está em uso. Escolha outro.");

  const { error } = await supabaseAdmin.from("cupons").insert({
    codigo,
    descricao: `R$ ${VALOR_CUPOM_VENDEDOR},00 de desconto na primeira mensalidade`,
    tipo: "valor_fixo",
    valor_desconto: VALOR_CUPOM_VENDEDOR,
    apenas_primeira_mensalidade: true,
    ativo: true,
    vendedor_id: vendedorId,
  });
  if (error) throw new Error("Não foi possível criar o cupom.");

  await registrarAuditoria({
    actorId: userId,
    actorRole: "vendedor",
    acao: "criar_cupom",
    entidade: "cupom",
    entidadeId: null,
    detalhes: { codigo, valor_desconto: VALOR_CUPOM_VENDEDOR },
  });

  return { ok: true as const, codigo };
}

export interface CupomVendedorRow {
  id: string;
  codigo: string;
  valor_desconto: number;
  ativo: boolean;
  usos: number;
  clientes: number;
}

export async function listarCuponsDoVendedor(
  supabase: SB,
  userId: string,
): Promise<CupomVendedorRow[]> {
  const vendedorId = await vendedorAtual(supabase, userId);

  const { data: cupons } = await supabaseAdmin
    .from("cupons")
    .select("id, codigo, valor_desconto, ativo, usos, created_at")
    .eq("vendedor_id", vendedorId)
    .order("created_at", { ascending: false });

  const ids = (cupons ?? []).map((c) => c.id);

  // Uma única consulta para todos os cupons (evita N+1).
  const contagem = new Map<string, number>();
  if (ids.length > 0) {
    const { data: usos } = await supabaseAdmin
      .from("cupom_usos")
      .select("cupom_id")
      .in("cupom_id", ids);
    for (const u of usos ?? []) {
      contagem.set(u.cupom_id, (contagem.get(u.cupom_id) ?? 0) + 1);
    }
  }

  return (cupons ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    valor_desconto: Number(c.valor_desconto),
    ativo: c.ativo,
    usos: Number(c.usos ?? 0),
    clientes: contagem.get(c.id) ?? 0,
  }));
}

export async function alternarCupomDoVendedor(
  supabase: SB,
  userId: string,
  cupomId: string,
  ativo: boolean,
) {
  const vendedorId = await vendedorAtual(supabase, userId);
  const { data: upd } = await supabaseAdmin
    .from("cupons")
    .update({ ativo })
    .eq("id", cupomId)
    .eq("vendedor_id", vendedorId)
    .select("id")
    .maybeSingle();
  if (!upd) throw new Error("Cupom não encontrado.");
  return { ok: true as const };
}
