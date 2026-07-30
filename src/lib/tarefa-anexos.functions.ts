import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BUCKET_ANEXOS = "tarefa-anexos";
export const TAMANHO_MAX_ANEXO = 10 * 1024 * 1024; // 10 MB

export interface Anexo {
  id: string;
  comentario_id: string;
  nome: string;
  tamanho: number;
  mime: string;
  created_at: string;
}

export const CAMPOS_ANEXO = "id, comentario_id, nome, tamanho, mime, created_at";

function texto(valor: unknown, campo: string, max: number): string {
  const v = String(valor ?? "").trim();
  if (!v) throw new Error(`${campo} inválido.`);
  if (v.length > max) throw new Error(`${campo} muito longo.`);
  return v;
}

/** Registra o arquivo já enviado ao armazenamento como anexo de um comentário. */
export const registrarAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      comentario_id: string;
      tarefa_id: string;
      path: string;
      nome: string;
      tamanho: number;
      mime?: string;
    }) => {
      const tamanho = Number(input?.tamanho ?? 0);
      if (!Number.isFinite(tamanho) || tamanho <= 0) throw new Error("Arquivo vazio.");
      if (tamanho > TAMANHO_MAX_ANEXO) throw new Error("O arquivo deve ter no máximo 10 MB.");
      return {
        comentario_id: texto(input?.comentario_id, "Comentário", 64),
        tarefa_id: texto(input?.tarefa_id, "Tarefa", 64),
        path: texto(input?.path, "Arquivo", 400),
        nome: texto(input?.nome, "Nome do arquivo", 255),
        tamanho,
        mime: String(input?.mime ?? "application/octet-stream").slice(0, 120),
      };
    },
  )
  .handler(async ({ data, context }): Promise<Anexo> => {
    if (!data.path.startsWith(`${data.tarefa_id}/`)) {
      throw new Error("Caminho de arquivo inválido.");
    }

    const { data: criado, error } = await context.supabase
      .from("tarefa_anexos")
      .insert({
        comentario_id: data.comentario_id,
        tarefa_id: data.tarefa_id,
        autor_id: context.userId,
        path: data.path,
        nome: data.nome,
        tamanho: data.tamanho,
        mime: data.mime,
      })
      .select(CAMPOS_ANEXO)
      .single();

    if (error) throw new Error(error.message);
    if (!criado) throw new Error("Não foi possível anexar o arquivo.");
    return criado as Anexo;
  });

/** Gera um link temporário para baixar o anexo, se a RLS permitir vê-lo. */
export const linkAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: texto(input?.id, "Anexo", 64) }))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { data: anexo, error } = await context.supabase
      .from("tarefa_anexos")
      .select("path, nome")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!anexo) throw new Error("Anexo não encontrado ou você não tem acesso a ele.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assinado, error: erroUrl } = await supabaseAdmin.storage
      .from(BUCKET_ANEXOS)
      .createSignedUrl(anexo.path, 60, { download: anexo.nome });

    if (erroUrl || !assinado?.signedUrl) {
      throw new Error("Não foi possível gerar o link do arquivo.");
    }
    return { url: assinado.signedUrl };
  });

/** Exclui um anexo (autor ou admin) e remove o arquivo do armazenamento. */
export const excluirAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: texto(input?.id, "Anexo", 64) }))
  .handler(async ({ data, context }) => {
    const { data: removido, error } = await context.supabase
      .from("tarefa_anexos")
      .delete()
      .eq("id", data.id)
      .select("path")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!removido) {
      throw new Error("Anexo não encontrado ou você não tem permissão para excluí-lo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(BUCKET_ANEXOS).remove([removido.path]);
    return { ok: true };
  });
