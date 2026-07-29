import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import type { AppPermission } from "@/lib/permissions";

/**
 * Esconde um trecho da interface quando o usuário não tem a permissão.
 * ATENÇÃO: isto é apenas cosmético. A autorização real acontece no servidor
 * (ensurePermission) e nas regras de acesso do banco.
 */
export function Can({
  permissao,
  children,
  fallback = null,
}: {
  permissao: AppPermission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(permissao) ? children : fallback}</>;
}
