import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AlertasAcesso } from "@/components/admin/AlertasAcesso";
import { TraceTimeline } from "@/components/admin/TraceTimeline";

interface LinhaResumo {
  app_version: string;
  rota: string;
  tipo: string;
  total: number;
  erros: number;
  sem_papel: number;
  p50_ms: number;
  p95_ms: number;
  ultima: string;
}

const ROTULOS: Record<string, string> = {
  sessao_resolvida: "Sessão resolvida",
  papel_resolvido: "Perfil resolvido",
  papel_sem_papel: "Sem perfil de acesso",
  papel_erro: "Falha ao resolver perfil",
  papel_retry: "Nova tentativa",
  troca_de_conta: "Troca de conta",
};

const PERIODOS = [
  { valor: "1", label: "Últimas 24h" },
  { valor: "7", label: "Últimos 7 dias" },
  { valor: "30", label: "Últimos 30 dias" },
];

/**
 * Painel de regressões de acesso: agrupa a telemetria de sessão/papel por
 * versão do app, rota e desfecho. Um pico de `papel_erro` ou de
 * `papel_sem_papel` em uma versão específica indica regressão do gate.
 */
export function TelemetriaAuthTab() {
  const [dias, setDias] = useState("7");
  const [linhas, setLinhas] = useState<LinhaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [traceAberto, setTraceAberto] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("auth_telemetria_resumo", {
      _dias: Number(dias),
    });
    if (error) {
      toast.error("Não foi possível carregar as métricas de acesso.");
      setLinhas([]);
    } else {
      setLinhas((data ?? []) as unknown as LinhaResumo[]);
    }
    setCarregando(false);
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totais = useMemo(() => {
    const soma = (chave: keyof LinhaResumo) =>
      linhas.reduce((acc, l) => acc + Number(l[chave] ?? 0), 0);
    const resolvidos = linhas.filter((l) => l.tipo === "papel_resolvido");
    const p95 = resolvidos.reduce((max, l) => Math.max(max, l.p95_ms), 0);
    const p50 = resolvidos.length
      ? Math.round(resolvidos.reduce((a, l) => a + l.p50_ms, 0) / resolvidos.length)
      : 0;
    return {
      eventos: soma("total"),
      erros: soma("erros"),
      semPapel: soma("sem_papel"),
      p50,
      p95,
      versoes: new Set(linhas.map((l) => l.app_version)).size,
    };
  }, [linhas]);

  const problematicas = useMemo(
    () => linhas.filter((l) => l.tipo === "papel_erro" || l.tipo === "papel_sem_papel").slice(0, 8),
    [linhas],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Resolução de sessão e perfil</h2>
          <p className="text-sm text-muted-foreground">
            Duração e desfecho da verificação de acesso, por versão e rota.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.valor} value={p.valor}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void carregar()}>
            <RefreshCw className={carregando ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi titulo="Eventos" valor={totais.eventos.toLocaleString("pt-BR")} />
        <Kpi
          titulo="Falhas de perfil"
          valor={totais.erros.toLocaleString("pt-BR")}
          alerta={totais.erros > 0}
        />
        <Kpi
          titulo="Contas sem perfil"
          valor={totais.semPapel.toLocaleString("pt-BR")}
          alerta={totais.semPapel > 0}
        />
        <Kpi titulo="Mediana (perfil)" valor={`${totais.p50} ms`} />
        <Kpi titulo="Pior caso p95" valor={`${totais.p95} ms`} alerta={totais.p95 > 2500} />
      </div>

      {problematicas.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Possíveis regressões
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {problematicas.map((l) => (
              <li key={`${l.app_version}-${l.rota}-${l.tipo}`}>
                <span className="font-medium text-foreground">{l.rota}</span> ·{" "}
                {ROTULOS[l.tipo] ?? l.tipo} · versão {l.app_version} ·{" "}
                {Number(l.total).toLocaleString("pt-BR")} ocorrência(s)
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Versão</th>
              <th className="px-3 py-2">Rota</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Mediana</th>
              <th className="px-3 py-2 text-right">p95</th>
              <th className="px-3 py-2">Último</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={`${l.app_version}-${l.rota}-${l.tipo}`} className="border-t border-border">
                <td className="px-3 py-2">
                  <Badge variant="outline">{l.app_version}</Badge>
                </td>
                <td className="px-3 py-2 font-medium text-foreground">{l.rota}</td>
                <td className="px-3 py-2">
                  {l.tipo === "papel_erro" ? (
                    <span className="text-destructive">{ROTULOS[l.tipo]}</span>
                  ) : (
                    (ROTULOS[l.tipo] ?? l.tipo)
                  )}
                </td>
                <td className="px-3 py-2 text-right">{Number(l.total)}</td>
                <td className="px-3 py-2 text-right">{l.p50_ms} ms</td>
                <td className="px-3 py-2 text-right">{l.p95_ms} ms</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(l.ultima).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
            {!carregando && linhas.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                  Nenhum evento de acesso no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AlertasAcesso />
      <IncidentesPorTrace dias={Number(dias)} onAbrirTrace={setTraceAberto} />
      <TraceTimeline traceId={traceAberto} onTraceIdChange={setTraceAberto} />
      <p className="text-xs text-muted-foreground">
        {totais.versoes} versão(ões) do app no período. Defina <code>VITE_APP_VERSION</code> no
        build para comparar publicações.
      </p>
    </div>
  );
}

interface Incidente {
  trace_id: string | null;
  tipo: string;
  rota: string | null;
  app_version: string;
  erro: string | null;
  created_at: string;
}

/**
 * Incidentes recentes com o Trace ID: o mesmo valor nomeia os artefatos do E2E
 * (vídeo/screenshot/dump) e viaja para o destino externo (Sentry/Datadog),
 * permitindo rastrear cada caso ponta a ponta.
 */
function IncidentesPorTrace({
  dias,
  onAbrirTrace,
}: {
  dias: number;
  onAbrirTrace: (traceId: string) => void;
}) {
  const [itens, setItens] = useState<Incidente[]>([]);

  useEffect(() => {
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    void supabase
      .from("auth_telemetria")
      .select("trace_id, tipo, rota, app_version, erro, created_at")
      .in("tipo", ["papel_erro", "papel_sem_papel"])
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setItens((data ?? []) as Incidente[]));
  }, [dias]);

  if (itens.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-foreground">Incidentes recentes (Trace ID)</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Use o Trace ID para achar o vídeo/screenshot do teste e o evento no monitoramento externo.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {itens.map((i, idx) => (
          <li
            key={`${i.trace_id ?? "sem"}-${idx}`}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-2 first:border-0 first:pt-0"
          >
            <Badge variant={i.tipo === "papel_erro" ? "destructive" : "outline"}>
              {ROTULOS[i.tipo] ?? i.tipo}
            </Badge>
            <span className="font-medium text-foreground">{i.rota ?? "—"}</span>
            {i.trace_id ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-1.5 py-0.5 font-mono text-xs"
                onClick={() => onAbrirTrace(i.trace_id as string)}
              >
                {i.trace_id}
              </Button>
            ) : (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">sem trace</code>
            )}
            <span className="text-xs text-muted-foreground">
              versão {i.app_version} · {new Date(i.created_at).toLocaleString("pt-BR")}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Kpi({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase text-muted-foreground">{titulo}</p>
      <p
        className={
          alerta
            ? "mt-1 text-2xl font-semibold text-destructive"
            : "mt-1 text-2xl font-semibold text-foreground"
        }
      >
        {valor}
      </p>
    </Card>
  );
}
