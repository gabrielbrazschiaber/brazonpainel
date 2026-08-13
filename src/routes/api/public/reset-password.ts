import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const schema = z.object({
  email: z.string().trim().email(),
});

export const Route = createFileRoute('/api/public/reset-password')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { email } = schema.parse(body);

          console.log(`[API/Public/Reset] Solicitando reset para: ${email}`);

          // Usamos o password-reset que configuramos para fetch manual ou supabaseAdmin
          const { enviarLinkDefinicaoSenha } = await import("@/lib/password-reset");
          const result = await enviarLinkDefinicaoSenha(email);

          if (result.error) {
            console.error(`[API/Public/Reset] Erro: ${result.error.message}`);
            return new Response(JSON.stringify({ ok: false, error: result.error.message }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (err: any) {
          console.error(`[API/Public/Reset] Erro fatal:`, err);
          return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
