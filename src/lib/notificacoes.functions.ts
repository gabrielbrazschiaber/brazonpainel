import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Marca as notificações do usuário como lidas (persistido no banco).
 * Sem `ids`, marca todas as pendentes. Retorna a contagem que restou
 * para o cliente atualizar o badge com o valor real do banco.
 */
export const marcarNotificacoesLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let query = supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() })
      .eq("user_id", userId)
      .is("lida_em", null);

    if (data.ids?.length) query = query.in("id", data.ids);

    const { error } = await query;
    if (error) throw new Error(error.message);

    const { count, error: erroConta } = await supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("lida_em", null);
    if (erroConta) throw new Error(erroConta.message);

    return { ok: true, nao_lidas: count ?? 0 };
  });

/**
 * Conta atual (do banco) de avisos não lidos: notificações pendentes +
 * novidades publicadas depois da última visita do usuário.
 */
export const contarAvisosNaoLidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: perfil } = await supabase
      .from("profiles")
      .select("novidades_vistas_em")
      .eq("id", userId)
      .maybeSingle();

    const vistasEm = perfil?.novidades_vistas_em ?? null;

    let novidadesQuery = supabase
      .from("novidades")
      .select("id", { count: "exact", head: true })
      .eq("publicado", true)
      .not("data_publicacao", "is", null);
    if (vistasEm) novidadesQuery = novidadesQuery.gt("data_publicacao", vistasEm);

    const [notif, novs] = await Promise.all([
      supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("lida_em", null),
      novidadesQuery,
    ]);

    return {
      notificacoes: notif.count ?? 0,
      novidades: novs.count ?? 0,
      novidades_vistas_em: vistasEm,
    };
  });
