import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { StatusBadge } from "@/components/StatusBadge";
import { BrazonLogo } from "@/components/BrazonLogo";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { criarVendedor, atualizarVendedor, criarAdmin, atualizarMeuPerfil, atualizarClienteAdmin } from "@/lib/admin.functions";
import { testarChaveAsaas } from "@/lib/asaas.functions";
import { obterConfiguracoes, salvarConfiguracoes } from "@/lib/config.functions";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import {
  Users,
  Layers,
  Wallet,
  UserCog,
  Plus,
  LogOut,
  Save,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração" }] }),
  component: () => (
    <RequireRole role="admin">
      <AdminArea />
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

interface VendedorRow {
  id: string;
  user_id: string;
  codigo_indicacao: string;
  percentual_comissao: number;
  ativo: boolean;
  nome?: string;
  email?: string;
  clientes_count?: number;
}

interface ClienteRow {
  id: string;
  user_id: string;
  vendedor_id: string | null;
  data_vencimento: string | null;
  status: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  planos: { nome: string; valor: number } | null;
  nome?: string;
  email?: string;
}

interface Config {
  id?: string | null;
  nome_app: string | null;
  dominio: string | null;
  dias_aviso_vencimento: number | null;
  percentual_comissao_padrao: number | null;
  asaas_webhook_url: string | null;
  asaas_ambiente: "producao" | "sandbox" | null;
  asaas_api_key_mascara: string;
  asaas_api_key_definida: boolean;
}

function AdminArea() {
  const { profile, signOut } = useAuth();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [admins, setAdmins] = useState<{ user_id: string; nome?: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [contaOpen, setContaOpen] = useState(false);
  const obterConfig = useServerFn(obterConfiguracoes);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: pls }, { data: vds }, { data: cls }, cfg, { data: adminRoles }] =
      await Promise.all([
        supabase.from("planos").select("id,nome,valor,descricao,ativo").order("valor"),
        supabase
          .from("vendedores")
          .select("id,user_id,codigo_indicacao,percentual_comissao,ativo")
          .order("created_at", { ascending: false }),
        supabase
          .from("clientes")
          .select("id,user_id,vendedor_id,data_vencimento,status,cpf_cnpj,telefone,planos(nome,valor)")
          .order("created_at", { ascending: false }),
        obterConfig({}).catch(() => null),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);

    const vrows = (vds ?? []) as unknown as VendedorRow[];
    const crows = (cls ?? []) as unknown as ClienteRow[];
    const adminIds = (adminRoles ?? []).map((r) => r.user_id);

    const userIds = [
      ...vrows.map((v) => v.user_id),
      ...crows.map((c) => c.user_id),
      ...adminIds,
    ];
    let adminRows: { user_id: string; nome?: string; email?: string }[] = [];
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nome,email")
        .in("id", userIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      vrows.forEach((v) => {
        const p = map.get(v.user_id);
        v.nome = p?.nome || undefined;
        v.email = p?.email || undefined;
        v.clientes_count = crows.filter((c) => c.vendedor_id === v.id).length;
      });
      crows.forEach((c) => {
        const p = map.get(c.user_id);
        c.nome = p?.nome || undefined;
        c.email = p?.email || undefined;
      });
      adminRows = adminIds.map((id) => {
        const p = map.get(id);
        return { user_id: id, nome: p?.nome || undefined, email: p?.email || undefined };
      });
    }

    setPlanos((pls ?? []) as Plano[]);
    setVendedores(vrows);
    setClientes(crows);
    setAdmins(adminRows);
    setConfig(
      (cfg as Config | null) ?? {
        nome_app: "",
        dominio: "",
        dias_aviso_vencimento: 5,
        percentual_comissao_padrao: 10,
        asaas_webhook_url: "",
        asaas_ambiente: "sandbox",
        asaas_api_key_mascara: "",
        asaas_api_key_definida: false,
      },
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);



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
        <BrazonLogo className="mb-6" />
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Administração</p>
            <h1 className="text-xl font-bold text-foreground">
              {profile?.nome || profile?.email}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setContaOpen(true)}>
              <UserCog className="mr-2 h-4 w-4" />
              Minha conta
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <MinhaContaDialog open={contaOpen} onOpenChange={setContaOpen} onSaved={load} />

        <Tabs defaultValue="dashboard" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <AdminDashboard />
          </TabsContent>
          <TabsContent value="vendedores" className="mt-4">
            <VendedoresTab vendedores={vendedores} onChanged={load} />
          </TabsContent>
          <TabsContent value="admins" className="mt-4">
            <AdminsTab admins={admins} onChanged={load} />
          </TabsContent>
          <TabsContent value="planos" className="mt-4">
            <PlanosTab planos={planos} onChanged={load} />
          </TabsContent>
          <TabsContent value="clientes" className="mt-4">
            <ClientesTab clientes={clientes} vendedores={vendedores} onChanged={load} />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <ConfigTab config={config} onSaved={load} />
          </TabsContent>
          <TabsContent value="auditoria" className="mt-4">
            <AuditoriaTab />
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}

/* ---------------- Minha conta (admin) ---------------- */
function MinhaContaDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { profile, refresh } = useAuth();
  const salvar = useServerFn(atualizarMeuPerfil);
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
      await salvar({
        data: { nome: nome.trim(), email: email.trim(), senha: senha || "" },
      });
      toast.success("Suas informações foram atualizadas.");
      await refresh();
      onOpenChange(false);
      onSaved();
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
            <Label htmlFor="mnome">Nome</Label>
            <Input id="mnome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="memail">E-mail</Label>
            <Input id="memail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="msenha">Nova senha (opcional)</Label>
            <Input
              id="msenha"
              type="password"
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

/* ---------------- Admins ---------------- */
function AdminsTab({
  admins,
  onChanged,
}: {
  admins: { user_id: string; nome?: string; email?: string }[];
  onChanged: () => void;
}) {
  const criar = useServerFn(criarAdmin);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setNome("");
    setEmail("");
    setSenha("");
  }

  async function submit() {
    if (nome.trim().length < 2 || !email.trim() || senha.length < 6) {
      toast.error("Preencha nome, e-mail e senha (mín. 6 caracteres).");
      return;
    }
    setSaving(true);
    try {
      await criar({ data: { nome: nome.trim(), email: email.trim(), senha } });
      toast.success("Administrador criado!");
      reset();
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar administrador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo administrador
        </Button>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Administrador</TableHead>
              <TableHead>E-mail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.user_id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    {a.nome ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.email ?? ""}</TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                  Nenhum administrador.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo administrador</DialogTitle>
            <DialogDescription>
              Defina o nome, e-mail e senha de acesso do novo administrador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="anome">Nome</Label>
              <Input id="anome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="aemail">E-mail</Label>
              <Input id="aemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asenha">Senha</Label>
              <Input
                id="asenha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

/* ---------------- Vendedores ---------------- */
function VendedoresTab({
  vendedores,
  onChanged,
}: {
  vendedores: VendedorRow[];
  onChanged: () => void;
}) {
  const criar = useServerFn(criarVendedor);
  const atualizar = useServerFn(atualizarVendedor);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VendedorRow | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [comissao, setComissao] = useState("10");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setNome("");
    setEmail("");
    setCodigo("");
    setComissao("10");
    setSenha("");
    setOpen(true);
  }

  function openEdit(v: VendedorRow) {
    setEditing(v);
    setNome(v.nome ?? "");
    setEmail(v.email ?? "");
    setCodigo(v.codigo_indicacao);
    setComissao(String(v.percentual_comissao));
    setSenha("");
    setOpen(true);
  }

  async function submit() {
    if (nome.trim().length < 2 || !email.trim() || codigo.trim().length < 2) {
      toast.error("Preencha nome, e-mail e código de indicação.");
      return;
    }
    if (senha && senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await atualizar({
          data: {
            vendedor_id: editing.id,
            nome: nome.trim(),
            email: email.trim(),
            codigo_indicacao: codigo.trim().toUpperCase(),
            percentual_comissao: Number(comissao) || 0,
            senha: senha || "",
          },
        });
        toast.success("Vendedor atualizado!");
      } else {
        const res = await criar({
          data: {
            nome: nome.trim(),
            email: email.trim(),
            codigo_indicacao: codigo.trim().toUpperCase(),
            percentual_comissao: Number(comissao) || 0,
            senha: senha || "",
          },
        });
        if (res.senha_definida) {
          toast.success("Vendedor cadastrado!", {
            description: "Ele pode entrar com o e-mail e a senha que você definiu.",
          });
        } else {
          const emailVend = email.trim();
          const { error: resetErr } = await enviarLinkDefinicaoSenha(emailVend);
          toast.success("Vendedor cadastrado!", {
            description: resetErr
              ? `Peça para ${emailVend} usar "Esqueci minha senha" no login para definir a senha.`
              : `Enviamos um e-mail para ${emailVend} definir a senha de acesso.`,
          });
        }
      }
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar vendedor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(v: VendedorRow) {
    const { error } = await supabase
      .from("vendedores")
      .update({ ativo: !v.ativo })
      .eq("id", v.id);
    if (error) toast.error("Não foi possível atualizar.");
    else {
      toast.success(v.ativo ? "Vendedor desativado." : "Vendedor ativado.");
      onChanged();
    }
  }

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo vendedor
        </Button>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedores.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{v.nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{v.email ?? ""}</div>
                </TableCell>
                <TableCell className="font-mono text-sm">{v.codigo_indicacao}</TableCell>
                <TableCell>{v.percentual_comissao}%</TableCell>
                <TableCell>{v.clientes_count ?? 0}</TableCell>
                <TableCell>
                  <Switch checked={v.ativo} onCheckedChange={() => toggleAtivo(v)} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(v)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {vendedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhum vendedor cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize os dados do vendedor. Deixe a senha em branco para mantê-la."
                : "Defina os dados do vendedor. Você pode escolher a senha de acesso."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vnome">Nome</Label>
              <Input id="vnome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vemail">E-mail</Label>
              <Input id="vemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vcod">Código de indicação</Label>
              <Input
                id="vcod"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: JOAO2026"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vcom">Comissão (%)</Label>
              <Input
                id="vcom"
                type="number"
                min={0}
                max={100}
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vsenha">
                {editing ? "Nova senha (opcional)" : "Senha de acesso"}
              </Label>
              <Input
                id="vsenha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={editing ? "Deixe em branco para manter" : "Mín. 6 caracteres"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Planos ---------------- */
function PlanosTab({ planos, onChanged }: { planos: Plano[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plano | null>(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setNome("");
    setValor("");
    setDescricao("");
    setAtivo(true);
    setOpen(true);
  }

  function openEdit(p: Plano) {
    setEditing(p);
    setNome(p.nome);
    setValor(String(p.valor));
    setDescricao(p.descricao ?? "");
    setAtivo(p.ativo);
    setOpen(true);
  }

  async function submit() {
    if (nome.trim().length < 2 || !valor) {
      toast.error("Informe nome e valor do plano.");
      return;
    }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      valor: Number(valor),
      descricao: descricao.trim() || null,
      ativo,
    };
    const { error } = editing
      ? await supabase.from("planos").update(payload).eq("id", editing.id)
      : await supabase.from("planos").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar o plano.");
      return;
    }
    toast.success(editing ? "Plano atualizado." : "Plano criado.");
    setOpen(false);
    onChanged();
  }

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo plano
        </Button>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.descricao ?? ""}</div>
                </TableCell>
                <TableCell>{formatCurrency(p.valor)}</TableCell>
                <TableCell>
                  <StatusBadge status={p.ativo ? "ativo" : "cancelado"} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {planos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nenhum plano cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pnome">Nome</Label>
              <Input id="pnome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pvalor">Valor (R$)</Label>
              <Input
                id="pvalor"
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pdesc">Descrição</Label>
              <Textarea
                id="pdesc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="pativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="pativo">Plano ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Clientes ---------------- */
function ClientesTab({
  clientes,
  vendedores,
  onChanged,
}: {
  clientes: ClienteRow[];
  vendedores: VendedorRow[];
  onChanged: () => void;
}) {
  const vmap = useMemo(
    () => new Map(vendedores.map((v) => [v.id, v.nome || v.codigo_indicacao])),
    [vendedores],
  );
  const [editing, setEditing] = useState<ClienteRow | null>(null);
  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="font-medium text-foreground">{c.nome ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{c.email ?? ""}</div>
              </TableCell>
              <TableCell>{c.vendedor_id ? vmap.get(c.vendedor_id) ?? "—" : "—"}</TableCell>
              <TableCell>{c.planos?.nome ?? "—"}</TableCell>
              <TableCell>{formatDate(c.data_vencimento)}</TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {clientes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Nenhum cliente cadastrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <EditarClienteAdminDialog
        cliente={editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={onChanged}
      />
    </Card>
  );
}

function EditarClienteAdminDialog({
  cliente,
  onOpenChange,
  onSaved,
}: {
  cliente: ClienteRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const salvar = useServerFn(atualizarClienteAdmin);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNome(cliente?.nome ?? "");
    setEmail(cliente?.email ?? "");
    setSenha("");
    setCpfCnpj(cliente?.cpf_cnpj ?? "");
    setTelefone(cliente?.telefone ?? "");
  }, [cliente]);

  async function submit() {
    if (!cliente) return;
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
      await salvar({
        data: { cliente_id: cliente.id, nome: nome.trim(), email: email.trim(), senha: senha || "", cpf_cnpj: cpfCnpj.trim() || null, telefone: telefone.trim() || null },
      });
      toast.success("Dados do cliente atualizados!");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!cliente} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar dados do cliente</DialogTitle>
          <DialogDescription>
            Atualize o nome, e-mail e senha de acesso do cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="acnome">Nome</Label>
            <Input id="acnome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acemail">E-mail</Label>
            <Input id="acemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accpf">CPF ou CNPJ</Label>
            <Input
              id="accpf"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder="Somente números"
            />
            <p className="text-xs text-muted-foreground">Obrigatório para gerar cobranças no Asaas.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="actel">Telefone (opcional)</Label>
            <Input
              id="actel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acsenha">Nova senha (opcional)</Label>
            <Input
              id="acsenha"
              type="password"
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

/* ---------------- Configurações ---------------- */
function ConfigTab({ config, onSaved }: { config: Config | null; onSaved: () => void }) {
  const [form, setForm] = useState<Config>(
    config ?? {
      nome_app: "",
      dominio: "",
      dias_aviso_vencimento: 5,
      percentual_comissao_padrao: 10,
      asaas_webhook_url: "",
      asaas_ambiente: "sandbox",
      asaas_api_key_mascara: "",
      asaas_api_key_definida: false,
    },
  );
  const [novaChave, setNovaChave] = useState("");
  const [saving, setSaving] = useState(false);
  const [testando, setTestando] = useState(false);
  const testar = useServerFn(testarChaveAsaas);
  const salvar = useServerFn(salvarConfiguracoes);

  async function testarChave() {
    setTestando(true);
    try {
      const r = await testar({});
      toast.success(
        `Chave válida! Conta: ${r.nomeConta} — ambiente ${r.ambiente === "producao" ? "produção" : "sandbox"}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao testar a chave.");
    } finally {
      setTestando(false);
    }
  }


  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await salvar({
        data: {
          nome_app: form.nome_app ?? "",
          dominio: form.dominio ?? "",
          dias_aviso_vencimento: Number(form.dias_aviso_vencimento) || 0,
          percentual_comissao_padrao: Number(form.percentual_comissao_padrao) || 0,
          asaas_webhook_url: form.asaas_webhook_url ?? "",
          asaas_ambiente: form.asaas_ambiente ?? "sandbox",
          asaas_api_key: novaChave.trim() || null,
        },
      });
      setNovaChave("");
      toast.success("Configurações salvas.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="capp">Nome do app</Label>
            <Input
              id="capp"
              value={form.nome_app ?? ""}
              onChange={(e) => set("nome_app", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cdom">Domínio</Label>
            <Input
              id="cdom"
              value={form.dominio ?? ""}
              onChange={(e) => set("dominio", e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="cdias">Dias de aviso de vencimento</Label>
            <Input
              id="cdias"
              type="number"
              min={0}
              value={form.dias_aviso_vencimento ?? 0}
              onChange={(e) => set("dias_aviso_vencimento", Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ccom">Comissão padrão (%)</Label>
            <Input
              id="ccom"
              type="number"
              min={0}
              max={100}
              value={form.percentual_comissao_padrao ?? 0}
              onChange={(e) => set("percentual_comissao_padrao", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Integração Asaas</h3>
          <p className="text-xs text-muted-foreground">
            Cobranças via PIX, boleto e cartão. Preencha quando tiver a chave da Asaas.
          </p>
          <div className="mt-3 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ckey">Chave de API Asaas</Label>
              <Input
                id="ckey"
                type="password"
                value={novaChave}
                onChange={(e) => setNovaChave(e.target.value)}
                placeholder={
                  form.asaas_api_key_definida
                    ? `Chave salva (${form.asaas_api_key_mascara}) — digite para substituir`
                    : "$aact_..."
                }
              />
              <p className="text-xs text-muted-foreground">
                {form.asaas_api_key_definida
                  ? "Deixe em branco para manter a chave atual. A chave nunca é exibida por segurança."
                  : "Cole a chave da API do Asaas. Ela fica guardada apenas no servidor."}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cwh">Webhook URL</Label>
              <Input
                id="cwh"
                value={form.asaas_webhook_url ?? ""}
                onChange={(e) => set("asaas_webhook_url", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="cprod"
                checked={form.asaas_ambiente === "producao"}
                onCheckedChange={(v) => set("asaas_ambiente", v ? "producao" : "sandbox")}
              />
              <Label htmlFor="cprod">
                Ambiente de produção {form.asaas_ambiente !== "producao" && "(sandbox)"}
              </Label>
            </div>
            <div>
              <Button type="button" variant="outline" onClick={testarChave} disabled={testando}>
                {testando ? "Testando..." : "Testar chave Asaas"}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Salve a chave antes de testar. O ambiente correto é detectado automaticamente.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface AuditoriaRow {
  id: string;
  actor_email: string | null;
  actor_role: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function AuditoriaTab() {
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("auditoria")
      .select("id,actor_email,actor_role,acao,entidade,entidade_id,detalhes,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as unknown as AuditoriaRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Auditoria de alterações</h2>
          <p className="text-sm text-muted-foreground">
            Registro das ações realizadas por vendedores e administradores.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Atualizar"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
              <TableCell>{r.actor_email ?? "—"}</TableCell>
              <TableCell>{r.actor_role ?? "—"}</TableCell>
              <TableCell>{r.acao}</TableCell>
              <TableCell>{r.entidade ?? "—"}</TableCell>
              <TableCell>
                <code className="text-xs text-muted-foreground">
                  {r.detalhes ? JSON.stringify(r.detalhes) : "—"}
                </code>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Nenhum registro de auditoria ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
