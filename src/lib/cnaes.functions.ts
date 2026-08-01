import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";

export type { Cnae } from "@/lib/cnaes.server";

const listarSchema = z.object({
  busca: z.string().trim().max(120).optional(),
  apenas_ativos: z.boolean().optional(),
  limite: z.number().int().min(1).max(1000).optional(),
});

const salvarSchema = z.object({
  codigo: z.string().trim().min(5, "Informe o código do CNAE").max(20),
  descricao: z.string().trim().max(300).optional().nullable(),
  segmento_sugerido: z.string().trim().max(120).optional().nullable(),
  ativo: z.boolean().optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

/** Qualquer usuário logado pode consultar o catálogo (filtros e selects). */
export const listarCnaes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listarSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { listarCnaesServer } = await import("@/lib/cnaes.server");
    return listarCnaesServer(context.supabase, data);
  });

export const segmentosDoCatalogo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { segmentosDoCatalogoServer } = await import("@/lib/cnaes.server");
    return segmentosDoCatalogoServer(context.supabase);
  });

export const salvarCnae = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => salvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracoes.gerenciar");
    const { salvarCnaeServer } = await import("@/lib/cnaes.server");
    return salvarCnaeServer(context.supabase, context.userId, data);
  });

export const excluirCnae = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "configuracoes.gerenciar");
    const { excluirCnaeServer } = await import("@/lib/cnaes.server");
    return excluirCnaeServer(context.supabase, context.userId, data.id);
  });
