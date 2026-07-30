import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "@/lib/permissions.guard";
import { TERMOS_TEXTO, TERMOS_VERSAO } from "@/lib/termos";


/** Gera uma senha aleatória e segura de 12 caracteres usando RNG criptográfico. */
function gerarSenhaAleatoria(): string {
  const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("");
}

const novoClienteSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  // Plano é obrigatório: sem ele não há mensalidade nem cobrança recorrente.
  plano_id: z.string().uuid("Selecione um plano válido."),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vencimento inválida."),
  mensagem_vendedor: z.string().trim().max(500).optional().nullable(),
  anotacoes: z.string().trim().max(1000).optional().nullable(),
  servico_extra: z.string().trim().max(200).optional().nullable(),
  servico_extra_valor: z.number().min(0).max(1000000).optional().nullable(),
  // CPF/CNPJ é obrigatório para gerar cobranças na plataforma de pagamento.
  cpf_cnpj: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11 || v.length === 14, "Informe um CPF (11) ou CNPJ (14 dígitos)."),
  telefone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 10 || v.length === 11, "Telefone inválido.")
    .optional()
    .nullable(),
  cupom: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Código de cupom inválido.")
    .optional()
    .nullable()
    .or(z.literal("")),
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
    await ensurePermission(supabase, userId, "clientes.criar");

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

    // Cupom aplicado pelo vendedor: validado no servidor. Um código inválido
    // não impede o cadastro — o cliente nasce sem desconto e o vendedor é avisado.
    let cupomPendenteId: string | null = null;
    let cupomAviso: string | null = null;
    let cupomCodigo: string | null = null;
    if (data.cupom) {
      const { buscarCupomAtivo, MENSAGENS_CUPOM } = await import("./cupons.server");
      const res = await buscarCupomAtivo(data.cupom);
      if ("motivo" in res) {
        cupomAviso = MENSAGENS_CUPOM[res.motivo];
      } else {
        cupomPendenteId = res.cupom.id;
        cupomCodigo = res.cupom.codigo;
      }
    }

    const { data: novoCliente, error: cliErr } = await supabaseAdmin.from("clientes").insert({
      user_id: newUserId,
      vendedor_id: vend.id,
      plano_id: data.plano_id ?? null,
      data_vencimento: data.data_vencimento,
      mensagem_vendedor: data.mensagem_vendedor ?? null,
      anotacoes: data.anotacoes ?? null,
      servico_extra: data.servico_extra ?? null,
      servico_extra_valor: data.servico_extra_valor ?? 0,
      cpf_cnpj: data.cpf_cnpj ?? null,
      telefone: data.telefone ?? null,
      cupom_pendente_id: cupomPendenteId,
      status: "ativo",
    }).select("id").maybeSingle();
    if (cliErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao cadastrar o cliente.");
    }

    // Garante o perfil antes de integrar com a plataforma de pagamento.
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, email: data.email, nome: data.nome }, { onConflict: "id" });

    // Integração: cria o customer na plataforma de pagamento já no cadastro.
    // Se a API falhar, o provisionamento é enfileirado com novas tentativas
    // automáticas — o cadastro nunca é bloqueado por indisponibilidade externa.
    let integracao: { provisionado: boolean; motivo?: string } = { provisionado: false };
    if (novoCliente?.id) {
      try {
        const { provisionarClienteAsaas } = await import("./asaas.server");
        integracao = await provisionarClienteAsaas(novoCliente.id);
      } catch {
        integracao = { provisionado: false, motivo: "erro_integracao" };
      }
    }

    const { registrarAuditoria } = await import("@/lib/audit.server");
    await registrarAuditoria({
      actorId: userId,
      actorRole: "vendedor",
      acao: "criar_cliente",
      entidade: "cliente",
      entidadeId: novoCliente?.id ?? null,
      detalhes: {
        nome: data.nome,
        email: data.email,
        plano_id: data.plano_id,
        servico_extra: data.servico_extra ?? null,
        servico_extra_valor: data.servico_extra_valor ?? 0,
        asaas_provisionado: integracao.provisionado,
        cupom: cupomCodigo,
        cupom_invalido: cupomAviso ? (data.cupom ?? null) : null,
      },
    });

    return { ok: true, integracao, cupom_aplicado: cupomCodigo, cupom_invalido: cupomAviso };
  });


const cadastroPublicoSchema = novoClienteSchema
  .omit({ mensagem_vendedor: true, anotacoes: true, data_vencimento: true })
  .extend({
    // Indicação é opcional: o cliente pode se cadastrar e comprar sozinho.
    ref: z.string().trim().max(60).optional().nullable(),
    cupom: z.string().trim().max(40).optional().nullable(),
    // Aceite obrigatório do Termo de Uso — o texto registrado vem do servidor.
    aceite_termos: z.literal(true),
    termos_versao: z.string().trim().min(1).max(40),
  });


/** Vencimento inicial do cadastro público: sempre calculado no servidor (30 dias). */
function vencimentoPadrao(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// Cadastro público (/cadastro, com ou sem ?ref=CODIGO).
// Endpoint sem autenticação: tudo que é sensível é decidido no servidor e a
// conta nasce SEM e-mail confirmado — a posse do e-mail é provada quando o
// usuário abre o link de definição de senha.
export const cadastroPublico = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cadastroPublicoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Indicação opcional: quando informada, precisa ser válida e ativa.
    let vendedorId: string | null = null;
    if (data.ref) {
      const { data: vend } = await supabaseAdmin
        .from("vendedores")
        .select("id, ativo")
        .eq("codigo_indicacao", data.ref)
        .maybeSingle();
      if (!vend || !vend.ativo) {
        throw new Error("Link de indicação inválido ou inativo.");
      }
      vendedorId = vend.id;
    }

    // O plano precisa existir e estar ativo — nunca confiar no id enviado.
    let planoId: string | null = null;
    if (data.plano_id) {
      const { data: plano } = await supabaseAdmin
        .from("planos")
        .select("id, ativo")
        .eq("id", data.plano_id)
        .maybeSingle();
      if (!plano || !plano.ativo) {
        throw new Error("Plano inválido ou indisponível.");
      }
      planoId = plano.id;
    }

    // Cupom (opcional): validado no servidor e apenas RESERVADO no cadastro.
    // O consumo real acontece quando a primeira cobrança é gerada.
    let cupomPendenteId: string | null = null;
    let cupomInfo: { codigo: string; valor_desconto: number } | null = null;
    if (data.cupom) {
      const { buscarCupomAtivo, MENSAGENS_CUPOM } = await import("./cupons.server");
      const res = await buscarCupomAtivo(data.cupom);
      if ("motivo" in res) {
        throw new Error(MENSAGENS_CUPOM[res.motivo]);
      }
      cupomPendenteId = res.cupom.id;
      cupomInfo = { codigo: res.cupom.codigo, valor_desconto: res.cupom.valor_desconto };
    }

    const email = data.email.trim().toLowerCase();
    const senhaGerada = gerarSenhaAleatoria();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senhaGerada,
      // Sem confirmação automática: quem não é dono do e-mail não ativa a conta.
      email_confirm: false,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      console.error("[cadastroPublico] Falha ao criar usuário:", createErr?.message);
      const msg = (createErr?.message ?? "").toLowerCase();
      if (msg.includes("already been registered") || msg.includes("already registered") || msg.includes("email_exists")) {
        throw new Error(
          "Este e-mail já possui uma conta. Faça login ou use \"Esqueci minha senha\" para acessar.",
        );
      }
      throw new Error("Não foi possível concluir o cadastro. Verifique os dados e tente novamente.");
    }


    const newUserId = created.user.id;

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "cliente" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao concluir o cadastro.");
    }

    const { data: clienteCriado, error: cliErr } = await supabaseAdmin
      .from("clientes")
      .insert({
        user_id: newUserId,
        vendedor_id: vendedorId,
        plano_id: planoId,
        data_vencimento: vencimentoPadrao(),
        cpf_cnpj: data.cpf_cnpj ?? null,
        telefone: data.telefone ?? null,
        cupom_pendente_id: cupomPendenteId,
        via_link: vendedorId !== null,
        status: "ativo",
      })
      .select("id")
      .single();
    if (cliErr || !clienteCriado) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Falha ao concluir o cadastro.");
    }

    // Garante o perfil (nome/e-mail) antes de provisionar na plataforma de pagamento.
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, email, nome: data.nome }, { onConflict: "id" });

    // Cria o customer na plataforma de pagamento e guarda o identificador,
    // para que a cobrança possa ser iniciada depois. Falha aqui não bloqueia o cadastro.
    const { provisionarClienteAsaas, criarCobrancaInicialCadastro } = await import("./asaas.server");
    const provisionamento = await provisionarClienteAsaas(clienteCriado.id);

    // Com o customer provisionado e o plano escolhido, já cria a assinatura/cobrança
    // inicial automaticamente. Falha aqui também não bloqueia o cadastro.
    let cobranca: Awaited<ReturnType<typeof criarCobrancaInicialCadastro>> = {
      criada: false,
      motivo: "sem_provisionamento",
    };
    if (provisionamento.provisionado && planoId) {
      cobranca = await criarCobrancaInicialCadastro(clienteCriado.id);
    }

    // Registro do aceite do Termo de Uso: data/hora + texto integral aceito.
    // O texto vem sempre do servidor, nunca do cliente.
    const { error: aceiteErr } = await supabaseAdmin.from("termos_aceites").insert({
      user_id: newUserId,
      email,
      versao: TERMOS_VERSAO,
      texto: TERMOS_TEXTO,
      origem: "cadastro_publico",
      aceito_em: new Date().toISOString(),
    });
    if (aceiteErr) {
      console.error("[cadastroPublico] falha ao registrar aceite:", aceiteErr.message);
    }

    return {
      ok: true,
      termos_versao: TERMOS_VERSAO,
      cupom: cupomInfo,
      pagamento_pronto: provisionamento.provisionado,
      cobranca: {
        criada: cobranca.criada,
        invoice_url: cobranca.invoiceUrl ?? null,
        valor: cobranca.valor ?? null,
        desconto_aplicado: cobranca.descontoAplicado ?? 0,
      },
    };




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
    await ensurePermission(supabase, userId, "clientes.editar");

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
  cpf_cnpj: z.string().trim().max(20).optional().nullable(),
  telefone: z.string().trim().max(20).optional().nullable(),
  anotacoes: z.string().trim().max(1000).optional().nullable(),
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
    await ensurePermission(supabase, userId, "clientes.editar");

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
        cpf_cnpj: data.cpf_cnpj ?? null,
        telefone: data.telefone ?? null,
        anotacoes: data.anotacoes ?? null,
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
