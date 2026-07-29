import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint chamado por cron (pg_cron) para gerar os lembretes automáticos de
 * vencimento dos clientes ativos, respeitando `dias_aviso_vencimento`.
 *
 * Autenticação: exige o token do agendamento (`configuracoes.cron_token`) ou o
 * segredo ASAAS_WEBHOOK_TOKEN no cabeçalho `x-cron-token` (ou Bearer).
 * Sem token configurado o endpoint fecha (fail-closed) e responde 503.
 */
export const Route = createFileRoute("/api/public/hooks/lembretes-vencimento")({
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
          .select("cron_token")
          .limit(1)
          .maybeSingle();

        const aceitos = [cfg?.cron_token, process.env.ASAAS_WEBHOOK_TOKEN].filter(
          (t): t is string => typeof t === "string" && t.length > 0,
        );

        if (aceitos.length === 0) {
          console.error("[Lembretes] Nenhum token de acionamento configurado.");
          return json({ error: "Endpoint indisponível" }, 503);
        }
        if (!aceitos.includes(enviado)) return json({ error: "Não autorizado" }, 401);

        try {
          const { gerarLembretesVencimento } = await import("@/lib/lembretes.server");
          const resumo = await gerarLembretesVencimento();
          return json({ ok: true, ...resumo });
        } catch (e) {
          console.error("[Lembretes] Falha ao gerar lembretes:", e);
          return json({ ok: false, error: "Falha ao gerar lembretes" }, 500);
        }
      },
    },
  },
});
