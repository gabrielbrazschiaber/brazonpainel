import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SENHA_PADRAO = "mudar123";

const novoClienteSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  plano_id: z.string().uuid().nullable().optional(),
  data_vencimento: z.string().min(10).max(10),
  mensagem_vendedor: z.string().trim().max(500).optional().nullable(),
});

// Vendedor logado cadastra um novo cliente (cria o login de acesso).
export const criarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => novoClienteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isVendedor } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "vendedor",
    });
    if (!isVendedor) throw new Error("Apenas vendedores podem cadastrar clientes.");

    const { data: vend } = await supabase
      .from("vendedores")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vend) throw new Error("Cadastro de vendedor não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: SENHA_PADRAO,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Não foi possível criar o login do cliente.");
    }

    const newUserId = created.user.id;

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "cliente" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao definir o perfil do cliente.");
    }

    const { error: cliErr } = await supabaseAdmin.from("clientes").insert({
      user_id: newUserId,
      vendedor_id: vend.id,
      plano_id: data.plano_id ?? null,
      data_vencimento: data.data_vencimento,
      mensagem_vendedor: data.mensagem_vendedor ?? null,
      status: "ativo",
    });
    if (cliErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao cadastrar o cliente.");
    }

    return { ok: true, senha: SENHA_PADRAO };
  });

const cadastroPublicoSchema = novoClienteSchema
  .omit({ mensagem_vendedor: true })
  .extend({
    ref: z.string().trim().min(1).max(60),
  });

// Cadastro público via link de indicação (/cadastro?ref=CODIGO).
export const cadastroPublico = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cadastroPublicoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: vend } = await supabaseAdmin
      .from("vendedores")
      .select("id, ativo")
      .eq("codigo_indicacao", data.ref)
      .maybeSingle();
    if (!vend || !vend.ativo) {
      throw new Error("Link de indicação inválido ou inativo.");
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: SENHA_PADRAO,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Não foi possível concluir o cadastro.");
    }

    const newUserId = created.user.id;

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "cliente" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao concluir o cadastro.");
    }

    const { error: cliErr } = await supabaseAdmin.from("clientes").insert({
      user_id: newUserId,
      vendedor_id: vend.id,
      plano_id: data.plano_id ?? null,
      data_vencimento: data.data_vencimento,
      status: "ativo",
    });
    if (cliErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao concluir o cadastro.");
    }

    return { ok: true, senha: SENHA_PADRAO };
  });
