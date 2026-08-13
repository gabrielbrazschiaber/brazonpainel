import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email(),
});

export const enviarResetEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    try {
      console.log(`[enviarResetEmail] Solicitando reset para: ${data.email}`);
      const { enviarLinkDefinicaoSenha } = await import("./password-reset");
      const res = await enviarLinkDefinicaoSenha(data.email);

      if (res.error) {
        console.error("[enviarResetEmail] Erro no fluxo de reset:", res.error.message);
        // O erro "fetch failed" geralmente significa que o servidor não conseguiu
        // alcançar o serviço de autenticação do Supabase.
        return { 
          ok: false, 
          error: res.error.message.includes("fetch failed") 
            ? "Falha na comunicação com o servidor de e-mail. Tente novamente." 
            : res.error.message 
        };
      }

      console.log("[enviarResetEmail] Fluxo de reset processado.");
      return { ok: true };
    } catch (err) {
      console.error("[enviarResetEmail] Erro fatal durante a execução:", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
