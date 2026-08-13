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
          // Usamos a função auxiliar que já lida com o supabaseAdmin
          const { error } = await enviarLinkDefinicaoSenha(parsed.data.email);
          
          if (error) {
            console.error("[auth-api] Supabase Auth Error:", error.message);
            // Mesmo com erro, retornamos 200 para evitar enumeração de e-mails em produção,
            // a menos que queiramos ser explícitos durante o debug.
            return new Response(JSON.stringify({ ok: true }), { 
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          return new Response(JSON.stringify({ ok: true }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (err: any) {
          console.error("[auth-api] Runtime Error:", err.message || err);
          // Fallback seguro: se falhar o fetch interno ou o import, retornamos 200
          // mas logamos o erro real para o admin.
          return new Response(JSON.stringify({ ok: true, note: "processed with fallback" }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
