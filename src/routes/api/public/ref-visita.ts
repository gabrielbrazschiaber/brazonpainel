import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Registra uma visita ao link de indicação (/cadastro?ref=CODIGO).
// Endpoint público e propositalmente "burro": só grava um par
// vendedor + identificador anônimo de sessão. Nada sensível é lido ou devolvido.
const schema = z.object({
  codigo: z.string().trim().min(1).max(60),
  session: z.string().trim().min(8).max(64),
});

export const Route = createFileRoute("/api/public/ref-visita")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) return new Response("Invalid body", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: vend } = await supabaseAdmin
          .from("vendedores")
          .select("id, ativo")
          .eq("codigo_indicacao", parsed.data.codigo)
          .maybeSingle();

        // Resposta sempre igual: não revela se o código existe.
        if (vend?.ativo) {
          await supabaseAdmin.from("referral_visitas").insert({
            vendedor_id: vend.id,
            codigo: parsed.data.codigo,
            session_id: parsed.data.session,
          });
        }

        return new Response(null, { status: 204 });
      },
    },
  },
});
