import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TERMOS_TEXTO, TERMOS_VERSAO } from "@/lib/termos";

// Verifica se o usuário autenticado já aceitou a versão vigente do Termo de Uso.
export const statusAceiteTermos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("termos_aceites")
      .select("versao,aceito_em")
      .eq("user_id", userId)
      .eq("versao", TERMOS_VERSAO)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[termos] falha ao verificar aceite:", error.message);
      // Em caso de erro de leitura não bloqueia o uso do painel.
      return { versaoAtual: TERMOS_VERSAO, aceito: true, indeterminado: true };
    }

    return {
      versaoAtual: TERMOS_VERSAO,
      aceito: Boolean(data),
      indeterminado: false,
    };
  });

// Registra o aceite da versão vigente pelo usuário autenticado.
// O texto gravado vem sempre do servidor, nunca do cliente.
export const registrarAceiteTermos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: existente } = await supabase
      .from("termos_aceites")
      .select("id")
      .eq("user_id", userId)
      .eq("versao", TERMOS_VERSAO)
      .limit(1)
      .maybeSingle();

    if (existente) return { ok: true, versao: TERMOS_VERSAO, jaRegistrado: true };

    const { data: perfil } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("termos_aceites").insert({
      user_id: userId,
      email: perfil?.email ?? "",
      versao: TERMOS_VERSAO,
      texto: TERMOS_TEXTO,
      origem: "revalidacao",
      aceito_em: new Date().toISOString(),
    });
    if (error) throw new Error("Não foi possível registrar o aceite.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorEmail: perfil?.email ?? null,
      acao: "aceite_termos",
      entidade: "termos_aceites",
      entidadeId: userId,
      detalhes: { versao: TERMOS_VERSAO, origem: "revalidacao" },
    });

    return { ok: true, versao: TERMOS_VERSAO, jaRegistrado: false };
  });

// Histórico de aceites do próprio usuário (RLS já restringe a linhas dele).
export const listarMeusAceites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("termos_aceites")
      .select("id,versao,texto,origem,aceito_em,email")
      .eq("user_id", userId)
      .order("aceito_em", { ascending: false });

    if (error) {
      console.error("[termos] falha ao listar aceites:", error.message);
      throw new Error("Não foi possível carregar seu histórico de aceites.");
    }

    return {
      versaoAtual: TERMOS_VERSAO,
      aceites: data ?? [],
    };
  });
