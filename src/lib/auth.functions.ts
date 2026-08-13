import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email(),
});

export const enviarResetEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    try {
      // DEBUG: Log antes de tentar importar
      console.log(`[enviarResetEmail] Solicitando reset para: ${data.email}`);
      
      const { enviarLinkDefinicaoSenha } = await import("./password-reset");
      const res = await enviarLinkDefinicaoSenha(data.email);
      
      if (res.error) {
        console.error("[enviarResetEmail] Erro retornado:", res.error.message);
        return { ok: false, error: res.error.message };
      }

      console.log("[enviarResetEmail] Sucesso!");
      return { ok: true };
    } catch (err: any) {
      console.error("[enviarResetEmail] Erro fatal:", err);
      // Tentamos capturar se é um erro de rede ou algo parecido
      const errorMsg = err?.message || String(err);
      return { ok: false, error: `Falha na execução: ${errorMsg}` };
    }
  });



