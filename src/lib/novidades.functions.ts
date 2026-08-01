import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";

const baseSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  conteudo: z.string().trim().min(1).max(10000),
  versao: z.string().trim().max(40).optional().nullable(),
  tipo: z.enum(["novidade", "comunicado"]),
  publico_cliente: z.boolean(),
  publico_vendedor: z.boolean(),
  publico_admin: z.boolean(),
  publicado: z.boolean(),
});

const criarSchema = baseSchema.refine(
  (v) => v.publico_cliente || v.publico_vendedor || v.publico_admin,
  { message: "Selecione ao menos um público-alvo." },
);

export const criarNovidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "novidades.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      titulo: data.titulo,
      conteudo: data.conteudo,
      versao: data.versao || null,
      tipo: data.tipo,
      publico_cliente: data.publico_cliente,
      publico_vendedor: data.publico_vendedor,
      publico_admin: data.publico_admin,
      publicado: data.publicado,
      data_publicacao: data.publicado ? new Date().toISOString() : null,
      criado_por_id: userId,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("novidades")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "novidade_criada",
      entidade: "novidade",
      entidadeId: inserted?.id,
      detalhes: { titulo: data.titulo, publicado: data.publicado, tipo: data.tipo },
    });

    return { ok: true, id: inserted?.id };
  });

const atualizarSchema = baseSchema
  .extend({ id: z.string().uuid() })
  .refine((v) => v.publico_cliente || v.publico_vendedor || v.publico_admin, {
    message: "Selecione ao menos um público-alvo.",
  });

export const atualizarNovidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "novidades.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("novidades")
      .select("publicado, data_publicacao")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Novidade não encontrada.");

    const virandoPublicado = !existing.publicado && data.publicado;

    const update = {
      titulo: data.titulo,
      conteudo: data.conteudo,
      versao: data.versao || null,
      tipo: data.tipo,
      publico_cliente: data.publico_cliente,
      publico_vendedor: data.publico_vendedor,
      publico_admin: data.publico_admin,
      publicado: data.publicado,
      ...(virandoPublicado ? { data_publicacao: new Date().toISOString() } : {}),
    };

    const { error } = await supabaseAdmin.from("novidades").update(update).eq("id", data.id);
    if (error) throw new Error(error.message);

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "novidade_atualizada",
      entidade: "novidade",
      entidadeId: data.id,
      detalhes: { titulo: data.titulo, publicado: data.publicado },
    });

    return { ok: true };
  });

export const excluirNovidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "novidades.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("novidades").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "novidade_excluida",
      entidade: "novidade",
      entidadeId: data.id,
    });

    return { ok: true };
  });

export const marcarNovidadesVistas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ novidades_vistas_em: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
