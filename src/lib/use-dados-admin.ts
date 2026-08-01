import { useCallback } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { adminPainelQuery, chavesPainel } from "@/lib/painel-queries";

/**
 * Carrega, de uma só vez, tudo que as abas do admin precisam: planos,
 * vendedores, clientes, administradores e configurações do sistema.
 *
 * Usa `useSuspenseQuery`: o componente suspende na primeira carga (o `Suspense`
 * da tela mostra o esqueleto) e, nas voltas seguintes, os dados vêm do cache —
 * sem spinner. `recarregar` invalida a chave e revalida em segundo plano.
 */
export function useDadosAdmin() {
  const cliente = useQueryClient();
  const { data } = useSuspenseQuery(adminPainelQuery());

  const recarregar = useCallback(
    async () => {
      await cliente.invalidateQueries({ queryKey: chavesPainel.admin });
    },
    [cliente],
  );

  return { ...data, carregando: false, recarregar };
}
