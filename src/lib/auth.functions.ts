import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email(),
});

export const enviarResetEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const SUPABASE_URL = process.env.SUPABASE_URL || "https://svdrarqtkfbzmxzivibr.supabase.co";
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!SUPABASE_SERVICE_ROLE_KEY) {
        return { ok: true, note: "missing_key" };
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });

      await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
        redirectTo: "https://painel.brazoncrm.com.br/redefinir-senha"
      });

      return { ok: true };
    } catch (err) {
      console.error("[enviarResetEmail] Error:", err);
      return { ok: true, error: "background_fail" };
    }
  });
