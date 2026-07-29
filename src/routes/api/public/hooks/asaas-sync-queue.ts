import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint chamado por cron (pg_cron) para reprocessar a fila de sincronização
 * com o Asaas. Autenticado pelo apikey (chave publicável) do projeto.
 */
export const Route = createFileRoute("/api/public/hooks/asaas-sync-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");

        const esperada =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

        if (!apikey || !esperada || apikey !== esperada) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { processarFilaAsaas } = await import("@/lib/asaas-queue.server");
          const resumo = await processarFilaAsaas(20);
          return new Response(JSON.stringify({ ok: true, ...resumo }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("[AsaasQueue] Falha ao processar fila:", e);
          return new Response(JSON.stringify({ ok: false, error: "Falha ao processar fila" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
