import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Data (YYYY-MM-DD) somando dias à data de hoje, em UTC. */
function dataEmDias(dias: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Diferença em dias entre hoje e uma data YYYY-MM-DD. */
function diasAte(vencimento: string): number {
  const hoje = new Date(`${dataEmDias(0)}T00:00:00Z`).getTime();
  const alvo = new Date(`${vencimento}T00:00:00Z`).getTime();
  return Math.round((alvo - hoje) / 86_400_000);
}

function mensagemLembrete(dias: number, nomeApp: string): string {
  if (dias <= 0) return `Sua assinatura ${nomeApp} vence hoje. Garanta a renovação para não perder o acesso.`;
  if (dias === 1) return `Sua assinatura ${nomeApp} vence amanhã. Renove para manter o acesso ativo.`;
  return `Sua assinatura ${nomeApp} vence em ${dias} dias. Renove com antecedência para manter o acesso ativo.`;
}

export type ResumoLembretes = {
  janelaDias: number;
  avaliados: number;
  criados: number;
  jaExistentes: number;
};

/**
 * Gera lembretes de vencimento para clientes ativos cujo vencimento cai dentro
 * da janela configurada em `configuracoes.dias_aviso_vencimento`.
 *
 * Idempotente: a chave única (cliente_id, vencimento) impede duplicidade, então
 * a rotina pode rodar várias vezes por dia sem gerar avisos repetidos.
 */
export async function gerarLembretesVencimento(): Promise<ResumoLembretes> {
  const { data: cfg } = await supabaseAdmin
    .from("configuracoes")
    .select("dias_aviso_vencimento, nome_app")
    .limit(1)
    .maybeSingle();

  const janelaDias = Math.max(0, Math.min(cfg?.dias_aviso_vencimento ?? 5, 365));
  const nomeApp = cfg?.nome_app?.trim() || "SaaS Manager";

  const hoje = dataEmDias(0);
  const limite = dataEmDias(janelaDias);

  const { data: clientes, error } = await supabaseAdmin
    .from("clientes")
    .select("id, user_id, data_vencimento")
    .eq("status", "ativo")
    .not("data_vencimento", "is", null)
    .gte("data_vencimento", hoje)
    .lte("data_vencimento", limite);

  if (error) throw new Error(error.message);

  const avaliados = clientes?.length ?? 0;
  if (!avaliados) return { janelaDias, avaliados: 0, criados: 0, jaExistentes: 0 };

  let criados = 0;
  let jaExistentes = 0;

  for (const c of clientes ?? []) {
    const vencimento = c.data_vencimento as string;
    const dias = diasAte(vencimento);

    const { error: insErro } = await supabaseAdmin.from("lembretes_vencimento").insert({
      cliente_id: c.id,
      user_id: c.user_id,
      vencimento,
      dias_restantes: dias,
      mensagem: mensagemLembrete(dias, nomeApp),
    });

    if (!insErro) {
      criados += 1;
      continue;
    }
    // 23505 = violação da chave única (lembrete já criado para este vencimento).
    if ((insErro as { code?: string }).code === "23505") {
      jaExistentes += 1;
      continue;
    }
    console.error("[Lembretes] Falha ao criar lembrete:", insErro.message);
  }

  return { janelaDias, avaliados, criados, jaExistentes };
}
