import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { StatusBadge } from "@/components/StatusBadge";
import { criarCliente } from "@/lib/vendedor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Copy,
  UserPlus,
  LogOut,
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
  planos: { nome: string; valor: number } | null;
  nome?: string;
  email?: string;
}

function defaultVencimento() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function VendedorArea() {
  const { profile, signOut } = useAuth();
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: vend } = await supabase
      .from("vendedores")
      .select("id,codigo_indicacao,percentual_comissao,ativo")
      .maybeSingle();
    setVendedor(vend as Vendedor | null);

    const { data: pls } = await supabase
      .from("planos")
      .select("id,nome,valor")
      .eq("ativo", true)
      .order("valor");
    setPlanos((pls ?? []) as Plano[]);

    const { data: cls } = await supabase
      .from("clientes")
      .select("id,user_id,data_vencimento,status,mensagem_vendedor,plano_id,planos(nome,valor)")
      .order("created_at", { ascending: false });
    const rows = (cls ?? []) as unknown as ClienteRow[];

    const ids = rows.map((r) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nome,email")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        const p = map.get(r.user_id);
        r.nome = p?.nome || undefined;
        r.email = p?.email || undefined;
      });
    }
    setClientes(rows);
    setLoading(false);
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
      .reduce((s, c) => s + (c.planos?.valor ?? 0), 0);
    const comissao = receitaAtiva * ((vendedor?.percentual_comissao ?? 0) / 100);
    return { total, ativos, vencendo, inadimplentes, comissao };
  }, [clientes, vendedor]);

  const linkIndicacao = vendedor
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/cadastro?ref=${vendedor.codigo_indicacao}`
    : "";

  function copiar(text: string, msg: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(msg));
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
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Painel do vendedor</p>
            <h1 className="text-xl font-bold text-foreground">
              {profile?.nome || profile?.email}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Código de afiliado:</span>
              <button
                onClick={() => copiar(vendedor?.codigo_indicacao ?? "", "Código copiado!")}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary"
              >
                {vendedor?.codigo_indicacao}
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Cadastrar cliente
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Métricas */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Users} label="Total de clientes" value={String(metrics.total)} />
          <MetricCard icon={CheckCircle2} label="Ativos" value={String(metrics.ativos)} tone="text-success" />
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
              <Button
                variant="outline"
                onClick={() => copiar(linkIndicacao, "Link copiado!")}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </Card>
        </section>

        {/* Lista de clientes */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-foreground">Meus clientes</h2>
          <Card className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{c.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email ?? ""}</div>
                    </TableCell>
                    <TableCell>{c.planos?.nome ?? "—"}</TableCell>
                    <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {clientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Nenhum cliente cadastrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>

      <CadastrarClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        planos={planos}
        onCreated={load}
      />
    </div>
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
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
}

function CadastrarClienteDialog({
  open,
  onOpenChange,
  planos,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planos: Plano[];
  onCreated: () => void;
}) {
  const criar = useServerFn(criarCliente);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [planoId, setPlanoId] = useState<string>("");
  const [vencimento, setVencimento] = useState(defaultVencimento());
  const [mensagem, setMensagem] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setNome("");
    setEmail("");
    setPlanoId("");
    setVencimento(defaultVencimento());
    setMensagem("");
  }

  async function submit() {
    if (nome.trim().length < 2 || !email.trim()) {
      toast.error("Informe nome e e-mail válidos.");
      return;
    }
    setSaving(true);
    try {
      const res = await criar({
        data: {
          nome: nome.trim(),
          email: email.trim(),
          plano_id: planoId || null,
          data_vencimento: vencimento,
          mensagem_vendedor: mensagem.trim() || null,
        },
      });
      toast.success("Cliente cadastrado!", {
        description: `Senha de acesso inicial: ${res.senha}`,
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar cliente</DialogTitle>
          <DialogDescription>
            O cliente recebe uma senha padrão e poderá trocá-la depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Plano</Label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — {formatCurrency(p.valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="venc">Vencimento</Label>
            <Input
              id="venc"
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="msg">Mensagem ao cliente (opcional)</Label>
            <Textarea
              id="msg"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Ex: Bem-vindo! Qualquer dúvida me chame."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
