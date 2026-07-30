import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { contexto, nomesDeUsuarios, papeisDeUsuarios } from "@/lib/tarefas.server";
import { CAMPOS_ANEXO, type Anexo } from "@/lib/tarefa-anexos.functions";

export interface Comentario {
  id: string;
  tarefa_id: string;
  autor_id: string;
  autor_nome: string | null;
  autor_papel: "admin" | "vendedor" | "cliente" | null;
  corpo: string;
  interno: boolean;
  created_at: string;
  updated_at: string;
  editado: boolean;
  anexos: Anexo[];
}

function validarCorpo(valor: unknown): string {
  const corpo = String(valor ?? "").trim();
  if (corpo.length < 1) throw new Error("Escreva uma mensagem antes de enviar.");
  if (corpo.length > 4000) throw new Error("A mensagem deve ter no máximo 4000 caracteres.");
  return corpo;
}

interface LinhaComentario {
  id: string;
  tarefa_id: string;
  autor_id: string;
  corpo: string;
  interno: boolean;
  created_at: string;
  updated_at: string;
}

type ClienteSupabase = SupabaseClient<Database>;

async function decorar(
  supabase: ClienteSupabase,
  linhas: LinhaComentario[],
): Promise<Comentario[]> {
  const ids = linhas.map((c) => c.autor_id);
  const [nomes, papeis] = await Promise.all([nomesDeUsuarios(ids), papeisDeUsuarios(ids)]);

  const porComentario = new Map<string, Anexo[]>();
  if (linhas.length > 0) {
    const { data: anexos } = await supabase
      .from("tarefa_anexos")
      .select(CAMPOS_ANEXO)
      .in(
        "comentario_id",
        linhas.map((c) => c.id),
      )
      .order("created_at", { ascending: true });

    for (const a of (anexos ?? []) as Anexo[]) {
      const lista = porComentario.get(a.comentario_id) ?? [];
      lista.push(a);
      porComentario.set(a.comentario_id, lista);
    }
  }

  return linhas.map((c) => ({
    id: c.id,
    tarefa_id: c.tarefa_id,
    autor_id: c.autor_id,
    autor_nome: nomes.get(c.autor_id) ?? null,
    autor_papel: papeis.get(c.autor_id) ?? null,
    corpo: c.corpo,
    interno: c.interno,
    created_at: c.created_at,
    updated_at: c.updated_at,
    editado: new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 1000,
    anexos: porComentario.get(c.id) ?? [],
  }));
}

const CAMPOS = "id, tarefa_id, autor_id, corpo, interno, created_at, updated_at";

/** Lista os comentários de uma tarefa. A RLS decide o que o usuário vê. */
export const listarComentarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tarefa_id: string }) => {
    const tarefa_id = String(input?.tarefa_id ?? "").trim();
    if (!tarefa_id) throw new Error("Tarefa inválida.");
    return { tarefa_id };
  })
  .handler(async ({ data, context }): Promise<Comentario[]> => {
    const { data: linhas, error } = await context.supabase
      .from("tarefa_comentarios")
      .select(CAMPOS)
      .eq("tarefa_id", data.tarefa_id)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) throw new Error(error.message);
    return decorar(context.supabase, (linhas ?? []) as LinhaComentario[]);
  });

/** Cria um comentário. Cliente nunca cria nota interna. */
export const criarComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tarefa_id: string; corpo: string; interno?: boolean }) => {
    const tarefa_id = String(input?.tarefa_id ?? "").trim();
    if (!tarefa_id) throw new Error("Tarefa inválida.");
    return { tarefa_id, corpo: validarCorpo(input?.corpo), interno: input?.interno === true };
  })
  .handler(async ({ data, context }): Promise<Comentario> => {
    const { supabase, userId } = context;
    const { isAdmin, vendedorId } = await contexto(supabase, userId);
    const equipe = isAdmin || !!vendedorId;

    const { data: criado, error } = await supabase
      .from("tarefa_comentarios")
      .insert({
        tarefa_id: data.tarefa_id,
        autor_id: userId,
        corpo: data.corpo,
        interno: equipe ? data.interno : false,
      })
      .select(CAMPOS)
      .single();

    if (error) throw new Error(error.message);
    if (!criado) throw new Error("Não foi possível comentar nesta tarefa.");

    const [comentario] = await decorar(supabase, [criado as LinhaComentario]);
    return comentario;
  });

/** Edita o próprio comentário (a RLS restringe ao autor). */
export const atualizarComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; corpo: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Comentário inválido.");
    return { id, corpo: validarCorpo(input?.corpo) };
  })
  .handler(async ({ data, context }) => {
    const { data: atualizado, error } = await context.supabase
      .from("tarefa_comentarios")
      .update({ corpo: data.corpo })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!atualizado) {
      throw new Error("Comentário não encontrado ou você não tem permissão para editá-lo.");
    }
    return { ok: true };
  });

/** Exclui o próprio comentário; admin pode excluir qualquer um. */
export const excluirComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Comentário inválido.");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { data: removido, error } = await context.supabase
      .from("tarefa_comentarios")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!removido) {
      throw new Error("Comentário não encontrado ou você não tem permissão para excluí-lo.");
    }
    return { ok: true };
  });
