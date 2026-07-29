import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LembreteCliente = {
  id: string;
  vencimento: string;
  dias_restantes: number;
  mensagem: string;
  lido_em: string | null;
};

/** Lembretes de vencimento em aberto do cliente logado. */
export const meusLembretes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LembreteCliente[]> => {
    const { data, error } = await context.supabase
      .from("lembretes_vencimento")
      .select("id, vencimento, dias_restantes, mensagem, lido_em")
      .eq("user_id", context.userId)
      .is("lido_em", null)
      .order("vencimento", { ascending: true })
      .limit(5);

    if (error) throw new Error(error.message);
    return (data ?? []) as LembreteCliente[];
  });

/** Marca um lembrete do próprio usuário como lido. */
export const marcarLembreteLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Lembrete inválido.");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lembretes_vencimento")
      .update({ lido_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Acionamento manual da rotina (somente administração). */
export const gerarLembretesAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensurePermission } = await import("./permissions.guard");
    await ensurePermission(context.supabase, context.userId, "configuracoes.gerenciar");

    const { gerarLembretesVencimento } = await import("./lembretes.server");
    return gerarLembretesVencimento();
  });
