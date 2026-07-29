import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gera uma senha aleatória e segura de 12 caracteres usando RNG criptográfico. */
function gerarSenhaAleatoria(): string {
  const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("");
}

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

    const senhaDefinidaPeloAdmin = !!(data.senha && data.senha.length >= 6);
    const senhaFinal = senhaDefinidaPeloAdmin ? data.senha! : gerarSenhaAleatoria();

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

    return { ok: true, senha_definida: senhaDefinidaPeloAdmin };
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

const editarVendedorSchema = z.object({
  vendedor_id: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  codigo_indicacao: z.string().trim().min(2).max(60),
  percentual_comissao: z.number().min(0).max(100),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
});

// Admin edita um vendedor: nome, e-mail, código, comissão e (opcionalmente) senha.
export const atualizarVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => editarVendedorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: vend } = await supabaseAdmin
      .from("vendedores")
      .select("id, user_id")
      .eq("id", data.vendedor_id)
      .maybeSingle();
    if (!vend) throw new Error("Vendedor não encontrado.");

    // Garante código de indicação único (exceto o próprio).
    const { data: dup } = await supabaseAdmin
      .from("vendedores")
      .select("id")
      .eq("codigo_indicacao", data.codigo_indicacao)
      .neq("id", data.vendedor_id)
      .maybeSingle();
    if (dup) throw new Error("Já existe um vendedor com esse código de indicação.");

    const authUpdate: { email: string; user_metadata: { nome: string }; password?: string } = {
      email: data.email,
      user_metadata: { nome: data.nome },
    };
    if (data.senha && data.senha.length >= 6) authUpdate.password = data.senha;

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
      vend.user_id,
      authUpdate,
    );
    if (authErr) throw new Error(authErr.message ?? "Não foi possível atualizar o login do vendedor.");

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome, email: data.email })
      .eq("id", vend.user_id);
    if (profErr) throw new Error("Falha ao atualizar os dados do vendedor.");

    const { error: vendErr } = await supabaseAdmin
      .from("vendedores")
      .update({
        codigo_indicacao: data.codigo_indicacao,
        percentual_comissao: data.percentual_comissao,
      })
      .eq("id", data.vendedor_id);
    if (vendErr) throw new Error("Falha ao atualizar o vendedor.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "atualizar_vendedor",
      entidade: "vendedor",
      entidadeId: data.vendedor_id,
      detalhes: {
        codigo_indicacao: data.codigo_indicacao,
        percentual_comissao: data.percentual_comissao,
      },
    });

    return { ok: true };
  });

const editarClienteAdminSchema = z.object({
  cliente_id: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
  cpf_cnpj: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().trim().max(20).optional().nullable(),
  plano_id: z.string().uuid().optional().nullable(),
  servico_extra: z.string().trim().max(200).optional().nullable(),
  servico_extra_valor: z.number().min(0).max(1000000).optional().default(0),
  anotacoes: z.string().trim().max(2000).optional().nullable(),
});


// Admin edita nome, e-mail e (opcionalmente) senha de qualquer cliente.
export const atualizarClienteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => editarClienteAdminSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cli } = await supabaseAdmin
      .from("clientes")
      .select("user_id, plano_id, servico_extra_valor, asaas_subscription_id")
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (!cli) throw new Error("Cliente não encontrado.");

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

    const { error: cliUpdErr } = await supabaseAdmin
      .from("clientes")
      .update({
        cpf_cnpj: data.cpf_cnpj ?? null,
        telefone: data.telefone ?? null,
        plano_id: data.plano_id ?? null,
        servico_extra: data.servico_extra ?? null,
        servico_extra_valor: data.servico_extra_valor ?? 0,
        anotacoes: data.anotacoes ?? null,
      })
      .eq("id", data.cliente_id);
    if (cliUpdErr) throw new Error("Falha ao atualizar os dados do cliente.");

    // Se o plano ou o valor do serviço extra mudou, sincroniza a assinatura no Asaas.
    const mudouCobranca =
      (cli.plano_id ?? null) !== (data.plano_id ?? null) ||
      Number(cli.servico_extra_valor ?? 0) !== Number(data.servico_extra_valor ?? 0);

    let sincronizacaoAsaas: {
      sincronizado: boolean;
      motivo?: string;
      valor?: number;
      enfileirado?: boolean;
    } | null = null;
    if (mudouCobranca && cli.asaas_subscription_id) {
      const { sincronizarAssinaturaCliente } = await import("@/lib/asaas.server");
      sincronizacaoAsaas = await sincronizarAssinaturaCliente(data.cliente_id);
    }


    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "atualizar_cliente",
      entidade: "cliente",
      entidadeId: data.cliente_id,
      detalhes: {
        nome: data.nome,
        email: data.email,
        senha_alterada: !!(data.senha && data.senha.length >= 6),
        plano_id: data.plano_id ?? null,
        servico_extra_valor: data.servico_extra_valor ?? 0,
        asaas_sincronizado: sincronizacaoAsaas?.sincronizado ?? null,
        asaas_motivo: sincronizacaoAsaas?.motivo ?? null,
      },
    });

    return { ok: true, asaas: sincronizacaoAsaas };
  });

/* ---------------- Exclusões ---------------- */

const excluirVendedorSchema = z.object({ vendedor_id: z.string().uuid() });

// Admin exclui um vendedor. Bloqueia se ele tiver clientes vinculados.
export const excluirVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => excluirVendedorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: vend } = await supabaseAdmin
      .from("vendedores")
      .select("id, user_id")
      .eq("id", data.vendedor_id)
      .maybeSingle();
    if (!vend) throw new Error("Vendedor não encontrado.");

    const { count } = await supabaseAdmin
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", data.vendedor_id);
    if ((count ?? 0) > 0) {
      throw new Error(
        `Este vendedor possui ${count} cliente(s) vinculado(s). Exclua ou reatribua os clientes antes de remover o vendedor.`,
      );
    }

    // Deletar o auth.user cascateia vendedores + user_roles.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(vend.user_id);
    if (delErr) throw new Error(delErr.message ?? "Não foi possível excluir o vendedor.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "excluir_vendedor",
      entidade: "vendedor",
      entidadeId: data.vendedor_id,
    });

    return { ok: true };
  });

const excluirAdminSchema = z.object({ user_id: z.string().uuid() });

// Admin exclui outro administrador. Bloqueia auto-exclusão e o último admin.
export const excluirAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => excluirAdminSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    if (data.user_id === userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      throw new Error("Não é possível excluir o último administrador.");
    }

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (delErr) throw new Error(delErr.message ?? "Não foi possível excluir o administrador.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "excluir_admin",
      entidade: "admin",
      entidadeId: data.user_id,
    });

    return { ok: true };
  });

const excluirClienteSchema = z.object({ cliente_id: z.string().uuid() });

// Admin exclui um cliente (remove login, cliente e pagamentos em cascata).
export const excluirCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => excluirClienteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cli } = await supabaseAdmin
      .from("clientes")
      .select("id, user_id")
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (!cli) throw new Error("Cliente não encontrado.");

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(cli.user_id);
    if (delErr) throw new Error(delErr.message ?? "Não foi possível excluir o cliente.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "excluir_cliente",
      entidade: "cliente",
      entidadeId: data.cliente_id,
    });

    return { ok: true };
  });

/* ---------------- Status de pagamento ---------------- */

const statusPagamentoSchema = z.object({
  pagamento_id: z.string().uuid(),
  novo_status: z.enum(["pago", "pendente", "simulacao"]),
});

// Admin altera manualmente o status de um pagamento.
// "simulacao" não entra em somatórios financeiros do painel.
export const atualizarStatusPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => statusPagamentoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pag } = await supabaseAdmin
      .from("pagamentos")
      .select("id, status")
      .eq("id", data.pagamento_id)
      .maybeSingle();
    if (!pag) throw new Error("Pagamento não encontrado.");

    const hoje = new Date().toISOString().slice(0, 10);
    const update = {
      status: data.novo_status,
      data_pagamento: data.novo_status === "pago" ? hoje : null,
    } as const;

    const { error: upErr } = await supabaseAdmin
      .from("pagamentos")
      .update(update)
      .eq("id", data.pagamento_id);
    if (upErr) throw new Error("Não foi possível atualizar o status do pagamento.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "atualizar_status_pagamento",
      entidade: "pagamento",
      entidadeId: data.pagamento_id,
      detalhes: { de: pag.status, para: data.novo_status },
    });

    return { ok: true };
  });

/* ---------------- Fila de sincronização Asaas ---------------- */

/** Lista os itens da fila de sincronização com o Asaas (admin). */
export const listarFilaAsaas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("asaas_sync_queue")
      .select("id, cliente_id, tipo, status, tentativas, max_tentativas, proxima_tentativa_em, ultimo_erro, updated_at, clientes(nome)")
      .order("updated_at", { ascending: false })
      .limit(50);

    return { itens: data ?? [] };
  });

/** Força o processamento imediato da fila de sincronização (admin). */
export const processarFilaAsaasAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Antecipa os agendamentos para que tudo pendente seja processado agora.
    await supabaseAdmin
      .from("asaas_sync_queue")
      .update({ proxima_tentativa_em: new Date().toISOString() })
      .eq("status", "pendente");

    const { processarFilaAsaas } = await import("@/lib/asaas-queue.server");
    const resumo = await processarFilaAsaas(50);
    return { ok: true, ...resumo };
  });

const reprocessarSyncSchema = z.object({ cliente_id: z.string().uuid() });

/**
 * Cria uma nova tentativa na fila e reprocessa imediatamente a sincronização
 * do Asaas para um cliente específico (admin).
 */
export const reprocessarSyncCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reprocessarSyncSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cli } = await supabaseAdmin
      .from("clientes")
      .select("id, asaas_subscription_id")
      .eq("id", data.cliente_id)
      .maybeSingle();

    if (!cli) throw new Error("Cliente não encontrado.");
    if (!cli.asaas_subscription_id) {
      return { ok: false as const, motivo: "sem_assinatura" };
    }

    // Registra/reabre um item na fila para este cliente, pronto para rodar agora.
    const { data: existente } = await supabaseAdmin
      .from("asaas_sync_queue")
      .select("id")
      .eq("cliente_id", data.cliente_id)
      .eq("tipo", "assinatura")
      .in("status", ["pendente", "processando"])
      .maybeSingle();

    const agora = new Date().toISOString();
    if (existente) {
      await supabaseAdmin
        .from("asaas_sync_queue")
        .update({ status: "pendente", proxima_tentativa_em: agora })
        .eq("id", existente.id);
    } else {
      await supabaseAdmin.from("asaas_sync_queue").insert({
        cliente_id: data.cliente_id,
        tipo: "assinatura",
        status: "pendente",
        tentativas: 0,
        proxima_tentativa_em: agora,
        ultimo_erro: "reprocessamento_manual",
      });
    }

    const { sincronizarAssinaturaCliente } = await import("@/lib/asaas.server");
    const resultado = await sincronizarAssinaturaCliente(data.cliente_id, {
      enfileirarSeFalhar: false,
    });

    const { ehFalhaTransitoria, calcularBackoffMs } = await import("@/lib/asaas-queue.server");

    if (resultado.sincronizado) {
      await supabaseAdmin
        .from("asaas_sync_queue")
        .update({ status: "concluido", ultimo_erro: null })
        .eq("cliente_id", data.cliente_id)
        .eq("tipo", "assinatura")
        .in("status", ["pendente", "processando"]);
    } else {
      const transitorio = ehFalhaTransitoria(resultado.motivo);
      await supabaseAdmin
        .from("asaas_sync_queue")
        .update({
          status: transitorio ? "pendente" : "falhou",
          ultimo_erro: resultado.motivo ?? "desconhecido",
          proxima_tentativa_em: new Date(
            Date.now() + (transitorio ? calcularBackoffMs(1) : 0)
          ).toISOString(),
        })
        .eq("cliente_id", data.cliente_id)
        .eq("tipo", "assinatura")
        .in("status", ["pendente", "processando"]);
    }

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "admin",
      acao: "reprocessar_sync_asaas",
      entidade: "cliente",
      entidadeId: data.cliente_id,
      detalhes: { sincronizado: resultado.sincronizado, motivo: resultado.motivo ?? null },
    });

    return {
      ok: resultado.sincronizado,
      motivo: resultado.motivo,
      valor: resultado.valor,
      reagendado: !resultado.sincronizado,
    };
  });
