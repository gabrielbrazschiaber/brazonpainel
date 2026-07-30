import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { contarTarefasAbertas } from "@/lib/tarefas.functions";
import { supabase } from "@/integrations/supabase/client";
import { usePaginaVisivel } from "@/lib/use-pagina-visivel";
import { useAuth } from "@/lib/auth";

type Opcoes = {
  /** Quando false, o hook não busca nem escuta (ex.: papel sem acesso). */
  ativo?: boolean;
  /** Dispara ao clicar em "Abrir" no toast de nova tarefa. */
  aoAbrirTarefas?: () => void;
};

const TITULO_MAX = 90;

function previa(titulo: unknown) {
  const texto = typeof titulo === "string" ? titulo.trim() : "";
  if (!texto) return undefined;
  return texto.length > TITULO_MAX ? `${texto.slice(0, TITULO_MAX)}…` : texto;
}

/**
 * Contador de tarefas em aberto com atualização em tempo real.
 * Avisa com um toast quando uma nova tarefa chega (criada por outra pessoa)
 * e mantém apenas um polling lento de segurança enquanto a aba está visível.
 */
export function useTarefasAbertas(opcoes: Opcoes = {}) {
  const { ativo = true, aoAbrirTarefas } = opcoes;
  const visivel = usePaginaVisivel();
  const [abertas, setAbertas] = useState(0);
  const montado = useRef(true);
  const buscar = useServerFn(contarTarefasAbertas);
  const { user } = useAuth();
  const meuId = user?.id ?? null;

  const abrirRef = useRef(aoAbrirTarefas);
  abrirRef.current = aoAbrirTarefas;

  const atualizar = useCallback(async () => {
    try {
      const total = await buscar({});
      if (!montado.current) return;
      setAbertas(total);
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

  useEffect(() => {
    if (!ativo || !visivel) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void atualizar();
      }, 800);
    };

    const canal = supabase
      .channel("tarefas-abertas")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tarefas" },
        (payload) => {
          const nova = payload.new as {
            titulo?: string | null;
            criado_por_id?: string | null;
          };
          agendar();
          // Tarefa criada por mim não é novidade.
          if (meuId && nova.criado_por_id === meuId) return;
          toast.message("Nova tarefa recebida", {
            description: previa(nova.titulo),
            action: abrirRef.current
              ? { label: "Abrir", onClick: () => abrirRef.current?.() }
              : undefined,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tarefas" },
        () => agendar(),
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
  }, [atualizar, ativo, visivel, meuId]);

  return { abertas, atualizar };
}
