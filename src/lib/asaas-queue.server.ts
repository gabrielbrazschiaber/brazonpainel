import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Fila de sincronização com o Asaas.
 *
 * Quando a API do Asaas falha temporariamente (rede, timeout, 429, 5xx), a
 * atualização do cliente é enfileirada e reprocessada mais tarde com backoff
 * exponencial (1min, 2min, 4min, ... até o limite de tentativas).
 */

const BACKOFF_BASE_MS = 60_000; // 1 minuto
const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000; // 6 horas
const MAX_TENTATIVAS = 6;

export type TipoSync = "assinatura" | "cliente";

export function calcularBackoffMs(tentativas: number): number {
  const bruto = BACKOFF_BASE_MS * Math.pow(2, Math.max(0, tentativas - 1));
  const jitter = Math.floor(Math.random() * 15_000);
  return Math.min(bruto, BACKOFF_MAX_MS) + jitter;
}

/** Erros que valem retry (indisponibilidade temporária). */
export function ehFalhaTransitoria(motivo?: string): boolean {
  return (
    motivo === "erro_rede" ||
    motivo === "asaas_indisponivel" ||
    motivo === "erro" ||
    motivo === "falha_asaas" ||
    motivo === "sem_email"
  );
}

export function statusEhTransitorio(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Enfileira (ou reagenda) uma sincronização pendente para o cliente. */
export async function enfileirarSincronizacao(
  clienteId: string,
  motivo: string,
  tipo: TipoSync = "assinatura",
): Promise<void> {
  const { data: existente } = await supabaseAdmin
    .from("asaas_sync_queue")
    .select("id, tentativas")
    .eq("cliente_id", clienteId)
    .eq("tipo", tipo)
    .in("status", ["pendente", "processando"])
    .maybeSingle();

  const agora = Date.now();

  if (existente) {
    await supabaseAdmin
      .from("asaas_sync_queue")
      .update({
        status: "pendente",
        ultimo_erro: motivo,
        proxima_tentativa_em: new Date(
          agora + calcularBackoffMs(existente.tentativas + 1),
        ).toISOString(),
      })
      .eq("id", existente.id);
    return;
  }

  await supabaseAdmin.from("asaas_sync_queue").insert({
    cliente_id: clienteId,
    tipo,
    status: "pendente",
    tentativas: 0,
    max_tentativas: MAX_TENTATIVAS,
    ultimo_erro: motivo,
    proxima_tentativa_em: new Date(agora + calcularBackoffMs(1)).toISOString(),
  });
}

/** Marca a fila do cliente como concluída (após um sync bem-sucedido). */
export async function concluirSincronizacao(
  clienteId: string,
  tipo: TipoSync = "assinatura",
): Promise<void> {
  await supabaseAdmin
    .from("asaas_sync_queue")
    .update({ status: "concluido", ultimo_erro: null })
    .eq("cliente_id", clienteId)
    .eq("tipo", tipo)
    .in("status", ["pendente", "processando"]);
}

/**
 * Processa os itens vencidos da fila. Retorna um resumo do processamento.
 * Idempotente: pode ser chamado por cron ou manualmente pelo admin.
 */
export async function processarFilaAsaas(limite = 20): Promise<{
  processados: number;
  concluidos: number;
  reagendados: number;
  falhados: number;
}> {
  const { data: itens } = await supabaseAdmin
    .from("asaas_sync_queue")
    .select("id, cliente_id, tipo, tentativas, max_tentativas")
    .eq("status", "pendente")
    .lte("proxima_tentativa_em", new Date().toISOString())
    .order("proxima_tentativa_em", { ascending: true })
    .limit(limite);

  const resumo = { processados: 0, concluidos: 0, reagendados: 0, falhados: 0 };
  if (!itens?.length) return resumo;

  const { sincronizarAssinaturaCliente, provisionarClienteAsaas } =
    await import("@/lib/asaas.server");

  for (const item of itens) {
    // Lock otimista: só processa se ainda estiver pendente.
    const { data: travado } = await supabaseAdmin
      .from("asaas_sync_queue")
      .update({ status: "processando" })
      .eq("id", item.id)
      .eq("status", "pendente")
      .select("id")
      .maybeSingle();
    if (!travado) continue;

    resumo.processados++;
    const tentativas = item.tentativas + 1;

    // tipo "cliente": só cria/recupera o customer na plataforma de pagamento.
    const resultado =
      item.tipo === "cliente"
        ? await (async () => {
            const r = await provisionarClienteAsaas(item.cliente_id, {
              enfileirarSeFalhar: false,
            });
            return { sincronizado: r.provisionado, motivo: r.motivo };
          })()
        : await sincronizarAssinaturaCliente(item.cliente_id, {
            enfileirarSeFalhar: false,
          });

    if (resultado.sincronizado) {
      await supabaseAdmin
        .from("asaas_sync_queue")
        .update({ status: "concluido", tentativas, ultimo_erro: null })
        .eq("id", item.id);
      resumo.concluidos++;
      continue;
    }

    const transitorio = ehFalhaTransitoria(resultado.motivo);
    const podeTentarDeNovo = transitorio && tentativas < item.max_tentativas;

    await supabaseAdmin
      .from("asaas_sync_queue")
      .update({
        status: podeTentarDeNovo ? "pendente" : "falhou",
        tentativas,
        ultimo_erro: resultado.motivo ?? "desconhecido",
        proxima_tentativa_em: podeTentarDeNovo
          ? new Date(Date.now() + calcularBackoffMs(tentativas)).toISOString()
          : new Date().toISOString(),
      })
      .eq("id", item.id);

    if (podeTentarDeNovo) resumo.reagendados++;
    else resumo.falhados++;
  }

  return resumo;
}
