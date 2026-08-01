import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Target, Trash2, UserPlus } from "lucide-react";

import { useAuth, roleHome } from "@/lib/auth";
import { TermosGate } from "@/components/TermosGate";
import { BrazonLogo } from "@/components/BrazonLogo";
import { SairButton } from "@/components/SairButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvisosSino } from "@/components/AvisosSino";
import { EmptyState } from "@/components/ui/empty-state";
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

import { formatCurrency, formatDate } from "@/lib/format";
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
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  const permitido = role === "admin" || role === "vendedor";

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/login", replace: true });
    else if (role && !permitido) void navigate({ to: roleHome(role), replace: true });
  }, [loading, session, role, permitido, navigate]);

  if (loading || !session || !role || !permitido) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <TermosGate>
      <ComercialConteudo isAdmin={role === "admin"} home={roleHome(role)} />
    </TermosGate>
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

  const [busca, setBusca] = useState("");
  const [estagio, setEstagio] = useState<LeadEstagio | "todos">("todos");
  const [segmento, setSegmento] = useState("todos");
  const [origem, setOrigem] = useState<LeadOrigem | "todas">("todas");
  const [followUp, setFollowUp] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Lead | null>(null);
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [excluindo, setExcluindo] = useState<Lead | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const filtroVendedor = isAdmin && vendedorId !== "todos" ? vendedorId : undefined;

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [d, l] = await Promise.all([
        carregarDashboard({
          data: { dias, ...(filtroVendedor ? { vendedor_id: filtroVendedor } : {}) },
        }),
        carregarLeads({
          data: {
            dias,
            ...(filtroVendedor ? { vendedor_id: filtroVendedor } : {}),
            ...(estagio !== "todos" ? { estagio } : {}),
            ...(origem !== "todas" ? { origem } : {}),
            ...(segmento !== "todos" ? { segmento } : {}),
            ...(busca.trim() ? { busca: busca.trim() } : {}),
            ...(followUp ? { apenas_follow_up: true } : {}),
          },
        }),
      ]);
      setDados(d);
      setLeads(l);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar os dados.");
    } finally {
      setCarregando(false);
    }
  }, [
    carregarDashboard,
    carregarLeads,
    dias,
    filtroVendedor,
    estagio,
    origem,
    segmento,
    busca,
    followUp,
  ]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    void carregarSegmentos({}).then(setSegmentos).catch(() => undefined);
    if (isAdmin) {
      void carregarVendedores({}).then(setVendedores).catch(() => undefined);
    }
  }, [carregarSegmentos, carregarVendedores, isAdmin]);

  const listaSegmentos = useMemo(() => segmentos, [segmentos]);

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
          <Button
            onClick={() => {
              setEditando(null);
              setFormAberto(true);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" /> Novo lead
          </Button>
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

        {carregando && !dados ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          dados && <ComercialDashboard dados={dados} />
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

          <div className="flex items-center gap-2">
            <Switch id="follow-up" checked={followUp} onCheckedChange={setFollowUp} />
            <Label htmlFor="follow-up" className="text-sm">
              Só follow-up de hoje
            </Label>
          </div>

          {leads.length === 0 ? (
            <EmptyState
              icon={Target}
              titulo="Nenhum lead ainda. Cadastre o primeiro contato do dia."
              descricao="Cada lead cadastrado alimenta o funil e as taxas de conversão desta página."
            />
          ) : (
            <>
              {/* Mobile: cards empilhados */}
              <div className="space-y-3 sm:hidden">
                {leads.map((l) => (
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
                      <span>{l.telefone}</span>
                      <span className="text-right">{formatCurrency(l.valor_estimado)}</span>
                      <span>{l.segmento || "Sem segmento"}</span>
                      <span className="text-right">
                        {l.reunioes_count} reuniã{l.reunioes_count === 1 ? "o" : "es"}
                      </span>
                      {l.proximo_contato && (
                        <span className="col-span-2">
                          Próximo contato: {formatDate(l.proximo_contato)}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop: tabela */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Estágio</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Reuniões</TableHead>
                      <TableHead>Próximo contato</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l) => (
                      <TableRow
                        key={l.id}
                        className="cursor-pointer"
                        onClick={() => setDetalhe(l)}
                      >
                        <TableCell>
                          <p className="font-medium">{l.nome_contato}</p>
                          <p className="text-xs text-muted-foreground">
                            {[l.empresa, l.cargo].filter(Boolean).join(" · ") || "—"}
                            {isAdmin && l.vendedor_nome ? ` · ${l.vendedor_nome}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>{l.telefone}</TableCell>
                        <TableCell>{l.segmento || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={estagioClasse(l.estagio)}>
                            {ESTAGIO_LABEL[l.estagio]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(l.valor_estimado)}
                        </TableCell>
                        <TableCell className="text-right">{l.reunioes_count}</TableCell>
                        <TableCell>
                          {l.proximo_contato ? formatDate(l.proximo_contato) : "—"}
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
