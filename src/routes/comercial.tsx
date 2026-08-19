import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ListChecks,
  PlayCircle,
  RefreshCw,
  SlidersHorizontal,
  Target,
  Upload,
  UserPlus,
} from "lucide-react";

import { useAuth, roleHome } from "@/lib/auth";
import { GateDependenteDePapel } from "@/components/GateEstado";
import { TermosGate } from "@/components/TermosGate";
import { OnboardingProvider, useTourDaTela } from "@/components/onboarding/OnboardingProvider";
import { MontarQuandoAberto } from "@/components/MontarQuandoAberto";

const AjudaDaTela = lazy(() =>
  import("@/components/onboarding/AjudaDaTela").then((m) => ({ default: m.AjudaDaTela })),
);
import { useJanelaVirtual } from "@/lib/use-janela-virtual";
import { TelaShell } from "@/components/TelaShell";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CardsEsqueleto } from "@/components/ui/loading-state";

import { Skeleton } from "@/components/ui/skeleton";
import { LeadsSkeletonCards, LeadsSkeletonRows } from "@/components/comercial/LeadsSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

const ComercialDashboard = lazy(() =>
  import("@/components/comercial/ComercialDashboard").then((m) => ({
    default: m.ComercialDashboard,
  })),
);
const LeadDetalheSheet = lazy(() =>
  import("@/components/comercial/LeadDetalheSheet").then((m) => ({ default: m.LeadDetalheSheet })),
);
import { LeadFormDialog } from "@/components/comercial/LeadFormDialog";
import { AcoesFollowUpLead } from "@/components/comercial/AcoesFollowUpLead";
import { FollowUpSequencialDialog } from "@/components/comercial/FollowUpSequencialDialog";
const ImportarLeadsDialog = lazy(() =>
  import("@/components/comercial/ImportarLeadsDialog").then((m) => ({
    default: m.ImportarLeadsDialog,
  })),
);
import { CompletarLeadsDialog } from "@/components/comercial/CompletarLeadsDialog";

import { formatCurrency, formatDate } from "@/lib/format";
import { mapaWhatsApp } from "@/lib/whatsapp";
import { WhatsAppIndicator } from "@/components/WhatsAppIndicator";
import { usePainelFollowUps } from "@/lib/use-painel-follow-ups";
import { diasDesde } from "@/lib/follow-up";

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
          "Uma lista só: marque se o lead respondeu ou não respondeu, acompanhe a fila do dia e a conversão do time comercial.",
      },
      { property: "og:title", content: "Gestão comercial de leads | Brazon" },
      {
        property: "og:description",
        content:
          "Listagem única de leads com follow-up em um clique, reuniões e taxa de conversão do time comercial.",
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

/** Abas da fila: a mesma listagem, recortes diferentes. */
type Fila = "hoje" | "atrasados" | "todos";

/** Cabeçalho da tabela de leads (compartilhado com o skeleton). */
function CabecalhoLeads() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Lead</TableHead>
        <TableHead>Telefone</TableHead>
        <TableHead>Estágio</TableHead>
        <TableHead>Contato</TableHead>
        <TableHead className="text-right">Ações</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function hojeISOLocal(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Situação do contato em uma linha: quando é o próximo toque e em que
 * tentativa da cadência o lead está.
 */
function SituacaoContato({ lead }: { lead: Lead }) {
  const hojeISO = hojeISOLocal();
  const atrasado = Boolean(lead.proximo_contato && lead.proximo_contato < hojeISO);
  const eHoje = lead.proximo_contato === hojeISO;

  const quando = !lead.proximo_contato
    ? lead.cadencia_encerrada
      ? "Cadência encerrada"
      : "Sem follow-up agendado"
    : atrasado
      ? `Atrasado desde ${formatDate(lead.proximo_contato)}`
      : eHoje
        ? "Contatar hoje"
        : `Próximo contato ${formatDate(lead.proximo_contato)}`;

  const cor = atrasado
    ? "text-destructive font-medium"
    : eHoje
      ? "text-amber-600 dark:text-amber-400 font-medium"
      : "text-muted-foreground";

  const dias = diasDesde(lead.ultimo_contato_em);
  const tentativa =
    lead.follow_ups_feitos > 0 ? `${lead.follow_ups_feitos}ª tentativa` : "Sem tentativa";
  const ultimo =
    dias === null
      ? "sem contato registrado"
      : dias === 0
        ? "último contato hoje"
        : `último contato há ${dias} dia${dias === 1 ? "" : "s"}`;

  return (
    <div className="space-y-0.5">
      <p className={`whitespace-nowrap text-sm ${cor}`}>{quando}</p>
      <p className="text-xs text-muted-foreground">
        {tentativa} · {ultimo}
      </p>
    </div>
  );
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

  const [fila, setFila] = useState<Fila>("hoje");
  const [busca, setBusca] = useState("");
  const [estagio, setEstagio] = useState<LeadEstagio | "todos">("todos");
  const [segmento, setSegmento] = useState("todos");
  const [origem, setOrigem] = useState<LeadOrigem | "todas">("todas");
  const [soZap, setSoZap] = useState(false);
  /** Filtro de leads com dados faltando. */
  const [incompletos, setIncompletos] = useState(false);
  const [ordem, setOrdem] = useState<"recentes" | "completude">("recentes");
  /** Filtro por lote de importação (vem do resultado da importação). */
  const [loteId, setLoteId] = useState<string | null>(null);

  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [desempenhoAberto, setDesempenhoAberto] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [completarAberto, setCompletarAberto] = useState(false);
  const [sequencialAberto, setSequencialAberto] = useState(false);
  const [editando, setEditando] = useState<Lead | null>(null);
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [excluindo, setExcluindo] = useState<Lead | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const filtroVendedor = isAdmin && vendedorId !== "todos" ? vendedorId : undefined;

  const painel = usePainelFollowUps(filtroVendedor);

  const filtrosLeads = useMemo(
    () => ({
      dias,
      ...(filtroVendedor ? { vendedor_id: filtroVendedor } : {}),
      ...(estagio !== "todos" ? { estagio } : {}),
      ...(origem !== "todas" ? { origem } : {}),
      ...(segmento !== "todos" ? { segmento } : {}),
      ...(busca.trim() ? { busca: busca.trim() } : {}),
      ...(fila === "hoje" ? { apenas_follow_up: true } : {}),
      ...(fila === "atrasados" ? { apenas_atrasados: true } : {}),
      ...(incompletos ? { apenas_incompletos: true } : {}),
      ...(loteId ? { importacao_id: loteId } : {}),
      ordem,
    }),
    [dias, filtroVendedor, estagio, origem, segmento, busca, fila, incompletos, loteId, ordem],
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

  /** Recarrega lista + contadores da fila depois de registrar um contato. */
  const atualizarTudo = useCallback(() => {
    void recarregar();
    void painel.buscar();
  }, [recarregar, painel]);

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

  // Com scroll infinito a lista cresce sem limite: renderizamos apenas as
  // linhas visíveis (mais folga) para não pesar no celular.
  const janelaCards = useJanelaVirtual({ total: leadsVisiveis.length, altura: 200 });
  const janelaLinhas = useJanelaVirtual({ total: leadsVisiveis.length, altura: 76 });
  const cardsVisiveis = leadsVisiveis.slice(janelaCards.inicio, janelaCards.fim);
  const linhasVisiveis = leadsVisiveis.slice(janelaLinhas.inicio, janelaLinhas.fim);

  async function confirmarExclusao() {
    if (!excluindo) return;
    setOcupado(true);
    try {
      await remover({ data: { id: excluindo.id } });
      toast.success("Lead excluído.");
      setExcluindo(null);
      atualizarTudo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o lead.");
    } finally {
      setOcupado(false);
    }
  }

  useTourDaTela("tela:comercial", !carregando);

  const abas: { chave: Fila; label: string; quantidade?: number }[] = [
    { chave: "hoje", label: "A contatar hoje", quantidade: painel.totalAContatar },
    { chave: "atrasados", label: "Atrasados", quantidade: painel.totalAtrasados },
    { chave: "todos", label: "Todos os leads" },
  ];

  const vazioTitulo =
    fila === "hoje"
      ? "Nada para contatar agora. Fila em dia!"
      : fila === "atrasados"
        ? "Nenhum follow-up atrasado."
        : soZap
          ? "Nenhum lead com WhatsApp ativo nos filtros atuais."
          : "Nenhum lead ainda. Cadastre o primeiro contato do dia.";

  return (
    <TelaShell
      voltarPara={home}
      area="Gestão comercial"
      trilha={[{ rotulo: "Painel", para: home }, { rotulo: "Gestão comercial" }]}
      headerExtra={
        <Suspense fallback={null}>
          <AjudaDaTela chave="tela:comercial" />
        </Suspense>
      }
    >
      <PageHeader
        eyebrow="Comercial"
        eyebrowIcon={Target}
        titulo="Gestão comercial"
        descricao="Uma lista só: marque se o lead respondeu ou não respondeu."
        acoes={
          <>
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
          </>
        }
      />

      <Card className="space-y-4 p-4 sm:p-5" data-tour="comercial-followups">
        {/* Abas da fila + busca: o que o vendedor usa todos os dias */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {abas.map((a) => (
              <Button
                key={a.chave}
                size="sm"
                variant={fila === a.chave ? "default" : "outline"}
                onClick={() => setFila(a.chave)}
              >
                {a.label}
                {typeof a.quantidade === "number" ? ` (${a.quantidade})` : ""}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setSequencialAberto(true)}
              disabled={painel.filaDoDia.length === 0}
            >
              <PlayCircle className="mr-2 h-4 w-4" /> Follow-up do dia
            </Button>
            <Button variant="ghost" size="sm" onClick={atualizarTudo} disabled={carregando}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Buscar por nome, empresa ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="sm:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFiltrosAbertos((v) => !v)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Mais filtros
              <ChevronDown
                className={`ml-1.5 h-4 w-4 transition-transform ${filtrosAbertos ? "rotate-180" : ""}`}
              />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDesempenhoAberto((v) => !v)}>
              <BarChart3 className="mr-2 h-4 w-4" /> Ver desempenho
              <ChevronDown
                className={`ml-1.5 h-4 w-4 transition-transform ${desempenhoAberto ? "rotate-180" : ""}`}
              />
            </Button>
            {painel.totalEncerrados > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400"
              >
                {painel.totalEncerrados} com cadência encerrada
              </Badge>
            )}
          </div>
        </div>

        <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <CollapsibleTrigger className="sr-only">Mais filtros</CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 rounded-lg border border-border/60 p-3">
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
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {isAdmin && (
                <Select value={vendedorId} onValueChange={setVendedorId}>
                  <SelectTrigger>
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
              <Select value={ordem} onValueChange={(v) => setOrdem(v as "recentes" | "completude")}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recentes">Mais recentes primeiro</SelectItem>
                  <SelectItem value="completude">Menos completos primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
              {loteId && (
                <Button variant="ghost" size="sm" onClick={() => setLoteId(null)}>
                  Limpar filtro de lote
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

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
            titulo={vazioTitulo}
            descricao={
              fila === "todos"
                ? "Cada lead cadastrado alimenta o funil e as taxas de conversão desta página."
                : "Veja tudo em “Todos os leads” ou cadastre novos contatos."
            }
          />
        ) : (
          <>
            {/* Mobile: cards empilhados */}
            <div className="space-y-3 sm:hidden" ref={janelaCards.ref}>
              <div style={{ height: janelaCards.antes }} aria-hidden />
              {cardsVisiveis.map((l) => (
                <Card key={l.id} className="space-y-2 p-4">
                  <div
                    className="flex cursor-pointer items-start justify-between gap-2"
                    onClick={() => setDetalhe(l)}
                  >
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
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {l.telefone}
                    <WhatsAppIndicator
                      telefone={l.telefone}
                      status={statusZap.get(l.id)}
                      size="sm"
                    />
                    <span>· {formatCurrency(l.valor_estimado)}</span>
                  </p>
                  <SituacaoContato lead={l} />
                  <AcoesFollowUpLead
                    lead={l}
                    onAtualizado={atualizarTudo}
                    onDetalhes={setDetalhe}
                    onEditar={(lead) => {
                      setEditando(lead);
                      setFormAberto(true);
                    }}
                    onExcluir={setExcluindo}
                  />
                </Card>
              ))}
              <div style={{ height: janelaCards.depois }} aria-hidden />
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block" ref={janelaLinhas.ref}>
              <Table>
                <CabecalhoLeads />
                <TableBody>
                  {janelaLinhas.antes > 0 && (
                    <TableRow aria-hidden>
                      <TableCell colSpan={5} style={{ height: janelaLinhas.antes, padding: 0 }} />
                    </TableRow>
                  )}
                  {linhasVisiveis.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="cursor-pointer" onClick={() => setDetalhe(l)}>
                        <p className="font-medium">{l.nome_contato}</p>
                        <p className="text-xs text-muted-foreground">
                          {[l.empresa, l.segmento].filter(Boolean).join(" · ") || "—"}
                          {isAdmin && l.vendedor_nome ? ` · ${l.vendedor_nome}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(l.valor_estimado)} · {l.completude}% completo ·{" "}
                          {l.reunioes_count} reuniã{l.reunioes_count === 1 ? "o" : "es"}
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
                      <TableCell>
                        <Badge variant="outline" className={estagioClasse(l.estagio)}>
                          {ESTAGIO_LABEL[l.estagio]}
                        </Badge>
                        {l.cadencia_encerrada && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            Cadência encerrada
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <SituacaoContato lead={l} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <AcoesFollowUpLead
                            lead={l}
                            onAtualizado={atualizarTudo}
                            onDetalhes={setDetalhe}
                            onEditar={(lead) => {
                              setEditando(lead);
                              setFormAberto(true);
                            }}
                            onExcluir={setExcluindo}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {janelaLinhas.depois > 0 && (
                    <TableRow aria-hidden>
                      <TableCell colSpan={5} style={{ height: janelaLinhas.depois, padding: 0 }} />
                    </TableRow>
                  )}
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

      {/* Desempenho: fica fora do caminho do dia a dia, aberto sob demanda */}
      <Collapsible open={desempenhoAberto} onOpenChange={setDesempenhoAberto}>
        <CollapsibleTrigger className="sr-only">Ver desempenho</CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {dados ? (
            <Suspense fallback={<CardsEsqueleto quantidade={3} />}>
              <ComercialDashboard
                dados={dados}
                onVerIncompletos={() => {
                  setFila("todos");
                  setIncompletos(true);
                  setOrdem("completude");
                  setFiltrosAbertos(true);
                }}
                onVerFollowUps={() => {
                  setFila("atrasados");
                  setDesempenhoAberto(false);
                }}
              />
            </Suspense>
          ) : (
            <CardsEsqueleto quantidade={3} />
          )}
        </CollapsibleContent>
      </Collapsible>

      <LeadFormDialog
        aberto={formAberto}
        onOpenChange={setFormAberto}
        lead={editando}
        segmentos={listaSegmentos}
        vendedores={vendedores}
        isAdmin={isAdmin}
        onSalvo={atualizarTudo}
      />

      <MontarQuandoAberto aberto={importarAberto}>
        <ImportarLeadsDialog
          aberto={importarAberto}
          onOpenChange={setImportarAberto}
          isAdmin={isAdmin}
          vendedores={vendedores}
          segmentos={listaSegmentos}
          onConcluido={atualizarTudo}
          onVerLote={(importacaoId) => {
            setLoteId(importacaoId);
            setFila("todos");
            setIncompletos(true);
            setOrdem("completude");
            setFiltrosAbertos(true);
          }}
        />
      </MontarQuandoAberto>

      <CompletarLeadsDialog
        aberto={completarAberto}
        onOpenChange={setCompletarAberto}
        leads={leads.filter((l) => l.completude < 100)}
        segmentos={listaSegmentos}
        onAtualizado={atualizarTudo}
      />

      <MontarQuandoAberto aberto={sequencialAberto}>
        <FollowUpSequencialDialog
          aberto={sequencialAberto}
          onOpenChange={setSequencialAberto}
          itens={painel.filaDoDia}
          onRegistrado={atualizarTudo}
        />
      </MontarQuandoAberto>

      <MontarQuandoAberto aberto={Boolean(detalhe)}>
        <LeadDetalheSheet
          lead={detalhe}
          aberto={Boolean(detalhe)}
          onOpenChange={(v) => {
            if (!v) setDetalhe(null);
          }}
          onAtualizado={atualizarTudo}
        />
      </MontarQuandoAberto>

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
    </TelaShell>
  );
}
