import { Suspense, useEffect, useState, type ReactNode } from "react";

/**
 * Só monta (e só baixa o JS de) um conteúdo pesado depois que ele é aberto
 * pela primeira vez. Depois disso permanece montado, preservando o estado
 * interno e as animações de fechar do Radix.
 *
 * Uso típico: diálogos e painéis grandes carregados com `lazy()`.
 */
export function MontarQuandoAberto({
  aberto,
  fallback = null,
  children,
}: {
  aberto: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const [jaAbriu, setJaAbriu] = useState(aberto);

  useEffect(() => {
    if (aberto) setJaAbriu(true);
  }, [aberto]);

  if (!jaAbriu) return null;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
