import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint chamado por cron (pg_cron) para devolver ao Banco de Leads os leads
 * puxados e NÃO trabalhados após o prazo configurado, avisando o vendedor um
 * dia antes.
 *
 * Autenticação: exige o token do agendamento (`configuracoes.cron_token`) ou o
 * segredo ASAAS_WEBHOOK_TOKEN no cabeçalho `x-cron-token` (ou Bearer).
 * Sem token configurado o endpoint fecha (fail-closed) e responde 503.
 */
export const Route = createFileRoute("/api/public/hooks/devolver-leads-abandonados")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        const enviado =
          request.headers.get("x-cron-token") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        if (!enviado) return json({ error: "Não autorizado" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("configuracoes")
          .select("cron_token, dias_devolver_lead")
          .limit(1)
          .maybeSingle();

        const aceitos = [cfg?.cron_token, process.env.ASAAS_WEBHOOK_TOKEN].filter(
          (t): t is string => typeof t === "string" && t.length > 0,
        );

        if (aceitos.length === 0) {
          console.error("[BancoLeads] Nenhum token de acionamento configurado.");
          return json({ error: "Endpoint indisponível" }, 503);
        }
        const { algumSegredoConfere } = await import("@/lib/token-compare.server");
        if (!algumSegredoConfere(enviado, aceitos)) {
          return json({ error: "Não autorizado" }, 401);
        }

        try {
          const dias = Math.min(30, Math.max(3, Number(cfg?.dias_devolver_lead ?? 7) || 7));
          const { data, error } = await supabaseAdmin.rpc("devolver_leads_abandonados", {
            _dias: dias,
          });
          if (error) throw new Error(error.message);
          return json({ ok: true, dias, devolvidos: Number(data ?? 0) });
        } catch (e) {
          console.error("[BancoLeads] Falha ao devolver leads abandonados:", e);
          return json({ ok: false, error: "Falha ao devolver leads" }, 500);
        }
      },
    },
  },
});
