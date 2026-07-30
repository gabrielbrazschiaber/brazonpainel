import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contexto, nomesDeUsuarios, papeisDeUsuarios } from "@/lib/tarefas.server";
import {
  checarLimiteEnvio,
  contatosDaEquipe,
  criarAtendimento,
  garantirParticipantes,
} from "@/lib/chat.server";

import { PREVIA_TAMANHO, exigirTexto, exigirUuid } from "@/lib/chat-validacao";

export type ConversaTipo = "equipe" | "atendimento";
export type Papel = "admin" | "vendedor" | "cliente";

export interface ConversaResumo {
  id: string;
  tipo: ConversaTipo;
  titulo: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  vendedor_id: string | null;
  ultima_mensagem_em: string;
  ultima_mensagem_previa: string | null;
  nao_lidas: number;
  participantes_nomes: string[];
  arquivada: boolean;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  autor_id: string;
  autor_nome: string;
  autor_papel: Papel | null;
  corpo: string;
  sistema: boolean;
  created_at: string;
  updated_at: string;
  editado: boolean;
}

export interface ContatoEquipe {
  user_id: string;
  nome: string;
  email: string;
  papel: "admin" | "vendedor";
}

/** Lista as conversas visíveis (a RLS decide o escopo) com contagem de não lidas. */
export const listarConversas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tipo?: ConversaTipo; arquivadas?: boolean } | undefined) => ({
    tipo: input?.tipo === "equipe" || input?.tipo === "atendimento" ? input.tipo : undefined,
    arquivadas: input?.arquivadas === true,
  }))
  .handler(async ({ data, context }): Promise<ConversaResumo[]> => {
    let query = context.supabase
      .from("conversas")
      .select("id, tipo, titulo, cliente_id, vendedor_id, ultima_mensagem_em, arquivada")
      .eq("arquivada", data.arquivadas)
      .order("ultima_mensagem_em", { ascending: false })
      .limit(100);
    if (data.tipo) query = query.eq("tipo", data.tipo);

    const { data: linhas, error } = await query;
    if (error) throw new Error(error.message);
    const conversas = linhas ?? [];
    if (conversas.length === 0) return [];

    const ids = conversas.map((c) => c.id);

    // Uma consulta só para participantes e outra para mensagens — nunca em loop.
    const [{ data: parts }, { data: msgs }] = await Promise.all([
      context.supabase
        .from("conversa_participantes")
        .select("conversa_id, user_id, lido_em")
        .in("conversa_id", ids),
      context.supabase
        .from("conversa_mensagens")
        .select("conversa_id, corpo, autor_id, created_at")
        .in("conversa_id", ids)
        .order("created_at", { ascending: true })
        .limit(3000),
    ]);

    const lidoEm = new Map<string, string | null>();
    const participantesPorConversa = new Map<string, string[]>();
    for (const p of parts ?? []) {
      if (p.user_id === context.userId) lidoEm.set(p.conversa_id, p.lido_em);
      const lista = participantesPorConversa.get(p.conversa_id) ?? [];
      lista.push(p.user_id);
      participantesPorConversa.set(p.conversa_id, lista);
    }

    const ultima = new Map<string, { corpo: string; created_at: string }>();
    const naoLidas = new Map<string, number>();
    for (const m of msgs ?? []) {
      ultima.set(m.conversa_id, { corpo: m.corpo, created_at: m.created_at });
      if (m.autor_id === context.userId) continue;
      const lido = lidoEm.get(m.conversa_id);
      const naoLida = !lido || new Date(m.created_at).getTime() > new Date(lido).getTime();
      if (naoLida) naoLidas.set(m.conversa_id, (naoLidas.get(m.conversa_id) ?? 0) + 1);
    }

    // Nome do cliente de cada atendimento (em lote).
    const clienteIds = conversas.map((c) => c.cliente_id).filter((v): v is string => Boolean(v));
    const clienteUser = new Map<string, string>();
    if (clienteIds.length) {
      const { data: cls } = await context.supabase
        .from("clientes")
        .select("id, user_id")
        .in("id", clienteIds);
      for (const cl of cls ?? []) clienteUser.set(cl.id, cl.user_id);
    }

    const nomes = await nomesDeUsuarios([
      ...clienteUser.values(),
      ...(parts ?? []).map((p) => p.user_id),
    ]);

    return conversas.map((c) => {
      const u = ultima.get(c.id);
      const clienteUid = c.cliente_id ? clienteUser.get(c.cliente_id) : null;
      return {
        id: c.id,
        tipo: c.tipo as ConversaTipo,
        titulo: c.titulo,
        cliente_id: c.cliente_id,
        cliente_nome: clienteUid ? (nomes.get(clienteUid) ?? null) : null,
        vendedor_id: c.vendedor_id,
        ultima_mensagem_em: c.ultima_mensagem_em,
        ultima_mensagem_previa: u
          ? u.corpo.slice(0, PREVIA_TAMANHO) + (u.corpo.length > PREVIA_TAMANHO ? "…" : "")
          : null,
        nao_lidas: naoLidas.get(c.id) ?? 0,
        participantes_nomes: (participantesPorConversa.get(c.id) ?? [])
          .map((uid) => nomes.get(uid))
          .filter((n): n is string => Boolean(n)),
        arquivada: c.arquivada,
      };
    });
  });

/** Abre (ou cria) a conversa de atendimento de um cliente. Idempotente. */
export const obterOuCriarAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cliente_id?: string } | undefined) => ({
    cliente_id: typeof input?.cliente_id === "string" ? input.cliente_id : null,
  }))
  .handler(async ({ data, context }): Promise<{ conversa_id: string }> => {
    const { isAdmin, vendedorId } = await contexto(context.supabase, context.userId);

    // Nunca confiamos no cliente_id vindo do navegador quando quem chama é o cliente.
    let clienteQuery = context.supabase.from("clientes").select("id, user_id, vendedor_id");
    if (!isAdmin && !vendedorId) {
      clienteQuery = clienteQuery.eq("user_id", context.userId);
    } else {
      const alvo = exigirUuid(data.cliente_id, "Cliente");
      clienteQuery = clienteQuery.eq("id", alvo);
      if (!isAdmin) clienteQuery = clienteQuery.eq("vendedor_id", vendedorId as string);
    }

    const { data: cliente, error: erroCliente } = await clienteQuery.limit(1).maybeSingle();
    if (erroCliente) throw new Error(erroCliente.message);
    if (!cliente) throw new Error("Cliente não encontrado ou fora do seu acesso.");

    const buscar = async () => {
      const { data: existente } = await context.supabase
        .from("conversas")
        .select("id")
        .eq("cliente_id", cliente.id)
        .eq("tipo", "atendimento")
        .limit(1)
        .maybeSingle();
      return existente?.id ?? null;
    };

    const jaExiste = await buscar();
    if (jaExiste) {
      await garantirParticipantes(context.supabase, context.userId, jaExiste, cliente);
      return { conversa_id: jaExiste };
    }

    const criada = await criarAtendimento(cliente.id, cliente.vendedor_id, context.userId);

    if (!criada.id) {
      // 23505 = corrida com outra chamada simultânea; relê a conversa existente.
      const emCorrida = criada.code === "23505" ? await buscar() : null;
      if (!emCorrida) throw new Error(criada.message ?? "Não foi possível abrir o atendimento.");
      await garantirParticipantes(context.supabase, context.userId, emCorrida, cliente);
      return { conversa_id: emCorrida };
    }


    await garantirParticipantes(context.supabase, context.userId, criada.id, cliente);
    return { conversa_id: criada.id };
  });

/** Cria uma conversa interna de equipe (somente admin/vendedor). */
export const criarConversaEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { titulo: string; participantes: string[] }) => ({
    titulo: exigirTexto(input?.titulo, "O título", 3, 140),
    participantes: Array.isArray(input?.participantes)
      ? input.participantes.filter((p): p is string => typeof p === "string").slice(0, 30)
      : [],
  }))
  .handler(async ({ data, context }): Promise<{ conversa_id: string }> => {
    const { isAdmin, vendedorId } = await contexto(context.supabase, context.userId);
    if (!isAdmin && !vendedorId) {
      throw new Error("Somente administradores e vendedores podem criar conversas de equipe.");
    }

    const convidados = Array.from(new Set(data.participantes)).filter((id) => id !== context.userId);
    if (convidados.length) {
      const papeis = await papeisDeUsuarios(convidados);
      const invalido = convidados.find((id) => {
        const papel = papeis.get(id);
        return papel !== "admin" && papel !== "vendedor";
      });
      if (invalido) {
        throw new Error("Conversas de equipe aceitam apenas administradores e vendedores.");
      }
    }

    const { data: criada, error } = await context.supabase
      .from("conversas")
      .insert({ tipo: "equipe", titulo: data.titulo, criado_por_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: erroPart } = await context.supabase
      .from("conversa_participantes")
      .insert(
        [context.userId, ...convidados].map((user_id) => ({ conversa_id: criada.id, user_id })),
      );
    if (erroPart) throw new Error(erroPart.message);

    return { conversa_id: criada.id };
  });

/** Mensagens de uma conversa, em ordem cronológica. */
export const listarMensagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversa_id: string; antes?: string }) => ({
    conversa_id: exigirUuid(input?.conversa_id, "Conversa"),
    antes: typeof input?.antes === "string" ? input.antes : null,
  }))
  .handler(async ({ data, context }): Promise<Mensagem[]> => {
    let query = context.supabase
      .from("conversa_mensagens")
      .select("id, conversa_id, autor_id, corpo, sistema, created_at, updated_at")
      .eq("conversa_id", data.conversa_id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data.antes) query = query.lt("created_at", data.antes);

    const { data: linhas, error } = await query;
    if (error) throw new Error(error.message);
    const msgs = linhas ?? [];
    if (msgs.length === 0) return [];

    const autores = msgs.map((m) => m.autor_id);
    const [nomes, papeis] = await Promise.all([
      nomesDeUsuarios(autores),
      papeisDeUsuarios(autores),
    ]);

    return msgs.map((m) => ({
      id: m.id,
      conversa_id: m.conversa_id,
      autor_id: m.autor_id,
      autor_nome: nomes.get(m.autor_id) ?? "Usuário",
      autor_papel: papeis.get(m.autor_id) ?? null,
      corpo: m.corpo,
      sistema: m.sistema,
      created_at: m.created_at,
      updated_at: m.updated_at,
      editado: new Date(m.updated_at).getTime() - new Date(m.created_at).getTime() > 1000,
    }));
  });

/** Envia uma mensagem na conversa e devolve já pronta para a tela. */
export const enviarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversa_id: string; corpo: string }) => ({
    conversa_id: exigirUuid(input?.conversa_id, "Conversa"),
    corpo: exigirTexto(input?.corpo, "A mensagem", 1, 4000),
  }))
  .handler(async ({ data, context }): Promise<Mensagem> => {
    await checarLimiteEnvio(context.supabase, context.userId);

    const { data: criada, error } = await context.supabase
      .from("conversa_mensagens")
      .insert({
        conversa_id: data.conversa_id,
        autor_id: context.userId,
        corpo: data.corpo,
        sistema: false,
      })
      .select("id, conversa_id, autor_id, corpo, sistema, created_at, updated_at")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!criada) throw new Error("Você não tem acesso a esta conversa.");

    const [nomes, papeis] = await Promise.all([
      nomesDeUsuarios([criada.autor_id]),
      papeisDeUsuarios([criada.autor_id]),
    ]);

    return {
      ...criada,
      autor_nome: nomes.get(criada.autor_id) ?? "Você",
      autor_papel: papeis.get(criada.autor_id) ?? null,
      editado: false,
    } as Mensagem;
  });

/** Marca a conversa como lida para o usuário atual. */
export const marcarConversaLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversa_id: string }) => ({
    conversa_id: exigirUuid(input?.conversa_id, "Conversa"),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const agora = new Date().toISOString();
    const { data: atualizada, error } = await context.supabase
      .from("conversa_participantes")
      .update({ lido_em: agora })
      .eq("conversa_id", data.conversa_id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!atualizada) {
      // Ex.: admin que ainda não é participante da conversa.
      const { error: erroInsert } = await context.supabase
        .from("conversa_participantes")
        .upsert(
          { conversa_id: data.conversa_id, user_id: context.userId, lido_em: agora },
          { onConflict: "conversa_id,user_id" },
        );
      if (erroInsert) throw new Error(erroInsert.message);
    }
    return { ok: true };
  });

/** Edita uma mensagem própria. */
export const editarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; corpo: string }) => ({
    id: exigirUuid(input?.id, "Mensagem"),
    corpo: exigirTexto(input?.corpo, "A mensagem", 1, 4000),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; updated_at: string }> => {
    const { data: linha, error } = await context.supabase
      .from("conversa_mensagens")
      .update({ corpo: data.corpo })
      .eq("id", data.id)
      .select("id, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!linha) throw new Error("Você só pode editar as suas próprias mensagens.");
    return { ok: true, updated_at: linha.updated_at };
  });

/** Exclui a própria mensagem (ou qualquer uma, se admin). */
export const excluirMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: exigirUuid(input?.id, "Mensagem") }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: linha, error } = await context.supabase
      .from("conversa_mensagens")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!linha) throw new Error("Você não tem permissão para excluir esta mensagem.");
    return { ok: true };
  });

/** Admins e vendedores ativos disponíveis para conversas de equipe. */
export const listarContatosEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContatoEquipe[]> => {
    const { isAdmin, vendedorId } = await contexto(context.supabase, context.userId);
    if (!isAdmin && !vendedorId) throw new Error("Acesso restrito à equipe.");
    return contatosDaEquipe(context.userId);
  });
