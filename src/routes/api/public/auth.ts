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
          // Usamos o SDK diretamente aqui para isolar o problema
          const { createClient } = await import("@supabase/supabase-js");
          const SUPABASE_URL = process.env.SUPABASE_URL || "https://svdrarqtkfbzmxzivibr.supabase.co";
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error("[auth-api] SUPABASE_SERVICE_ROLE_KEY is missing");
            return new Response(JSON.stringify({ error: "Configuração do servidor ausente" }), { 
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }

          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false }
          });

          const { error } = await supabaseAdmin.auth.resetPasswordForEmail(parsed.data.email, {
            redirectTo: "https://painel.brazoncrm.com.br/redefinir-senha"
          });
          
          if (error) {
            console.error("[auth-api] Supabase Auth Error:", error.message);
            return new Response(JSON.stringify({ error: error.message }), { 
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }

          return new Response(JSON.stringify({ ok: true }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (err: any) {
          console.error("[auth-api] Runtime Error:", err.message || err);
          return new Response(JSON.stringify({ error: err.message || "Erro interno" }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      },
    },
  },
});
