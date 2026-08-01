import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  atividadeSchema,
  dashboardSchema,
  idSchema,
  leadIdSchema,
  listarLeadsSchema,
  mudarEstagioSchema,
  salvarLeadSchema,
  salvarReuniaoSchema,
} from "@/lib/leads.schemas";

export type {
  Lead,
  Atividade,
  Reuniao,
  DashboardComercial,
  ListaLeads,
} from "@/lib/leads.server";

export const listarLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listarLeadsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { listarLeadsServer } = await import("@/lib/leads.server");
    return listarLeadsServer(context.supabase, context.userId, data);
  });

export const listarSegmentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarSegmentosServer } = await import("@/lib/leads.server");
    return listarSegmentosServer(context.supabase, context.userId);
  });

export const listarVendedoresComercial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarVendedoresServer } = await import("@/lib/leads.server");
    return listarVendedoresServer(context.supabase, context.userId);
  });

export const salvarLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => salvarLeadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { salvarLeadServer } = await import("@/lib/leads.server");
    return salvarLeadServer(context.supabase, context.userId, data);
  });

export const mudarEstagio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => mudarEstagioSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { mudarEstagioServer } = await import("@/lib/leads.server");
    return mudarEstagioServer(context.supabase, context.userId, data);
  });

export const registrarAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => atividadeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { registrarAtividadeServer } = await import("@/lib/leads.server");
    return registrarAtividadeServer(context.supabase, context.userId, data);
  });

export const listarAtividades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leadIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { listarAtividadesServer } = await import("@/lib/leads.server");
    return listarAtividadesServer(context.supabase, context.userId, data.lead_id);
  });

export const listarReunioes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leadIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { listarReunioesServer } = await import("@/lib/leads.server");
    return listarReunioesServer(context.supabase, context.userId, data.lead_id);
  });

export const salvarReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => salvarReuniaoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { salvarReuniaoServer } = await import("@/lib/leads.server");
    return salvarReuniaoServer(context.supabase, context.userId, data);
  });

export const excluirLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { excluirLeadServer } = await import("@/lib/leads.server");
    return excluirLeadServer(context.supabase, context.userId, data.id);
  });

export const dashboardComercial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dashboardSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { dashboardComercialServer } = await import("@/lib/leads.server");
    return dashboardComercialServer(context.supabase, context.userId, data);
  });
