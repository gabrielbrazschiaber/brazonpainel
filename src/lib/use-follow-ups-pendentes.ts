import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { contarFollowUps } from "@/lib/leads.functions";
import { usePaginaVisivel } from "@/lib/use-pagina-visivel";

/**
 * Contador de follow-ups atrasados + de hoje, no mesmo padrão de
 * use-tarefas-abertas: polling lento e apenas com a aba visível.
 */
export function useFollowUpsPendentes({ ativo = true }: { ativo?: boolean } = {}) {
  const visivel = usePaginaVisivel();
  const buscar = useServerFn(contarFollowUps);
  const [pendentes, setPendentes] = useState(0);
  const montado = useRef(true);

  const atualizar = useCallback(async () => {
    try {
      const r = await buscar({});
      if (!montado.current) return;
      setPendentes(r.total);
    } catch {
      /* silencioso: badge é informativo */
    }
  }, [buscar]);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ativo || !visivel) return;
    void atualizar();
    const id = setInterval(() => {
      void atualizar();
    }, 300000);
    return () => clearInterval(id);
  }, [atualizar, ativo, visivel]);

  return { pendentes, atualizar };
}
