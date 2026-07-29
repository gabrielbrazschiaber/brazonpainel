import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Plus, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/auth";
import { TermosGate } from "@/components/TermosGate";
import { BrazonLogo } from "@/components/BrazonLogo";
import { SairButton } from "@/components/SairButton";
import { formatDate } from "@/lib/format";
import {
  listarTarefas,
  listarResponsaveis,
  criarTarefa,
  atualizarTarefa,
  type Tarefa,
  type TarefaStatus,
  type TarefaPrioridade,
  type ResponsavelOpcao,
} from "@/lib/tarefas.functions";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas e solicitações | Brazon" },
      {
        name: "description",
        content:
          "Acompanhe tarefas de ativação de planos, solicitações de clientes e direcione responsáveis pelo atendimento.",
      },
      { property: "og:title", content: "Tarefas e solicitações | Brazon" },
      {
        property: "og:description",
        content:
          "Central de tarefas: ativação de planos, solicitações de clientes e direcionamento de responsáveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

const STATUS_LABEL: Record<TarefaStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const PRIORIDADE_LABEL: Record<TarefaPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

function statusClasse(status: TarefaStatus): string {
  if (status === "concluida") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "em_andamento") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "cancelada") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary border-primary/20";
}

function prioridadeClasse(p: TarefaPrioridade): string {
  if (p === "alta") return "bg-red-100 text-red-700 border-red-200";
  if (p === "baixa") return "bg-muted text-muted-foreground";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function origemLabel(t: Tarefa): string {
  if (t.origem === "plano") return "Contratação de plano";
  if (t.origem === "solicitacao_cliente") return "Solicitação do cliente";
  return "Tarefa interna";
}

function TarefasPage() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <TermosGate>
      <TarefasConteudo equipe={role !== "cliente"} home={roleHome(role)} />
    </TermosGate>
  );
}

interface ClienteOpcao {
  id: string;
  nome: string;
}

function TarefasConteudo({ equipe, home }: { equipe: boolean; home: string }) {
  const carregar = useServerFn(listarTarefas);
  const carregarResponsaveis = useServerFn(listarResponsaveis);
  const criar = useServerFn(criarTarefa);
  const atualizar = useServerFn(atualizarTarefa);

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [responsaveis, setResponsaveis] = useState<ResponsavelOpcao[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<TarefaStatus | "todas">("todas");
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media" as TarefaPrioridade,
    prazo: "",
    cliente_id: "",
    responsavel_id: "",
  });

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setTarefas(await carregar({}));
    } catch {
      toast.error("Não foi possível carregar as tarefas.");
    } finally {
      setCarregando(false);
    }
  }, [carregar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (!equipe) return;
    void (async () => {
      try {
        setResponsaveis(await carregarResponsaveis({}));
      } catch {
        /* lista de responsáveis é opcional na tela */
      }

      const { data } = await supabase
        .from("clientes")
        .select("id, user_id")
        .order("created_at", { ascending: false })
        .limit(300);

      const ids = (data ?? []).map((c) => c.user_id);
      if (ids.length === 0) return;
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      const nomes = new Map((perfis ?? []).map((p) => [p.id, (p.nome || "").trim() || p.email]));
      setClientes(
        (data ?? []).map((c) => ({ id: c.id, nome: nomes.get(c.user_id) ?? "Cliente" })),
      );
    })();
  }, [equipe, carregarResponsaveis]);

  const visiveis = useMemo(
    () => (filtro === "todas" ? tarefas : tarefas.filter((t) => t.status === filtro)),
    [tarefas, filtro],
  );

  const resumo = useMemo(
    () => ({
      abertas: tarefas.filter((t) => t.status === "aberta").length,
      andamento: tarefas.filter((t) => t.status === "em_andamento").length,
      concluidas: tarefas.filter((t) => t.status === "concluida").length,
      semResponsavel: tarefas.filter((t) => !t.responsavel_id && t.status !== "concluida").length,
    }),
    [tarefas],
  );

  async function enviar() {
    setSalvando(true);
    try {
      await criar({
        data: {
          titulo: form.titulo,
          descricao: form.descricao,
          prioridade: form.prioridade,
          prazo: form.prazo || null,
          cliente_id: form.cliente_id || null,
          responsavel_id: form.responsavel_id || null,
        },
      });
      toast.success(equipe ? "Tarefa criada." : "Solicitação enviada ao seu vendedor.");
      setAberto(false);
      setForm({ titulo: "", descricao: "", prioridade: "media", prazo: "", cliente_id: "", responsavel_id: "" });
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterar(id: string, patch: Parameters<typeof atualizarTarefa>[0] extends never ? never : {
    status?: TarefaStatus;
    prioridade?: TarefaPrioridade;
    responsavel_id?: string | null;
  }) {
    setAtualizandoId(id);
    try {
      await atualizar({ data: { id, ...patch } });
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a tarefa.");
    } finally {
      setAtualizandoId(null);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <BrazonLogo className="h-7 w-auto shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {equipe ? "Tarefas" : "Minhas solicitações"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {equipe
                ? "Ativações de plano, solicitações de clientes e direcionamento de responsáveis."
                : "Peça um atendimento e acompanhe o andamento com o seu vendedor."}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to={home}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <SairButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        {equipe && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Resumo titulo="Abertas" valor={resumo.abertas} />
            <Resumo titulo="Em andamento" valor={resumo.andamento} />
            <Resumo titulo="Sem responsável" valor={resumo.semResponsavel} />
            <Resumo titulo="Concluídas" valor={resumo.concluidas} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as TarefaStatus | "todas")}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABEL) as TarefaStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button className="ml-auto" onClick={() => setAberto(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {equipe ? "Nova tarefa" : "Nova solicitação"}
          </Button>
        </div>

        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visiveis.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma tarefa por aqui</p>
            <p className="text-sm text-muted-foreground">
              {equipe
                ? "Tarefas são criadas automaticamente quando um cliente contrata um plano."
                : "Crie uma solicitação e o seu vendedor cuidará do direcionamento."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {visiveis.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.titulo}</span>
                      <Badge variant="outline" className={statusClasse(t.status)}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                      <Badge variant="outline" className={prioridadeClasse(t.prioridade)}>
                        {PRIORIDADE_LABEL[t.prioridade]}
                      </Badge>
                    </div>
                    {t.descricao && (
                      <p className="whitespace-pre-line text-sm text-muted-foreground">{t.descricao}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {origemLabel(t)}
                      {t.cliente_nome ? ` · Cliente: ${t.cliente_nome}` : ""}
                      {` · Criada em ${formatDate(t.created_at)}`}
                      {t.prazo ? ` · Prazo ${formatDate(t.prazo)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Responsável: {t.responsavel_nome ?? "a direcionar"}
                    </p>
                  </div>

                  {equipe && (
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
                      <Select
                        value={t.responsavel_id ?? "nenhum"}
                        disabled={atualizandoId === t.id}
                        onValueChange={(v) =>
                          alterar(t.id, { responsavel_id: v === "nenhum" ? null : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Direcionar responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhum">Sem responsável</SelectItem>
                          {responsaveis.map((r) => (
                            <SelectItem key={r.user_id} value={r.user_id}>
                              {r.nome} ({r.papel === "admin" ? "admin" : "vendedor"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={t.status}
                        disabled={atualizandoId === t.id}
                        onValueChange={(v) => alterar(t.id, { status: v as TarefaStatus })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as TarefaStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{equipe ? "Nova tarefa" : "Nova solicitação"}</DialogTitle>
            <DialogDescription>
              {equipe
                ? "Descreva a tarefa, escolha o cliente (opcional) e direcione o responsável."
                : "Conte o que você precisa. A solicitação vai para o seu vendedor, que direciona ao responsável."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-titulo">Título *</Label>
              <Input
                id="t-titulo"
                value={form.titulo}
                maxLength={140}
                placeholder="Ex.: Configurar acesso do cliente"
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="t-desc">Detalhes</Label>
              <Textarea
                id="t-desc"
                rows={4}
                value={form.descricao}
                maxLength={2000}
                placeholder="Explique o que precisa ser feito"
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v as TarefaPrioridade }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORIDADE_LABEL) as TarefaPrioridade[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORIDADE_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {equipe && (
                <div className="grid gap-1.5">
                  <Label htmlFor="t-prazo">Prazo</Label>
                  <Input
                    id="t-prazo"
                    type="date"
                    value={form.prazo}
                    onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {equipe && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Cliente (opcional)</Label>
                  <Select
                    value={form.cliente_id || "nenhum"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, cliente_id: v === "nenhum" ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem cliente</SelectItem>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label>Responsável</Label>
                  <Select
                    value={form.responsavel_id || "nenhum"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, responsavel_id: v === "nenhum" ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Direcionar depois" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Direcionar depois</SelectItem>
                      {responsaveis.map((r) => (
                        <SelectItem key={r.user_id} value={r.user_id}>
                          {r.nome} ({r.papel === "admin" ? "admin" : "vendedor"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={salvando || form.titulo.trim().length < 3}>
              {salvando ? "Salvando..." : equipe ? "Criar tarefa" : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Resumo({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-semibold">{valor}</p>
    </Card>
  );
}
