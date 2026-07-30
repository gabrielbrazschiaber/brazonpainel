import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CATALOGO_SOLICITACOES,
  MOTIVOS_CANCELAMENTO,
  itemPorCategoria,
  rotuloCategoria,
  type CategoriaSolicitacao,
} from "@/lib/solicitacoes";

export type SolicitacaoStatus =
  | "aberta"
  | "em_andamento"
  | "aguardando_cliente"
  | "concluida"
  | "cancelada";

export interface MinhaSolicitacao {
  id: string;
  titulo: string;
  descricao: string | null;
  status: SolicitacaoStatus;
  categoria: string | null;
  categoria_rotulo: string;
  created_at: string;
}

export interface MinhasSolicitacoesResultado {
  itens: MinhaSolicitacao[];
  contadores: {
    pendentes: number;
    andamento: number;
    aguardando: number;
    concluidas: number;
  };
}

interface CriarSolicitacaoInput {
  categoria: CategoriaSolicitacao;
  dados: Record<string, string>;
}

const CATEGORIAS = CATALOGO_SOLICITACOES.map((i) => i.categoria);

/** Cria uma solicitação do cliente, que entra na fila de tarefas da equipe. */
export const criarSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CriarSolicitacaoInput) => {
    const categoria = String(input?.categoria ?? "") as CategoriaSolicitacao;
    if (!CATEGORIAS.includes(categoria)) throw new Error("Tipo de solicitação inválido.");

    const item = itemPorCategoria(categoria)!;
    const entrada = (input?.dados ?? {}) as Record<string, unknown>;
    const dados: Record<string, string> = {};

    for (const campo of item.campos) {
      const bruto = String(entrada[campo.nome] ?? "").trim();

      if (!bruto) {
        if (campo.obrigatorio) throw new Error(`Preencha o campo "${campo.label}".`);
        continue;
      }

      if (campo.tipo === "textarea" && bruto.length > 2000) {
        throw new Error(`O campo "${campo.label}" deve ter no máximo 2000 caracteres.`);
      }
      if (campo.tipo === "texto" && bruto.length > 200) {
        throw new Error(`O campo "${campo.label}" deve ter no máximo 200 caracteres.`);
      }
      if (campo.tipo === "dia_mes") {
        const dia = Number(bruto);
        if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
          throw new Error("Escolha um dia entre 1 e 28.");
        }
      }
      if (campo.tipo === "select_motivo" && !MOTIVOS_CANCELAMENTO.includes(bruto as never)) {
        throw new Error("Escolha um motivo válido.");
      }

      dados[campo.nome] = bruto;
    }

    return { categoria, dados };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const item = itemPorCategoria(data.categoria)!;

    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, vendedor_id, plano_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!cliente) throw new Error("Cadastro de cliente não encontrado.");

    const legiveis: string[] = [];
    let planoDesejadoId: string | null = null;

    for (const campo of item.campos) {
      const valor = data.dados[campo.nome];
      if (!valor) continue;

      if (campo.tipo === "select_plano") {
        const { data: plano } = await supabase
          .from("planos")
          .select("id, nome, ativo")
          .eq("id", valor)
          .maybeSingle();
        if (!plano || !plano.ativo) throw new Error("O plano escolhido não está disponível.");
        planoDesejadoId = plano.id;
        legiveis.push(`${campo.label}: ${plano.nome}`);
        continue;
      }

      legiveis.push(`${campo.label}: ${valor}`);
    }

    const { data: criada, error } = await supabase
      .from("tarefas")
      .insert({
        titulo: item.titulo,
        descricao: legiveis.join("\n") || null,
        status: "aberta",
        prioridade: item.prioridade,
        origem: "solicitacao_cliente",
        categoria: data.categoria,
        dados: data.dados,
        cliente_id: cliente.id,
        cliente_user_id: userId,
        vendedor_id: cliente.vendedor_id,
        responsavel_id: null,
        plano_id: planoDesejadoId,
        criado_por_id: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    if (!criada) throw new Error("Não foi possível registrar a solicitação.");
    return { id: criada.id };
  });

/** Lista as solicitações do cliente logado (RLS garante o escopo). */
export const minhasSolicitacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MinhasSolicitacoesResultado> => {
    const { data, error } = await context.supabase
      .from("tarefas")
      .select("id, titulo, descricao, status, categoria, created_at")
      .eq("cliente_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const itens: MinhaSolicitacao[] = (data ?? []).map((t) => ({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status as SolicitacaoStatus,
      categoria: t.categoria,
      categoria_rotulo: t.categoria ? rotuloCategoria(t.categoria) : t.titulo,
      created_at: t.created_at,
    }));

    return {
      itens,
      contadores: {
        pendentes: itens.filter((i) => i.status === "aberta").length,
        andamento: itens.filter((i) => i.status === "em_andamento").length,
        aguardando: itens.filter((i) => i.status === "aguardando_cliente").length,
        concluidas: itens.filter((i) => i.status === "concluida").length,
      },
    };
  });

/** O cliente desiste de um pedido que ainda não entrou em andamento. */
export const cancelarMinhaSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Solicitação inválida.");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { data: atualizada, error } = await context.supabase
      .from("tarefas")
      .update({ status: "cancelada" })
      .eq("id", data.id)
      .eq("cliente_user_id", context.userId)
      .in("status", ["aberta", "aguardando_cliente"])
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!atualizada) throw new Error("Solicitação não encontrada ou já em andamento.");
    return { ok: true };
  });
