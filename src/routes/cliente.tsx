import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { StatusBadge } from "@/components/StatusBadge";
import { BrazonLogo } from "@/components/BrazonLogo";
import { NovidadesSino } from "@/components/NovidadesSino";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, daysUntil, initials } from "@/lib/format";

import { toast } from "sonner";
import { Bell, CalendarClock, CreditCard, BadgeCheck, LogOut } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarCobranca } from "@/lib/asaas.functions";

export const Route = createFileRoute("/cliente")({
  head: () => ({ meta: [{ title: "Minha assinatura" }] }),
  component: () => (
    <RequireRole role="cliente">
      <ClienteArea />
    </RequireRole>
  ),
});

interface Plano {
  id: string;
  nome: string;
  valor: number;
  descricao: string | null;
  ativo: boolean;
}

interface Cliente {
  id: string;
  data_vencimento: string | null;
  status: string;
  mensagem_vendedor: string | null;
  plano_id: string | null;
  servico_extra: string | null;
  servico_extra_valor: number | null;
  planos: Plano | null;
}

interface Pagamento {
  id: string;
  valor: number;
  status: string;
  data_pagamento: string | null;
  created_at: string;
  invoice_url: string | null;
  planoNome?: string;
}

function ClienteArea() {
  const { profile, signOut } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [renovando, setRenovando] = useState<string | null>(null);
  const gerarCobrancaFn = useServerFn(gerarCobranca);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cli } = await supabase
      .from("clientes")
      .select("id,data_vencimento,status,mensagem_vendedor,plano_id,servico_extra,servico_extra_valor,planos(id,nome,valor,descricao,ativo)")
      .maybeSingle();
    setCliente(cli as unknown as Cliente);

    const { data: pls } = await supabase
      .from("planos")
      .select("id,nome,valor,descricao,ativo")
      .eq("ativo", true)
      .order("valor");
    setPlanos((pls ?? []) as Plano[]);

    if (cli?.id) {
      const { data: pgs } = await supabase
        .from("pagamentos")
        .select("id,valor,status,data_pagamento,created_at,invoice_url")
        .eq("cliente_id", cli.id)
        .order("created_at", { ascending: false });
      setPagamentos((pgs ?? []) as Pagamento[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dias = daysUntil(cliente?.data_vencimento);
  const venc = cliente?.data_vencimento;

  function headerTone() {
    if (cliente?.status === "ativo" && (dias == null || dias > 5)) return "ativo";
    if (cliente?.status === "vencido" || cliente?.status === "inadimplente") return "vencido";
    if (dias != null && dias <= 5) return "vencendo";
    return cliente?.status ?? "ativo";
  }

  async function handleRenovar(plano: Plano) {
    setRenovando(plano.id);
    try {
      const res = await gerarCobrancaFn({
        data: { plano_id: plano.id, tipoPagamento: "PIX" },
      });
      const url = res.invoiceUrl || res.bankSlipUrl;
      if (url) {
        toast.success("Assinatura mensal gerada!", {
          description: "A cobrança se repete todo mês. Abrindo a página de pagamento...",
        });
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.success("Assinatura mensal criada com sucesso.");
      }
      await load();
    } catch (err) {
      toast.error("Não foi possível gerar a cobrança", {
        description:
          err instanceof Error ? err.message : "Verifique a configuração do Asaas.",
      });
    } finally {
      setRenovando(null);
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Barra superior fixa */}
      <header className="glass-header sticky top-0 z-30 border-b border-border/60">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 sm:flex sm:justify-between sm:gap-4 sm:px-4">
          <div className="min-w-0"><BrazonLogo /></div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">

            <StatusBadge status={headerTone()} />
            <NovidadesSino />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </header>

      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        {/* Boas-vindas */}
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/15 sm:h-12 sm:w-12">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {initials(profile?.nome || profile?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Bem-vindo,</p>
            <h1 className="truncate text-lg font-bold text-foreground sm:text-2xl">
              {profile?.nome || profile?.email}
            </h1>
          </div>
        </div>

        {/* Mensagem do vendedor */}
        {cliente?.mensagem_vendedor && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 p-3 sm:p-4">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warning-foreground">
                Mensagem do seu vendedor
              </p>
              <p className="mt-1 text-sm text-warning-foreground/90">
                {cliente.mensagem_vendedor}
              </p>
            </div>
          </div>
        )}

        {/* Cards de resumo */}
        <section className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <Card className="card-interactive p-4 sm:p-5">
            <div className="flex items-center gap-2 text-muted-foreground sm:gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
                <CalendarClock className="h-4 w-4" />
              </span>
              <span className="min-w-0 text-xs font-medium leading-tight sm:text-sm">Vencimento</span>
            </div>
            <p className="mt-3 text-xl font-bold text-foreground sm:text-2xl">{formatDate(venc)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {dias == null
                ? "Sem data definida"
                : dias < 0
                  ? `Vencido há ${Math.abs(dias)} dia(s)`
                  : `${dias} dia(s) restantes`}
            </p>
          </Card>
          <Card className="card-interactive p-4 sm:p-5">
            <div className="flex items-center gap-2 text-muted-foreground sm:gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
                <CreditCard className="h-4 w-4" />
              </span>
              <span className="min-w-0 text-xs font-medium leading-tight sm:text-sm">Plano atual</span>
            </div>
            <p className="mt-3 text-xl font-bold text-foreground sm:text-2xl">
              {cliente?.planos?.nome ?? "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {cliente?.planos ? `${formatCurrency(cliente.planos.valor)}/mês` : "Sem plano"}
            </p>
            {cliente?.servico_extra && (
              <p className="mt-1 text-sm text-muted-foreground">
                + {cliente.servico_extra} ({formatCurrency(cliente.servico_extra_valor ?? 0)})
              </p>
            )}
            {(cliente?.planos?.valor || cliente?.servico_extra_valor) && (
              <p className="mt-2 text-sm font-semibold text-foreground">
                Total: {formatCurrency((cliente?.planos?.valor ?? 0) + (cliente?.servico_extra_valor ?? 0))}/mês
              </p>
            )}
          </Card>
          <Card className="card-interactive p-4 sm:p-5 min-[420px]:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-muted-foreground sm:gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
                <BadgeCheck className="h-4 w-4" />
              </span>
              <span className="min-w-0 text-xs font-medium leading-tight sm:text-sm">Status</span>
            </div>
            <div className="mt-3">
              <StatusBadge status={cliente?.status ?? "ativo"} className="text-sm" />
            </div>
          </Card>
        </section>


        {/* Renovar assinatura */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-foreground">Renovar assinatura</h2>
          <p className="text-sm text-muted-foreground">
            Ative a cobrança mensal recorrente do seu plano atual — o pagamento é gerado automaticamente todo mês.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planos
              .filter((p) => p.id === cliente?.plano_id)
              .map((p) => (
                <Card key={p.id} className="flex flex-col p-5 border-2 border-primary">
                  <span className="mb-2 inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Plano atual
                  </span>
                  <h3 className="text-base font-semibold text-foreground">{p.nome}</h3>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatCurrency(p.valor)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  {p.descricao && (
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.descricao}</p>
                  )}
                  <Button
                    className="mt-4 w-full"
                    onClick={() => handleRenovar(p)}
                    disabled={renovando !== null}
                  >
                    {renovando === p.id ? "Gerando cobrança..." : "Assinar mensalmente (recorrente)"}
                  </Button>
                </Card>
              ))}
            {!cliente?.plano_id && (
              <p className="text-sm text-muted-foreground">
                Nenhum plano associado à sua conta. Fale com seu vendedor.
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Pagamento recorrente mensal processado com segurança pela Asaas. Você pode cancelar quando quiser falando com seu vendedor.
          </p>
        </section>

        {/* Histórico de pagamentos */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-foreground">Histórico de pagamentos</h2>
          <Card className="mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fatura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((pg) => (
                  <TableRow key={pg.id}>
                    <TableCell>{formatDate(pg.data_pagamento || pg.created_at)}</TableCell>
                    <TableCell>{cliente?.planos?.nome ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(pg.valor)}</TableCell>
                    <TableCell>
                      <StatusBadge status={pg.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {pg.status === "pendente" && pg.invoice_url ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(pg.invoice_url!, "_blank", "noopener")}
                        >
                          Abrir fatura
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {pagamentos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhum pagamento registrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
    </div>
  );
}
