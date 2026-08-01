import * as React from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { adminPainelQuery, clientePainelQuery, vendedorPainelQuery } from "@/lib/painel-queries";

function prefetchDados(rota: string, qc: QueryClient) {
  if (rota === "/admin") return qc.prefetchQuery(adminPainelQuery());
  if (rota === "/cliente") return qc.prefetchQuery(clientePainelQuery());
  if (rota === "/vendedor") return qc.prefetchQuery(vendedorPainelQuery());
  return undefined;
}

function ocioso(fn: () => void) {
  if (typeof window === "undefined") return;
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn);
  else window.setTimeout(fn, 300);
}

/**
 * Prefetch por intenção nas rotas autenticadas.
 *
 * `aoIntencao(rota)` roda no hover/foco de um item de menu e adianta duas
 * coisas: o código da rota (router) e os dados do painel (React Query).
 * `prefetchOcioso` faz o mesmo quando o menu fica visível e o navegador está
 * ocioso — assim a troca de página (ex.: /admin ↔ /comercial) chega
 * praticamente instantânea.
 */
export function usePrefetchIntencao() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const aoIntencao = React.useCallback(
    (rota?: string) => {
      if (!rota) return;
      // Código da rota (também cobre /comercial, /tarefas, /banco-leads...).
      type Destino = Parameters<typeof router.preloadRoute>[0];
      void Promise.resolve(router.preloadRoute({ to: rota } as Destino)).catch(() => undefined);
      void prefetchDados(rota, queryClient)?.catch(() => undefined);
    },
    [queryClient, router],
  );

  const prefetchOcioso = React.useCallback(
    (rotas: readonly (string | undefined)[]) => {
      ocioso(() => rotas.forEach((r) => aoIntencao(r)));
    },
    [aoIntencao],
  );

  return { aoIntencao, prefetchOcioso };
}

/**
 * Dispara o prefetch quando o elemento observado entra na tela.
 * Usado no menu lateral: menu visível = navegação provável.
 */
export function usePrefetchQuandoVisivel(
  rotas: readonly (string | undefined)[],
  alvo: React.RefObject<HTMLElement | null>,
) {
  const { prefetchOcioso } = usePrefetchIntencao();
  const chave = rotas.filter(Boolean).join("|");

  React.useEffect(() => {
    const no = alvo.current;
    if (!no || !chave || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        prefetchOcioso(chave.split("|"));
        obs.disconnect();
      }
    });
    obs.observe(no);
    return () => obs.disconnect();
  }, [alvo, chave, prefetchOcioso]);
}
