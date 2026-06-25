import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { StatusBadge } from "@/components/StatusBadge";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Bell, CalendarClock, CreditCard, BadgeCheck, LogOut } from "lucide-react";

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
  planos: Plano | null;
}

interface Pagamento {
  id: string;
  valor: number;
  status: string;
  data_pagamento: string | null;
  created_at: string;
  planoNome?: string;
}

function ClienteArea() {
  const { profile, signOut } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cli } = await supabase
      .from("clientes")
      .select("id,data_vencimento,status,mensagem_vendedor,plano_id,planos(id,nome,valor,descricao,ativo)")
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
        .select("id,valor,status,data_pagamento,created_at")
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

  function handleRenovar(plano: Plano) {
    toast.info("Pagamento via Asaas", {
      description:
        "A cobrança será gerada assim que a integração com o Asaas for ativada nas configurações.",
    });
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
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {initials(profile?.nome || profile?.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">Bem-vindo,</p>
              <h1 className="text-xl font-bold text-foreground">
                {profile?.nome || profile?.email}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={headerTone()} />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mensagem do vendedor */}
        {cliente?.mensagem_vendedor && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 p-4">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div>
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
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              <span className="text-sm">Vencimento</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatDate(venc)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {dias == null
                ? "Sem data definida"
                : dias < 0
                  ? `Vencido há ${Math.abs(dias)} dia(s)`
                  : `${dias} dia(s) restantes`}
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">Plano atual</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {cliente?.planos?.nome ?? "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {cliente?.planos ? `${formatCurrency(cliente.planos.valor)}/mês` : "Sem plano"}
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BadgeCheck className="h-4 w-4" />
              <span className="text-sm">Status</span>
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
            Escolha um plano para renovar sua assinatura.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planos.map((p) => {
              const atual = p.id === cliente?.plano_id;
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "flex flex-col p-5",
                    atual && "border-2 border-primary",
                  )}
                >
                  {atual && (
                    <span className="mb-2 inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Plano atual
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-foreground">{p.nome}</h3>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatCurrency(p.valor)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  {p.descricao && (
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.descricao}</p>
                  )}
                  <Button className="mt-4 w-full" onClick={() => handleRenovar(p)}>
                    Renovar via Asaas
                  </Button>
                </Card>
              );
            })}
            {planos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum plano disponível.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Pagamento processado com segurança pela Asaas.
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
                  </TableRow>
                ))}
                {pagamentos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
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
