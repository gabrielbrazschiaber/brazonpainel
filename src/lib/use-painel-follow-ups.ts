import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { painelFollowUps, type FollowUp, type PainelFollowUps } from "@/lib/leads.functions";

/**
 * Contadores e fila do dia dos follow-ups.
 * Alimenta as abas da listagem de leads e o modo sequencial, sem renderizar
 * um painel separado na tela.
 */
export function usePainelFollowUps(vendedorId?: string | undefined) {
  const carregar = useServerFn(painelFollowUps);
  const [dados, setDados] = useState<PainelFollowUps | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const d = await carregar({ data: vendedorId ? { vendedor_id: vendedorId } : {} });
      setDados(d);
    } catch {
      /* contadores são informativos: a listagem já mostra erros de carga */
    } finally {
      setCarregando(false);
    }
  }, [carregar, vendedorId]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  /** Fila do modo sequencial: atrasados primeiro, depois os de hoje. */
  const filaDoDia: FollowUp[] = dados
    ? [...dados.atrasados, ...dados.hoje].filter((i) => !i.cadencia_encerrada)
    : [];

  return {
    dados,
    carregando,
    buscar,
    filaDoDia,
    totalAContatar: (dados?.totalAtrasados ?? 0) + (dados?.totalHoje ?? 0),
    totalAtrasados: dados?.totalAtrasados ?? 0,
    totalProximos: dados?.totalProximos ?? 0,
    totalEncerrados: dados?.totalEncerrados ?? 0,
  };
}
