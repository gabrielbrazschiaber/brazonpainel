import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  importacaoIdSchema,
  importarLeadsSchema,
  verificarDuplicadosSchema,
} from "@/lib/leads-import.schemas";

export type {
  Importacao,
  ResultadoImportacao,
  ResultadoDesfazer,
  LeadExistenteServer,
} from "@/lib/leads-import.server";

export const verificarDuplicados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verificarDuplicadosSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { verificarDuplicadosServer } = await import("@/lib/leads-import.server");
    return verificarDuplicadosServer(context.supabase, context.userId, data);
  });

export const importarLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importarLeadsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { importarLeadsServer } = await import("@/lib/leads-import.server");
    return importarLeadsServer(context.supabase, context.userId, data);
  });

export const listarImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarImportacoesServer } = await import("@/lib/leads-import.server");
    return listarImportacoesServer(context.supabase, context.userId);
  });

export const desfazerImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importacaoIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { desfazerImportacaoServer } = await import("@/lib/leads-import.server");
    return desfazerImportacaoServer(context.supabase, context.userId, data.importacao_id);
  });
