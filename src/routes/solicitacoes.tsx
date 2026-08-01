import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Inbox,
  Info,
  Loader2,
  MessageSquare,
  SlidersHorizontal,
  ArrowUpDown,
  PackagePlus,
  Receipt,
  CalendarClock,
  UserPen,
  CircleX,
  MessageSquarePlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/auth";
import { GateDependenteDePapel } from "@/components/GateEstado";
import { TermosGate } from "@/components/TermosGate";
import { OnboardingProvider, useTourDaTela } from "@/components/onboarding/OnboardingProvider";
const AjudaDaTela = lazy(() =>
  import("@/components/onboarding/AjudaDaTela").then((m) => ({ default: m.AjudaDaTela })),
);
import { BrazonLogo } from "@/components/BrazonLogo";
import { SairButton } from "@/components/SairButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvisosSino } from "@/components/AvisosSino";
import { formatCurrency } from "@/lib/format";
import {
  AVISO_RENOVACAO,
  CATALOGO_SOLICITACOES,
  MOTIVOS_CANCELAMENTO,
  itemPorCategoria,
  type CampoSolicitacao,
  type CategoriaSolicitacao,
} from "@/lib/solicitacoes";
import {
  criarSolicitacao,
  minhasSolicitacoes,
  cancelarMinhaSolicitacao,
  type MinhaSolicitacao,
  type SolicitacaoStatus,
} from "@/lib/solicitacoes.functions";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações | Brazon" },
      {
        name: "description",
        content:
          "Peça alterações de plano, segunda via de cobrança, mudança de vencimento e outros atendimentos à equipe Brazon.",
      },
      { property: "og:title", content: "Solicitações | Brazon" },
      {
        property: "og:description",
        content: "Catálogo de pedidos do cliente: plano, vencimento, cobrança e atendimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SolicitacoesPage,
});

const STATUS_LABEL: Record<SolicitacaoStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando você",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function statusClasse(status: SolicitacaoStatus): string {
  if (status === "concluida") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "em_andamento") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "aguardando_cliente") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "cancelada") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary border-primary/20";
}

/**
 * Ícones do catálogo de solicitações, declarados um a um.
 * Antes usávamos `import * as Icons from "lucide-react"`, o que arrastava a
 * biblioteca inteira (~500 kB) para o pacote compartilhado de todas as telas.
 */
const ICONES_CATALOGO: Record<string, LucideIcon> = {
  ArrowUpDown,
  PackagePlus,
  Receipt,
  CalendarClock,
  UserPen,
  CircleX,
  MessageSquarePlus,
};

function IconeCatalogo({ nome, className }: { nome: string; className?: string }) {
  const Componente = ICONES_CATALOGO[nome] ?? MessageSquare;
  return <Componente className={className} />;
}

interface PlanoOpcao {
  id: string;
  nome: string;
  valor: number;
}

function SolicitacoesPage() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  return (
    <GateDependenteDePapel pronto={Boolean(role)}>
      <TermosGate>
        <OnboardingProvider>
          <SolicitacoesConteudo home={roleHome(role)} />
        </OnboardingProvider>
      </TermosGate>
    </GateDependenteDePapel>
  );
}

type AbaFiltro = "abertas" | "concluidas" | "canceladas" | "todas";

function SolicitacoesConteudo({ home }: { home: string }) {
  const carregar = useServerFn(minhasSolicitacoes);
  const criar = useServerFn(criarSolicitacao);
  const cancelar = useServerFn(cancelarMinhaSolicitacao);

  const [itens, setItens] = useState<MinhaSolicitacao[]>([]);
  const [contadores, setContadores] = useState({
    pendentes: 0,
    andamento: 0,
    aguardando: 0,
    concluidas: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<AbaFiltro>("abertas");
  const [dialogo, setDialogo] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaSolicitacao | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const [planos, setPlanos] = useState<PlanoOpcao[]>([]);
  const [planoAtual, setPlanoAtual] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await carregar({});
      setItens(r.itens);
      setContadores(r.contadores);
    } catch {
      toast.error("Não foi possível carregar suas solicitações.");
    } finally {
      setCarregando(false);
    }
  }, [carregar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    void (async () => {
      const { data: lista } = await supabase
        .from("planos")
        .select("id, nome, valor")
        .eq("ativo", true)
        .order("valor", { ascending: true });
      setPlanos((lista ?? []) as PlanoOpcao[]);

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data: cli } = await supabase
        .from("clientes")
        .select("plano_id")
        .eq("user_id", user.user.id)
        .maybeSingle();
      setPlanoAtual(cli?.plano_id ?? null);
    })();
  }, []);

  const visiveis = useMemo(() => {
    if (aba === "todas") return itens;
    if (aba === "concluidas") return itens.filter((i) => i.status === "concluida");
    if (aba === "canceladas") return itens.filter((i) => i.status === "cancelada");
    return itens.filter(
      (i) =>
        i.status === "aberta" || i.status === "em_andamento" || i.status === "aguardando_cliente",
    );
  }, [itens, aba]);

  const contagemAbas = useMemo(
    () => ({
      abertas: contadores.pendentes + contadores.andamento + contadores.aguardando,
      concluidas: contadores.concluidas,
      canceladas: itens.filter((i) => i.status === "cancelada").length,
      todas: itens.length,
    }),
    [contadores, itens],
  );

  const item = categoria ? itemPorCategoria(categoria) : undefined;

  const faltaObrigatorio = useMemo(() => {
    if (!item) return true;
    return item.campos.some((c) => c.obrigatorio && !(respostas[c.nome] ?? "").trim());
  }, [item, respostas]);

  function abrirCatalogo() {
    setCategoria(null);
    setRespostas({});
    setDialogo(true);
  }

  async function enviar() {
    if (!categoria) return;
    setEnviando(true);
    try {
      await criar({ data: { categoria, dados: respostas } });
      toast.success("Solicitação enviada! Nossa equipe já foi avisada.");
      setDialogo(false);
      setCategoria(null);
      setRespostas({});
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a solicitação.");
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarPedido(id: string) {
    setCancelandoId(id);
    try {
      await cancelar({ data: { id } });
      toast.success("Solicitação cancelada.");
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar a solicitação.");
    } finally {
      setCancelandoId(null);
    }
  }

  function renderCampo(campo: CampoSolicitacao) {
    const valor = respostas[campo.nome] ?? "";
    const setar = (v: string) => setRespostas((r) => ({ ...r, [campo.nome]: v }));

    return (
      <div key={campo.nome} className="grid gap-1.5">
        <Label htmlFor={`campo-${campo.nome}`}>
          {campo.label} {campo.obrigatorio && <span className="text-destructive">*</span>}
        </Label>

        {campo.tipo === "texto" && (
          <Input
            id={`campo-${campo.nome}`}
            value={valor}
            maxLength={200}
            onChange={(e) => setar(e.target.value)}
          />
        )}

        {campo.tipo === "textarea" && (
          <Textarea
            id={`campo-${campo.nome}`}
            rows={4}
            maxLength={2000}
            value={valor}
            onChange={(e) => setar(e.target.value)}
          />
        )}

        {campo.tipo === "select_plano" && (
          <Select value={valor} onValueChange={setar}>
            <SelectTrigger id={`campo-${campo.nome}`}>
              <SelectValue placeholder="Escolha o plano" />
            </SelectTrigger>
            <SelectContent>
              {planos
                .filter((p) => p.id !== planoAtual)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — {formatCurrency(p.valor)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {campo.tipo === "dia_mes" && (
          <Select value={valor} onValueChange={setar}>
            <SelectTrigger id={`campo-${campo.nome}`}>
              <SelectValue placeholder="Escolha o dia" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                <SelectItem key={d} value={d}>
                  Dia {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {campo.tipo === "select_motivo" && (
          <RadioGroup value={valor} onValueChange={setar} className="gap-2">
            {MOTIVOS_CANCELAMENTO.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <RadioGroupItem value={m} id={`motivo-${m}`} />
                <Label htmlFor={`motivo-${m}`} className="font-normal">
                  {m}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {campo.ajuda && <p className="text-xs text-muted-foreground">{campo.ajuda}</p>}
      </div>
    );
  }

  useTourDaTela("tela:solicitacoes", !carregando);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <BrazonLogo className="shrink-0" symbolClassName="h-7 w-7" textClassName="text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-base font-semibold sm:text-lg">
              <MessageSquare className="h-4 w-4 text-primary" /> Solicitações
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Peça o que precisar e acompanhe seus pedidos. Nossa equipe cuida do resto.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to={home}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Suspense fallback={null}>
            <AjudaDaTela chave="tela:solicitacoes" />
          </Suspense>
          <ThemeToggle />
          <AvisosSino />
          <SairButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <Card
          data-tour="solic-catalogo"
          className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-semibold">Sua assinatura renova sozinha.</p>
            <p className="text-sm text-muted-foreground">{AVISO_RENOVACAO}</p>
          </div>
          <Button size="lg" className="shrink-0" onClick={abrirCatalogo}>
            Fazer uma solicitação
          </Button>
        </Card>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Precisa de algo específico (alterar plano, vencimento, cancelar...)?</span>
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-2"
            onClick={abrirCatalogo}
          >
            Ver todos os pedidos
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Contador
            titulo="Pendentes"
            valor={contadores.pendentes}
            icone={<Clock className="h-4 w-4 text-primary" />}
          />
          <Contador
            titulo="Em andamento"
            valor={contadores.andamento}
            icone={<Loader2 className="h-4 w-4 text-blue-600" />}
          />
          <Contador
            titulo="Aguardando você"
            valor={contadores.aguardando}
            icone={<AlertCircle className="h-4 w-4 text-amber-600" />}
          />
          <Contador
            titulo="Concluídas"
            valor={contadores.concluidas}
            icone={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          />
        </div>

        <Tabs value={aba} onValueChange={(v) => setAba(v as AbaFiltro)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="abertas">Em aberto ({contagemAbas.abertas})</TabsTrigger>
            <TabsTrigger value="concluidas">Concluídas ({contagemAbas.concluidas})</TabsTrigger>
            <TabsTrigger value="canceladas">Canceladas ({contagemAbas.canceladas})</TabsTrigger>
            <TabsTrigger value="todas">Todas ({contagemAbas.todas})</TabsTrigger>
          </TabsList>
        </Tabs>

        {carregando ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
          </div>
        ) : visiveis.length === 0 ? (
          <EmptyState
            icon={Inbox}
            titulo="Nenhuma solicitação ainda"
            descricao="É só escolher o que você precisa. A gente cuida do resto."
            acao={<Button onClick={abrirCatalogo}>Fazer uma solicitação</Button>}
          />
        ) : (
          <div data-tour="solic-lista" className="space-y-3">
            {visiveis.map((s) => (
              <Card key={s.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.categoria_rotulo}</span>
                  <Badge variant="outline" className={statusClasse(s.status)}>
                    {STATUS_LABEL[s.status]}
                  </Badge>
                </div>

                {s.descricao && (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{s.descricao}</p>
                )}

                {s.status === "aguardando_cliente" && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />A equipe precisa de uma resposta
                    sua.
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Criada há {formatDistanceToNow(new Date(s.created_at), { locale: ptBR })}
                  </p>

                  {(s.status === "aberta" || s.status === "aguardando_cliente") && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={cancelandoId === s.id}>
                          Cancelar pedido
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar esta solicitação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A equipe deixará de tratar este pedido. Você pode abrir outro depois.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void cancelarPedido(s.id)}>
                            Cancelar pedido
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{item ? item.titulo : "O que você precisa?"}</DialogTitle>
            <DialogDescription>
              {item ? item.descricao : "Escolha o tipo de pedido para a nossa equipe."}
            </DialogDescription>
          </DialogHeader>

          {!item ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Você não precisa pedir renovação nem otimização — cuidamos disso automaticamente.
                  Use esta lista para pedidos específicos.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CATALOGO_SOLICITACOES.map((c) => (
                  <button
                    key={c.categoria}
                    type="button"
                    className="flex items-start gap-3 rounded-lg border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => {
                      setCategoria(c.categoria);
                      setRespostas({});
                    }}
                  >
                    <IconeCatalogo
                      nome={c.icone}
                      className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{c.titulo}</span>
                      <span className="block text-xs text-muted-foreground">{c.descricao}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {item.avisoAntes && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item.avisoAntes}</span>
                </div>
              )}
              {item.campos.map(renderCampo)}
            </div>
          )}

          {item && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoria(null)} disabled={enviando}>
                Voltar
              </Button>
              <Button onClick={enviar} disabled={enviando || faltaObrigatorio}>
                {enviando ? "Enviando..." : "Enviar solicitação"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Contador({
  titulo,
  valor,
  icone,
}: {
  titulo: string;
  valor: number;
  icone: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icone}
        {titulo}
      </div>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
    </Card>
  );
}
