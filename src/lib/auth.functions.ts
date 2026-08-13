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
        // Retornamos sucesso cosmético se o erro for "User not found" por segurança,
        // mas aqui mantemos o erro real para o admin/vendedor saber o que houve.
        return { ok: false, error: res.error.message };
      }

      console.log("[enviarResetEmail] Fluxo de reset processado.");
      return { ok: true };
    } catch (err) {
      console.error("[enviarResetEmail] Erro fatal durante a execução:", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
