import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";

const schema = z.object({
  email: z.string().trim().email(),
});

export const Route = createFileRoute("/api/public/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "E-mail inválido" }), { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        try {
          // O resetPasswordForEmail do Supabase sempre retorna 200/ok mesmo se o e-mail não existir
          // por razões de segurança (evitar enumeração de e-mails), a menos que configurado o contrário.
          const { error } = await enviarLinkDefinicaoSenha(parsed.data.email);
          
          if (error) {
            console.error("[auth-api] Erro ao enviar link:", error.message);
            return new Response(JSON.stringify({ error: error.message }), { 
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }

          return new Response(JSON.stringify({ ok: true }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (err) {
          console.error("[auth-api] Erro inesperado:", err);
          return new Response(JSON.stringify({ error: "Erro interno ao processar a solicitação" }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
