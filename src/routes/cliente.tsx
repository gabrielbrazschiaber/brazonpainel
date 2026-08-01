import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { StatusBadge } from "@/components/StatusBadge";
import { AppShell } from "@/components/AppShell";
import { useTourDaTela } from "@/components/onboarding/OnboardingProvider";
const AjudaDaTela = lazy(() =>
  import("@/components/onboarding/AjudaDaTela").then((m) => ({ default: m.AjudaDaTela })),
);
import type { AppNavItem } from "@/components/AppSidebar";

import { Card } from "@/components/ui/card";
import { LembretesVencimento } from "@/components/cliente/LembretesVencimento";

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
import {
  Bell,
  CalendarClock,
  CreditCard,
  BadgeCheck,
  RefreshCw,
  MessageSquare,
  FileCheck2,
  ScrollText,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarCobranca } from "@/lib/asaas.functions";
import { validarMeuCupom } from "@/lib/cupons.functions";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Minha assinatura | Brazon" },
      {
        name: "description",
        content:
          "Acompanhe seu plano, vencimentos e faturas, renove a assinatura e abra solicitações para a equipe Brazon.",
      },
      { property: "og:title", content: "Minha assinatura | Brazon" },
      { property: "og:description", content: "Seu plano, faturas e renovação em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  asaas_subscription_id: string | null;
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
  const { profile } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [renovando, setRenovando] = useState<string | null>(null);
  const gerarCobrancaFn = useServerFn(gerarCobranca);
  const validarCupomFn = useServerFn(validarMeuCupom);
  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{
    codigo: string;
    valor_desconto: number;
  } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cli, error: erroCli } = await supabase
        .from("clientes")
        .select(
          "id,data_vencimento,status,mensagem_vendedor,plano_id,servico_extra,servico_extra_valor,asaas_subscription_id,planos(id,nome,valor,descricao,ativo)",
        )
        .limit(1)
        .maybeSingle();
      if (erroCli) throw new Error(erroCli.message);
      setCliente((cli ?? null) as unknown as Cliente);

      const { data: pls, error: erroPls } = await supabase
        .from("planos")
        .select("id,nome,valor,descricao,ativo")
        .eq("ativo", true)
        .order("valor");
      if (erroPls) throw new Error(erroPls.message);
      setPlanos((pls ?? []) as Plano[]);

      if (cli?.id) {
        const { data: pgs, error: erroPgs } = await supabase
          .from("pagamentos")
          .select("id,valor,status,data_pagamento,created_at,invoice_url")
          .eq("cliente_id", cli.id)
          .order("created_at", { ascending: false });
        if (erroPgs) throw new Error(erroPgs.message);
        setPagamentos((pgs ?? []) as Pagamento[]);
      } else {
        setPagamentos([]);
      }
    } catch (e) {
      // Antes o erro era ignorado e a tela ficava vazia sem explicação.
      toast.error("Não foi possível carregar seus dados", {
        description: e instanceof Error ? e.message : "Tente novamente em instantes.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dias = daysUntil(cliente?.data_vencimento);
  const venc = cliente?.data_vencimento;
  const totalMensal = (cliente?.planos?.valor ?? 0) + (cliente?.servico_extra_valor ?? 0);
  const assinaturaAtiva = Boolean(cliente?.asaas_subscription_id);
  const faturaPendente = pagamentos.find((p) => p.status === "pendente" && p.invoice_url);

  function headerTone() {
    if (cliente?.status === "ativo" && (dias == null || dias > 5)) return "ativo";
    if (cliente?.status === "vencido" || cliente?.status === "inadimplente") return "vencido";
    if (dias != null && dias <= 5) return "vencendo";
    return cliente?.status ?? "ativo";
  }

  const navItems: AppNavItem[] = [
    { value: "assinatura", label: "Minha assinatura", icon: CreditCard, to: "/cliente" },
    { value: "solicitacoes", label: "Solicitações", icon: MessageSquare, to: "/solicitacoes" },
    { value: "aceites", label: "Meus aceites", icon: FileCheck2, to: "/meus-aceites" },
    { value: "termos", label: "Termos de Uso", icon: ScrollText, to: "/termos-de-uso" },
  ];

  async function aplicarCupom() {
    const cod = codigoCupom.trim();
    if (!cod) {
      toast.error("Digite o código do cupom.");
      return;
    }
    setValidandoCupom(true);
    try {
      const res = await validarCupomFn({ data: { codigo: cod } });
      if (!res.valido) {
        setCupomAplicado(null);
        toast.error(res.mensagem);
        return;
      }
      setCodigoCupom(res.codigo);
      setCupomAplicado({ codigo: res.codigo, valor_desconto: res.valor_desconto });
      toast.success(`Cupom ${res.codigo} aplicado.`);
    } catch {
      toast.error("Não foi possível validar o cupom agora.");
    } finally {
      setValidandoCupom(false);
    }
  }

  async function handleRenovar(plano: Plano) {
    setRenovando(plano.id);
    try {
      const res = await gerarCobrancaFn({
        data: {
          plano_id: plano.id,
          tipoPagamento: "PIX",
          cupom: cupomAplicado?.codigo ?? null,
        },
      });
      if (res.descontoAplicado > 0) {
        toast.success(
          `Cupom ${res.cupom} aplicado: ${formatCurrency(res.descontoAplicado)} de desconto na 1ª mensalidade.`,
        );
      }
      const url = res.invoiceUrl || res.bankSlipUrl;
      if (url) {
        // Como a abertura acontece após um await, o navegador (principalmente
        // no celular) pode bloquear o pop-up. Nesse caso oferecemos o link.
        const janela = window.open(url, "_blank", "noopener,noreferrer");
        if (janela) {
          toast.success("Assinatura mensal gerada!", {
            description: "A cobrança se repete todo mês. Abrindo a página de pagamento...",
          });
        } else {
          toast.success("Assinatura mensal gerada!", {
            description: "Seu navegador bloqueou a nova aba. Toque para abrir a fatura.",
            duration: 15000,
            action: {
              label: "Abrir fatura",
              onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
            },
          });
        }
      } else {
        toast.success("Assinatura mensal criada com sucesso.");
      }

      await load();
    } catch (err) {
      toast.error("Não foi possível gerar a cobrança", {
        description: err instanceof Error ? err.message : "Verifique a configuração do Asaas.",
      });
    } finally {
      setRenovando(null);
    }
  }

  useTourDaTela("tela:cliente", !loading);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AppShell
      contexto="Minha assinatura"
      items={navItems}
      larguraMax="max-w-5xl"
      headerExtra={
        <>
          <Suspense fallback={null}>
            <AjudaDaTela chave="tela:cliente" />
          </Suspense>
          <StatusBadge status={headerTone()} />
        </>
      }
    >
      <div>
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

        {/* Lembretes automáticos de vencimento */}
        <LembretesVencimento />

        {/* Mensagem do vendedor */}

        {cliente?.mensagem_vendedor && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 p-3 sm:p-4">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warning-foreground">
                Mensagem do seu vendedor
              </p>
              <p className="mt-1 text-sm text-warning-foreground/90">{cliente.mensagem_vendedor}</p>
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
              <span className="min-w-0 text-xs font-medium leading-tight sm:text-sm">
                Vencimento
              </span>
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
          <Card data-tour="cli-plano" className="card-interactive p-4 sm:p-5">
            <div className="flex items-center gap-2 text-muted-foreground sm:gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
                <CreditCard className="h-4 w-4" />
              </span>
              <span className="min-w-0 text-xs font-medium leading-tight sm:text-sm">
                Plano atual
              </span>
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
                Total:{" "}
                {formatCurrency(
                  (cliente?.planos?.valor ?? 0) + (cliente?.servico_extra_valor ?? 0),
                )}
                /mês
              </p>
            )}
          </Card>
          <Card
            data-tour="cli-status"
            className="card-interactive p-4 sm:p-5 min-[420px]:col-span-2 lg:col-span-1"
          >
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

        {/* Próxima cobrança recorrente */}
        {cliente?.plano_id && (
          <section className="mt-6">
            <Card className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <RefreshCw className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium sm:text-sm">
                      {assinaturaAtiva ? "Próxima cobrança automática" : "Próxima renovação"}
                    </span>
                  </div>
                  <p className="mt-3 text-xl font-bold text-foreground sm:text-2xl">
                    {venc ? formatDate(venc) : "A definir"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {totalMensal > 0 ? `${formatCurrency(totalMensal)}/mês` : "Valor a definir"}
                    {dias != null &&
                      (dias < 0
                        ? ` · vencido há ${Math.abs(dias)} dia(s)`
                        : ` · em ${dias} dia(s)`)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {assinaturaAtiva
                      ? "Sua assinatura mensal está ativa: a cobrança é gerada automaticamente a cada ciclo e esta data é atualizada quando o pagamento é confirmado."
                      : "Ative a assinatura mensal recorrente abaixo para que a cobrança seja gerada automaticamente todo mês."}
                  </p>
                </div>
                {faturaPendente && (
                  <Button
                    variant="outline"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => window.open(faturaPendente.invoice_url!, "_blank", "noopener")}
                  >
                    Abrir fatura em aberto
                  </Button>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* Renovar assinatura */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-foreground">Renovar assinatura</h2>
          <p className="text-sm text-muted-foreground">
            Ative a cobrança mensal recorrente do seu plano atual — o pagamento é gerado
            automaticamente todo mês.
          </p>
          {/* Cupom de desconto */}
          {cliente?.plano_id && !assinaturaAtiva && (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
              <label htmlFor="cupom" className="text-sm font-medium text-foreground">
                Cupom de desconto
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="cupom"
                  value={codigoCupom}
                  onChange={(e) => {
                    setCodigoCupom(e.target.value.toUpperCase());
                    setCupomAplicado(null);
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={aplicarCupom}
                  disabled={validandoCupom}
                  className="sm:w-32"
                >
                  {validandoCupom ? "Validando..." : cupomAplicado ? "Aplicado" : "Aplicar"}
                </Button>
              </div>
              {cupomAplicado && (
                <div className="mt-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Mensalidade</span>
                    <span>{formatCurrency(totalMensal)}</span>
                  </div>
                  <div className="flex justify-between text-success">
                    <span>Cupom {cupomAplicado.codigo}</span>
                    <span>
                      -{formatCurrency(Math.min(cupomAplicado.valor_desconto, totalMensal))}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold text-foreground">
                    <span>1ª mensalidade</span>
                    <span>
                      {formatCurrency(Math.max(totalMensal - cupomAplicado.valor_desconto, 0))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A partir do 2º mês: {formatCurrency(totalMensal)}/mês.
                  </p>
                </div>
              )}
            </div>
          )}

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
                    {renovando === p.id
                      ? "Gerando cobrança..."
                      : "Assinar mensalmente (recorrente)"}
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
            Pagamento recorrente mensal processado com segurança pela Asaas. Você pode cancelar
            quando quiser falando com seu vendedor.
          </p>
        </section>

        {/* Histórico de pagamentos */}
        <section data-tour="cli-historico" className="mt-10">
          <h2 className="text-lg font-bold text-foreground">Histórico de pagamentos</h2>
          <Card className="mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="hidden sm:table-cell">Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fatura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((pg) => (
                  <TableRow key={pg.id}>
                    <TableCell>
                      {formatDate(pg.data_pagamento || pg.created_at)}
                      <span className="block text-xs text-muted-foreground sm:hidden">
                        {cliente?.planos?.nome ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {cliente?.planos?.nome ?? "—"}
                    </TableCell>
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
    </AppShell>
  );
}
