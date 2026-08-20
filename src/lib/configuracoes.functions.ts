import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  mensagemRapidaSchema,
  idSchema,
} from "@/lib/leads.schemas";

export const listarMensagensRapidasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarMensagensRapidasServer } = await import("@/lib/configuracoes.server");
    return listarMensagensRapidasServer(context.supabase);
  });

export const salvarMensagemRapida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => mensagemRapidaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { salvarMensagemRapidaServer } = await import("@/lib/configuracoes.server");
    return salvarMensagemRapidaServer(context.supabase, data);
  });

export const excluirMensagemRapida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { excluirMensagemRapidaServer } = await import("@/lib/configuracoes.server");
    return excluirMensagemRapidaServer(context.supabase, data.id);
  });
