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
      await enviarLinkDefinicaoSenha(data.email);
      return { ok: true };
    } catch (err) {
      console.error("[enviarResetEmail] Error:", err);
      // Sempre retornamos sucesso para o frontend por segurança
      return { ok: true };
    }
  });

