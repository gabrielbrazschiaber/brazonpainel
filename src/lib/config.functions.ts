import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";

/**
 * Admin consulta o token de autenticação do webhook do Asaas.
 *
 * Por padrão devolve APENAS uma máscara — o segredo não fica no HTML nem na
 * memória da página. O valor completo só é retornado quando o admin pede
 * explicitamente (botão "Revelar"/"Copiar"), reduzindo a exposição do segredo.
 */
export const obterWebhookToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ revelar: z.boolean().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");
    const token = (process.env.ASAAS_WEBHOOK_TOKEN ?? "").trim();
    return {
      definido: !!token,
      mascara: mascararChave(token),
      token: data.revelar ? token : null,
    };
  });

/** Mascara a chave da API, revelando apenas os últimos 4 caracteres. */
function mascararChave(chave: string | null | undefined): string {
  if (!chave) return "";
  const limpa = chave.trim();
  if (limpa.length <= 4) return "****";
  return `****${limpa.slice(-4)}`;
}

/**
 * Admin lê as configurações. A chave do Asaas NUNCA é enviada em texto puro
 * para o navegador — apenas uma versão mascarada e um indicador de existência.
 */
export const obterConfiguracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("configuracoes")
      .select(
        "id,nome_app,dominio,dias_aviso_vencimento,dias_devolver_lead,percentual_comissao_padrao,asaas_api_key,asaas_webhook_url,asaas_ambiente",
      )
      .limit(1)
      .maybeSingle();

    return {
      id: data?.id ?? null,
      nome_app: data?.nome_app ?? "",
      dominio: data?.dominio ?? "",
      dias_aviso_vencimento: data?.dias_aviso_vencimento ?? 5,
      dias_devolver_lead: data?.dias_devolver_lead ?? 7,
      percentual_comissao_padrao: data?.percentual_comissao_padrao ?? 10,
      asaas_webhook_url: data?.asaas_webhook_url ?? "",
      asaas_ambiente: (data?.asaas_ambiente ?? "sandbox") as "producao" | "sandbox",
      asaas_api_key_mascara: mascararChave(data?.asaas_api_key),
      asaas_api_key_definida: !!(data?.asaas_api_key && data.asaas_api_key.trim()),
    };
  });

const salvarConfigSchema = z.object({
  nome_app: z.string().trim().max(120).optional().nullable(),
  dominio: z.string().trim().max(200).optional().nullable(),
  dias_aviso_vencimento: z.number().int().min(0).max(365),
  /** Prazo para devolver ao Banco de Leads um lead não trabalhado. */
  dias_devolver_lead: z.number().int().min(3).max(30),
  percentual_comissao_padrao: z.number().min(0).max(100),
  asaas_webhook_url: z.string().trim().max(500).optional().nullable(),
  asaas_ambiente: z.enum(["producao", "sandbox"]),
  // Chave nova, opcional. Em branco = manter a chave existente.
  asaas_api_key: z.string().trim().max(500).optional().nullable(),
});

/**
 * Admin salva as configurações. A chave do Asaas só é gravada quando um novo
 * valor é informado; se vier em branco, a chave atual é preservada. Toda a
 * escrita ocorre no servidor via supabaseAdmin.
 */
export const salvarConfiguracoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => salvarConfigSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existente } = await supabaseAdmin
      .from("configuracoes")
      .select("id")
      .limit(1)
      .maybeSingle();

    const novaChave = data.asaas_api_key?.trim();

    const base = {
      nome_app: data.nome_app ?? "",
      dominio: data.dominio ?? "",
      dias_aviso_vencimento: data.dias_aviso_vencimento,
      dias_devolver_lead: data.dias_devolver_lead,
      percentual_comissao_padrao: data.percentual_comissao_padrao,
      asaas_webhook_url: data.asaas_webhook_url ?? "",
      asaas_ambiente: data.asaas_ambiente,
    };

    if (existente?.id) {
      const payload = novaChave ? { ...base, asaas_api_key: novaChave } : base;
      const { error } = await supabaseAdmin
        .from("configuracoes")
        .update(payload)
        .eq("id", existente.id);
      if (error) throw new Error("Não foi possível salvar as configurações.");
    } else {
      const payload = { ...base, asaas_api_key: novaChave ?? null };
      const { error } = await supabaseAdmin.from("configuracoes").insert(payload);
      if (error) throw new Error("Não foi possível salvar as configurações.");
    }

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: "atualizar_configuracoes",
      entidade: "configuracoes",
      detalhes: { chave_alterada: !!novaChave, ambiente: data.asaas_ambiente },
    });

    return { ok: true };
  });
