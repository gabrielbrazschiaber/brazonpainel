import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ClipboardList,
  Database,
  Download,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";

import { useAuth, roleHome } from "@/lib/auth";
import { GateDependenteDePapel } from "@/components/GateEstado";
import { TermosGate } from "@/components/TermosGate";
import { OnboardingProvider, useTourDaTela } from "@/components/onboarding/OnboardingProvider";
import { AjudaDaTela } from "@/components/onboarding/AjudaDaTela";
import { AppShell } from "@/components/AppShell";
import type { AppNavItem } from "@/components/AppSidebar";
import { ErroLimite } from "@/components/ErroLimite";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import { BancoAdminPainel } from "@/components/banco-leads/BancoAdminPainel";
import { BancoLeadFormDialog } from "@/components/banco-leads/BancoLeadFormDialog";
import { ImportarBancoDialog } from "@/components/banco-leads/ImportarBancoDialog";

import { formatDate } from "@/lib/format";
import { formatarTelefone } from "@/lib/leads-import";
import { ORIGEM_LABEL } from "@/lib/leads";
import {
  BANCO_STATUS_LABEL,
  ESTADOS_BR,
  LIMITE_PUXADAS_HORA,
  bancoStatusClasse,
  diasParaDevolucao,
  horaRenovacao,
  type BancoLeadStatus,
} from "@/lib/banco-leads";
import {
  arquivarBancoLead,
  devolverLead,
  excluirBancoLead,
  listarBancoLeads,
  puxarLeads,
  saldoPuxadas,
  type BancoLead,
  type ListaBancoLeads,
  type SaldoPuxadas,
} from "@/lib/banco-leads.functions";
import { listarSegmentos } from "@/lib/leads.functions";

export const Route = createFileRoute("/banco-leads")({
  head: () => ({
    meta: [
      { title: "Banco de Leads | Brazon" },
      {
        name: "description",
        content:
          "Repositório central de leads do time: o admin abastece as listas e cada vendedor puxa leads para a própria carteira com limite por hora.",
      },
      { property: "og:title", content: "Banco de Leads | Brazon" },
      {
        property: "og:description",
        content:
          "Puxe leads do banco central para sua carteira, acompanhe sua cota e devolva o que não for trabalhar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BancoLeadsPage,
});

function BancoLeadsPage() {
  const { loading, session, role, roleResolvido } = useAuth();
  const navigate = useNavigate();
  const permitido = role === "admin" || role === "vendedor";

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/login", replace: true });
    else if (roleResolvido && role && !permitido) {
      void navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, session, role, roleResolvido, permitido, navigate]);

  return (
    <GateDependenteDePapel pronto={Boolean(role) && permitido}>
      <TermosGate>
        <OnboardingProvider>
          <BancoLeadsConteudo isAdmin={role === "admin"} />
        </OnboardingProvider>
      </TermosGate>
    </GateDependenteDePapel>
  );
}

const POR_PAGINA = 25;
const TODOS = "__todos__";

type Aba = "disponiveis" | "meus" | "admin";

function BancoLeadsConteudo({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const buscar = useServerFn(listarBancoLeads);
  const buscarSaldo = useServerFn(saldoPuxadas);
  const buscarSegmentos = useServerFn(listarSegmentos);
  const puxar = useServerFn(puxarLeads);
  const devolver = useServerFn(devolverLead);
  const arquivar = useServerFn(arquivarBancoLead);
  const excluir = useServerFn(excluirBancoLead);

  const [aba, setAba] = useState<Aba>(isAdmin ? "admin" : "disponiveis");
  const [lista, setLista] = useState<ListaBancoLeads | null>(null);
  const [saldo, setSaldo] = useState<SaldoPuxadas | null>(null);
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [segmento, setSegmento] = useState(TODOS);
  const [estado, setEstado] = useState(TODOS);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [puxando, setPuxando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [importAberto, setImportAberto] = useState(false);
  const [editando, setEditando] = useState<BancoLead | null>(null);
  const [confirmacao, setConfirmacao] = useState<
    { tipo: "devolver" | "arquivar" | "excluir"; lead: BancoLead } | null
  >(null);

  const status: BancoLeadStatus | undefined =
    aba === "disponiveis" ? "disponivel" : aba === "meus" ? "puxado" : undefined;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await buscar({
        data: {
          ...(status ? { status } : {}),
          ...(aba === "meus" ? { meus: true } : {}),
          ...(buscaAplicada ? { busca: buscaAplicada } : {}),
          ...(segmento !== TODOS ? { segmento } : {}),
          ...(estado !== TODOS ? { estado } : {}),
          pagina,
          por_pagina: POR_PAGINA,
        },
      });
      setLista(dados);
      setSelecionados([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar o banco de leads.");
    } finally {
      setCarregando(false);
    }
  }, [buscar, status, aba, buscaAplicada, segmento, estado, pagina]);

  const carregarSaldo = useCallback(async () => {
    if (isAdmin) return;
    try {
      setSaldo(await buscarSaldo({}));
    } catch {
      /* cota é informativa: falha não bloqueia a tela */
    }
  }, [buscarSaldo, isAdmin]);

  useEffect(() => {
    if (aba === "admin") {
      setCarregando(false);
      return;
    }
    void carregar();
  }, [aba, carregar]);

  useEffect(() => {
    void carregarSaldo();
  }, [carregarSaldo]);

  useEffect(() => {
    void (async () => {
      try {
        const s = await buscarSegmentos({});
        setSegmentos(Array.isArray(s) ? (s as string[]) : []);
      } catch {
        setSegmentos([]);
      }
    })();
  }, [buscarSegmentos]);

  useTourDaTela("tela:banco-leads", !carregando);

  const itens = lista?.itens ?? [];
  const prazo = lista?.prazo_devolucao ?? 7;
  const total = lista?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const restante = saldo?.restante ?? 0;
  const limite = saldo?.limite ?? LIMITE_PUXADAS_HORA;
  const podePuxar = Math.min(restante, selecionados.length);

  const selecionaveis = useMemo(
    () => itens.filter((l) => l.status === "disponivel").map((l) => l.id),
    [itens],
  );

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id],
    );
  }

  async function puxarSelecionados() {
    if (selecionados.length === 0) return;
    if (restante <= 0) {
      toast.error(
        `Você já puxou ${limite} leads nesta hora. A cota volta às ${horaRenovacao(saldo?.renova_em ?? null)}.`,
      );
      return;
    }
    setPuxando(true);
    try {
      const r = await puxar({ data: { ids: selecionados.slice(0, restante) } });
      if (r.puxados > 0) {
        toast.success(
          `${r.puxados} lead(s) na sua carteira. Trabalhe em até ${prazo} dias ou eles voltam ao banco.`,
        );
      }
      if (r.indisponiveis > 0) {
        toast.warning(`${r.indisponiveis} lead(s) já tinham sido puxados por outra pessoa.`);
      }
      if (r.ja_na_carteira > 0) {
        toast.info(`${r.ja_na_carteira} lead(s) já estavam na sua carteira.`);
      }
      await Promise.all([carregar(), carregarSaldo()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao puxar os leads.");
    } finally {
      setPuxando(false);
    }
  }

  async function confirmar() {
    if (!confirmacao) return;
    const { tipo, lead } = confirmacao;
    try {
      if (tipo === "devolver") {
        const r = await devolver({ data: { banco_lead_id: lead.id } });
        toast.success(
          r.status === "arquivado"
            ? "Lead devolvido e arquivado: já tinha sido devolvido 3 vezes."
            : "Lead devolvido ao banco.",
        );
      } else if (tipo === "arquivar") {
        await arquivar({ data: { id: lead.id } });
        toast.success("Lead arquivado.");
      } else {
        await excluir({ data: { id: lead.id } });
        toast.success("Lead removido do banco.");
      }
      setConfirmacao(null);
      await Promise.all([carregar(), carregarSaldo()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    }
  }

  const navItems: AppNavItem[] = [
    {
      value: "painel",
      label: "Painel",
      icon: LayoutDashboard,
      to: isAdmin ? "/admin" : "/vendedor",
    },
    { value: "tarefas", label: "Tarefas", icon: ClipboardList, to: "/tarefas" },
    { value: "comercial", label: "Comercial", icon: Target, to: "/comercial" },
    { value: "banco", label: "Banco de Leads", icon: Database, to: "/banco-leads" },
  ];

  return (
    <AppShell
      contexto="Banco de Leads"
      items={navItems}
      tab="banco"
      headerExtra={<AjudaDaTela chave="tela:banco-leads" />}
      {...(isAdmin
        ? {
            acaoPrincipal: {
              label: "Importar planilha",
              icon: Upload,
              onClick: () => setImportAberto(true),
            },
          }
        : {})}
    >
      <ErroLimite area="Banco de Leads">
        <div className="space-y-5" data-tour="banco-leads">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">Repositório central</p>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Banco de Leads</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {isAdmin
                  ? "Abasteça o banco com listas prospectadas e acompanhe a qualidade de cada fonte."
                  : `Puxe leads para a sua carteira. Limite de ${limite} por hora e ${prazo} dias para trabalhar cada lead.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditando(null);
                      setFormAberto(true);
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo lead
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setImportAberto(true)}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Importar
                  </Button>
                </>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate({ to: "/comercial" })}
              >
                <Target className="mr-1.5 h-3.5 w-3.5" /> Minha carteira
              </Button>
            </div>
          </header>

          {!isAdmin ? (
            <Card className="p-4" data-tour="banco-cota">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Cota da hora</p>
                  <p className="text-lg font-semibold text-foreground">
                    {restante} de {limite} disponíveis
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {restante >= limite
                    ? "Cota cheia"
                    : `Volta ao total às ${horaRenovacao(saldo?.renova_em ?? null)}`}
                </p>
              </div>
              <Progress
                value={limite > 0 ? (restante / limite) * 100 : 0}
                className="mt-3 h-2"
              />
            </Card>
          ) : null}

          <Tabs value={aba} onValueChange={(v) => { setAba(v as Aba); setPagina(0); }}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {isAdmin ? <TabsTrigger value="admin">Visão geral</TabsTrigger> : null}
              <TabsTrigger value="disponiveis">Disponíveis</TabsTrigger>
              {!isAdmin ? <TabsTrigger value="meus">Meus puxados</TabsTrigger> : null}
            </TabsList>
          </Tabs>

          {aba === "admin" ? (
            <BancoAdminPainel />
          ) : (
            <>
              <Card className="p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setBuscaAplicada(busca.trim());
                          setPagina(0);
                        }
                      }}
                      placeholder="Buscar por nome ou empresa"
                      className="pl-8"
                      aria-label="Buscar leads no banco"
                    />
                  </div>
                  <Select
                    value={segmento}
                    onValueChange={(v) => {
                      setSegmento(v);
                      setPagina(0);
                    }}
                  >
                    <SelectTrigger className="sm:w-44">
                      <SelectValue placeholder="Segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todos os segmentos</SelectItem>
                      {segmentos.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={estado}
                    onValueChange={(v) => {
                      setEstado(v);
                      setPagina(0);
                    }}
                  >
                    <SelectTrigger className="sm:w-32">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todos</SelectItem>
                      {ESTADOS_BR.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBuscaAplicada(busca.trim());
                      setPagina(0);
                      void carregar();
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="ml-1.5 sm:hidden">Atualizar</span>
                  </Button>
                </div>
              </Card>

              {!isAdmin && aba === "disponiveis" && selecionados.length > 0 ? (
                <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {selecionados.length} selecionado(s)
                    {podePuxar < selecionados.length
                      ? ` — sua cota permite ${podePuxar} agora`
                      : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>
                      Limpar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void puxarSelecionados()}
                      disabled={puxando || restante <= 0}
                    >
                      {puxando ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Puxar para minha carteira
                    </Button>
                  </div>
                </Card>
              ) : null}

              <Card className="overflow-hidden">
                {carregando ? (
                  <div className="space-y-2 p-4">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 rounded-md" />
                    ))}
                  </div>
                ) : itens.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={Database}
                      titulo={
                        aba === "meus" ? "Você não tem leads puxados" : "Nenhum lead disponível"
                      }
                      descricao={
                        aba === "meus"
                          ? "Puxe leads na aba Disponíveis para começar a trabalhar."
                          : isAdmin
                            ? "Importe uma planilha para abastecer o banco."
                            : "Assim que o admin abastecer o banco, os leads aparecem aqui."
                      }
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {!isAdmin && aba === "disponiveis" ? (
                            <TableHead className="w-10">
                              <Checkbox
                                checked={
                                  selecionaveis.length > 0 &&
                                  selecionaveis.every((id) => selecionados.includes(id))
                                }
                                onCheckedChange={(v) =>
                                  setSelecionados(v === true ? selecionaveis : [])
                                }
                                aria-label="Selecionar todos os leads da página"
                              />
                            </TableHead>
                          ) : null}
                          <TableHead>Contato</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Segmento</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin ? <TableHead>Com quem está</TableHead> : null}
                          {aba === "meus" ? <TableHead>Devolve em</TableHead> : null}
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((l) => {
                          const dias = diasParaDevolucao(l.puxado_em, prazo);
                          return (
                            <TableRow key={l.id}>
                              {!isAdmin && aba === "disponiveis" ? (
                                <TableCell>
                                  <Checkbox
                                    checked={selecionados.includes(l.id)}
                                    onCheckedChange={() => alternar(l.id)}
                                    aria-label={`Selecionar ${l.nome_contato}`}
                                  />
                                </TableCell>
                              ) : null}
                              <TableCell>
                                <p className="font-medium text-foreground">{l.nome_contato}</p>
                                <p className="text-xs text-muted-foreground">
                                  {l.empresa || ORIGEM_LABEL[l.origem]}
                                  {l.cargo ? ` · ${l.cargo}` : ""}
                                </p>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {l.mascarado ? (
                                  <span
                                    className="text-muted-foreground"
                                    title="O telefone completo aparece depois de puxar o lead"
                                  >
                                    {l.telefone}
                                  </span>
                                ) : (
                                  formatarTelefone(l.telefone)
                                )}
                              </TableCell>
                              <TableCell>{l.segmento || "—"}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {[l.cidade, l.estado].filter(Boolean).join(" / ") || "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge
                                    variant="outline"
                                    className={bancoStatusClasse(l.status)}
                                  >
                                    {BANCO_STATUS_LABEL[l.status]}
                                  </Badge>
                                  {l.reservado_segmento || l.reservado_estado ? (
                                    <span className="text-[11px] text-muted-foreground">
                                      Reserva:{" "}
                                      {[l.reservado_segmento, l.reservado_estado]
                                        .filter(Boolean)
                                        .join(" / ")}
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              {isAdmin ? (
                                <TableCell className="whitespace-nowrap">
                                  {l.vendedor_nome ?? "—"}
                                  {l.puxado_em ? (
                                    <span className="block text-xs text-muted-foreground">
                                      {formatDate(l.puxado_em)}
                                    </span>
                                  ) : null}
                                </TableCell>
                              ) : null}
                              {aba === "meus" ? (
                                <TableCell className="whitespace-nowrap">
                                  {dias === null ? (
                                    "—"
                                  ) : (
                                    <span
                                      className={
                                        dias <= 1
                                          ? "font-medium text-destructive"
                                          : dias <= 2
                                            ? "font-medium text-amber-600 dark:text-amber-400"
                                            : "text-muted-foreground"
                                      }
                                    >
                                      {dias === 0 ? "hoje" : `${dias} dia(s)`}
                                    </span>
                                  )}
                                </TableCell>
                              ) : null}
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {aba === "meus" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setConfirmacao({ tipo: "devolver", lead: l })
                                      }
                                      title="Devolver ao banco"
                                    >
                                      <Undo2 className="h-3.5 w-3.5" />
                                    </Button>
                                  ) : null}
                                  {isAdmin ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditando(l);
                                          setFormAberto(true);
                                        }}
                                        title="Editar lead"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setConfirmacao({ tipo: "excluir", lead: l })
                                        }
                                        title="Remover do banco"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>

              {total > POR_PAGINA ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Página {pagina + 1} de {paginas} · {total} lead(s)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagina === 0}
                      onClick={() => setPagina((p) => Math.max(0, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagina + 1 >= paginas}
                      onClick={() => setPagina((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </ErroLimite>

      <ImportarBancoDialog
        aberto={importAberto}
        onOpenChange={setImportAberto}
        segmentos={segmentos}
        onConcluido={() => void carregar()}
      />
      <BancoLeadFormDialog
        aberto={formAberto}
        onOpenChange={setFormAberto}
        lead={editando}
        segmentos={segmentos}
        onSalvo={() => void carregar()}
      />

      <AlertDialog
        open={Boolean(confirmacao)}
        onOpenChange={(v) => {
          if (!v) setConfirmacao(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.tipo === "devolver"
                ? "Devolver este lead ao banco?"
                : confirmacao?.tipo === "arquivar"
                  ? "Arquivar este lead?"
                  : "Remover este lead do banco?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === "devolver"
                ? "O lead volta a ficar disponível para o time e sai da sua carteira. Depois de três devoluções ele é arquivado automaticamente."
                : confirmacao?.tipo === "arquivar"
                  ? "O lead deixa de aparecer para os vendedores, mas continua no histórico."
                  : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmar()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
