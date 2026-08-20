/** Follow-ups: priorização, registro, reagendamento e cadência. */
import { escopoComercial, hojeISO, nomesVendedores } from "@/lib/leads-base.server";
import type { Sb, Lead } from "@/lib/leads-base.server";
import { ESTAGIOS_SEM_FOLLOW_UP } from "@/lib/leads";
import type { LeadEstagio, LeadOrigem } from "@/lib/leads";
import type { z } from "zod";
import type {
  followUpsSchema,
  reagendarFollowUpSchema,
  registrarFollowUpSchema,
  reativarCadenciaSchema,
} from "@/lib/leads.schemas";

/* ------------------------------------------------------------------ *
 * Follow-ups: atrasados, de hoje e próximos, priorizados
 * ------------------------------------------------------------------ */

export interface FollowUp {
  id: string;
  nome_contato: string;
  empresa: string | null;
  telefone: string;
  email: string | null;
  segmento: string | null;
  origem: LeadOrigem;
  estagio: LeadEstagio;
  valor_estimado: number;
  proximo_contato: string;
  observacoes: string | null;
  vendedor_id: string;
  vendedor_nome?: string | null;
  /** Dias de atraso (0 = follow-up é hoje; negativo = ainda vai vencer). */
  atraso: number;
  /** Pontuação de prioridade (maior = mais urgente). */
  prioridade: number;
  /** Tentativas SEM resposta já registradas. */
  follow_ups_feitos: number;
  ultimo_contato_em: string | null;
  cadencia_encerrada: boolean;
}

export interface PainelFollowUps {
  isAdmin: boolean;
  hojeISO: string;
  atrasados: FollowUp[];
  hoje: FollowUp[];
  /** Follow-ups agendados entre amanhã e +7 dias. */
  proximos: FollowUp[];
  totalAtrasados: number;
  totalHoje: number;
  totalProximos: number;
  /** Leads com cadência encerrada e estágio ainda aberto. */
  totalEncerrados: number;
}

/** Peso do estágio na priorização: quanto mais perto do fechamento, mais urgente. */
const PESO_ESTAGIO: Record<string, number> = {
  em_negociacao: 40,
  interessado: 25,
  contatado: 10,
  nao_interessado: 2,
};

function diasEntre(deISO: string, ateISO: string): number {
  const a = new Date(`${deISO}T00:00:00`).getTime();
  const b = new Date(`${ateISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Soma dias a uma data ISO (AAAA-MM-DD) sem depender de fuso. */
function somarDias(baseISO: string, dias: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Prioridade = atraso + estágio + valor estimado (com teto), tudo em pontos. */
function pontuar(atraso: number, estagio: LeadEstagio, valor: number): number {
  const pAtraso = Math.min(atraso, 30) * 4;
  const pEstagio = PESO_ESTAGIO[estagio] ?? 0;
  const pValor = Math.min(valor / 100, 30);
  return Math.round(pAtraso + pEstagio + pValor);
}

const CAMPOS_FOLLOW_UP =
  "id, vendedor_id, nome_contato, empresa, telefone, email, segmento, origem, estagio, valor_estimado, observacoes, proximo_contato, follow_ups_feitos, ultimo_contato_em, cadencia_encerrada";

const SEM_FOLLOW_UP_SQL = `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`;

function mapearFollowUp(
  l: Record<string, unknown>,
  hoje: string,
  nomes: Map<string, string>,
): FollowUp {
  const proximo = String(l.proximo_contato);
  const atraso = diasEntre(proximo, hoje);
  const valor = Number(l.valor_estimado ?? 0);
  return {
    id: String(l.id),
    nome_contato: String(l.nome_contato),
    empresa: (l.empresa as string | null) ?? null,
    telefone: String(l.telefone ?? ""),
    email: (l.email as string | null) ?? null,
    segmento: (l.segmento as string | null) ?? null,
    origem: l.origem as LeadOrigem,
    estagio: l.estagio as LeadEstagio,
    valor_estimado: valor,
    proximo_contato: proximo,
    observacoes: (l.observacoes as string | null) ?? null,
    vendedor_id: String(l.vendedor_id),
    vendedor_nome: nomes.get(String(l.vendedor_id)) ?? null,
    atraso,
    prioridade: pontuar(Math.max(0, atraso), l.estagio as LeadEstagio, valor),
    follow_ups_feitos: Number(l.follow_ups_feitos ?? 0),
    ultimo_contato_em: (l.ultimo_contato_em as string | null) ?? null,
    cadencia_encerrada: Boolean(l.cadencia_encerrada),
  };
}

export async function followUpsServer(
  supabase: Sb,
  userId: string,
  filtros: z.infer<typeof followUpsSchema>,
): Promise<PainelFollowUps> {
  const escopo = await escopoComercial(supabase, userId);
  const hoje = hojeISO();
  const limite = filtros.limite ?? 50;
  const fim = somarDias(hoje, 7);

  let query = supabase
    .from("leads")
    .select(CAMPOS_FOLLOW_UP)
    .not("proximo_contato", "is", null)
    .lte("proximo_contato", fim)
    .not("estagio", "in", SEM_FOLLOW_UP_SQL)
    .order("proximo_contato", { ascending: true })
    .limit(400);

  let queryEncerrados = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("cadencia_encerrada", true)
    .not("estagio", "in", SEM_FOLLOW_UP_SQL);

  // Vendedor: a RLS já restringe aos leads dele; o filtro é só para o admin.
  if (escopo.isAdmin && filtros.vendedor_id) {
    query = query.eq("vendedor_id", filtros.vendedor_id);
    queryEncerrados = queryEncerrados.eq("vendedor_id", filtros.vendedor_id);
  }

  const [{ data, error }, { count: encerrados }] = await Promise.all([query, queryEncerrados]);
  if (error) throw new Error(error.message);

  const nomes = escopo.isAdmin
    ? await nomesVendedores((data ?? []).map((l: { vendedor_id: string }) => l.vendedor_id))
    : new Map<string, string>();

  const itens: FollowUp[] = (data ?? []).map((l: Record<string, unknown>) =>
    mapearFollowUp(l, hoje, nomes),
  );

  const ordenar = (a: FollowUp, b: FollowUp) =>
    b.prioridade - a.prioridade || b.valor_estimado - a.valor_estimado;
  const porData = (a: FollowUp, b: FollowUp) =>
    a.proximo_contato.localeCompare(b.proximo_contato) || ordenar(a, b);

  const atrasados = itens.filter((i) => i.atraso > 0).sort(ordenar);
  const deHoje = itens.filter((i) => i.atraso === 0).sort(ordenar);
  const proximos = itens.filter((i) => i.atraso < 0).sort(porData);

  return {
    isAdmin: escopo.isAdmin,
    hojeISO: hoje,
    atrasados: atrasados.slice(0, limite),
    hoje: deHoje.slice(0, limite),
    proximos: proximos.slice(0, limite),
    totalAtrasados: atrasados.length,
    totalHoje: deHoje.length,
    totalProximos: proximos.length,
    totalEncerrados: encerrados ?? 0,
  };
}

/** Reagenda o próximo contato do lead (RLS garante o escopo). */
export async function reagendarFollowUpServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof reagendarFollowUpSchema>,
) {
  await escopoComercial(supabase, userId);
  const { data, error } = await supabase
    .from("leads")
    .update({ proximo_contato: dados.proximo_contato, cadencia_encerrada: false })
    .eq("id", dados.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");
  return { id: data.id as string };
}

/** Pergunta a data seguinte à régua do banco (fonte única da cadência). */
async function proximaData(
  supabase: Sb,
  estagio: LeadEstagio,
  tentativas: number,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("lead_proximo_follow_up", {
    _estagio: estagio,
    _tentativas: tentativas,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

const RESULTADO_LABEL: Record<string, string> = {
  mensagem_enviada: "Mensagem enviada",
  respondeu: "Respondeu",
  nao_respondeu: "Não respondeu",
  sem_whatsapp: "Sem WhatsApp",
  lead_inexistente: "Lead inexistente",
  adiar: "Adiado",
  reativar: "Reativado",
};

/**
 * Registra o resultado de um toque de follow-up.
 * A régua de datas vive no banco: aqui só decidimos tentativas e adiamentos.
 */
export async function registrarFollowUpServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof registrarFollowUpSchema>,
) {
  await escopoComercial(supabase, userId);

  const { data: lead, error: erroLead } = await supabase
    .from("leads")
    .select("id, estagio, follow_ups_feitos, situacao_contato")
    .eq("id", dados.lead_id)
    .maybeSingle();
  if (erroLead) throw new Error(erroLead.message);
  if (!lead) throw new Error("Lead não encontrado ou você não tem permissão.");

  const patch: Record<string, unknown> = { ultimo_contato_em: new Date().toISOString() };
  let detalhe = "";

  if (dados.resultado === "respondeu") {
    if (!dados.novo_estagio) throw new Error("Informe o novo estágio do lead.");
    patch.estagio = dados.novo_estagio;
    patch.situacao_contato = "respondeu";
    patch.aguardando_resposta_ate = null;
    detalhe = `novo estágio: ${dados.novo_estagio}`;
  } else if (dados.resultado === "mensagem_enviada") {
    const prazo = dados.prazo_dias ?? 2;
    patch.situacao_contato = "mensagem_enviada";
    patch.mensagem_enviada_em = new Date().toISOString();
    patch.aguardando_resposta_ate = somarDias(hojeISO(), prazo);
    patch.cadencia_encerrada = false;
    
    // Se for mensagem 1, gasta uma tentativa de follow-up se desejar
    // ou apenas marca como enviado. O requisito pede "marcar que já foi enviado a mensagem 1"
    // e "proximo contato sabe que precisa enviar a mensagem 2".
    // Vamos registrar o ID da mensagem se fornecido.
    if (dados.mensagem_id) {
      const { data: l } = await supabase.from("leads").select("mensagens_enviadas").eq("id", dados.lead_id).single();
      const ids = Array.isArray(l?.mensagens_enviadas) ? l.mensagens_enviadas : [];
      if (!ids.includes(dados.mensagem_id)) {
        patch.mensagens_enviadas = [...ids, dados.mensagem_id];
      }
    }
    
    detalhe = `Mensagem enviada (prazo de ${prazo} dias para resposta)`;
  } else if (dados.resultado === "nao_respondeu") {
    // Gastou uma tentativa da cadência
    const tentativas = Number(lead.follow_ups_feitos ?? 0) + 1;
    const proxima = await proximaData(supabase, lead.estagio as LeadEstagio, tentativas);
    
    patch.situacao_contato = "nao_respondeu";
    patch.follow_ups_feitos = tentativas;
    patch.proximo_contato = proxima;
    patch.cadencia_encerrada = proxima === null;
    patch.aguardando_resposta_ate = null;
    
    detalhe = proxima
      ? `${tentativas}ª tentativa s/ resp. · próximo contato ${proxima}`
      : `${tentativas}ª tentativa s/ resp. · cadência encerrada`;
  } else if (dados.resultado === "sem_whatsapp" || dados.resultado === "lead_inexistente") {
    patch.situacao_contato = dados.resultado;
    patch.estagio = "perdido";
    patch.motivo_descarte = dados.motivo ?? RESULTADO_LABEL[dados.resultado];
    patch.motivo_perda = patch.motivo_descarte as string;
    patch.proximo_contato = null;
    patch.cadencia_encerrada = true;
    patch.aguardando_resposta_ate = null;
    detalhe = `Lead descartado: ${patch.motivo_descarte}`;
  } else if (dados.resultado === "reativar") {
    const proxima = await proximaData(supabase, lead.estagio as LeadEstagio, 0);
    patch.situacao_contato = "nao_contatado";
    patch.follow_ups_feitos = 0;
    patch.cadencia_encerrada = false;
    patch.proximo_contato = proxima;
    patch.aguardando_resposta_ate = null;
    detalhe = `Cadência reiniciada · próximo contato ${proxima ?? "—"}`;
  } else if (dados.resultado === "adiar") {
    if (!dados.adiar_dias) throw new Error("Informe em quantos dias adiar.");
    patch.proximo_contato = somarDias(hojeISO(), dados.adiar_dias);
    patch.cadencia_encerrada = false;
    patch.aguardando_resposta_ate = null;
    detalhe = `adiado ${dados.adiar_dias} dia(s)`;
  }

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", dados.lead_id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");

  await supabase.from("lead_atividades").insert({
    lead_id: dados.lead_id,
    autor_id: userId,
    tipo: "contato",
    para: dados.resultado,
    corpo: [`${RESULTADO_LABEL[dados.resultado]} — ${detalhe}`, dados.nota ?? ""]
      .filter(Boolean)
      .join("\n"),
  });

  return { id: data.id as string };
}

/** Traz de volta um lead com a cadência encerrada, zerando as tentativas. */
export async function reativarCadenciaServer(
  supabase: Sb,
  userId: string,
  dados: z.infer<typeof reativarCadenciaSchema>,
) {
  await escopoComercial(supabase, userId);

  const { data: lead, error: erroLead } = await supabase
    .from("leads")
    .select("id, estagio")
    .eq("id", dados.lead_id)
    .maybeSingle();
  if (erroLead) throw new Error(erroLead.message);
  if (!lead) throw new Error("Lead não encontrado ou você não tem permissão.");
  if (ESTAGIOS_SEM_FOLLOW_UP.includes(lead.estagio as LeadEstagio)) {
    throw new Error("Leads ganhos ou perdidos não recebem follow-up.");
  }

  const proxima = await proximaData(supabase, lead.estagio as LeadEstagio, 0);
  const { data, error } = await supabase
    .from("leads")
    .update({
      follow_ups_feitos: 0,
      cadencia_encerrada: false,
      proximo_contato: proxima,
      ultimo_contato_em: new Date().toISOString(),
    })
    .eq("id", dados.lead_id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado ou você não tem permissão.");

  await supabase.from("lead_atividades").insert({
    lead_id: dados.lead_id,
    autor_id: userId,
    tipo: "contato",
    para: "reativado",
    corpo: `Cadência reativada · próximo contato ${proxima ?? "—"}`,
  });

  return { id: data.id as string };
}

/** Contador leve para o badge da sidebar: atrasados + de hoje. */
export async function contarFollowUpsServer(supabase: Sb, userId: string) {
  const escopo = await escopoComercial(supabase, userId).catch(() => null);
  if (!escopo) return { atrasados: 0, hoje: 0, total: 0 };
  const hoje = hojeISO();
  const semFollowUp = `(${ESTAGIOS_SEM_FOLLOW_UP.join(",")})`;
  const contar = (aplicar: (q: unknown) => unknown) => {
    const q = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("estagio", "in", semFollowUp);
    return aplicar(q) as Promise<{ count: number | null }>;
  };
  const [atrasados, deHoje] = await Promise.all([
    contar((q) => (q as Sb).not("proximo_contato", "is", null).lt("proximo_contato", hoje)),
    contar((q) => (q as Sb).eq("proximo_contato", hoje)),
  ]);
  const a = atrasados.count ?? 0;
  const h = deHoje.count ?? 0;
  return { atrasados: a, hoje: h, total: a + h };
}
