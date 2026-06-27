import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SENHA_PADRAO_VENDEDOR = "mudar123";

async function ensureAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Apenas administradores podem executar esta ação.");
}

const novoVendedorSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  codigo_indicacao: z.string().trim().min(2).max(60),
  percentual_comissao: z.number().min(0).max(100),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
});

// Admin cria um vendedor (com login de acesso).
export const criarVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => novoVendedorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("vendedores")
      .select("id")
      .eq("codigo_indicacao", data.codigo_indicacao)
      .maybeSingle();
    if (existing) throw new Error("Já existe um vendedor com esse código de indicação.");

    const senhaFinal = data.senha && data.senha.length >= 6 ? data.senha : SENHA_PADRAO_VENDEDOR;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: senhaFinal,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Não foi possível criar o login do vendedor.");
    }

    const newUserId = created.user.id;

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "vendedor" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao definir o perfil do vendedor.");
    }

    const { error: vendErr } = await supabaseAdmin.from("vendedores").insert({
      user_id: newUserId,
      codigo_indicacao: data.codigo_indicacao,
      percentual_comissao: data.percentual_comissao,
      ativo: true,
    });
    if (vendErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao cadastrar o vendedor.");
    }

    return { ok: true, senha: senhaFinal };
  });

const novoAdminSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(6).max(72),
});

// Admin cria outro administrador (com login de acesso).
export const criarAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => novoAdminSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Não foi possível criar o login do administrador.");
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Falha ao definir o perfil do administrador.");
    }

    return { ok: true };
  });

const meuPerfilSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
});

// Admin edita as próprias informações (nome, e-mail e, opcionalmente, senha).
export const atualizarMeuPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => meuPerfilSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authUpdate: { email: string; user_metadata: { nome: string }; password?: string } = {
      email: data.email,
      user_metadata: { nome: data.nome },
    };
    if (data.senha && data.senha.length >= 6) authUpdate.password = data.senha;

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
    if (authErr) throw new Error(authErr.message ?? "Não foi possível atualizar o login.");

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome, email: data.email })
      .eq("id", userId);
    if (profErr) throw new Error("Falha ao atualizar o perfil.");

    return { ok: true };
  });
