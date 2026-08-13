import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";

/** Gera uma senha aleatória e segura de 12 caracteres usando RNG criptográfico. */
function gerarSenhaAleatoria(): string {
  const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("");
}

/**
 * Escopo de atuação do vendedor. Lista vazia = sem restrição na dimensão.
 * Usado pela reserva do banco de leads (`public.pode_ver_banco_lead`).
 */
const escopoVendedorSchema = {
  segmentos: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  estados: z.array(z.string().trim().length(2)).max(27).optional(),
  cnaes: z.array(z.string().trim().regex(/^\d{7}$/)).max(200).optional(),
};

type EscopoEntrada = {
  segmentos?: string[];
  estados?: string[];
  cnaes?: string[];
};

/** Normaliza (trim/upper/dedupe) e valida estados e CNAEs contra os dados reais. */
async function normalizarEscopo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  entrada: EscopoEntrada,
): Promise<{ segmentos: string[]; estados: string[]; cnaes: string[] }> {
  const { opcoesUnicas } = await import("@/lib/escopo");
  const { ESTADOS_BR } = await import("@/lib/banco-leads");

  const segmentos = opcoesUnicas(entrada.segmentos ?? []);
  const estados = opcoesUnicas((entrada.estados ?? []).map((e) => e.toUpperCase()));
  const cnaes = opcoesUnicas(entrada.cnaes ?? []);

  const ufsValidas = new Set<string>(ESTADOS_BR as readonly string[]);
  const ufInvalida = estados.find((e) => !ufsValidas.has(e));
  if (ufInvalida) throw new Error(`Estado inválido no escopo: ${ufInvalida}.`);

  if (cnaes.length > 0) {
    const { data } = await supabaseAdmin
      .from("cnaes")
      .select("codigo")
      .in("codigo", cnaes)
      .eq("ativo", true);
    const existentes = new Set(((data ?? []) as { codigo: string }[]).map((c) => c.codigo));
    const faltando = cnaes.filter((c) => !existentes.has(c));
    if (faltando.length > 0) {
      throw new Error(
        `CNAE não encontrado ou inativo no catálogo: ${faltando.slice(0, 3).join(", ")}.`,
      );
    }
  }

  return { segmentos, estados, cnaes };
}

const novoVendedorSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  codigo_indicacao: z.string().trim().min(2).max(60),
  percentual_comissao: z.number().min(0).max(100),
  senha: z.string().min(6).max(72).optional().or(z.literal("")),
  ...escopoVendedorSchema,
});

// Admin cria um vendedor (com login de acesso).
export const criarVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => novoVendedorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "vendedores.criar");

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

    const escopo = await normalizarEscopo(supabaseAdmin, data);

    const { error: vendErr } = await supabaseAdmin.from("vendedores").insert({
      user_id: newUserId,
      codigo_indicacao: data.codigo_indicacao,
      percentual_comissao: data.percentual_comissao,
      segmentos: escopo.segmentos,
      estados: escopo.estados,
      cnaes: escopo.cnaes,
      ativo: true,
    });
    if (vendErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao cadastrar o vendedor.");
    }

    // Dispara o e-mail de definição de senha para o vendedor
    const { enviarLinkDefinicaoSenha } = await import("./password-reset");
    await enviarLinkDefinicaoSenha(data.email);

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
    await ensurePermission(supabase, userId, "vendedores.criar");

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
    await ensurePermission(supabase, userId, "vendedores.editar");

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
  ...escopoVendedorSchema,
});

// Admin edita um vendedor: nome, e-mail, código, comissão e (opcionalmente) senha.
export const atualizarVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => editarVendedorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "vendedores.editar");

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
    if (authErr)
      throw new Error(authErr.message ?? "Não foi possível atualizar o login do vendedor.");

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome, email: data.email })
      .eq("id", vend.user_id);
    if (profErr) throw new Error("Falha ao atualizar os dados do vendedor.");

    const escopo = await normalizarEscopo(supabaseAdmin, data);

    const { error: vendErr } = await supabaseAdmin
      .from("vendedores")
      .update({
        codigo_indicacao: data.codigo_indicacao,
        percentual_comissao: data.percentual_comissao,
        segmentos: escopo.segmentos,
        estados: escopo.estados,
        cnaes: escopo.cnaes,
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
        segmentos: escopo.segmentos,
        estados: escopo.estados,
        cnaes: escopo.cnaes,
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
    await ensurePermission(supabase, userId, "clientes.editar");

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
    if (authErr)
      throw new Error(authErr.message ?? "Não foi possível atualizar o login do cliente.");

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
    await ensurePermission(supabase, userId, "vendedores.excluir");

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
    await ensurePermission(supabase, userId, "vendedores.excluir");

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
    await ensurePermission(supabase, userId, "clientes.excluir");

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
    await ensurePermission(supabase, userId, "pagamentos.editar_status");

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
    await ensurePermission(supabase, userId, "asaas.sincronizar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("asaas_sync_queue")
      .select(
        "id, cliente_id, tipo, status, tentativas, max_tentativas, proxima_tentativa_em, ultimo_erro, updated_at, clientes(nome)",
      )
      .order("updated_at", { ascending: false })
      .limit(50);

    return { itens: data ?? [] };
  });

/** Força o processamento imediato da fila de sincronização (admin). */
export const processarFilaAsaasAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "asaas.sincronizar");

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
    await ensurePermission(supabase, userId, "asaas.sincronizar");

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
            Date.now() + (transitorio ? calcularBackoffMs(1) : 0),
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

/* ---------------- Leituras e ações sensíveis (fail-closed no servidor) ---------------- */

/** Lista o histórico de auditoria (exige a permissão de leitura de auditoria). */
export const listarAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "auditoria.ler");
    const { data: ehAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (ehAdmin !== true) {
      throw new Error("Acesso negado: a auditoria é restrita a administradores.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("auditoria")
      .select("id,actor_email,actor_role,acao,entidade,entidade_id,detalhes,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    return { registros: data ?? [] };
  });

/** Lista os últimos webhooks recebidos do Asaas (exige gerenciar configurações). */
export const listarWebhookLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "configuracoes.gerenciar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("asaas_webhook_logs")
      .select("id,event,payment_id,status,payload,processing_result,error_message,created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    return { logs: data ?? [] };
  });

const planoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(120),
  valor: z.number().min(0).max(1_000_000),
  descricao: z.string().trim().max(500).nullable().optional(),
  ativo: z.boolean(),
});

/** Cria ou atualiza um plano (exige a permissão de gerenciar planos). */
export const salvarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "planos.gerenciar");

    const payload = {
      nome: data.nome,
      valor: data.valor,
      descricao: data.descricao?.trim() ? data.descricao.trim() : null,
      ativo: data.ativo,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: salvo, error } = data.id
      ? await supabaseAdmin
          .from("planos")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .maybeSingle()
      : await supabaseAdmin.from("planos").insert(payload).select("id").maybeSingle();

    if (error) throw new Error("Não foi possível salvar o plano.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: data.id ? "atualizar_plano" : "criar_plano",
      entidade: "plano",
      entidadeId: salvo?.id ?? data.id ?? null,
      detalhes: payload,
    });

    return { ok: true as const, id: salvo?.id ?? data.id ?? null };
  });

const vendedorAtivoSchema = z.object({
  vendedor_id: z.string().uuid(),
  ativo: z.boolean(),
});

/** Ativa/desativa um vendedor (exige a permissão de editar vendedores). */
export const alternarVendedorAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vendedorAtivoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, "vendedores.editar");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vendedores")
      .update({ ativo: data.ativo })
      .eq("id", data.vendedor_id);

    if (error) throw new Error("Não foi possível atualizar o vendedor.");

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      acao: data.ativo ? "ativar_vendedor" : "desativar_vendedor",
      entidade: "vendedor",
      entidadeId: data.vendedor_id,
    });

    return { ok: true as const };
  });
