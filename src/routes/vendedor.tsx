import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { StatusBadge } from "@/components/StatusBadge";
import { AppShell } from "@/components/AppShell";
import type { AppNavItem } from "@/components/AppSidebar";

import { atualizarMensagemCliente, atualizarMeuPerfilVendedor } from "@/lib/vendedor.functions";
import { ClienteFormDialog } from "@/components/vendedor/ClienteFormDialog";
import { CuponsVendedor } from "@/components/vendedor/CuponsVendedor";
import { ReferralsCard } from "@/components/vendedor/ReferralsCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { buscarPerfis } from "@/lib/profiles";

import { toast } from "sonner";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Copy,
  UserPlus,
  MessageSquare,
  Pencil,
  UserCog,
  LayoutDashboard,
  ClipboardList,
  Share2,
  Ticket,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/vendedor")({
  head: () => ({ meta: [{ title: "Painel do vendedor" }] }),
  component: () => (
    <RequireRole role="vendedor">
      <VendedorArea />
    </RequireRole>
  ),
});

interface Plano {
  id: string;
  nome: string;
  valor: number;
}

interface Vendedor {
  id: string;
  codigo_indicacao: string;
  percentual_comissao: number;
  ativo: boolean;
}

interface ClienteRow {
  id: string;
  user_id: string;
  data_vencimento: string | null;
  status: string;
  mensagem_vendedor: string | null;
  plano_id: string | null;
  servico_extra: string | null;
  servico_extra_valor: number | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  anotacoes: string | null;
  planos: { nome: string; valor: number } | null;
  nome?: string;
  email?: string;
}

function VendedorArea() {
  const { profile } = useAuth();
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [msgCliente, setMsgCliente] = useState<ClienteRow | null>(null);
  const [editCliente, setEditCliente] = useState<ClienteRow | null>(null);
  const [contaOpen, setContaOpen] = useState(false);
  const [secaoAtiva, setSecaoAtiva] = useState("painel");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: vend, error: erroVend } = await supabase
        .from("vendedores")
        .select("id,codigo_indicacao,percentual_comissao,ativo")
        .limit(1)
        .maybeSingle();
      if (erroVend) throw new Error(erroVend.message);
      setVendedor((vend ?? null) as Vendedor | null);

      const { data: pls, error: erroPls } = await supabase
        .from("planos")
        .select("id,nome,valor")
        .eq("ativo", true)
        .order("valor");
      if (erroPls) throw new Error(erroPls.message);
      setPlanos((pls ?? []) as Plano[]);

      const { data: cls, error: erroCls } = await supabase
        .from("clientes")
        .select(
          "id,user_id,data_vencimento,status,mensagem_vendedor,anotacoes,plano_id,servico_extra,servico_extra_valor,cpf_cnpj,telefone,planos(nome,valor)",
        )
        .order("created_at", { ascending: false });
      if (erroCls) throw new Error(erroCls.message);
      const rows = (cls ?? []) as unknown as ClienteRow[];

      const map = await buscarPerfis(rows.map((r) => r.user_id));
      rows.forEach((r) => {
        const p = map.get(r.user_id);
        r.nome = p?.nome || undefined;
        r.email = p?.email || undefined;
      });

      setClientes(rows);
    } catch (e) {
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

  const metrics = useMemo(() => {
    const total = clientes.length;
    const ativos = clientes.filter((c) => c.status === "ativo").length;
    const vencendo = clientes.filter((c) => c.status === "vencido").length;
    const inadimplentes = clientes.filter((c) => c.status === "inadimplente").length;
    const receitaAtiva = clientes
      .filter((c) => c.status === "ativo")
      .reduce((s, c) => s + (c.planos?.valor ?? 0) + (c.servico_extra_valor ?? 0), 0);
    const comissao = receitaAtiva * ((vendedor?.percentual_comissao ?? 0) / 100);
    return { total, ativos, vencendo, inadimplentes, comissao };
  }, [clientes, vendedor]);

  const linkIndicacao = vendedor
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/cadastro?ref=${vendedor.codigo_indicacao}`
    : "";

  function copiar(text: string, msg: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(msg));
  }

  const navItems: AppNavItem[] = [
    { value: "painel", label: "Painel", icon: LayoutDashboard, to: "/vendedor" },
    { value: "tarefas", label: "Tarefas", icon: ClipboardList, to: "/tarefas" },
    { value: "comercial", label: "Comercial", icon: Target, to: "/comercial" },
    { value: "indicacoes", label: "Indicações", icon: Share2 },
    { value: "cupons", label: "Meus cupons", icon: Ticket },
    { value: "clientes", label: "Meus clientes", icon: Users },
  ];

  /** Rola até a seção correspondente; o item ativo é simplesmente o último clicado. */
  function irParaSecao(value: string) {
    setSecaoAtiva(value);
    document.getElementById(`secao-${value}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AppShell
      contexto="Painel do vendedor"
      items={navItems}
      tab={secaoAtiva}
      onTab={irParaSecao}
      onConta={() => setContaOpen(true)}
      acaoPrincipal={{
        label: "Cadastrar cliente",
        icon: UserPlus,
        onClick: () => setDialogOpen(true),
      }}
    >

        {/* Cabeçalho */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Painel do vendedor</p>
            <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">
              {profile?.nome || profile?.email}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Código de afiliado:</span>
              <button
                onClick={() => copiar(vendedor?.codigo_indicacao ?? "", "Código copiado!")}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
              >
                {vendedor?.codigo_indicacao}
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        <MinhaContaVendedorDialog open={contaOpen} onOpenChange={setContaOpen} />

        {/* Métricas */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard icon={Users} label="Total de clientes" value={String(metrics.total)} />
          <MetricCard
            icon={CheckCircle2}
            label="Ativos"
            value={String(metrics.ativos)}
            tone="text-success"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Vencidos / inadimplentes"
            value={String(metrics.vencendo + metrics.inadimplentes)}
            tone="text-destructive"
          />
          <MetricCard
            icon={Wallet}
            label="Comissão estimada/mês"
            value={formatCurrency(metrics.comissao)}
            tone="text-primary"
          />
        </section>

        {/* Link de indicação */}
        <section className="mt-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground">Seu link de indicação</h2>
            <p className="text-sm text-muted-foreground">
              Compartilhe para que novos clientes se cadastrem ligados a você.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={linkIndicacao} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copiar(linkIndicacao, "Link copiado!")}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </Card>
        </section>

        {/* Indicações */}
        <div id="secao-indicacoes">
          <ReferralsCard />
        </div>

        {/* Cupons do vendedor */}
        <div id="secao-cupons">
          <CuponsVendedor />
        </div>

        {/* Lista de clientes */}
        <section id="secao-clientes" className="mt-8">
          <h2 className="text-lg font-bold text-foreground">Meus clientes</h2>
          <Card className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{c.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email ?? ""}</div>
                      <div className="mt-2 flex flex-wrap gap-2 sm:hidden">
                        <Button variant="outline" size="sm" onClick={() => setMsgCliente(c)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {c.mensagem_vendedor ? "Editar aviso" : "Enviar aviso"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditCliente(c)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar dados
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{c.planos?.nome ?? "—"}</div>
                      {c.servico_extra && (
                        <div className="text-xs text-muted-foreground">
                          + {c.servico_extra} ({formatCurrency(c.servico_extra_valor ?? 0)})
                        </div>
                      )}
                      {(c.planos?.valor || c.servico_extra_valor) && (
                        <div className="text-xs font-semibold text-foreground">
                          Total:{" "}
                          {formatCurrency((c.planos?.valor ?? 0) + (c.servico_extra_valor ?? 0))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setMsgCliente(c)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {c.mensagem_vendedor ? "Editar aviso" : "Enviar aviso"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditCliente(c)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar dados
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhum cliente cadastrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </section>

      <ClienteFormDialog
        mode="criar"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        planos={planos}
        onSaved={load}
      />

      <MensagemDialog
        cliente={msgCliente}
        onOpenChange={(v) => !v && setMsgCliente(null)}
        onSaved={load}
      />

      <ClienteFormDialog
        mode="editar"
        cliente={editCliente}
        planos={planos}
        onOpenChange={(v: boolean) => !v && setEditCliente(null)}
        onSaved={load}
      />
    </AppShell>

  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "text-foreground",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card className="card-interactive p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground sm:gap-2.5">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 sm:h-9 sm:w-9 ${tone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 text-xs font-medium leading-tight sm:text-sm">{label}</span>
      </div>
      <p className={`mt-3 text-xl font-bold sm:text-2xl ${tone}`}>{value}</p>
    </Card>
  );
}

function MensagemDialog({
  cliente,
  onOpenChange,
  onSaved,
}: {
  cliente: ClienteRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const salvar = useServerFn(atualizarMensagemCliente);
  const [mensagem, setMensagem] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMensagem(cliente?.mensagem_vendedor ?? "");
  }, [cliente]);

  async function submit() {
    if (!cliente) return;
    setSaving(true);
    try {
      await salvar({
        data: {
          cliente_id: cliente.id,
          mensagem_vendedor: mensagem.trim() || null,
        },
      });
      toast.success("Mensagem salva!");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a mensagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!cliente} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mensagem para {cliente?.nome ?? "o cliente"}</DialogTitle>
          <DialogDescription>
            O aviso aparece no topo da área do cliente. Deixe em branco para remover.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="aviso">Mensagem / aviso</Label>
          <Textarea
            id="aviso"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Ex: Seu plano vence em breve, renove para continuar ativo."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MinhaContaVendedorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { profile, refresh } = useAuth();
  const salvar = useServerFn(atualizarMeuPerfilVendedor);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(profile?.nome ?? "");
      setEmail(profile?.email ?? "");
      setSenha("");
    }
  }, [open, profile]);

  async function submit() {
    if (nome.trim().length < 2 || !email.trim()) {
      toast.error("Informe nome e e-mail válidos.");
      return;
    }
    if (senha && senha.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await salvar({ data: { nome: nome.trim(), email: email.trim(), senha: senha || "" } });
      toast.success("Suas informações foram atualizadas.");
      await refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Minha conta</DialogTitle>
          <DialogDescription>Edite seu nome, e-mail e senha de acesso.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="vmcnome">Nome</Label>
            <Input id="vmcnome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vmcemail">E-mail</Label>
            <Input
              id="vmcemail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vmcsenha">Nova senha (opcional)</Label>
            <PasswordInput
              id="vmcsenha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Deixe em branco para manter"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
