import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint chamado por cron (pg_cron) para reprocessar a fila de sincronização
 * com o Asaas.
 *
 * Autenticação: exige o segredo ASAAS_WEBHOOK_TOKEN no cabeçalho `x-cron-token`
 * (ou `Authorization: Bearer ...`). A chave publicável NÃO serve como segredo,
 * pois é pública por definição. Sem o segredo configurado o endpoint fecha
 * (fail-closed) e responde 503.
 */
export const Route = createFileRoute("/api/public/hooks/asaas-sync-queue")({
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

        // Segredos aceitos: o token do agendamento (guardado em configuracoes,
        // fora do alcance do navegador) ou o segredo ASAAS_WEBHOOK_TOKEN.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("configuracoes")
          .select("cron_token")
          .limit(1)
          .maybeSingle();

        const aceitos = [cfg?.cron_token, process.env.ASAAS_WEBHOOK_TOKEN].filter(
          (t): t is string => typeof t === "string" && t.length > 0,
        );

        if (aceitos.length === 0) {
          console.error("[AsaasQueue] Nenhum token de acionamento configurado.");
          return json({ error: "Endpoint indisponível" }, 503);
        }

        if (!aceitos.includes(enviado)) {
          return json({ error: "Não autorizado" }, 401);
        }

        try {
          const { processarFilaAsaas } = await import("@/lib/asaas-queue.server");
          const resumo = await processarFilaAsaas(20);
          return json({ ok: true, ...resumo });
        } catch (e) {
          console.error("[AsaasQueue] Falha ao processar fila:", e);
          return json({ ok: false, error: "Falha ao processar fila" }, 500);
        }
      },
    },
  },
});
