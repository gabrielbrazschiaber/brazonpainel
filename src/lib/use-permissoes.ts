import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { minhasPermissoes } from "@/lib/permissions.functions";
import type { AppPermission } from "@/lib/permissions";

/**
 * Permissões do usuário autenticado.
 * Serve apenas para esconder controles na interface — a autorização real
 * continua sendo feita no servidor (ensurePermission) e nas políticas RLS.
 *
 * `pode` e o objeto retornado são memoizados: sem isso, qualquer `useMemo`
 * ou `useEffect` do consumidor que dependa deles roda a cada renderização.
 */
export function usePermissoes() {
  const carregar = useServerFn(minhasPermissoes);
  const [permissoes, setPermissoes] = useState<AppPermission[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    carregar({})
      .then((res) => {
        if (vivo) setPermissoes(res.permissoes as AppPermission[]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [carregar]);

  const pode = useCallback(
    (permissao: AppPermission) => permissoes.includes(permissao),
    [permissoes],
  );

  return useMemo(() => ({ permissoes, pode, carregando }), [permissoes, pode, carregando]);
}
