import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Save, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  definirEscopoVendedor,
  escoposVendedores,
  estatisticasBanco,
  qualidadeDosLotes,
  type EscopoVendedor,
  type EstatisticasBanco,
  type QualidadeLote,
} from "@/lib/banco-leads.functions";

function Kpi({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <Card className="p-4">
      <p className="eyebrow">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{valor}</p>
    </Card>
  );
}

function listaParaTexto(itens: string[]): string {
  return itens.join(", ");
}

function textoParaLista(valor: string, tamanho?: number): string[] {
  return Array.from(
    new Set(
      valor
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .map((v) => (tamanho ? v.toUpperCase().slice(0, tamanho) : v.slice(0, 120))),
    ),
  );
}

/** Linha editável de escopo (segmentos/estados) de um vendedor. */
function LinhaEscopo({ escopo, onSalvo }: { escopo: EscopoVendedor; onSalvo: () => void }) {
  const salvar = useServerFn(definirEscopoVendedor);
  const [segmentos, setSegmentos] = useState(listaParaTexto(escopo.segmentos));
  const [estados, setEstados] = useState(listaParaTexto(escopo.estados));
  const [cnaes, setCnaes] = useState(listaParaTexto(escopo.cnaes));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setSegmentos(listaParaTexto(escopo.segmentos));
    setEstados(listaParaTexto(escopo.estados));
    setCnaes(listaParaTexto(escopo.cnaes));
  }, [escopo]);

  async function enviar() {
    setSalvando(true);
    try {
      await salvar({
        data: {
          vendedor_id: escopo.id,
          segmentos: textoParaLista(segmentos),
          estados: textoParaLista(estados, 2).filter((e) => e.length === 2),
          cnaes: textoParaLista(cnaes)
            .map((c) => c.replace(/\D/g, ""))
            .filter((c) => c.length === 7),
        },
      });
      toast.success(`Escopo de ${escopo.nome} atualizado.`);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o escopo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{escopo.nome}</TableCell>
      <TableCell>
        <Input
          value={segmentos}
          onChange={(e) => setSegmentos(e.target.value)}
          placeholder="Ex.: Padaria, Farmácia"
          className="h-9 w-full sm:w-auto sm:min-w-[180px]"
          aria-label={`Segmentos de ${escopo.nome}`}
        />
      </TableCell>
      <TableCell>
        <Input
          value={estados}
          onChange={(e) => setEstados(e.target.value)}
          placeholder="Ex.: SP, MG"
          className="h-9 w-full sm:w-auto sm:min-w-[120px]"
          aria-label={`Estados de ${escopo.nome}`}
        />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Input
          value={cnaes}
          onChange={(e) => setCnaes(e.target.value)}
          placeholder="Ex.: 1091102, 4712100"
          className="h-9 w-full sm:w-auto sm:min-w-[150px]"
          aria-label={`CNAEs de ${escopo.nome}`}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" onClick={() => void enviar()} disabled={salvando}>
          {salvando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5 hidden sm:inline">Salvar</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Visão do admin: números do banco, qualidade dos lotes e reserva por segmento. */
export function BancoAdminPainel() {
  const buscarStats = useServerFn(estatisticasBanco);
  const buscarQualidade = useServerFn(qualidadeDosLotes);
  const buscarEscopos = useServerFn(escoposVendedores);

  const [stats, setStats] = useState<EstatisticasBanco | null>(null);
  const [lotes, setLotes] = useState<QualidadeLote[]>([]);
  const [escopos, setEscopos] = useState<EscopoVendedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<"conectado" | "desconectado" | "tentando">("desconectado");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [s, q, e] = await Promise.all([
        buscarStats({}),
        buscarQualidade({}),
        buscarEscopos({}),
      ]);
      setStats(s);
      setLotes(q);
      setEscopos(e);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar os dados do banco.");
    } finally {
      setCarregando(false);
    }
  }, [buscarStats, buscarQualidade, buscarEscopos]);

  useEffect(() => {
    void carregar();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const setupRealtime = () => {
      // Remove o canal existente antes de criar um novo para evitar conflitos
      if (channel) {
        void supabase.removeChannel(channel);
      }

      setRealtimeStatus("tentando");
      
      const newChannel = supabase
        .channel("banco-leads-admin-panorama")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "banco_leads" },
          () => void carregar()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "banco_leads_lotes" },
          () => void carregar()
        );

      newChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("conectado");
          retryCount = 0;
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setRealtimeStatus("desconectado");
          
          if (!pollingRef.current) {
            pollingRef.current = setInterval(() => void carregar(), 30000);
          }

          if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 2000;
            setTimeout(() => {
              retryCount++;
              setupRealtime();
            }, delay);
          }
        }
      });

      channel = newChannel;
    };

    setupRealtime();

    return () => {
      if (channel) void supabase.removeChannel(channel);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [carregar]);

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            Panorama do banco central de leads e da qualidade de cada lista importada.
          </p>
          <div className="flex items-center gap-2">
            {realtimeStatus === "conectado" ? (
              <Badge variant="outline" className="h-5 gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Wifi className="h-3 w-3" /> Realtime Ativo
              </Badge>
            ) : realtimeStatus === "tentando" ? (
              <Badge variant="outline" className="h-5 gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Conectando...
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 gap-1 border-destructive/20 bg-destructive/10 text-destructive">
                <WifiOff className="h-3 w-3" /> Polling (Fallback)
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Total no banco" valor={stats?.total ?? 0} />
        <Kpi titulo="Disponíveis" valor={stats?.disponiveis ?? 0} />
        <Kpi titulo="Com vendedores" valor={stats?.puxados ?? 0} />
        <Kpi titulo="Em reserva" valor={stats?.bloqueados ?? 0} />
      </div>

      <Card className="p-4">
        <h2 className="text-base font-semibold text-foreground">Qualidade por lote</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Conversão de cada lista: leads ganhos sobre leads efetivamente puxados.
        </p>
        {lotes.length === 0 ? (
          <EmptyState
            titulo="Nenhum lote importado"
            descricao="Importe uma planilha para começar a medir a qualidade das listas."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Importado em</TableHead>
                  <TableHead className="text-right">No banco</TableHead>
                  <TableHead className="text-right">Puxados</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Devoluções</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((l) => (
                  <TableRow key={l.lote_id}>
                    <TableCell>
                      <p className="font-medium">{l.fonte}</p>
                      <p className="text-xs text-muted-foreground">{l.arquivo_nome}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(l.created_at)}</TableCell>
                    <TableCell className="text-right">{l.entrados}</TableCell>
                    <TableCell className="text-right">{l.puxados}</TableCell>
                    <TableCell className="text-right">{l.ganhos}</TableCell>
                    <TableCell className="text-right">{l.devolvidos}</TableCell>
                    <TableCell className="text-right">
                      {l.taxa === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="secondary">{Math.round(l.taxa * 100)}%</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-base font-semibold text-foreground">Reserva por segmento</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Segmentos, estados e CNAEs de cada vendedor. Leads reservados só ficam liberados para
          quem tem o segmento, o estado ou o CNAE no escopo durante a janela de reserva definida em
          Configurações.
        </p>
        {escopos.length === 0 ? (
          <EmptyState
            titulo="Nenhum vendedor ativo"
            descricao="Cadastre vendedores em Configurações para definir os escopos."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Segmentos</TableHead>
                  <TableHead>Estados (UF)</TableHead>
                  <TableHead className="hidden md:table-cell">CNAEs</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escopos.map((e) => (
                  <LinhaEscopo key={e.id} escopo={e} onSalvo={carregar} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {stats && stats.por_segmento.length > 0 ? (
        <Card className="p-4">
          <h2 className="text-base font-semibold text-foreground">Leads por segmento</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.por_segmento.slice(0, 24).map((s) => (
              <Badge key={s.segmento} variant="secondary">
                {s.segmento}: {s.total}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
