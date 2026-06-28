// Server-only helper to record change-audit entries.
// Never import this from route files or *.functions.ts at module scope —
// load it inside server handlers with await import(...).

interface RegistroAuditoria {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown> | null;
}

// Registra uma alteração na tabela de auditoria. Nunca lança erro para não
// quebrar a operação principal — apenas loga falhas no servidor.
export async function registrarAuditoria(registro: RegistroAuditoria): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("auditoria").insert({
      actor_id: registro.actorId ?? null,
      actor_email: registro.actorEmail ?? null,
      actor_role: registro.actorRole ?? null,
      acao: registro.acao,
      entidade: registro.entidade,
      entidade_id: registro.entidadeId ?? null,
      detalhes: (registro.detalhes ?? null) as never,
    });
    if (error) console.error("[auditoria] falha ao registrar:", error.message);
  } catch (e) {
    console.error("[auditoria] erro inesperado:", e);
  }
}
