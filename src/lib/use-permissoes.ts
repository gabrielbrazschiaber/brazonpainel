import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { minhasPermissoes } from "@/lib/permissions.functions";
import type { AppPermission } from "@/lib/permissions";

/**
 * Permissões do usuário autenticado.
 * Serve apenas para esconder controles na interface — a autorização real
 * continua sendo feita no servidor (ensurePermission) e nas políticas RLS.
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

  function pode(permissao: AppPermission) {
    return permissoes.includes(permissao);
  }

  return { permissoes, pode, carregando };
}
