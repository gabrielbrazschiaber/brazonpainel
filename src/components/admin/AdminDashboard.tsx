import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckCircle2,
  Trophy,
  Receipt,
  Webhook,
  Users,
  Wallet,
  AlertTriangle,
  Clock,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ---------------- Types ---------------- */
interface ClienteRow {
  id: string;
  user_id: string;
  vendedor_id: string | null;
  data_vencimento: string | null;
  status: string;
  created_at: string;
  servico_extra_valor: number | null;
  planos: { nome: string; valor: number } | null;
  nome?: string;
}
interface VendedorRow {
  id: string;
  user_id: string;
  nome?: string;
}
interface PagamentoRow {
  id: string;
  cliente_id: string;
  valor: number;
  status: string;
  data_pagamento: string | null;
  created_at: string;
  asaas_payment_id: string | null;
  cliente_nome?: string;
}
interface WebhookLog {
  id: string;
  event: string | null;
  payment_id: string | null;
  status: string | null;
  payload: unknown;
  processing_result: string;
  error_message: string | null;
  created_at: string;
}

/* ---------------- Helpers ---------------- */
function relativeDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(meses / 12)} ano(s)`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ---------------- Main ---------------- */
export function AdminDashboard() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logDetail, setLogDetail] = useState<WebhookLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cls }, { data: vds }, { data: pgs }] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id,user_id,vendedor_id,data_vencimento,status,created_at,servico_extra_valor,planos(nome,valor)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("vendedores").select("id,user_id"),
      supabase
        .from("pagamentos")
        .select("id,cliente_id,valor,status,data_pagamento,created_at,asaas_payment_id")
        .order("created_at", { ascending: false }),
    ]);

    const crows = (cls ?? []) as unknown as ClienteRow[];
    const vrows = (vds ?? []) as unknown as VendedorRow[];
    const prows = (pgs ?? []) as unknown as PagamentoRow[];

    const userIds = [...crows.map((c) => c.user_id), ...vrows.map((v) => v.user_id)];
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nome")
        .in("id", userIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p.nome]));
      crows.forEach((c) => (c.nome = map.get(c.user_id) || undefined));
      vrows.forEach((v) => (v.nome = map.get(v.user_id) || undefined));
    }
    const clienteNome = new Map(crows.map((c) => [c.id, c.nome]));
    prows.forEach((p) => (p.cliente_nome = clienteNome.get(p.cliente_id) || undefined));

    setClientes(crows);
    setVendedores(vrows);
    setPagamentos(prows);
    setLoading(false);
  }, []);

  const loadWebhooks = useCallback(async () => {
    const { data } = await supabase
      .from("asaas_webhook_logs")
      .select("id,event,payment_id,status,payload,processing_result,error_message,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    setWebhookLogs((data ?? []) as unknown as WebhookLog[]);
  }, []);

  useEffect(() => {
    load();
    loadWebhooks();
  }, [load, loadWebhooks]);

  /* ---------- KPIs ---------- */
  const kpi = useMemo(() => {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesPassado = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const novosMes = clientes.filter((c) => new Date(c.created_at) >= inicioMes).length;

    const mrr = clientes
      .filter((c) => c.status === "ativo")
      .reduce((s, c) => s + (c.planos?.valor ?? 0) + (c.servico_extra_valor ?? 0), 0);

    const pagosMesPassado = pagamentos
      .filter((p) => {
        if (p.status !== "pago" || !p.data_pagamento) return false;
        const d = new Date(p.data_pagamento + "T00:00:00");
        return d >= inicioMesPassado && d < inicioMes;
      })
      .reduce((s, p) => s + (p.valor ?? 0), 0);

    const inadimplentes = clientes.filter(
      (c) => c.status === "vencido" || c.status === "inadimplente",
    ).length;
    const taxaInad = clientes.length ? (inadimplentes / clientes.length) * 100 : 0;

    const pendentes = pagamentos.filter((p) => p.status === "pendente");
    const totalPendente = pendentes.reduce((s, p) => s + (p.valor ?? 0), 0);

    return {
      totalClientes: clientes.length,
      novosMes,
      mrr,
      pagosMesPassado,
      inadimplentes,
      taxaInad,
      pendentesCount: pendentes.length,
      totalPendente,
    };
  }, [clientes, pagamentos]);

  /* ---------- Alertas ---------- */
  const alertas = useMemo(() => {
    type Alerta = {
      tipo: "vencido" | "vencendo" | "webhook";
      titulo: string;
      sub: string;
      badge: { label: string; tone: string };
      prioridade: number;
    };
    const items: Alerta[] = [];

    clientes.forEach((c) => {
      if (c.status === "cancelado" || !c.data_vencimento) return;
      const dias = daysUntil(c.data_vencimento);
      if (dias === null) return;
      if (dias < 0) {
        items.push({
          tipo: "vencido",
          titulo: c.nome || "Cliente",
          sub: `há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`,
          badge: { label: "vencido", tone: "bg-destructive/15 text-destructive border-destructive/30" },
          prioridade: 0,
        });
      } else if (dias <= 5) {
        items.push({
          tipo: "vencendo",
          titulo: c.nome || "Cliente",
          sub: `vence em ${dias}d`,
          badge: { label: `vence em ${dias}d`, tone: "bg-warning/20 text-warning-foreground border-warning/40" },
          prioridade: 1,
        });
      }
    });

    webhookLogs
      .filter((w) => w.processing_result !== "OK")
      .slice(0, 5)
      .forEach((w) => {
        items.push({
          tipo: "webhook",
          titulo: `Pagamento ${w.payment_id ?? "—"}`,
          sub: relativeDate(w.created_at),
          badge: { label: "webhook falhou", tone: "bg-destructive/15 text-destructive border-destructive/30" },
          prioridade: 2,
        });
      });

    return items.sort((a, b) => a.prioridade - b.prioridade);
  }, [clientes, webhookLogs]);

  /* ---------- Paginação de alertas ---------- */
  const ALERTAS_POR_PAGINA = 6;
  const [alertaPagina, setAlertaPagina] = useState(0);
  const totalAlertaPaginas = Math.max(1, Math.ceil(alertas.length / ALERTAS_POR_PAGINA));
  useEffect(() => {
    if (alertaPagina > totalAlertaPaginas - 1) setAlertaPagina(0);
  }, [alertaPagina, totalAlertaPaginas]);
  const alertasPagina = alertas.slice(
    alertaPagina * ALERTAS_POR_PAGINA,
    alertaPagina * ALERTAS_POR_PAGINA + ALERTAS_POR_PAGINA,
  );

  /* ---------- MRR chart ---------- */
  const mrrChart = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: MESES[d.getMonth()], valor: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    pagamentos.forEach((p) => {
      if (p.status !== "pago" || !p.data_pagamento) return;
      const d = new Date(p.data_pagamento + "T00:00:00");
      const i = idx.get(monthKey(d));
      if (i !== undefined) buckets[i].valor += p.valor ?? 0;
    });
    return buckets;
  }, [pagamentos]);
  const temDadosMrr = mrrChart.some((b) => b.valor > 0);

  /* ---------- Status chart ---------- */
  const statusChart = useMemo(() => {
    const conf: { key: string; label: string; color: string }[] = [
      { key: "ativo", label: "Ativo", color: "hsl(142 71% 45%)" },
      { key: "vencido", label: "Vencido", color: "hsl(38 92% 50%)" },
      { key: "inadimplente", label: "Inadimplente", color: "hsl(0 72% 51%)" },
      { key: "cancelado", label: "Cancelado", color: "hsl(215 16% 47%)" },
    ];
    return conf
      .map((c) => ({
        ...c,
        value: clientes.filter((cl) => cl.status === c.key).length,
      }))
      .filter((c) => c.value > 0);
  }, [clientes]);

  /* ---------- Ranking ---------- */
  const ranking = useMemo(() => {
    const rows = vendedores.map((v) => {
      const meus = clientes.filter((c) => c.vendedor_id === v.id);
      const receita = meus.reduce(
        (s, c) => s + (c.planos?.valor ?? 0) + (c.servico_extra_valor ?? 0),
        0,
      );
      const ativos = meus.filter((c) => c.status === "ativo").length;
      const inadimplentes = meus.filter(
        (c) => c.status === "vencido" || c.status === "inadimplente",
      ).length;
      return {
        id: v.id,
        nome: v.nome || "Vendedor",
        clientes: meus.length,
        receita,
        ativos,
        inadimplentes,
        lista: meus,
      };
    });
    rows.sort((a, b) => b.clientes - a.clientes);
    return rows.slice(0, 5);
  }, [vendedores, clientes]);
  const maxClientes = ranking[0]?.clientes || 1;
  type RankingRow = (typeof ranking)[number];
  const [rankingDetail, setRankingDetail] = useState<RankingRow | null>(null);

  const ultimosPagamentos = useMemo(() => pagamentos.slice(0, 8), [pagamentos]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Clientes ativos"
          value={String(kpi.totalClientes)}
          delta={kpi.novosMes > 0 ? `+${kpi.novosMes} este mês` : "Nenhum novo este mês"}
          deltaTone={kpi.novosMes > 0 ? "text-success" : "text-muted-foreground"}
        />
        <KpiCard
          icon={Wallet}
          label="MRR (receita/mês)"
          value={formatCurrency(kpi.mrr)}
          valueTone="text-success"
          delta={
            kpi.pagosMesPassado > 0
              ? `${kpi.mrr >= kpi.pagosMesPassado ? "▲" : "▼"} vs ${formatCurrency(kpi.pagosMesPassado)} mês anterior`
              : "sem base do mês anterior"
          }
          deltaTone={kpi.mrr >= kpi.pagosMesPassado ? "text-success" : "text-destructive"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Taxa de inadimplência"
          value={`${kpi.taxaInad.toFixed(1)}%`}
          valueTone={kpi.taxaInad > 10 ? "text-destructive" : "text-foreground"}
          delta={`${kpi.inadimplentes} cliente(s)`}
          deltaTone="text-muted-foreground"
        />
        <KpiCard
          icon={Clock}
          label="Cobranças pendentes"
          value={`${kpi.pendentesCount} cobrança(s)`}
          delta={`${formatCurrency(kpi.totalPendente)} a receber`}
          deltaTone="text-warning-foreground"
        />
      </div>

      {/* Alertas + Ranking */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Alertas e ações urgentes</h3>
          </div>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-success" />
              Nenhum alerta no momento
            </div>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.titulo}</p>
                    <p className="text-xs text-muted-foreground">{a.sub}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                      a.badge.tone,
                    )}
                  >
                    {a.badge.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Ranking de vendedores</h3>
          </div>
          {ranking.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum vendedor.</p>
          ) : (
            <ul className="space-y-3">
              {ranking.map((r, i) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      {i + 1}. {r.nome}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {r.clientes} cli · {formatCurrency(r.receita)}
                    </span>
                  </div>
                  <Progress value={(r.clientes / maxClientes) * 100} className="mt-1.5 h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Receita mensal (MRR)</h3>
          {!temDadosMrr ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Dados insuficientes para o gráfico
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mrrChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={(v) => `R$ ${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), "Receita"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="hsl(217 91% 60%)"
                  strokeWidth={2}
                  fill="url(#mrrFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Clientes por status</h3>
          {statusChart.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sem clientes.</p>
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusChart}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {statusChart.map((s) => (
                        <Cell key={s.key} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{clientes.length}</span>
                  <span className="text-xs text-muted-foreground">clientes</span>
                </div>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                {statusChart.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label} · {((s.value / clientes.length) * 100).toFixed(0)}%
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Pagamentos + Webhooks */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Últimos pagamentos</h3>
          </div>
          {ultimosPagamentos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento.</p>
          ) : (
            <ul className="space-y-2">
              {ultimosPagamentos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {p.cliente_nome || "Cliente"}
                      {p.asaas_payment_id && (
                        <span className="ml-1 text-xs text-primary">· Asaas</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {relativeDate(p.data_pagamento || p.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium">{formatCurrency(p.valor)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Logs de webhook Asaas</h3>
            </div>
            <Button variant="outline" size="sm" onClick={loadWebhooks}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
          {webhookLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum log registrado.</p>
          ) : (
            <ul className="space-y-2">
              {webhookLogs.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => setLogDetail(w)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{w.event ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{relativeDate(w.created_at)}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                        resultTone(w.processing_result),
                      )}
                    >
                      {w.processing_result}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={!!logDetail} onOpenChange={(o) => !o && setLogDetail(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do webhook</DialogTitle>
            <DialogDescription>
              {logDetail?.event} · {logDetail && relativeDate(logDetail.created_at)}
            </DialogDescription>
          </DialogHeader>
          {logDetail?.error_message && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {logDetail.error_message}
            </div>
          )}
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            {JSON.stringify(logDetail?.payload ?? {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function resultTone(result: string): string {
  switch (result) {
    case "OK":
      return "bg-success/15 text-success border-success/30";
    case "NOT_FOUND":
      return "bg-warning/20 text-warning-foreground border-warning/40";
    default:
      return "bg-destructive/15 text-destructive border-destructive/30";
  }
}

function KpiCard({
  icon: Icon,
  label,
  value,
  valueTone = "text-foreground",
  delta,
  deltaTone = "text-muted-foreground",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  valueTone?: string;
  delta?: string;
  deltaTone?: string;
}) {
  const Trend = deltaTone.includes("success")
    ? ArrowUp
    : deltaTone.includes("destructive")
      ? ArrowDown
      : null;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className={cn("mt-2 text-2xl font-bold", valueTone)}>{value}</p>
      {delta && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", deltaTone)}>
          {Trend && <Trend className="h-3 w-3" />}
          {delta}
        </p>
      )}
    </Card>
  );
}
