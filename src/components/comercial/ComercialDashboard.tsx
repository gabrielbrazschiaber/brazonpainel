import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { percentual, SITUACAO_LABEL, situacaoClasse } from "@/lib/leads";
import type { DashboardComercial } from "@/lib/leads.functions";

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior === 0 && atual === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> sem variação
      </span>
    );
  }
  if (anterior === 0) {
    return <span className="text-xs text-muted-foreground">sem período anterior</span>;
  }
  const delta = ((atual - anterior) / anterior) * 100;
  const positivo = delta >= 0;
  return (
    <span
      className={`flex items-center gap-1 text-xs ${positivo ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
    >
      {positivo ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(delta).toFixed(0)}% vs. período anterior
    </span>
  );
}

function Kpi({
  titulo,
  valor,
  hint,
  rodape,
}: {
  titulo: string;
  valor: string;
  hint?: string;
  rodape?: React.ReactNode;
}) {
  return (
    <Card className="space-y-1 p-4">
      <p className="eyebrow">{titulo}</p>
      <p className="text-2xl font-semibold text-foreground">{valor}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {rodape}
    </Card>
  );
}

export function ComercialDashboard({
  dados,
  onVerIncompletos,
  onVerFollowUps,
}: {
  dados: DashboardComercial;
  onVerIncompletos?: () => void;
  /** Leva para a fila de follow-ups (aba de atrasados). */
  onVerFollowUps?: () => void;
}) {
  const { funil, anterior, reunioes, segmentos, serie, ranking } = dados;
  const total = funil.contatados || 1;

  const etapas = [
    { label: "Contatados", valor: funil.contatados },
    { label: "Interessados", valor: funil.interessados },
    { label: "Em negociação", valor: funil.em_negociacao },
    { label: "Ganhos", valor: funil.ganhos },
  ];

  const temSerie = serie.some((m) => m.contatados > 0 || m.ganhos > 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          titulo="Leads contatados"
          valor={String(funil.contatados)}
          rodape={<Variacao atual={funil.contatados} anterior={anterior.contatados} />}
        />
        <Kpi
          titulo="Taxa de interesse"
          valor={percentual(funil.taxa_interesse)}
          rodape={<Variacao atual={funil.interessados} anterior={anterior.interessados} />}
        />
        <Kpi
          titulo="Vendas fechadas"
          valor={String(funil.ganhos)}
          hint={`${formatCurrency(funil.valor_ganho)} em valor estimado`}
          rodape={<Variacao atual={funil.ganhos} anterior={anterior.ganhos} />}
        />
        <Kpi
          titulo="Leads por venda"
          valor={
            funil.leads_por_venda === null
              ? "sem dados suficientes"
              : funil.leads_por_venda.toFixed(1)
          }
          hint="chamadas necessárias para fechar 1"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          titulo="Follow-ups atrasados"
          valor={String(dados.follow_ups_atrasados)}
          hint={`${dados.follow_ups_hoje} para hoje · ${dados.cadencias_encerradas} com cadência encerrada`}
          rodape={
            onVerFollowUps && (
              <Button variant="outline" size="sm" className="mt-1" onClick={onVerFollowUps}>
                Ver fila
              </Button>
            )
          }
        />
        <Kpi
          titulo="Toques até fechar"
          valor={
            dados.media_tentativas_ate_ganho === null
              ? "sem dados suficientes"
              : dados.media_tentativas_ate_ganho.toFixed(1)
          }
          hint="média de tentativas nos leads ganhos"
        />
        <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p data-tour="comercial-incompletos" className="eyebrow">
              Leads incompletos
            </p>
            <p className="text-xl font-semibold text-foreground">{dados.incompletos}</p>
            <p className="text-xs text-muted-foreground">
              faltam empresa, cargo, e-mail ou segmento
            </p>
          </div>
          {onVerIncompletos && (
            <Button variant="outline" size="sm" onClick={onVerIncompletos}>
              Ver incompletos
            </Button>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-4 p-4 sm:p-5">
          <p className="section-title">Qualidade da base</p>
          <div className="space-y-3">
            {dados.situacoes?.map((s: any) => (
              <div key={s.chave} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">{SITUACAO_LABEL[s.chave as keyof typeof SITUACAO_LABEL] || s.chave}</span>
                  <span className="text-foreground">{s.total} ({percentual(s.percentual)})</span>
                </div>
                <Progress value={(s.percentual || 0) * 100} className="h-1.5" />
              </div>
            ))}
            {(!dados.situacoes || dados.situacoes.length === 0) && (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem dados de situação</p>
            )}
          </div>
        </Card>

        <Card data-tour="comercial-funil" className="space-y-4 p-4 sm:p-5">
          <p className="section-title">Funil de vendas</p>
          {etapas.map((e) => (
            <div key={e.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-medium">
                  {e.valor}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({((e.valor / total) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>
              <Progress value={(e.valor / total) * 100} />
            </div>
          ))}
        </Card>

        <Card className="space-y-3 p-4 sm:p-5">
          <p className="section-title">Perdas e pipeline</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Não interessados</span>
              <span className="font-medium">{funil.nao_interessados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perdidos</span>
              <span className="font-medium">{funil.perdidos}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pipeline aberto</span>
              <span className="font-medium">{formatCurrency(funil.pipeline_aberto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ticket médio</span>
              <span className="font-medium">
                {funil.ticket_medio === null ? "—" : formatCurrency(funil.ticket_medio)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa de fechamento</span>
              <span className="font-medium">{percentual(funil.taxa_fechamento)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div data-tour="comercial-reunioes" className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="Reuniões marcadas" valor={String(reunioes.marcadas)} />
          <Kpi titulo="Realizadas" valor={String(reunioes.realizadas)} />
          <Kpi titulo="Remarcadas" valor={String(reunioes.remarcadas)} />
          <Kpi titulo="No-show" valor={String(reunioes.no_show)} />
        </div>
        <p className="text-sm text-muted-foreground">
          Comparecimento: {percentual(reunioes.taxa_comparecimento)} · No-show:{" "}
          {percentual(reunioes.taxa_no_show)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3 p-4 sm:p-5">
          <p className="section-title">Contatados vs. ganhos (6 meses)</p>
          {temSerie ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="rotulo" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="contatados"
                    name="Contatados"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="ganhos"
                    name="Ganhos"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Dados insuficientes para o gráfico</p>
          )}
        </Card>

        <Card className="space-y-3 p-4 sm:p-5">
          <p className="section-title">Conversão por segmento</p>
          {segmentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes para o gráfico</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentos.slice(0, 8).map((s) => (
                  <TableRow key={s.segmento}>
                    <TableCell>{s.segmento}</TableCell>
                    <TableCell className="text-right">{s.total}</TableCell>
                    <TableCell className="text-right">{s.ganhos}</TableCell>
                    <TableCell className="text-right">{percentual(s.taxa)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {dados.isAdmin && ranking.length > 0 && (
        <Card className="space-y-3 p-4 sm:p-5">
          <p className="section-title">Ranking de vendedores</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="hidden text-right md:table-cell">Contatados</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Fechamento</TableHead>
                <TableHead className="text-right">Valor ganho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r, i) => (
                <TableRow key={r.vendedor_id}>
                  <TableCell className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    {r.nome}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">{r.contatados}</TableCell>
                  <TableCell className="text-right">{r.ganhos}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {percentual(r.taxa)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(r.valor_ganho)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
