import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  bancoLeadIdSchema,
  definirEscopoVendedorSchema,
  importarBancoLeadsSchema,
  listarBancoLeadsSchema,
  puxarLeadsSchema,
  salvarBancoLeadSchema,
} from "@/lib/banco-leads.schemas";
import { z } from "zod";

export type {
  BancoLead,
  ListaBancoLeads,
  ResumoPuxada,
  SaldoPuxadas,
  EstatisticasBanco,
  QualidadeLote,
  EscopoVendedor,
  ResultadoImportacaoBanco,
} from "@/lib/banco-leads.server";

const idSchema = z.object({ id: z.string().uuid() });

export const listarBancoLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listarBancoLeadsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { listarBancoLeadsServer } = await import("@/lib/banco-leads.server");
    return listarBancoLeadsServer(context.supabase, context.userId, data);
  });

export const contarBancoDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { contarDisponiveisServer } = await import("@/lib/banco-leads.server");
    return { total: await contarDisponiveisServer(context.supabase, context.userId) };
  });

export const salvarBancoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => salvarBancoLeadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { salvarBancoLeadServer } = await import("@/lib/banco-leads.server");
    return salvarBancoLeadServer(context.supabase, context.userId, data);
  });

export const importarBancoLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importarBancoLeadsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { importarBancoLeadsServer } = await import("@/lib/banco-leads.server");
    return importarBancoLeadsServer(context.supabase, context.userId, data);
  });

export const puxarLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => puxarLeadsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { puxarLeadsServer } = await import("@/lib/banco-leads.server");
    return puxarLeadsServer(context.supabase, context.userId, data);
  });

export const devolverLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bancoLeadIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { devolverLeadServer } = await import("@/lib/banco-leads.server");
    return devolverLeadServer(context.supabase, context.userId, data.banco_lead_id);
  });

export const saldoPuxadas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { saldoPuxadasServer } = await import("@/lib/banco-leads.server");
    return saldoPuxadasServer(context.supabase, context.userId);
  });

export const arquivarBancoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { arquivarBancoLeadServer } = await import("@/lib/banco-leads.server");
    return arquivarBancoLeadServer(context.supabase, context.userId, data.id);
  });

export const excluirBancoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { excluirBancoLeadServer } = await import("@/lib/banco-leads.server");
    return excluirBancoLeadServer(context.supabase, context.userId, data.id);
  });

export const estatisticasBanco = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { estatisticasBancoServer } = await import("@/lib/banco-leads.server");
    return estatisticasBancoServer(context.supabase, context.userId);
  });

export const qualidadeDosLotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { qualidadeDosLotesServer } = await import("@/lib/banco-leads.server");
    return qualidadeDosLotesServer(context.supabase, context.userId);
  });

export const escoposVendedores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarEscoposVendedoresServer } = await import("@/lib/banco-leads.server");
    return listarEscoposVendedoresServer(context.supabase, context.userId);
  });

export const definirEscopoVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => definirEscopoVendedorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { definirEscopoVendedorServer } = await import("@/lib/banco-leads.server");
    return definirEscopoVendedorServer(context.supabase, context.userId, data);
  });
