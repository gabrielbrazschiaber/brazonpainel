// Área administrativa de cupons.
// Toda leitura e escrita passa por ensurePermission("cupons.gerenciar"):
// o navegador nunca decide quem pode ver ou alterar cupons.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";

export interface CupomAdmin {
  id: string;
  codigo: string;
  descricao: string | null;
  valor_desconto: number;
  apenas_primeira_mensalidade: boolean;
  ativo: boolean;
  validade: string | null;
  max_usos: number | null;
  usos: number;
  reservados: number;
  created_at: string;
}

/** Lista todos os cupons com uso consolidado e reservas pendentes. */
export const listarCupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "cupons.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cupons }, { data: reservas }] = await Promise.all([
      supabaseAdmin
        .from("cupons")
        .select(
          "id,codigo,descricao,valor_desconto,apenas_primeira_mensalidade,ativo,validade,max_usos,usos,created_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("clientes")
        .select("cupom_pendente_id")
        .not("cupom_pendente_id", "is", null),
    ]);

    const porCupom = new Map<string, number>();
    for (const r of reservas ?? []) {
      const id = r.cupom_pendente_id as string;
      porCupom.set(id, (porCupom.get(id) ?? 0) + 1);
    }

    const lista: CupomAdmin[] = (cupons ?? []).map((c) => ({
      id: c.id,
      codigo: c.codigo,
      descricao: c.descricao,
      valor_desconto: Number(c.valor_desconto),
      apenas_primeira_mensalidade: c.apenas_primeira_mensalidade,
      ativo: c.ativo,
      validade: c.validade,
      max_usos: c.max_usos === null ? null : Number(c.max_usos),
      usos: Number(c.usos),
      reservados: porCupom.get(c.id) ?? 0,
      created_at: c.created_at,
    }));

    return { cupons: lista };
  });

const cupomSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Use apenas letras, números, hífen ou underline."),
  descricao: z.string().trim().max(300).nullable().optional(),
  valor_desconto: z.number().min(0.01).max(1_000_000),
  apenas_primeira_mensalidade: z.boolean(),
  ativo: z.boolean(),
  validade: z.string().trim().min(1).nullable().optional(),
  max_usos: z.number().int().min(1).max(1_000_000).nullable().optional(),
});

/** Cria ou atualiza um cupom. */
export const salvarCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cupomSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "cupons.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codigo = data.codigo.trim().toUpperCase();

    // Código é único: evita dois cupons iguais com regras diferentes.
    const { data: existente } = await supabaseAdmin
      .from("cupons")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (existente && existente.id !== data.id) {
      throw new Error(`Já existe um cupom com o código ${codigo}.`);
    }

    const payload = {
      codigo,
      descricao: data.descricao?.trim() ? data.descricao.trim() : null,
      valor_desconto: data.valor_desconto,
      apenas_primeira_mensalidade: data.apenas_primeira_mensalidade,
      ativo: data.ativo,
      validade: data.validade ? new Date(data.validade).toISOString() : null,
      max_usos: data.max_usos ?? null,
    };

    const { data: salvo, error } = data.id
      ? await supabaseAdmin
          .from("cupons")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .maybeSingle()
      : await supabaseAdmin.from("cupons").insert(payload).select("id").maybeSingle();

    if (error) throw new Error("Não foi possível salvar o cupom.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: data.id ? "atualizar_cupom" : "criar_cupom",
      entidade: "cupom",
      entidadeId: salvo?.id ?? data.id ?? null,
      detalhes: payload,
    });

    return { ok: true as const, id: salvo?.id ?? data.id ?? null };
  });

const alternarSchema = z.object({
  cupom_id: z.string().uuid(),
  ativo: z.boolean(),
});

/** Bloqueia (desativa) ou libera um cupom. */
export const alternarCupomAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => alternarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "cupons.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cupons")
      .update({ ativo: data.ativo })
      .eq("id", data.cupom_id);
    if (error) throw new Error("Não foi possível atualizar o cupom.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: data.ativo ? "liberar_cupom" : "bloquear_cupom",
      entidade: "cupom",
      entidadeId: data.cupom_id,
    });

    return { ok: true as const };
  });

const detalheSchema = z.object({ cupom_id: z.string().uuid() });

export interface UsoCupomAdmin {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_email: string;
  valor_desconto: number;
  valor_original: number;
  valor_final: number;
  origem: string;
  asaas_payment_id: string | null;
  asaas_subscription_id: string | null;
  pago_em: string | null;
  created_at: string;
}

export interface ReservaCupomAdmin {
  cliente_id: string;
  cliente_nome: string;
  cliente_email: string;
  desde: string;
}

/** Histórico de usos + reservas pendentes de um cupom, por cliente. */
export const detalharCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => detalheSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "cupons.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: usos }, { data: reservas }] = await Promise.all([
      supabaseAdmin
        .from("cupom_usos")
        .select(
          "id,cliente_id,valor_desconto,valor_original,valor_final,origem,asaas_payment_id,asaas_subscription_id,pago_em,created_at",
        )
        .eq("cupom_id", data.cupom_id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("clientes")
        .select("id,user_id,created_at")
        .eq("cupom_pendente_id", data.cupom_id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const clienteIds = [
      ...new Set([...(usos ?? []).map((u) => u.cliente_id), ...(reservas ?? []).map((r) => r.id)]),
    ];

    const { data: clientes } = clienteIds.length
      ? await supabaseAdmin.from("clientes").select("id,user_id").in("id", clienteIds)
      : { data: [] as { id: string; user_id: string }[] };

    const userIds = [...new Set((clientes ?? []).map((c) => c.user_id))];
    const { data: perfis } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,nome,email").in("id", userIds)
      : { data: [] as { id: string; nome: string; email: string }[] };

    const perfilPorUser = new Map((perfis ?? []).map((p) => [p.id, p]));
    const perfilPorCliente = new Map(
      (clientes ?? []).map((c) => [c.id, perfilPorUser.get(c.user_id)]),
    );

    const listaUsos: UsoCupomAdmin[] = (usos ?? []).map((u) => ({
      id: u.id,
      cliente_id: u.cliente_id,
      cliente_nome: perfilPorCliente.get(u.cliente_id)?.nome ?? "—",
      cliente_email: perfilPorCliente.get(u.cliente_id)?.email ?? "—",
      valor_desconto: Number(u.valor_desconto),
      valor_original: Number(u.valor_original ?? 0),
      valor_final: Number(u.valor_final ?? 0),
      origem: u.origem ?? "desconhecida",
      asaas_payment_id: u.asaas_payment_id,
      asaas_subscription_id: u.asaas_subscription_id ?? null,
      pago_em: u.pago_em ?? null,
      created_at: u.created_at,
    }));

    const listaReservas: ReservaCupomAdmin[] = (reservas ?? []).map((r) => ({
      cliente_id: r.id,
      cliente_nome: perfilPorCliente.get(r.id)?.nome ?? "—",
      cliente_email: perfilPorCliente.get(r.id)?.email ?? "—",
      desde: r.created_at,
    }));

    return { usos: listaUsos, reservas: listaReservas };
  });

const reservaSchema = z.object({ cliente_id: z.string().uuid() });

/** Libera a reserva de cupom de um cliente (ele volta a poder usar outro). */
export const liberarReservaCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reservaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "cupons.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("clientes")
      .update({ cupom_pendente_id: null })
      .eq("id", data.cliente_id);
    if (error) throw new Error("Não foi possível liberar a reserva.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: "liberar_reserva_cupom",
      entidade: "cliente",
      entidadeId: data.cliente_id,
    });

    return { ok: true as const };
  });

const usoSchema = z.object({ uso_id: z.string().uuid() });

/**
 * Estorna um uso registrado indevidamente: apaga o registro e devolve
 * uma unidade ao contador do cupom.
 */
export const estornarUsoCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => usoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "cupons.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: uso } = await supabaseAdmin
      .from("cupom_usos")
      .select("id,cupom_id,cliente_id")
      .eq("id", data.uso_id)
      .maybeSingle();
    if (!uso) throw new Error("Registro de uso não encontrado.");

    const { error } = await supabaseAdmin.from("cupom_usos").delete().eq("id", uso.id);
    if (error) throw new Error("Não foi possível estornar o uso do cupom.");

    const { data: atual } = await supabaseAdmin
      .from("cupons")
      .select("usos")
      .eq("id", uso.cupom_id)
      .maybeSingle();
    await supabaseAdmin
      .from("cupons")
      .update({ usos: Math.max(Number(atual?.usos ?? 1) - 1, 0) })
      .eq("id", uso.cupom_id);

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: "estornar_uso_cupom",
      entidade: "cupom",
      entidadeId: uso.cupom_id,
      detalhes: { cliente_id: uso.cliente_id },
    });

    return { ok: true as const };
  });
