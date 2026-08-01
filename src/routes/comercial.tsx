import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ListChecks,
  Loader2,
  Pencil,
  RefreshCw,
  Target,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";

import { useAuth, roleHome } from "@/lib/auth";
import { GateDependenteDePapel } from "@/components/GateEstado";
import { TermosGate } from "@/components/TermosGate";
import { OnboardingProvider, useTourDaTela } from "@/components/onboarding/OnboardingProvider";
import { AjudaDaTela } from "@/components/onboarding/AjudaDaTela";
import { BrazonLogo } from "@/components/BrazonLogo";
import { SairButton } from "@/components/SairButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvisosSino } from "@/components/AvisosSino";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadsSkeletonCards, LeadsSkeletonRows } from "@/components/comercial/LeadsSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ComercialDashboard } from "@/components/comercial/ComercialDashboard";
import { LeadDetalheSheet } from "@/components/comercial/LeadDetalheSheet";
import { LeadFormDialog } from "@/components/comercial/LeadFormDialog";
import { FollowUpsPanel } from "@/components/comercial/FollowUpsPanel";
import { ImportarLeadsDialog } from "@/components/comercial/ImportarLeadsDialog";
import { CompletarLeadsDialog } from "@/components/comercial/CompletarLeadsDialog";
import { Progress } from "@/components/ui/progress";

import { formatCurrency, formatDate } from "@/lib/format";
import { mapaWhatsApp } from "@/lib/whatsapp";
import { WhatsAppIndicator } from "@/components/WhatsAppIndicator";

import {
  ESTAGIO_LABEL,
  LEAD_ESTAGIOS,
  LEAD_ORIGENS,
  ORIGEM_LABEL,
  estagioClasse,
  type LeadEstagio,
  type LeadOrigem,
} from "@/lib/leads";
import {
  dashboardComercial,
  excluirLead,
  listarLeads,
  listarSegmentos,
  listarVendedoresComercial,
  type DashboardComercial,
  type Lead,
} from "@/lib/leads.functions";

export const Route = createFileRoute("/comercial")({
  head: () => ({
    meta: [
      { title: "Gestão comercial de leads | Brazon" },
      {
        name: "description",
        content:
          "Cadastre leads prospectados, atualize o estágio do funil, registre reuniões e acompanhe a conversão do time comercial.",
      },
      { property: "og:title", content: "Gestão comercial de leads | Brazon" },
      {
        property: "og:description",
        content:
          "Funil de vendas, reuniões e taxa de conversão do time comercial em uma única página.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComercialPage,
});

const PERIODOS = [
  { valor: 7, label: "7 dias" },
  { valor: 30, label: "30 dias" },
  { valor: 90, label: "90 dias" },
  { valor: 0, label: "Todo o período" },
];

function ComercialPage() {
  const { loading, session, role, roleResolvido } = useAuth();
  const navigate = useNavigate();

  const permitido = role === "admin" || role === "vendedor";

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/login", replace: true });
    // Redireciona por papel apenas quando ele já está resolvido.
    else if (roleResolvido && role && !permitido) {
      void navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, session, role, roleResolvido, permitido, navigate]);

  return (
    <GateDependenteDePapel pronto={Boolean(role) && permitido}>
      <TermosGate>
        <OnboardingProvider>
          <ComercialConteudo isAdmin={role === "admin"} home={roleHome(role)} />
        </OnboardingProvider>
      </TermosGate>
    </GateDependenteDePapel>
  );
}

const POR_PAGINA = 25;

/** Cabeçalho da tabela de leads (compartilhado com o skeleton). */
function CabecalhoLeads() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Contato</TableHead>
        <TableHead>Telefone</TableHead>
        <TableHead>Segmento</TableHead>
        <TableHead>Estágio</TableHead>
        <TableHead className="w-28">Completude</TableHead>
        <TableHead className="text-right">Valor</TableHead>
        <TableHead className="text-right">Reuniões</TableHead>
        <TableHead>Próximo contato</TableHead>
        <TableHead className="text-right">Ações</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/**
 * Data do próximo contato colorida pela urgência:
 * vermelho atrasado, âmbar hoje, cinza futuro; traço quando a cadência acabou.
 */
function ProximoContatoCell({ lead }: { lead: Lead }) {
  if (!lead.proximo_contato) {
    return (
      <span
        className="text-muted-foreground"
        title={lead.cadencia_encerrada ? "Cadência encerrada" : "Sem follow-up agendado"}
      >
        —
      </span>
    );
  }
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate(),
  ).padStart(2, "0")}`;
  const cor =
    lead.proximo_contato < hojeISO
      ? "text-destructive font-medium"
      : lead.proximo_contato === hojeISO
        ? "text-amber-600 dark:text-amber-400 font-medium"
        : "text-muted-foreground";
  return <span className={`whitespace-nowrap ${cor}`}>{formatDate(lead.proximo_contato)}</span>;
}

function ComercialConteudo({ isAdmin, home }: { isAdmin: boolean; home: string }) {
  const carregarLeads = useServerFn(listarLeads);
  const carregarDashboard = useServerFn(dashboardComercial);
  const carregarSegmentos = useServerFn(listarSegmentos);
  const carregarVendedores = useServerFn(listarVendedoresComercial);
  const remover = useServerFn(excluirLead);

  const [dias, setDias] = useState(30);
  const [vendedorId, setVendedorId] = useState("todos");
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [segmentos, setSegmentos] = useState<string[]>([]);

  const [dados, setDados] = useState<DashboardComercial | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroMais, setErroMais] = useState<string | null>(null);
  const sentinela = useRef<HTMLDivElement | null>(null);

  const [busca, setBusca] = useState("");
  const [estagio, setEstagio] = useState<LeadEstagio | "todos">("todos");
  const [segmento, setSegmento] = useState("todos");
  const [origem, setOrigem] = useState<LeadOrigem | "todas">("todas");
  const [followUp, setFollowUp] = useState(false);
  const [soZap, setSoZap] = useState(false);
  /** Aba/filtro de leads com dados faltando. */
  const [incompletos, setIncompletos] = useState(false);
  const [abaFollowUp, setAbaFollowUp] = useState<"atrasados" | "hoje" | "proximos" | undefined>(
    undefined,
  );
  const [ordem, setOrdem] = useState<"recentes" | "completude">("recentes");
  /** Filtro por lote de importação (vem do resultado da importação). */
  const [loteId, setLoteId] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [completarAberto, setCompletarAberto] = useState(false);
  const [editando, setEditando] = useState<Lead | null>(null);
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [excluindo, setExcluindo] = useState<Lead | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const filtroVendedor = isAdmin && vendedorId !== "todos" ? vendedorId : undefined;

  const filtrosLeads = useMemo(
    () => ({
      dias,
      ...(filtroVendedor ? { vendedor_id: filtroVendedor } : {}),
      ...(estagio !== "todos" ? { estagio } : {}),
      ...(origem !== "todas" ? { origem } : {}),
      ...(segmento !== "todos" ? { segmento } : {}),
      ...(busca.trim() ? { busca: busca.trim() } : {}),
      ...(followUp ? { apenas_follow_up: true } : {}),
      ...(incompletos ? { apenas_incompletos: true } : {}),
      ...(loteId ? { importacao_id: loteId } : {}),
      ordem,
    }),
    [dias, filtroVendedor, estagio, origem, segmento, busca, followUp, incompletos, loteId, ordem],
  );

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    setErroMais(null);
    try {
      const [d, l] = await Promise.all([
        carregarDashboard({
          data: { dias, ...(filtroVendedor ? { vendedor_id: filtroVendedor } : {}) },
        }),
        carregarLeads({ data: { ...filtrosLeads, pagina: 0, por_pagina: POR_PAGINA } }),
      ]);
      setDados(d);
      setLeads(l.leads);
      setTotal(l.total);
      setTemMais(l.temMais);
      setPagina(0);
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : "Não foi possível carregar os leads.");
    } finally {
      setCarregando(false);
    }
  }, [carregarDashboard, carregarLeads, dias, filtroVendedor, filtrosLeads]);

  /** Próxima página: acrescenta ao final da lista já carregada. */
  const carregarMais = useCallback(async () => {
    if (carregandoMais || !temMais) return;
    const proxima = pagina + 1;
    setCarregandoMais(true);
    setErroMais(null);
    try {
      const l = await carregarLeads({
        data: { ...filtrosLeads, pagina: proxima, por_pagina: POR_PAGINA },
      });
      setLeads((atuais) => {
        const vistos = new Set(atuais.map((x) => x.id));
        return [...atuais, ...l.leads.filter((x) => !vistos.has(x.id))];
      });
      setTotal(l.total);
      setTemMais(l.temMais);
      setPagina(proxima);
    } catch (err) {
      setErroMais(err instanceof Error ? err.message : "Não foi possível carregar mais leads.");
    } finally {
      setCarregandoMais(false);
    }
  }, [carregarLeads, carregandoMais, filtrosLeads, pagina, temMais]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Infinite scroll: observa a sentinela no fim da lista.
  useEffect(() => {
    const alvo = sentinela.current;
    // Com erro pendente o carregamento automático para: o usuário decide
    // quando tentar novamente, evitando loop de requisições que falham.
    if (!alvo || !temMais || erroMais) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) void carregarMais();
      },
      { rootMargin: "200px" },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [carregarMais, temMais, erroMais]);

  useEffect(() => {
    void carregarSegmentos({})
      .then(setSegmentos)
      .catch(() => undefined);
    if (isAdmin) {
      void carregarVendedores({})
        .then(setVendedores)
        .catch(() => undefined);
    }
  }, [carregarSegmentos, carregarVendedores, isAdmin]);

  const listaSegmentos = useMemo(() => segmentos, [segmentos]);
  /** Status de WhatsApp calculado uma vez por carregamento da lista. */
  const statusZap = useMemo(() => mapaWhatsApp(leads), [leads]);
  /** Filtro local: mostra apenas contatos com WhatsApp ativo. */
  const leadsVisiveis = useMemo(
    () => (soZap ? leads.filter((l) => statusZap.get(l.id) === "ativo") : leads),
    [leads, soZap, statusZap],
  );

  async function confirmarExclusao() {
    if (!excluindo) return;
    setOcupado(true);
    try {
      await remover({ data: { id: excluindo.id } });
      toast.success("Lead excluído.");
      setExcluindo(null);
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o lead.");
    } finally {
      setOcupado(false);
    }
  }

  useTourDaTela("tela:comercial", !carregando && Boolean(dados));

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-header sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/60 px-3 pt-[env(safe-area-inset-top)] sm:px-6">
        <Button asChild variant="ghost" size="sm" className="h-10 w-10 p-0 sm:w-auto sm:px-3">
          <Link to={home} aria-label="Voltar ao painel">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:ml-2 sm:inline">Painel</span>
          </Link>
        </Button>
        <BrazonLogo className="hidden h-7 sm:block" />
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
          <AjudaDaTela chave="tela:comercial" />
          <ThemeToggle />
          <AvisosSino />
          <SairButton variante="icone" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Comercial
            </p>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Gestão comercial</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre seus leads, registre reuniões e acompanhe sua conversão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              data-tour="comercial-importar"
              variant="outline"
              onClick={() => setImportarAberto(true)}
            >
              <Upload className="mr-2 h-4 w-4" /> Importar planilha
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIncompletos(true);
                setOrdem("completude");
                setCompletarAberto(true);
              }}
            >
              <ListChecks className="mr-2 h-4 w-4" /> Completar leads
            </Button>
            <Button
              data-tour="comercial-novo-lead"
              onClick={() => {
                setEditando(null);
                setFormAberto(true);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Novo lead
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map((p) => (
            <Button
              key={p.valor}
              size="sm"
              variant={dias === p.valor ? "default" : "outline"}
              onClick={() => setDias(p.valor)}
            >
              {p.label}
            </Button>
          ))}
          {isAdmin && (
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os vendedores</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div id="follow-ups" data-tour="comercial-followups">
          <FollowUpsPanel
            isAdmin={isAdmin}
            vendedorId={filtroVendedor}
            onAtualizado={() => void recarregar()}
            abaInicial={abaFollowUp}
          />
        </div>

        {carregando && !dados ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          dados && (
            <ComercialDashboard
              dados={dados}
              onVerIncompletos={() => {
                setIncompletos(true);
                setOrdem("completude");
              }}
              onVerFollowUps={() => {
                setAbaFollowUp("atrasados");
                document
                  .getElementById("follow-ups")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          )
        )}

        <Card className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Buscar por nome, empresa ou telefone"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Select value={estagio} onValueChange={(v) => setEstagio(v as LeadEstagio | "todos")}>
              <SelectTrigger>
                <SelectValue placeholder="Estágio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estágios</SelectItem>
                {LEAD_ESTAGIOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTAGIO_LABEL[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={segmento} onValueChange={setSegmento}>
              <SelectTrigger>
                <SelectValue placeholder="Segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os segmentos</SelectItem>
                {listaSegmentos.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={origem} onValueChange={(v) => setOrigem(v as LeadOrigem | "todas")}>
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {LEAD_ORIGENS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {ORIGEM_LABEL[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch id="follow-up" checked={followUp} onCheckedChange={setFollowUp} />
              <Label htmlFor="follow-up" className="text-sm">
                Só follow-up de hoje
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="so-whatsapp" checked={soZap} onCheckedChange={setSoZap} />
              <Label htmlFor="so-whatsapp" className="text-sm">
                Só com WhatsApp ativo
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="so-incompletos"
                checked={incompletos}
                onCheckedChange={(v) => {
                  setIncompletos(v);
                  setOrdem(v ? "completude" : "recentes");
                }}
              />
              <Label htmlFor="so-incompletos" className="text-sm">
                Só incompletos
              </Label>
            </div>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as "recentes" | "completude")}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes primeiro</SelectItem>
                <SelectItem value="completude">Menos completos primeiro</SelectItem>
              </SelectContent>
            </Select>
            {loteId && (
              <Button variant="ghost" size="sm" onClick={() => setLoteId(null)}>
                Limpar filtro de lote
              </Button>
            )}
          </div>

          {carregando ? (
            <>
              <LeadsSkeletonCards />
              <div className="hidden sm:block">
                <Table>
                  <CabecalhoLeads />
                  <TableBody>
                    <LeadsSkeletonRows />
                  </TableBody>
                </Table>
              </div>
            </>
          ) : erroLista ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-10 text-center"
            >
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Não foi possível carregar os leads.
                </p>
                <p className="text-xs text-muted-foreground">{erroLista}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void recarregar()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          ) : leadsVisiveis.length === 0 ? (
            <EmptyState
              icon={Target}
              titulo={
                soZap
                  ? "Nenhum lead com WhatsApp ativo nos filtros atuais."
                  : "Nenhum lead ainda. Cadastre o primeiro contato do dia."
              }
              descricao={
                soZap
                  ? "Confira se os telefones estão cadastrados com DDD e número de celular."
                  : "Cada lead cadastrado alimenta o funil e as taxas de conversão desta página."
              }
            />
          ) : (
            <>
              {/* Mobile: cards empilhados */}
              <div className="space-y-3 sm:hidden">
                {leadsVisiveis.map((l) => (
                  <Card
                    key={l.id}
                    className="cursor-pointer space-y-2 p-4"
                    onClick={() => setDetalhe(l)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.nome_contato}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[l.empresa, l.cargo].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <Badge variant="outline" className={estagioClasse(l.estagio)}>
                        {ESTAGIO_LABEL[l.estagio]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {l.telefone}
                        <WhatsAppIndicator
                          telefone={l.telefone}
                          status={statusZap.get(l.id)}
                          size="sm"
                        />
                      </span>

                      <span className="text-right">{formatCurrency(l.valor_estimado)}</span>
                      <span>{l.segmento || "Sem segmento"}</span>
                      <span className="text-right">
                        {l.reunioes_count} reuniã{l.reunioes_count === 1 ? "o" : "es"}
                      </span>
                      <span className="col-span-2">
                        Próximo contato: <ProximoContatoCell lead={l} />
                      </span>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop: tabela */}
              <div className="hidden sm:block">
                <Table>
                  <CabecalhoLeads />
                  <TableBody>
                    {leadsVisiveis.map((l) => (
                      <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetalhe(l)}>
                        <TableCell>
                          <p className="font-medium">{l.nome_contato}</p>
                          <p className="text-xs text-muted-foreground">
                            {[l.empresa, l.cargo].filter(Boolean).join(" · ") || "—"}
                            {isAdmin && l.vendedor_nome ? ` · ${l.vendedor_nome}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            {l.telefone}
                            <WhatsAppIndicator
                              telefone={l.telefone}
                              status={statusZap.get(l.id)}
                              size="sm"
                            />
                          </span>
                        </TableCell>

                        <TableCell>{l.segmento || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={estagioClasse(l.estagio)}>
                            {ESTAGIO_LABEL[l.estagio]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={l.completude} className="h-1.5 w-14" />
                            <span className="text-xs text-muted-foreground">{l.completude}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(l.valor_estimado)}
                        </TableCell>
                        <TableCell className="text-right">{l.reunioes_count}</TableCell>
                        <TableCell>
                          <ProximoContatoCell lead={l} />
                        </TableCell>

                        <TableCell className="text-right">
                          <div
                            className="flex justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Editar lead"
                              onClick={() => {
                                setEditando(l);
                                setFormAberto(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Excluir lead"
                              onClick={() => setExcluindo(l)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div
                ref={sentinela}
                className="flex flex-col items-center gap-2 pt-2 text-xs text-muted-foreground"
              >
                <span aria-live="polite">
                  Mostrando {leadsVisiveis.length} de {total} lead{total === 1 ? "" : "s"}
                  {soZap ? " (só com WhatsApp ativo)" : ""}
                </span>

                {carregandoMais && (
                  <div className="w-full space-y-2" aria-hidden="true">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                )}

                {erroMais && !carregandoMais && (
                  <div role="alert" className="flex flex-col items-center gap-2">
                    <p className="text-destructive">{erroMais}</p>
                    <Button variant="outline" size="sm" onClick={() => void carregarMais()}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
                    </Button>
                  </div>
                )}

                {temMais && !carregandoMais && !erroMais && (
                  <Button variant="outline" size="sm" onClick={() => void carregarMais()}>
                    Carregar mais
                  </Button>
                )}

                {!temMais && !carregandoMais && !erroMais && leads.length > 0 && (
                  <span>Todos os leads deste filtro foram carregados.</span>
                )}
              </div>
            </>
          )}
        </Card>
      </main>

      <LeadFormDialog
        aberto={formAberto}
        onOpenChange={setFormAberto}
        lead={editando}
        segmentos={listaSegmentos}
        vendedores={vendedores}
        isAdmin={isAdmin}
        onSalvo={() => void recarregar()}
      />

      <ImportarLeadsDialog
        aberto={importarAberto}
        onOpenChange={setImportarAberto}
        isAdmin={isAdmin}
        vendedores={vendedores}
        segmentos={listaSegmentos}
        onConcluido={() => void recarregar()}
        onVerLote={(importacaoId) => {
          setLoteId(importacaoId);
          setIncompletos(true);
          setOrdem("completude");
        }}
      />

      <CompletarLeadsDialog
        aberto={completarAberto}
        onOpenChange={setCompletarAberto}
        leads={leads.filter((l) => l.completude < 100)}
        segmentos={listaSegmentos}
        onAtualizado={() => void recarregar()}
      />

      <LeadDetalheSheet
        lead={detalhe}
        aberto={Boolean(detalhe)}
        onOpenChange={(v) => {
          if (!v) setDetalhe(null);
        }}
        onAtualizado={() => void recarregar()}
      />

      <AlertDialog open={Boolean(excluindo)} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>
              O lead {excluindo?.nome_contato} e todo o histórico dele serão removidos. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={ocupado} onClick={() => void confirmarExclusao()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
