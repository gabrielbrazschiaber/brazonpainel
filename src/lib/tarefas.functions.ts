import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contexto, nomesDeUsuarios } from "@/lib/tarefas.server";

export type TarefaStatus =
  | "aberta"
  | "em_andamento"
  | "aguardando_cliente"
  | "concluida"
  | "cancelada";
export type TarefaPrioridade = "baixa" | "media" | "alta";
export type TarefaOrigem = "plano" | "solicitacao_cliente" | "manual";

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  origem: TarefaOrigem;
  cliente_id: string | null;
  cliente_user_id: string | null;
  vendedor_id: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  concluida_em: string | null;
  created_at: string;
  categoria: string | null;
  dados: Record<string, unknown> | null;
  cliente_nome: string | null;
  responsavel_nome: string | null;
  criado_por_nome: string | null;
  comentarios_count: number;
}

export interface ResponsavelOpcao {
  user_id: string;
  nome: string;
  email: string;
  papel: "admin" | "vendedor";
}

/** Lista as tarefas visíveis para o usuário logado (RLS decide o escopo). */
export const listarTarefas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Tarefa[]> => {
    const { data, error } = await context.supabase
      .from("tarefas")
      .select(
        "id, titulo, descricao, status, prioridade, origem, categoria, dados, cliente_id, cliente_user_id, vendedor_id, responsavel_id, criado_por_id, prazo, concluida_em, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw new Error(error.message);
    const linhas = data ?? [];

    const { data: coments } = await context.supabase
      .from("tarefa_comentarios")
      .select("tarefa_id")
      .in("tarefa_id", linhas.map((t) => t.id));

    const contagem = new Map<string, number>();
    for (const c of coments ?? []) {
      contagem.set(c.tarefa_id, (contagem.get(c.tarefa_id) ?? 0) + 1);
    }

    const nomes = await nomesDeUsuarios(
      linhas.flatMap((t) => [t.cliente_user_id, t.responsavel_id, t.criado_por_id] as string[]),
    );

    return linhas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status as TarefaStatus,
      prioridade: t.prioridade as TarefaPrioridade,
      origem: t.origem as TarefaOrigem,
      cliente_id: t.cliente_id,
      cliente_user_id: t.cliente_user_id,
      vendedor_id: t.vendedor_id,
      responsavel_id: t.responsavel_id,
      prazo: t.prazo,
      concluida_em: t.concluida_em,
      created_at: t.created_at,
      categoria: t.categoria,
      dados: (t.dados as Record<string, unknown> | null) ?? null,
      cliente_nome: t.cliente_user_id ? (nomes.get(t.cliente_user_id) ?? null) : null,
      responsavel_nome: t.responsavel_id ? (nomes.get(t.responsavel_id) ?? null) : null,
      criado_por_nome: t.criado_por_id ? (nomes.get(t.criado_por_id) ?? null) : null,
      comentarios_count: contagem.get(t.id) ?? 0,
    }));
  });

/** Responsáveis possíveis (equipe interna). Somente admin e vendedor. */
export const listarResponsaveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResponsavelOpcao[]> => {
    const { isAdmin, vendedorId } = await contexto(context.supabase, context.userId);
    if (!isAdmin && !vendedorId) throw new Error("Acesso negado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "vendedor"]);

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [];

    const { data: perfis } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids);

    const papelPorUsuario = new Map<string, "admin" | "vendedor">();
    for (const r of roles ?? []) {
      const atual = papelPorUsuario.get(r.user_id);
      if (r.role === "admin" || !atual) papelPorUsuario.set(r.user_id, r.role as "admin" | "vendedor");
    }

    return (perfis ?? [])
      .map((p) => ({
        user_id: p.id,
        nome: (p.nome || "").trim() || p.email,
        email: p.email,
        papel: papelPorUsuario.get(p.id) ?? "vendedor",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

interface NovaTarefaInput {
  titulo: string;
  descricao?: string | null;
  prioridade?: TarefaPrioridade;
  prazo?: string | null;
  cliente_id?: string | null;
  responsavel_id?: string | null;
}

const PRIORIDADES: TarefaPrioridade[] = ["baixa", "media", "alta"];

/** Cria uma tarefa (equipe) ou uma solicitação (cliente). */
export const criarTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NovaTarefaInput) => {
    const titulo = String(input?.titulo ?? "").trim();
    if (titulo.length < 3) throw new Error("Descreva um título com pelo menos 3 caracteres.");
    if (titulo.length > 140) throw new Error("O título deve ter no máximo 140 caracteres.");

    const descricao = String(input?.descricao ?? "").trim().slice(0, 2000) || null;
    const prioridade = PRIORIDADES.includes(input?.prioridade as TarefaPrioridade)
      ? (input.prioridade as TarefaPrioridade)
      : "media";
    const prazo = String(input?.prazo ?? "").trim() || null;
    if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) throw new Error("Prazo inválido.");

    return {
      titulo,
      descricao,
      prioridade,
      prazo,
      cliente_id: String(input?.cliente_id ?? "").trim() || null,
      responsavel_id: String(input?.responsavel_id ?? "").trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, vendedorId } = await contexto(supabase, userId);

    let clienteId = data.cliente_id;
    let clienteUserId: string | null = null;
    let tarefaVendedorId: string | null = vendedorId;
    let origem: TarefaOrigem = "manual";
    let responsavelId = data.responsavel_id;

    if (!isAdmin && !vendedorId) {
      // Cliente: cria uma solicitação, que vai para o vendedor direcionar.
      const { data: cli } = await supabase
        .from("clientes")
        .select("id, vendedor_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!cli) throw new Error("Cadastro de cliente não encontrado.");
      clienteId = cli.id;
      clienteUserId = userId;
      tarefaVendedorId = cli.vendedor_id;
      origem = "solicitacao_cliente";
      responsavelId = null;
    } else if (clienteId) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("id, user_id, vendedor_id")
        .eq("id", clienteId)
        .maybeSingle();

      if (!cli) throw new Error("Cliente não encontrado.");
      clienteUserId = cli.user_id;
      if (!isAdmin) tarefaVendedorId = vendedorId;
      else tarefaVendedorId = cli.vendedor_id;
    }

    const { data: criada, error } = await supabase
      .from("tarefas")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao,
        prioridade: data.prioridade,
        prazo: data.prazo,
        origem,
        cliente_id: clienteId,
        cliente_user_id: clienteUserId,
        vendedor_id: tarefaVendedorId,
        responsavel_id: responsavelId,
        criado_por_id: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: criada.id };
  });

interface AtualizarTarefaInput {
  id: string;
  status?: TarefaStatus;
  prioridade?: TarefaPrioridade;
  responsavel_id?: string | null;
  prazo?: string | null;
}

const STATUS: TarefaStatus[] = [
  "aberta",
  "em_andamento",
  "aguardando_cliente",
  "concluida",
  "cancelada",
];

/** Atualiza status, prioridade, prazo ou responsável (equipe interna). */
export const atualizarTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AtualizarTarefaInput) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Tarefa inválida.");
    if (input?.status && !STATUS.includes(input.status)) throw new Error("Status inválido.");
    if (input?.prioridade && !PRIORIDADES.includes(input.prioridade)) {
      throw new Error("Prioridade inválida.");
    }
    return {
      id,
      status: input?.status,
      prioridade: input?.prioridade,
      responsavel_id: input?.responsavel_id === undefined ? undefined : (input.responsavel_id || null),
      prazo: input?.prazo === undefined ? undefined : (input.prazo || null),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, vendedorId } = await contexto(supabase, userId);
    if (!isAdmin && !vendedorId) throw new Error("Apenas a equipe pode atualizar tarefas.");

    const patch: {
      status?: TarefaStatus;
      concluida_em?: string | null;
      prioridade?: TarefaPrioridade;
      responsavel_id?: string | null;
      prazo?: string | null;
    } = {};
    if (data.status) {
      patch.status = data.status;
      patch.concluida_em = data.status === "concluida" ? new Date().toISOString() : null;
    }
    if (data.prioridade) patch.prioridade = data.prioridade;
    if (data.responsavel_id !== undefined) patch.responsavel_id = data.responsavel_id;
    if (data.prazo !== undefined) patch.prazo = data.prazo;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { data: atualizada, error } = await supabase
      .from("tarefas")
      .update(patch)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!atualizada) {
      throw new Error("Tarefa não encontrada ou você não tem permissão para alterá-la.");
    }
    return { ok: true };
  });
