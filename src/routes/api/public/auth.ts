import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email(),
});

export const Route = createFileRoute("/api/public/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = schema.safeParse(body);
          
          if (!parsed.success) {
            return new Response(JSON.stringify({ ok: true, note: "invalid email" }), { 
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          // Importação dinâmica para evitar falhas de carregamento no worker
          const { enviarLinkDefinicaoSenha } = await import("@/lib/password-reset");
          
          // Tenta enviar, mas ignora o resultado para a resposta da API (segurança)
          try {
            await enviarLinkDefinicaoSenha(parsed.data.email);
          } catch (e) {
            console.error("[auth-api] Background error:", e);
          }

          return new Response(JSON.stringify({ ok: true }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (err) {
          console.error("[auth-api] Fatal error:", err);
          return new Response(JSON.stringify({ ok: true, note: "fatal" }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
