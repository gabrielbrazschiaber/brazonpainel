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

        const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
        if (!esperado) {
          console.error("[AsaasQueue] ASAAS_WEBHOOK_TOKEN não configurado.");
          return json({ error: "Endpoint indisponível" }, 503);
        }

        const enviado =
          request.headers.get("x-cron-token") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        if (enviado !== esperado) {
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
