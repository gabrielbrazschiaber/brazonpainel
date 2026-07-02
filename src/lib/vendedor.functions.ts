import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gera uma senha aleatória e segura de 12 caracteres. */
function gerarSenhaAleatoria(): string {
  const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!";
  let senha = "";
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    senha += charset[randomIndex];
  }
  return senha;
}

const novoClienteSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  plano_id: z.string().uuid().nullable().optional(),
  data_vencimento: z.string().min(10).max(10),
  mensagem_vendedor: z.string().trim().max(500).optional().nullable(),
  servico_extra: z.string().trim().max(200).optional().nullable(),
  servico_extra_valor: z.number().min(0).max(1000000).optional().nullable(),
  cpf_cnpj: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().trim().max(20).optional().nullable(),
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

    const senhaGerada = gerarSenhaAleatoria();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: senhaGerada,
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

    const { data: novoCliente, error: cliErr } = await supabaseAdmin.from("clientes").insert({
      user_id: newUserId,
      vendedor_id: vend.id,
      plano_id: data.plano_id ?? null,
      data_vencimento: data.data_vencimento,
      mensagem_vendedor: data.mensagem_vendedor ?? null,
      servico_extra: data.servico_extra ?? null,
      servico_extra_valor: data.servico_extra_valor ?? 0,
      cpf_cnpj: data.cpf_cnpj ?? null,
      telefone: data.telefone ?? null,
      status: "ativo",
    }).select("id").maybeSingle();
    if (cliErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao cadastrar o cliente.");
    }

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "vendedor",
      acao: "criar_cliente",
      entidade: "cliente",
      entidadeId: novoCliente?.id ?? null,
      detalhes: { nome: data.nome, email: data.email, plano_id: data.plano_id ?? null, servico_extra: data.servico_extra ?? null, servico_extra_valor: data.servico_extra_valor ?? 0 },
    });

    return { ok: true, senha: senhaGerada };
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

    const senhaGerada = gerarSenhaAleatoria();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: senhaGerada,
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
      cpf_cnpj: data.cpf_cnpj ?? null,
      telefone: data.telefone ?? null,
      status: "ativo",
    });
    if (cliErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao concluir o cadastro.");
    }

    return { ok: true, senha: senhaGerada };
  });

const mensagemSchema = z.object({
  cliente_id: z.string().uuid(),
  mensagem_vendedor: z.string().trim().max(500).nullable(),
});

// Vendedor logado atualiza a mensagem/aviso de um cliente seu, a qualquer momento.
export const atualizarMensagemCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => mensagemSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isVendedor } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "vendedor",
    });
    if (!isVendedor) throw new Error("Apenas vendedores podem enviar mensagens.");

    const { data: vend } = await supabase
      .from("vendedores")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vend) throw new Error("Cadastro de vendedor não encontrado.");

    // Garante que o cliente pertence a este vendedor antes de atualizar.
    const { data: updated, error: updErr } = await supabase
      .from("clientes")
      .update({ mensagem_vendedor: data.mensagem_vendedor })
      .eq("id", data.cliente_id)
      .eq("vendedor_id", vend.id)
      .select("id")
      .maybeSingle();
    if (updErr) throw new Error("Falha ao salvar a mensagem.");
    if (!updated) throw new Error("Cliente não encontrado ou não pertence a você.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "vendedor",
      acao: "atualizar_mensagem",
      entidade: "cliente",
      entidadeId: data.cliente_id,
      detalhes: { mensagem_vendedor: data.mensagem_vendedor },
    });

    return { ok: true };
  });

const editarClienteSchema = z.object({
  cliente_id: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
  plano_id: z.string().uuid().nullable().optional(),
  servico_extra: z.string().trim().max(200).optional().nullable(),
  servico_extra_valor: z.number().min(0).max(1000000).optional().nullable(),
});

// Vendedor logado edita nome, e-mail, senha, plano e serviço extra de um cliente seu.
export const atualizarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => editarClienteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isVendedor } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "vendedor",
    });
    if (!isVendedor) throw new Error("Apenas vendedores podem editar clientes.");

    const { data: vend } = await supabase
      .from("vendedores")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vend) throw new Error("Cadastro de vendedor não encontrado.");

    // Garante que o cliente pertence a este vendedor.
    const { data: cli } = await supabase
      .from("clientes")
      .select("user_id")
      .eq("id", data.cliente_id)
      .eq("vendedor_id", vend.id)
      .maybeSingle();
    if (!cli) throw new Error("Cliente não encontrado ou não pertence a você.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authUpdate: { email: string; user_metadata: { nome: string }; password?: string } = {
      email: data.email,
      user_metadata: { nome: data.nome },
    };
    if (data.senha && data.senha.length >= 6) authUpdate.password = data.senha;

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
      cli.user_id,
      authUpdate,
    );
    if (authErr) throw new Error(authErr.message ?? "Não foi possível atualizar o login do cliente.");

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome, email: data.email })
      .eq("id", cli.user_id);
    if (profErr) throw new Error("Falha ao atualizar os dados do cliente.");

    // Atualiza plano e serviço extra (escopo garantido pelo vendedor).
    const { error: cliUpdErr } = await supabase
      .from("clientes")
      .update({
        plano_id: data.plano_id ?? null,
        servico_extra: data.servico_extra ?? null,
        servico_extra_valor: data.servico_extra_valor ?? 0,
      })
      .eq("id", data.cliente_id)
      .eq("vendedor_id", vend.id);
    if (cliUpdErr) throw new Error("Falha ao atualizar plano/serviço do cliente.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "vendedor",
      acao: "atualizar_cliente",
      entidade: "cliente",
      entidadeId: data.cliente_id,
      detalhes: {
        nome: data.nome,
        email: data.email,
        senha_alterada: !!(data.senha && data.senha.length >= 6),
        plano_id: data.plano_id ?? null,
        servico_extra: data.servico_extra ?? null,
        servico_extra_valor: data.servico_extra_valor ?? 0,
      },
    });

    return { ok: true };
  });

const meuPerfilVendedorSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
});

// Vendedor logado edita seu próprio nome, e-mail e (opcionalmente) senha.
export const atualizarMeuPerfilVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => meuPerfilVendedorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isVendedor } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "vendedor",
    });
    if (!isVendedor) throw new Error("Apenas vendedores podem editar este perfil.");

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
