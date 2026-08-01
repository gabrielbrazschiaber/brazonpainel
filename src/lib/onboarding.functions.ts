import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Progresso do onboarding do próprio usuário: quais tutoriais ele já concluiu,
 * pulou ou deixou pelo meio.
 */
export const meuProgressoOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("onboarding_progresso")
      .select("chave,status,passo_parou")
      .eq("user_id", userId);

    if (error) {
      console.error("[onboarding] falha ao ler progresso:", error.message);
      // Falha de leitura não deve tentar mostrar tutorial de novo.
      return { itens: [], indeterminado: true };
    }

    return { itens: data ?? [], indeterminado: false };
  });

/** Marca um tutorial como concluído, pulado ou em andamento. */
export const marcarTutorial = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const chave = typeof d.chave === "string" ? d.chave.trim() : "";
    const status = typeof d.status === "string" ? d.status : "concluido";
    const passo =
      typeof d.passo_parou === "number" && Number.isFinite(d.passo_parou)
        ? Math.max(0, Math.min(200, Math.trunc(d.passo_parou)))
        : null;

    if (!chave || chave.length > 80) throw new Error("Tutorial inválido.");
    if (!["concluido", "pulado", "em_andamento"].includes(status)) {
      throw new Error("Situação de tutorial inválida.");
    }
    return { chave, status, passo_parou: passo };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: linha, error } = await supabase
      .from("onboarding_progresso")
      .upsert(
        {
          user_id: userId,
          chave: data.chave,
          status: data.status,
          passo_parou: data.passo_parou,
        },
        { onConflict: "user_id,chave" },
      )
      .select("chave,status,passo_parou")
      .maybeSingle();

    if (error) {
      console.error("[onboarding] falha ao marcar tutorial:", error.message);
      throw new Error("Não foi possível salvar seu progresso do tutorial.");
    }
    return { ok: true, item: linha };
  });

/** Reinicia um tutorial específico ou todos, para "Rever tutoriais". */
export const reiniciarOnboarding = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const chave = typeof d.chave === "string" && d.chave.trim() ? d.chave.trim() : null;
    if (chave && chave.length > 80) throw new Error("Tutorial inválido.");
    return { chave };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase.from("onboarding_progresso").delete().eq("user_id", userId);
    if (data.chave) q = q.eq("chave", data.chave);

    const { data: removidos, error } = await q.select("chave");
    if (error) {
      console.error("[onboarding] falha ao reiniciar:", error.message);
      throw new Error("Não foi possível reiniciar o tutorial.");
    }
    return { ok: true, removidos: (removidos ?? []).map((r) => r.chave) };
  });

/** Visão do admin: quem da equipe já concluiu cada tutorial. */
export const progressoEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: ehAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (ehAdmin !== true) throw new Error("Acesso negado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: linhas, error }, { data: perfis }] = await Promise.all([
      supabaseAdmin
        .from("onboarding_progresso")
        .select("user_id,chave,status,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id,nome,email"),
    ]);

    if (error) {
      console.error("[onboarding] falha ao ler progresso da equipe:", error.message);
      throw new Error("Não foi possível carregar o progresso da equipe.");
    }

    const mapa = new Map<string, { nome: string | null; email: string | null }>();
    (perfis ?? []).forEach((p) => mapa.set(p.id, { nome: p.nome, email: p.email }));

    const porUsuario = new Map<
      string,
      { user_id: string; nome: string | null; email: string | null; chaves: string[]; boasVindas: boolean }
    >();

    (linhas ?? []).forEach((l) => {
      const atual =
        porUsuario.get(l.user_id) ??
        {
          user_id: l.user_id,
          nome: mapa.get(l.user_id)?.nome ?? null,
          email: mapa.get(l.user_id)?.email ?? null,
          chaves: [] as string[],
          boasVindas: false,
        };
      atual.chaves.push(l.chave);
      if (l.chave === "boas_vindas") atual.boasVindas = true;
      porUsuario.set(l.user_id, atual);
    });

    return { usuarios: Array.from(porUsuario.values()) };
  });
