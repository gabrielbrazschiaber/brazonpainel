import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email(),
});

export const enviarResetEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    try {
      console.log(`[enviarResetEmail] Chamando API pública para reset: ${data.email}`);
      
      // Como o server function está sofrendo com networking, chamamos a rota API local
      // que o Vite/Nitro expõe. Em produção, isso resolve localmente ou via rede externa.
      const baseUrl = process.env.VITE_SITE_URL || 'http://localhost:8080';
      
      const response = await fetch(`${baseUrl}/api/public/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("[enviarResetEmail] API retornou erro:", response.status, errData);
        return { ok: false, error: errData.error || "Erro na API de reset" };
      }

      return { ok: true };
    } catch (err: any) {
      console.error("[enviarResetEmail] Erro ao chamar API:", err);
      return { ok: false, error: err?.message || String(err) };
    }
  });




