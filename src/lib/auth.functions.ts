import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email(),
});

export const enviarResetEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { enviarLinkDefinicaoSenha } = await import("./password-reset");
      const { error } = await enviarLinkDefinicaoSenha(data.email);
      
      if (error) {
        console.error("[enviarResetEmail] Erro do Supabase:", error.message);
        return { ok: false, error: error.message };
      }

      return { ok: true };
    } catch (err) {
      console.error("[enviarResetEmail] Erro de execução:", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });


