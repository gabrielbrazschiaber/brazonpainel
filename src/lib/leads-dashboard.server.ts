/** Dashboard comercial: agregações de funil, reuniões, segmentos e ranking. */
import { escopoComercial, hojeISO, dataLimite, nomesVendedores } from "@/lib/leads-base.server";
import type { Sb } from "@/lib/leads-base.server";
import { ESTAGIOS_FECHADOS, ESTAGIOS_SEM_FOLLOW_UP, razao } from "@/lib/leads";
import type { LeadEstagio, ReuniaoStatus } from "@/lib/leads";
import type { z } from "zod";
import type { dashboardSchema } from "@/lib/leads.schemas";

// ---------------------------------------------------------------------------
// Dashboard: tudo agregado no servidor.
// ---------------------------------------------------------------------------

interface LeadAgregado {
  estagio: LeadEstagio;
  segmento: string | null;
  valor_estimado: number;
  contatado_em: string;
  vendedor_id: string;
  follow_ups_feitos?: number | null;
  situacao_contato?: string | null;
}

function contarFunil(leads: LeadAgregado[]) {
  const conta = (e: LeadEstagio) => leads.filter((l) => l.estagio === e).length;
  const contatados = leads.length;
  const interessados = conta("interessado");
  const nao_interessados = conta("nao_interessado");
  const em_negociacao = conta("em_negociacao");
  const ganhos = conta("ganho");
  const perdidos = conta("perdido");
  const valor_ganho = leads
    .filter((l) => l.estagio === "ganho")
    .reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0);
  const pipeline_aberto = leads
    .filter((l) => !ESTAGIOS_FECHADOS.includes(l.estagio))
    .reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0);

  return {
    contatados,
    interessados,
    nao_interessados,
    em_negociacao,
    ganhos,
    perdidos,
    taxa_interesse: razao(interessados, contatados),
    taxa_fechamento: razao(ganhos, contatados),
    taxa_negociacao: razao(ganhos, em_negociacao),
    leads_por_venda: razao(contatados, ganhos),
    valor_ganho,
    ticket_medio: razao(valor_ganho, ganhos),
    pipeline_aberto,
  };
}

function contarReunioes(rows: { status: ReuniaoStatus }[]) {
  const conta = (s: ReuniaoStatus) => rows.filter((r) => r.status === s).length;
  const marcadas = rows.length;
  const realizadas = conta("realizada");
  const remarcadas = conta("remarcada");
  const no_show = conta("no_show");
  const canceladas = conta("cancelada");
  return {
    marcadas,
    realizadas,
    remarcadas,
    no_show,
    canceladas,
    taxa_comparecimento: razao(realizadas, realizadas + no_show),
    taxa_no_show: razao(no_show, marcadas),
  };
}

export async function dashboardComercialServer(
  supabase: Sb,
  userId: string,
  filtros: z.infer<typeof dashboardSchema>,
) {
  const escopo = await escopoComercial(supabase, userId);
  const vendedorFiltro = escopo.isAdmin ? filtros.vendedor_id : undefined;
  const dias = filtros.dias && filtros.dias > 0 ? filtros.dias : null;

  const inicio = dataLimite(dias);
  const inicioAnterior = dias ? dataLimite(dias * 2) : null;

  const base = () => {
    let q = supabase
      .from("leads")
      .select("estagio, segmento, valor_estimado, contatado_em, vendedor_id, follow_ups_feitos, situacao_contato")
      .limit(5000);
    if (vendedorFiltro) q = q.eq("vendedor_id", vendedorFiltro);
    return q;
  };

  const seisMeses = new Date();
  seisMeses.setDate(1);
  seisMeses.setHours(0, 0, 0, 0);
  seisMeses.setMonth(seisMeses.getMonth() - 5);
  const inicioSerie = seisMeses.toISOString().slice(0, 10);

  let qReunioes = supabase.from("lead_reunioes").select("status, agendada_para").limit(5000);
  if (vendedorFiltro) qReunioes = qReunioes.eq("vendedor_id", vendedorFiltro);

  const [atual, anterior, serie, reunioes] = await Promise.all([
    inicio ? base().gte("contatado_em", inicio) : base(),
    inicio && inicioAnterior
      ? base().gte("contatado_em", inicioAnterior).lt("contatado_em", inicio)
      : Promise.resolve({ data: [], error: null }),
    base().gte("contatado_em", inicioSerie),
    qReunioes,
  ]);

  for (const r of [atual, serie, reunioes]) {
    if ((r as { error?: { message: string } }).error) {
      throw new Error((r as { error: { message: string } }).error.message);
    }
  }

  const leadsAtuais = ((atual.data ?? []) as LeadAgregado[]).map((l) => ({
    ...l,
    valor_estimado: Number(l.valor_estimado ?? 0),
  }));
  const leadsAnteriores = (anterior.data ?? []) as LeadAgregado[];

  const funil = contarFunil(leadsAtuais);
  const funilAnterior = contarFunil(leadsAnteriores);

  // Reuniões do período (por agendada_para).
  const todasReunioes = (reunioes.data ?? []) as {
    status: ReuniaoStatus;
    agendada_para: string;
  }[];
  const limiteReuniao = inicio ? new Date(`${inicio}T00:00:00`).getTime() : null;
  const reunioesPeriodo = limiteReuniao
    ? todasReunioes.filter((r) => new Date(r.agendada_para).getTime() >= limiteReuniao)
    : todasReunioes;
  const metricasReunioes = contarReunioes(reunioesPeriodo);

  // Qualidade da base e Situação do contato.
  const porSituacao = new Map<string, number>();
  for (const l of leadsAtuais) {
    const chave = l.situacao_contato || "nao_contatado";
    porSituacao.set(chave, (porSituacao.get(chave) ?? 0) + 1);
  }
  const situacoes = Array.from(porSituacao.entries()).map(([chave, total]) => ({
    chave,
    total,
    percentual: razao(total, leadsAtuais.length),
  }));

  // Segmentos: conversão por segmento no período.
  const porSegmento = new Map<string, { total: number; ganhos: number }>();
  for (const l of leadsAtuais) {
    const chave = (l.segmento ?? "").trim() || "Sem segmento";
    const atualSeg = porSegmento.get(chave) ?? { total: 0, ganhos: 0 };
    atualSeg.total += 1;
    if (l.estagio === "ganho") atualSeg.ganhos += 1;
    porSegmento.set(chave, atualSeg);
  }
  const segmentos = Array.from(porSegmento.entries())
    .map(([segmento, v]) => ({
      segmento,
      total: v.total,
      ganhos: v.ganhos,
      taxa: razao(v.ganhos, v.total),
    }))
    .sort((a, b) => (b.taxa ?? 0) - (a.taxa ?? 0) || b.total - a.total);

  // Série de 6 meses.
  const meses: { mes: string; rotulo: string; contatados: number; ganhos: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    meses.push({
      mes,
      rotulo: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      contatados: 0,
      ganhos: 0,
    });
  }
  const indice = new Map(meses.map((m, i) => [m.mes, i]));
  for (const l of (serie.data ?? []) as LeadAgregado[]) {
    const chave = (l.contatado_em ?? "").slice(0, 7);
    const i = indice.get(chave);
    if (i === undefined) continue;
    meses[i].contatados += 1;
    if (l.estagio === "ganho") meses[i].ganhos += 1;
  }

  // Ranking apenas para admin.
  let ranking: {
    vendedor_id: string;
    nome: string;
    contatados: number;
    ganhos: number;
    taxa: number | null;
    valor_ganho: number;
  }[] = [];
  if (escopo.isAdmin) {
    const porVendedor = new Map<string, { contatados: number; ganhos: number; valor: number }>();
    for (const l of leadsAtuais) {
      const v = porVendedor.get(l.vendedor_id) ?? { contatados: 0, ganhos: 0, valor: 0 };
      v.contatados += 1;
      if (l.estagio === "ganho") {
        v.ganhos += 1;
        v.valor += Number(l.valor_estimado ?? 0);
      }
      porVendedor.set(l.vendedor_id, v);
    }
    const nomes = await nomesVendedores(Array.from(porVendedor.keys()));
    ranking = Array.from(porVendedor.entries())
      .map(([vendedor_id, v]) => ({
        vendedor_id,
        nome: nomes.get(vendedor_id) ?? "Vendedor",
        contatados: v.contatados,
        ganhos: v.ganhos,
        taxa: razao(v.ganhos, v.contatados),
        valor_ganho: v.valor,
      }))
      .sort((a, b) => b.ganhos - a.ganhos || (b.taxa ?? 0) - (a.taxa ?? 0));
  }

  // Card extra: leads com dados faltando. Não entra em nenhuma outra métrica.
  let qIncompletos = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .lt("completude", 4);
  if (vendedorFiltro) qIncompletos = qIncompletos.eq("vendedor_id", vendedorFiltro);
  const { count: incompletos } = await qIncompletos;

  // Cadência: contadores independentes do período (é operação do dia a dia).
  const hoje = hojeISO();
  const semFollowUp = `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`;
  const contarCadencia = (aplicar: (q: ReturnType<typeof supabase.from>) => unknown) => {
    let q = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("estagio", "in", semFollowUp);
    if (vendedorFiltro) q = q.eq("vendedor_id", vendedorFiltro);
    return aplicar(q) as Promise<{ count: number | null }>;
  };

  const [atrasadosRes, hojeRes, encerradasRes] = await Promise.all([
    contarCadencia((q) => q.not("proximo_contato", "is", null).lt("proximo_contato", hoje)),
    contarCadencia((q) => q.eq("proximo_contato", hoje)),
    contarCadencia((q) => q.eq("cadencia_encerrada", true)),
  ]);

  // "Toques até fechar": média de tentativas dos leads ganhos no período.
  const ganhos = leadsAtuais.filter((l) => l.estagio === "ganho");
  const media_tentativas_ate_ganho = razao(
    ganhos.reduce((s, l) => s + Number(l.follow_ups_feitos ?? 0), 0),
    ganhos.length,
  );

  return {
    isAdmin: escopo.isAdmin,
    incompletos: incompletos ?? 0,
    dias: dias ?? 0,
    funil,
    anterior: funilAnterior,
    reunioes: metricasReunioes,
    segmentos,
    situacoes,
    serie: meses,
    ranking,
    follow_ups_atrasados: atrasadosRes.count ?? 0,
    follow_ups_hoje: hojeRes.count ?? 0,
    cadencias_encerradas: encerradasRes.count ?? 0,
    media_tentativas_ate_ganho,
  };
}

export type DashboardComercial = Awaited<ReturnType<typeof dashboardComercialServer>>;
