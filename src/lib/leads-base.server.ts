/** Base server-only do módulo comercial: escopo, tipos e helpers compartilhados. */
import {
  ESTAGIOS_FECHADOS,
  ESTAGIOS_SEM_FOLLOW_UP,
  apenasDigitos,
  razao,
  type LeadEstagio,
  type LeadOrigem,
  type ReuniaoStatus,
} from "@/lib/leads";
import type { z } from "zod";
import type {
  listarLeadsSchema,
  salvarLeadSchema,
  mudarEstagioSchema,
  salvarReuniaoSchema,
  dashboardSchema,
  followUpsSchema,
  reagendarFollowUpSchema,
  registrarFollowUpSchema,
  reativarCadenciaSchema,
} from "@/lib/leads.schemas";

// Cliente tipado do usuário logado (RLS ativa). Tipo frouxo de propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sb = any;

export interface Escopo {
  isAdmin: boolean;
  vendedorId: string | null;
}

const CAMPOS_LEAD =
  "id, vendedor_id, nome_contato, empresa, cargo, telefone, email, segmento, origem, estagio, valor_estimado, motivo_perda, observacoes, proximo_contato, follow_ups_feitos, ultimo_contato_em, cadencia_encerrada, cliente_id, contatado_em, fechado_em, importacao_id, completude, created_at, updated_at";

export interface Lead {
  id: string;
  vendedor_id: string;
  nome_contato: string;
  empresa: string | null;
  cargo: string | null;
  telefone: string;
  email: string | null;
  segmento: string | null;
  origem: LeadOrigem;
  estagio: LeadEstagio;
  valor_estimado: number;
  motivo_perda: string | null;
  observacoes: string | null;
  proximo_contato: string | null;
  /** Tentativas de contato SEM resposta já registradas. */
  follow_ups_feitos: number;
  ultimo_contato_em: string | null;
  cadencia_encerrada: boolean;
  cliente_id: string | null;
  contatado_em: string;
  fechado_em: string | null;
  importacao_id: string | null;
  /** 0 a 4: empresa, cargo, e-mail e segmento preenchidos. */
  completude: number;
  created_at: string;
  updated_at: string;
  reunioes_count: number;
  vendedor_nome?: string | null;
}

export async function escopoComercial(supabase: Sb, userId: string): Promise<Escopo> {
  const [{ data: isAdmin }, { data: vendedorId }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("current_vendedor_id"),
  ]);
  const escopo: Escopo = {
    isAdmin: isAdmin === true,
    vendedorId: (vendedorId as string | null) ?? null,
  };
  if (!escopo.isAdmin && !escopo.vendedorId) {
    throw new Error("Acesso restrito à equipe comercial.");
  }
  return escopo;
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dataLimite(dias: number | null | undefined): string | null {
  if (!dias || dias <= 0) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Nomes de vendedores (perfis) resolvidos em lote via cliente administrativo. */
async export function nomesVendedores(vendedorIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(vendedorIds.filter(Boolean)));
  if (unicos.length === 0) return mapa;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: vends } = await supabaseAdmin
    .from("vendedores")
    .select("id, user_id")
    .in("id", unicos);
  const userIds = (vends ?? []).map((v: { user_id: string }) => v.user_id);
  const { data: perfis } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, email")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const porUser = new Map<string, string>();
  for (const p of perfis ?? []) {
    porUser.set(p.id, (p.nome || "").trim() || p.email);
  }
  for (const v of vends ?? []) {
    mapa.set(v.id, porUser.get(v.user_id) ?? "Vendedor");
  }
  return mapa;
}

export async function nomesDeUsuarios(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return mapa;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("id, nome, email").in("id", unicos);
  for (const p of data ?? []) mapa.set(p.id, (p.nome || "").trim() || p.email);
  return mapa;
}

/** Vendedores ativos, para o filtro do admin. */
export async function listarVendedoresServer(supabase: Sb, userId: string) {
  const { isAdmin } = await escopoComercial(supabase, userId);
  if (!isAdmin) return [] as { id: string; nome: string }[];
  const { data, error } = await supabase.from("vendedores").select("id").eq("ativo", true);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((v: { id: string }) => v.id);
  const nomes = await nomesVendedores(ids);
  return ids
    .map((id: string) => ({ id, nome: nomes.get(id) ?? "Vendedor" }))
    .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR"));
}
