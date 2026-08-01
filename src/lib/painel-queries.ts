import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { obterConfiguracoes } from "@/lib/config.functions";
import { buscarPerfis } from "@/lib/profiles";
import {
  CONFIG_PADRAO,
  type AdminRow,
  type ClienteRow,
  type Config,
  type Plano,
  type VendedorRow,
} from "@/lib/admin-tipos";

/**
 * Fonte única das consultas dos painéis autenticados.
 *
 * Cada tela declara aqui o que precisa (com seleção mínima de colunas e
 * limite explícito de linhas) e consome via `useSuspenseQuery`, para que a
 * navegação entre telas use o cache em vez de recarregar tudo do zero.
 */

/** Teto de linhas por lista: nenhuma consulta traz a tabela inteira. */
export const LIMITE_LISTA = 300;
/** Histórico de pagamentos exibido ao cliente. */
export const LIMITE_PAGAMENTOS = 50;

export const chavesPainel = {
  admin: ["painel", "admin"] as const,
  cliente: ["painel", "cliente"] as const,
  vendedor: ["painel", "vendedor"] as const,
};

export interface DadosAdmin {
  planos: Plano[];
  vendedores: VendedorRow[];
  clientes: ClienteRow[];
  admins: AdminRow[];
  config: Config | null;
}

async function carregarAdmin(): Promise<DadosAdmin> {
  const [resPls, resVds, resCls, cfg, resAdmins] = await Promise.all([
    supabase.from("planos").select("id,nome,valor,descricao,ativo").order("valor"),
    supabase
      .from("vendedores")
      .select("id,user_id,codigo_indicacao,percentual_comissao,ativo")
      .order("created_at", { ascending: false })
      .limit(LIMITE_LISTA),
    supabase
      .from("clientes")
      .select(
        "id,user_id,vendedor_id,data_vencimento,status,cpf_cnpj,telefone,plano_id,servico_extra,servico_extra_valor,anotacoes,asaas_subscription_id,planos(nome,valor)",
      )
      .order("created_at", { ascending: false })
      .limit(LIMITE_LISTA),
    obterConfiguracoes({}).catch(() => null),
    supabase.from("user_roles").select("user_id").eq("role", "admin").limit(LIMITE_LISTA),
  ]);

  const primeiroErro = resPls.error ?? resVds.error ?? resCls.error ?? resAdmins.error ?? null;
  if (primeiroErro) throw new Error(primeiroErro.message);

  const vendedores = (resVds.data ?? []) as unknown as VendedorRow[];
  const clientes = (resCls.data ?? []) as unknown as ClienteRow[];
  const adminIds = (resAdmins.data ?? []).map((r) => r.user_id);

  // Uma única consulta de perfis para todos os ids envolvidos.
  const perfis = await buscarPerfis([
    ...vendedores.map((v) => v.user_id),
    ...clientes.map((c) => c.user_id),
    ...adminIds,
  ]);

  const porVendedor = new Map<string, number>();
  clientes.forEach((c) => {
    if (!c.vendedor_id) return;
    porVendedor.set(c.vendedor_id, (porVendedor.get(c.vendedor_id) ?? 0) + 1);
  });

  vendedores.forEach((v) => {
    const p = perfis.get(v.user_id);
    v.nome = p?.nome || undefined;
    v.email = p?.email || undefined;
    v.clientes_count = porVendedor.get(v.id) ?? 0;
  });
  clientes.forEach((c) => {
    const p = perfis.get(c.user_id);
    c.nome = p?.nome || undefined;
    c.email = p?.email || undefined;
  });

  return {
    planos: (resPls.data ?? []) as Plano[],
    vendedores,
    clientes,
    admins: adminIds.map((id) => ({
      user_id: id,
      nome: perfis.get(id)?.nome || undefined,
      email: perfis.get(id)?.email || undefined,
    })),
    config: (cfg as Config | null) ?? CONFIG_PADRAO,
  };
}

export const adminPainelQuery = () =>
  queryOptions({ queryKey: chavesPainel.admin, queryFn: carregarAdmin });

export interface PlanoCliente {
  id: string;
  nome: string;
  valor: number;
  descricao: string | null;
  ativo: boolean;
}

export interface ClienteAssinatura {
  id: string;
  data_vencimento: string | null;
  status: string;
  mensagem_vendedor: string | null;
  plano_id: string | null;
  servico_extra: string | null;
  servico_extra_valor: number | null;
  asaas_subscription_id: string | null;
  planos: PlanoCliente | null;
}

export interface PagamentoCliente {
  id: string;
  valor: number;
  status: string;
  data_pagamento: string | null;
  created_at: string;
  invoice_url: string | null;
  planoNome?: string;
}

export interface DadosCliente {
  cliente: ClienteAssinatura | null;
  planos: PlanoCliente[];
  pagamentos: PagamentoCliente[];
}

async function carregarCliente(): Promise<DadosCliente> {
  const { data: cli, error: erroCli } = await supabase
    .from("clientes")
    .select(
      "id,data_vencimento,status,mensagem_vendedor,plano_id,servico_extra,servico_extra_valor,asaas_subscription_id,planos(id,nome,valor,descricao,ativo)",
    )
    .limit(1)
    .maybeSingle();
  if (erroCli) throw new Error(erroCli.message);
  const cliente = (cli ?? null) as unknown as ClienteAssinatura | null;

  // O cliente só pode renovar o plano que já possui: buscamos apenas ele
  // em vez da tabela inteira de planos.
  const consultaPlanos = supabase
    .from("planos")
    .select("id,nome,valor,descricao,ativo")
    .eq("ativo", true)
    .order("valor");
  const { data: pls, error: erroPls } = cliente?.plano_id
    ? await consultaPlanos.eq("id", cliente.plano_id)
    : await consultaPlanos.limit(LIMITE_LISTA);
  if (erroPls) throw new Error(erroPls.message);

  let pagamentos: PagamentoCliente[] = [];
  if (cliente?.id) {
    const { data: pgs, error: erroPgs } = await supabase
      .from("pagamentos")
      .select("id,valor,status,data_pagamento,created_at,invoice_url")
      .eq("cliente_id", cliente.id)
      .order("created_at", { ascending: false })
      .limit(LIMITE_PAGAMENTOS);
    if (erroPgs) throw new Error(erroPgs.message);
    pagamentos = (pgs ?? []) as PagamentoCliente[];
  }

  return { cliente, planos: (pls ?? []) as PlanoCliente[], pagamentos };
}

export const clientePainelQuery = () =>
  queryOptions({ queryKey: chavesPainel.cliente, queryFn: carregarCliente });

export interface VendedorAtual {
  id: string;
  codigo_indicacao: string;
  percentual_comissao: number;
  ativo: boolean;
}

export interface DadosVendedor {
  vendedor: VendedorAtual | null;
  planos: { id: string; nome: string; valor: number }[];
  clientes: ClienteRow[];
}

async function carregarVendedor(): Promise<DadosVendedor> {
  const [resVend, resPls, resCls] = await Promise.all([
    supabase
      .from("vendedores")
      .select("id,codigo_indicacao,percentual_comissao,ativo")
      .limit(1)
      .maybeSingle(),
    supabase.from("planos").select("id,nome,valor").eq("ativo", true).order("valor"),
    supabase
      .from("clientes")
      .select(
        "id,user_id,data_vencimento,status,mensagem_vendedor,anotacoes,plano_id,servico_extra,servico_extra_valor,cpf_cnpj,telefone,planos(nome,valor)",
      )
      .order("created_at", { ascending: false })
      .limit(LIMITE_LISTA),
  ]);

  const erro = resVend.error ?? resPls.error ?? resCls.error ?? null;
  if (erro) throw new Error(erro.message);

  const clientes = (resCls.data ?? []) as unknown as ClienteRow[];
  const perfis = await buscarPerfis(clientes.map((c) => c.user_id));
  clientes.forEach((c) => {
    const p = perfis.get(c.user_id);
    c.nome = p?.nome || undefined;
    c.email = p?.email || undefined;
  });

  return {
    vendedor: (resVend.data ?? null) as VendedorAtual | null,
    planos: (resPls.data ?? []) as { id: string; nome: string; valor: number }[],
    clientes,
  };
}

export const vendedorPainelQuery = () =>
  queryOptions({ queryKey: chavesPainel.vendedor, queryFn: carregarVendedor });
