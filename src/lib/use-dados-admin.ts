import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

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

interface DadosAdmin {
  planos: Plano[];
  vendedores: VendedorRow[];
  clientes: ClienteRow[];
  admins: AdminRow[];
  config: Config | null;
}

const VAZIO: DadosAdmin = {
  planos: [],
  vendedores: [],
  clientes: [],
  admins: [],
  config: null,
};

/**
 * Carrega, de uma só vez, tudo que as abas do admin precisam: planos,
 * vendedores, clientes, administradores e configurações do sistema.
 *
 * A busca vive num hook (e não dentro da tela) para separar dados de interface:
 * a rota `/admin` apenas distribui o resultado às abas e repassa `recarregar`
 * como callback de "algo mudou".
 */
export function useDadosAdmin() {
  const obterConfig = useServerFn(obterConfiguracoes);
  const [dados, setDados] = useState<DadosAdmin>(VAZIO);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [resPls, resVds, resCls, cfg, resAdmins] = await Promise.all([
        supabase.from("planos").select("id,nome,valor,descricao,ativo").order("valor"),
        supabase
          .from("vendedores")
          .select("id,user_id,codigo_indicacao,percentual_comissao,ativo")
          .order("created_at", { ascending: false }),
        supabase
          .from("clientes")
          .select(
            "id,user_id,vendedor_id,data_vencimento,status,cpf_cnpj,telefone,plano_id,servico_extra,servico_extra_valor,anotacoes,asaas_subscription_id,planos(nome,valor)",
          )
          .order("created_at", { ascending: false }),
        obterConfig({}).catch(() => null),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
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

      vendedores.forEach((v) => {
        const p = perfis.get(v.user_id);
        v.nome = p?.nome || undefined;
        v.email = p?.email || undefined;
        v.clientes_count = clientes.filter((c) => c.vendedor_id === v.id).length;
      });
      clientes.forEach((c) => {
        const p = perfis.get(c.user_id);
        c.nome = p?.nome || undefined;
        c.email = p?.email || undefined;
      });

      setDados({
        planos: (resPls.data ?? []) as Plano[],
        vendedores,
        clientes,
        admins: adminIds.map((id) => ({
          user_id: id,
          nome: perfis.get(id)?.nome || undefined,
          email: perfis.get(id)?.email || undefined,
        })),
        config: (cfg as Config | null) ?? CONFIG_PADRAO,
      });
    } catch (e) {
      toast.error("Não foi possível carregar o painel", {
        description: e instanceof Error ? e.message : "Tente novamente em instantes.",
      });
    } finally {
      setCarregando(false);
    }
  }, [obterConfig]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { ...dados, carregando, recarregar };
}
