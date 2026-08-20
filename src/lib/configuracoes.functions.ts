import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";
import { registrarAuditoria } from "@/lib/audit.server";
import {
  mensagemRapidaSchema,
  idSchema,
} from "@/lib/leads.schemas";

const configIaSchema = z.object({
  provedor: z.enum(["openrouter", "deepseek", "groq", "google", "anthropic"]),
  modelo: z.string().max(120),
  api_key: z.string().min(20).optional().or(z.literal("")),
});

export const listarMensagensRapidasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarMensagensRapidasServer } = await import("@/lib/configuracoes.server");
    return listarMensagensRapidasServer(context.supabase);
  });

export const salvarMensagemRapida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => mensagemRapidaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { salvarMensagemRapidaServer } = await import("@/lib/configuracoes.server");
    return salvarMensagemRapidaServer(context.supabase, data);
  });

export const excluirMensagemRapida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { excluirMensagemRapidaServer } = await import("@/lib/configuracoes.server");
    return excluirMensagemRapidaServer(context.supabase, data.id);
  });

export const obterConfigIa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensurePermission(context.supabase, context.userId, "configuracoes.gerenciar");

    const { data, error } = await supabaseAdmin
      .from("configuracoes")
      .select("ia_provedor, ia_modelo, ia_key_ultimos4, ia_testada_em, ia_teste_ok, ia_api_key")
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("Erro ao carregar configuração de IA");

    return {
      provedor: (data?.ia_provedor as any) ?? "openrouter",
      modelo: data?.ia_modelo ?? "deepseek/deepseek-chat:free",
      temChave: !!data?.ia_api_key,
      ultimos4: data?.ia_key_ultimos4 ?? null,
      testadaEm: data?.ia_testada_em ?? null,
      testeOk: data?.ia_teste_ok ?? null,
    };
  });

export const salvarConfigIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => configIaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensurePermission(context.supabase, context.userId, "configuracoes.gerenciar");

    // Buscamos o ID primeiro
    const { data: cfg } = await supabaseAdmin.from("configuracoes").select("id").limit(1).single();
    if (!cfg) throw new Error("Configurações não encontradas.");

    const update: any = {
      ia_provedor: data.provedor,
      ia_modelo: data.modelo,
      updated_at: new Date().toISOString(),
    };

    if (data.api_key) {
      update.ia_api_key = data.api_key;
    }

    const { error } = await supabaseAdmin
      .from("configuracoes")
      .update(update)
      .eq("id", cfg.id);

    if (error) throw new Error("Erro ao salvar configuração de IA: " + error.message);

    await registrarAuditoria({
      actorId: context.userId,
      acao: "config_ia_atualizada",
      entidade: "configuracoes",
      detalhes: {
        provedor: data.provedor,
        modelo: data.modelo,
        chave_alterada: !!data.api_key,
      },
    });

    return { ok: true };
  });

export const testarConexaoIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensurePermission(context.supabase, context.userId, "configuracoes.gerenciar");

    const { data: cfg } = await supabaseAdmin
      .from("configuracoes")
      .select("id, ia_provedor, ia_modelo, ia_api_key")
      .limit(1)
      .single();

    if (!cfg?.ia_api_key) {
      throw new Error("API Key não configurada.");
    }

    const inicio = Date.now();
    let ok = false;
    let mensagem = "";

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${cfg.ia_api_key}`,
              "HTTP-Referer": "https://brazoncrm.com.br",
              "X-Title": "Brazon CRM Admin Test"
          },
          body: JSON.stringify({
              model: cfg.ia_modelo,
              messages: [{ role: "user", content: "responda apenas OK" }],
              max_tokens: 10
          })
      });

      if (response.ok) {
          ok = true;
          mensagem = "Conexão estabelecida com sucesso.";
      } else {
          const errBody = await response.text();
          mensagem = errBody.replace(cfg.ia_api_key, "***");
      }
    } catch (e) {
      mensagem = e instanceof Error ? e.message : "Erro desconhecido";
    }

    const latenciaMs = Date.now() - inicio;

    await supabaseAdmin
      .from("configuracoes")
      .update({
        ia_testada_em: new Date().toISOString(),
        ia_teste_ok: ok,
      })
      .eq("id", cfg.id);

    return { ok, mensagem, latenciaMs };
  });
