import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Film, Loader2, Search } from "lucide-react";

export interface EventoTrace {
  id: string;
  created_at: string;
  tipo: string;
  motivo: string | null;
  rota: string;
  duracao_ms: number | null;
  papel: string | null;
  erro: string | null;
  app_version: string;
  user_id: string | null;
}

const ROTULOS: Record<string, string> = {
  sessao_resolvida: "Sessão resolvida",
  papel_resolvido: "Perfil resolvido",
  papel_sem_papel: "Sem perfil de acesso",
  papel_erro: "Falha ao resolver perfil",
  papel_retry: "Nova tentativa",
  troca_de_conta: "Troca de conta",
  navegacao: "Navegação",
};

const FALHAS = new Set(["papel_erro", "papel_sem_papel"]);

/** Artefatos que o E2E grava usando o Trace ID como nome da pasta. */
const ARTEFATOS = [
  { rotulo: "Vídeo da sessão", arquivo: "video.webm" },
  { rotulo: "Screenshot da falha", arquivo: "falha.png" },
  { rotulo: "Dump do DOM", arquivo: "dump.html" },
  { rotulo: "Log do console", arquivo: "console.log" },
];

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Linha do tempo de um Trace ID: os eventos do gate (sessão, perfil,
 * retentativas, troca de conta), as rotas por onde o usuário passou e onde
 * encontrar os artefatos do E2E daquele mesmo trace — tudo num só lugar.
 */
export function TraceTimeline({
  traceId,
  onTraceIdChange,
}: {
  traceId: string;
  onTraceIdChange: (valor: string) => void;
}) {
  const [busca, setBusca] = useState(traceId);
  const [eventos, setEventos] = useState<EventoTrace[] | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => setBusca(traceId), [traceId]);

  const carregar = useCallback(async (id: string) => {
    const alvo = id.trim();
    if (!alvo) {
      setEventos(null);
      return;
    }
    setCarregando(true);
    const { data, error } = await supabase.rpc("auth_telemetria_trace", { _trace_id: alvo });
    if (error) {
      toast.error("Não foi possível abrir este Trace ID.");
      setEventos([]);
    } else {
      setEventos((data ?? []) as unknown as EventoTrace[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar(traceId);
  }, [traceId, carregar]);

  const inicio = eventos?.[0]?.created_at;

  return (
    <Card className="p-4" data-tour="telemetria-trace">
      <h3 className="text-sm font-semibold text-foreground">Linha do tempo por Trace ID</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Cole um Trace ID para ver, na ordem, os eventos de acesso, as rotas percorridas e os
        artefatos gravados pelo teste automatizado.
      </p>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          onTraceIdChange(busca.trim());
        }}
      >
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex.: 8f3a1c9e-4b2d-47aa-9f10-2c7d5e6b1a34"
          aria-label="Trace ID"
          className="font-mono text-xs"
        />
        <Button type="submit" disabled={carregando || !busca.trim()} className="sm:w-40">
          {carregando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Abrir Trace ID
        </Button>
      </form>

      {eventos !== null && eventos.length === 0 && !carregando && (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum evento encontrado para este Trace ID. Confira se o valor foi copiado por inteiro.
        </p>
      )}

      {eventos !== null && eventos.length > 0 && (
        <>
          <ol className="mt-4 space-y-3">
            {eventos.map((ev) => {
              const decorrido = inicio
                ? Math.max(0, new Date(ev.created_at).getTime() - new Date(inicio).getTime())
                : 0;
              return (
                <li key={ev.id} className="flex gap-3 border-l-2 border-border pl-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={FALHAS.has(ev.tipo) ? "destructive" : "outline"}>
                        {ROTULOS[ev.tipo] ?? ev.tipo}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{ev.rota}</span>
                      <span className="text-xs text-muted-foreground">
                        {horaCurta(ev.created_at)} · +{decorrido} ms
                        {ev.duracao_ms !== null ? ` · durou ${ev.duracao_ms} ms` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      versão {ev.app_version}
                      {ev.papel ? ` · perfil ${ev.papel}` : ""}
                      {ev.motivo ? ` · ${ev.motivo}` : ""}
                    </p>
                    {ev.erro && (
                      <p className="mt-1 break-words text-xs text-destructive">{ev.erro}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Artefatos do teste</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Gravados pelo pipeline em <code>tests/e2e/artifacts/{traceId}/</code>
            </p>
            <ul className="mt-2 space-y-1">
              {ARTEFATOS.map((a) => (
                <li key={a.arquivo} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{a.rotulo}</span>
                  <code className="truncate rounded bg-muted px-1.5 py-0.5">{a.arquivo}</code>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`tests/e2e/artifacts/${traceId}`);
                  toast.success("Caminho dos artefatos copiado.");
                } catch {
                  toast.error("Não foi possível copiar o caminho.");
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar caminho dos artefatos
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
