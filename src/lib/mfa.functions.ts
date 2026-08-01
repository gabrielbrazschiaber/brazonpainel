import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Status do 2FA do próprio usuário + política global aplicável ao papel dele. */
export const obterStatusMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { contarCodigosDisponiveis, lerPoliticaMfa, temFatorVerificado } = await import(
      "@/lib/mfa.server"
    );

    const [{ data: perfil }, { data: papeis }, politica] = await Promise.all([
      supabase.from("profiles").select("telefone").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      lerPoliticaMfa(),
    ]);

    const lista = (papeis ?? []).map((p) => p.role as string);
    const obrigatorio =
      (politica.admin && lista.includes("admin")) ||
      (politica.vendedor && lista.includes("vendedor"));

    const [codigos, ativo] = await Promise.all([
      contarCodigosDisponiveis(userId),
      temFatorVerificado(userId),
    ]);

    return {
      ativo,
      obrigatorio,
      politica,
      codigosDisponiveis: codigos,
      telefone: perfil?.telefone ?? "",
    };
  });

/** Gera (ou regenera) os códigos de recuperação. Só aqui eles aparecem em texto. */
export const gerarCodigosRecuperacaoMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { regravarCodigos } = await import("@/lib/mfa.server");
    const { registrarAuditoria } = await import("@/lib/audit.server");
    const codigos = await regravarCodigos(userId);
    await registrarAuditoria({
      actorId: userId,
      acao: "mfa_codigos_gerados",
      entidade: "usuario",
      entidadeId: userId,
      detalhes: { quantidade: codigos.length },
    });
    return { codigos };
  });

/** Salva o telefone de contato usado pelo suporte para confirmar identidade. */
export const salvarTelefoneContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ telefone: z.string().trim().max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const digitos = data.telefone.replace(/\D/g, "");
    if (digitos && (digitos.length < 10 || digitos.length > 11)) {
      throw new Error("Informe um telefone com DDD (10 ou 11 dígitos).");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ telefone: digitos || null })
      .eq("id", userId);
    if (error) throw new Error("Não foi possível salvar o telefone.");
    return { ok: true };
  });

/**
 * Usa um código de recuperação para recuperar o acesso quando o app
 * autenticador foi perdido. Ao validar, todos os fatores são removidos e o
 * usuário precisa cadastrar o 2FA novamente.
 */
export const usarCodigoRecuperacaoMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ codigo: z.string().trim().min(4) }).parse(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { consumirCodigo, contarCodigosDisponiveis, removerTodosFatores } = await import(
      "@/lib/mfa.server"
    );
    const { registrarAuditoria } = await import("@/lib/audit.server");

    const ok = await consumirCodigo(userId, data.codigo);
    if (!ok) {
      await registrarAuditoria({
        actorId: userId,
        acao: "mfa_codigo_recuperacao_invalido",
        entidade: "usuario",
        entidadeId: userId,
      });
      throw new Error("Código de recuperação inválido ou já utilizado.");
    }

    const removidos = await removerTodosFatores(userId);
    const restantes = await contarCodigosDisponiveis(userId);
    await registrarAuditoria({
      actorId: userId,
      acao: "mfa_recuperado_por_codigo",
      entidade: "usuario",
      entidadeId: userId,
      detalhes: { fatores_removidos: removidos, codigos_restantes: restantes },
    });
    return { ok: true, codigosRestantes: restantes };
  });

/** Admin define para quais papéis o 2FA é obrigatório. */
export const salvarPoliticaMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ admin: z.boolean(), vendedor: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ensurePermission } = await import("@/lib/permissions.guard");
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { contarCodigosDisponiveis, temFatorVerificado } = await import("@/lib/mfa.server");

    // Proteção contra perda total de acesso administrativo: só é possível
    // exigir 2FA dos admins depois que quem está exigindo já tem o próprio
    // 2FA ativo e códigos de recuperação guardados.
    if (data.admin) {
      const [ativo, codigos] = await Promise.all([
        temFatorVerificado(userId),
        contarCodigosDisponiveis(userId),
      ]);
      if (!ativo) {
        throw new Error(
          "Ative a verificação em duas etapas na sua conta antes de exigi-la dos administradores.",
        );
      }
      if (codigos === 0) {
        throw new Error(
          "Gere seus códigos de recuperação antes de exigir a verificação em duas etapas dos administradores.",
        );
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existente } = await supabaseAdmin
      .from("configuracoes")
      .select("id")
      .limit(1)
      .maybeSingle();

    const payload = {
      mfa_obrigatorio_admin: data.admin,
      mfa_obrigatorio_vendedor: data.vendedor,
    };
    const { error } = existente?.id
      ? await supabaseAdmin.from("configuracoes").update(payload).eq("id", existente.id)
      : await supabaseAdmin.from("configuracoes").insert(payload);
    if (error) throw new Error("Não foi possível salvar a política de 2FA.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: "mfa_politica_atualizada",
      entidade: "configuracoes",
      detalhes: payload,
    });
    return { ok: true };
  });

/** Lista, para o admin, quem tem 2FA ativo entre os acessos internos. */
export const listarStatusMfaEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ensurePermission } = await import("@/lib/permissions.guard");
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: papeis } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("role", ["admin", "vendedor"]);

    const ids = Array.from(new Set((papeis ?? []).map((p) => p.user_id)));
    const { data: perfis } = await supabaseAdmin
      .from("profiles")
      .select("id,nome,email,telefone")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const linhas = await Promise.all(
      ids.map(async (id) => {
        const { data: fatores } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: id });
        const { count } = await supabaseAdmin
          .from("mfa_codigos_recuperacao")
          .select("id", { count: "exact", head: true })
          .eq("user_id", id)
          .is("usado_em", null);
        const perfil = perfis?.find((p) => p.id === id);
        return {
          user_id: id,
          nome: perfil?.nome ?? "",
          email: perfil?.email ?? "",
          telefone: perfil?.telefone ?? "",
          papeis: (papeis ?? []).filter((p) => p.user_id === id).map((p) => p.role as string),
          ativo: (fatores?.factors ?? []).some((f) => f.status === "verified"),
          codigosDisponiveis: count ?? 0,
        };
      }),
    );

    return { usuarios: linhas.sort((a, b) => a.nome.localeCompare(b.nome)) };
  });

/**
 * Admin remove o 2FA de um usuário que perdeu o acesso ao app autenticador,
 * depois de confirmar a identidade por telefone. Fica registrado na auditoria.
 */
export const resetarMfaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ user_id: z.string().uuid(), motivo: z.string().trim().min(5).max(300) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ensurePermission } = await import("@/lib/permissions.guard");
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { removerTodosFatores } = await import("@/lib/mfa.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const removidos = await removerTodosFatores(data.user_id);
    await supabaseAdmin.from("mfa_codigos_recuperacao").delete().eq("user_id", data.user_id);

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: "mfa_resetado_pelo_admin",
      entidade: "usuario",
      entidadeId: data.user_id,
      detalhes: { fatores_removidos: removidos, motivo: data.motivo },
    });
    return { ok: true, removidos };
  });
