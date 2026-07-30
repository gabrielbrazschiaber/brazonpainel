import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { SairButton } from "@/components/SairButton";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";
import { StatusBadge } from "@/components/StatusBadge";
import { BrazonSymbol } from "@/components/BrazonLogo";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { NovidadesTab } from "@/components/admin/NovidadesTab";
import { PermissoesTab } from "@/components/admin/PermissoesTab";
import { CuponsTab } from "@/components/admin/CuponsTab";
import { ConfiguracoesPage, type SecaoConfiguracao } from "@/components/admin/ConfiguracoesPage";
import { NovidadesSino } from "@/components/NovidadesSino";

import { ClienteFormDialog } from "@/components/vendedor/ClienteFormDialog";
import {
  criarVendedor,
  atualizarVendedor,
  criarAdmin,
  atualizarMeuPerfil,
  excluirVendedor,
  excluirAdmin,
  excluirCliente,
  reprocessarSyncCliente,
  listarAuditoria,
  salvarPlano,
  alternarVendedorAtivo,
} from "@/lib/admin.functions";
import { testarChaveAsaas } from "@/lib/asaas.functions";
import { obterConfiguracoes, salvarConfiguracoes, obterWebhookToken } from "@/lib/config.functions";
import { gerarLembretesAgora, ultimaExecucaoLembretes } from "@/lib/lembretes.functions";

import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  UserCog,
  Plus,
  LogOut,
  Save,
  Shield,
  Copy,
  Check,
  KeyRound,
  LayoutDashboard,
  TicketPercent,
  Users,
  Package,
  UserCircle,
  Settings,
  ScrollText,
  Megaphone,
  Trash2,
  Search,
  X,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

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
  plano_id: string | null;
  servico_extra: string | null;
  servico_extra_valor: number | null;
  anotacoes: string | null;
  asaas_subscription_id?: string | null;
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
  const { profile } = useAuth();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [admins, setAdmins] = useState<{ user_id: string; nome?: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [contaOpen, setContaOpen] = useState(false);
  const [tab, setTab] = useState("dashboard");
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
          .select(
            "id,user_id,vendedor_id,data_vencimento,status,cpf_cnpj,telefone,plano_id,servico_extra,servico_extra_valor,anotacoes,asaas_subscription_id,planos(nome,valor)",
          )
          .order("created_at", { ascending: false }),
        obterConfig({}).catch(() => null),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);

    const vrows = (vds ?? []) as unknown as VendedorRow[];
    const crows = (cls ?? []) as unknown as ClienteRow[];
    const adminIds = (adminRoles ?? []).map((r) => r.user_id);

    const userIds = [...vrows.map((v) => v.user_id), ...crows.map((c) => c.user_id), ...adminIds];
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

  const navItems = [
    { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { value: "clientes", label: "Clientes", icon: UserCircle },
    { value: "novidades", label: "Novidades", icon: Megaphone },
    { value: "config", label: "Configurações", icon: Settings },
    { value: "auditoria", label: "Auditoria", icon: ScrollText },
  ] as const;

  const secoesConfig: SecaoConfiguracao[] = [
    {
      value: "cupons",
      label: "Cupons",
      descricao: "Descontos e histórico de uso",
      icon: TicketPercent,
      permissao: "cupons.gerenciar",
      render: () => <CuponsTab />,
    },
    {
      value: "planos",
      label: "Planos",
      descricao: "Valores e disponibilidade",
      icon: Package,
      permissao: "planos.gerenciar",
      render: () => <PlanosTab planos={planos} onChanged={load} />,
    },
    {
      value: "admins",
      label: "Admins",
      descricao: "Acessos administrativos",
      icon: Shield,
      permissao: "vendedores.ler",
      render: () => <AdminsTab admins={admins} onChanged={load} />,
    },
    {
      value: "vendedores",
      label: "Vendedores",
      descricao: "Equipe de vendas e comissões",
      icon: Users,
      permissao: "vendedores.ler",
      render: () => <VendedoresTab vendedores={vendedores} onChanged={load} />,
    },
    {
      value: "permissoes",
      label: "Permissões",
      descricao: "O que cada papel pode fazer",
      icon: KeyRound,
      permissao: "configuracoes.gerenciar",
      render: () => <PermissoesTab />,
    },
    {
      value: "geral",
      label: "Geral e integrações",
      descricao: "Dados do app, Asaas e webhook",
      icon: Settings,
      permissao: "configuracoes.gerenciar",
      render: () => <ConfigTab config={config} onSaved={load} />,
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar
          items={navItems}
          tab={tab}
          onTab={setTab}
          onConta={() => setContaOpen(true)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border/60 px-2 pt-[env(safe-area-inset-top)] sm:gap-2 sm:px-4">
            <SidebarTrigger className="h-10 w-10 shrink-0" aria-label="Abrir menu" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Administração</p>
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {profile?.nome || profile?.email}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <Button asChild variant="ghost" size="sm" className="h-10 w-10 shrink-0 p-0 sm:h-9 sm:w-auto sm:px-3" aria-label="Tarefas">
              <Link to="/tarefas">
                <ClipboardList className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tarefas</span>
              </Link>
            </Button>
            <NovidadesSino />
              <SairButton variante="icone" />
            </div>
          </header>

          <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-6">
            <MinhaContaDialog open={contaOpen} onOpenChange={setContaOpen} onSaved={load} />

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="sr-only">
                {navItems.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="dashboard" className="mt-0">
                <AdminDashboard />
              </TabsContent>
              <TabsContent value="clientes" className="mt-0">
                <ClientesTab
                  clientes={clientes}
                  vendedores={vendedores}
                  planos={planos}
                  onChanged={load}
                />
              </TabsContent>
              <TabsContent value="novidades" className="mt-0">
                <NovidadesTab />
              </TabsContent>
              <TabsContent value="config" className="mt-0">
                <ConfiguracoesPage secoes={secoesConfig} />
              </TabsContent>
              <TabsContent value="auditoria" className="mt-0">
                <AuditoriaTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </SidebarProvider>
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
            <Input
              id="memail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="msenha">Nova senha (opcional)</Label>
            <PasswordInput
              id="msenha"
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
  const { profile } = useAuth();
  const criar = useServerFn(criarAdmin);
  const excluir = useServerFn(excluirAdmin);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [aExcluir, setAExcluir] = useState<{ user_id: string; nome?: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

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

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await excluir({ data: { user_id: aExcluir.user_id } });
      toast.success("Administrador excluído.");
      setAExcluir(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir administrador.");
    } finally {
      setExcluindo(false);
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
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Administrador</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.user_id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    {a.nome ?? "—"}
                    {a.user_id === profile?.id && (
                      <span className="text-xs text-muted-foreground">(você)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.email ?? ""}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={a.user_id === profile?.id}
                    onClick={() => setAExcluir({ user_id: a.user_id, nome: a.nome })}
                    aria-label="Excluir administrador"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
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
              <Input
                id="aemail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asenha">Senha</Label>
              <PasswordInput
                id="asenha"
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

      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso de <strong>{aExcluir?.nome || "este administrador"}</strong> será removido
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
  const excluir = useServerFn(excluirVendedor);
  const alternarAtivo = useServerFn(alternarVendedorAtivo);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VendedorRow | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [comissao, setComissao] = useState("10");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [aExcluir, setAExcluir] = useState<VendedorRow | null>(null);
  const [excluindo, setExcluindo] = useState(false);

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
    try {
      await alternarAtivo({ data: { vendedor_id: v.id, ativo: !v.ativo } });
      toast.success(v.ativo ? "Vendedor desativado." : "Vendedor ativado.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await excluir({ data: { vendedor_id: aExcluir.id } });
      toast.success("Vendedor excluído.");
      setAExcluir(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir vendedor.");
    } finally {
      setExcluindo(false);
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
        <Table className="min-w-[600px]">
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
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(v)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setAExcluir(v)}
                      aria-label="Excluir vendedor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
              <Input
                id="vemail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
              <PasswordInput
                id="vsenha"
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

      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso de <strong>{aExcluir?.nome || "este vendedor"}</strong> será removido
              permanentemente. Se ele tiver clientes vinculados, a exclusão será bloqueada —
              reatribua ou exclua os clientes antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- Planos ---------------- */
function PlanosTab({ planos, onChanged }: { planos: Plano[]; onChanged: () => void }) {
  const gravarPlano = useServerFn(salvarPlano);
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
    try {
      await gravarPlano({ data: { ...payload, id: editing?.id } });
    } catch (e) {
      setSaving(false);
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o plano.");
      return;
    }
    setSaving(false);
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
        <Table className="min-w-[600px]">
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
  planos,
  onChanged,
}: {
  clientes: ClienteRow[];
  vendedores: VendedorRow[];
  planos: Plano[];
  onChanged: () => void;
}) {
  const vmap = useMemo(
    () => new Map(vendedores.map((v) => [v.id, v.nome || v.codigo_indicacao])),
    [vendedores],
  );
  const excluir = useServerFn(excluirCliente);
  const reprocessarSync = useServerFn(reprocessarSyncCliente);
  const [reprocessando, setReprocessando] = useState<string | null>(null);

  const reprocessarCliente = async (c: ClienteRow) => {
    setReprocessando(c.id);
    try {
      const res = await reprocessarSync({ data: { cliente_id: c.id } });
      if (res.ok) {
        toast.success("Sincronização concluída!", {
          description: `A cobrança de ${c.nome ?? "cliente"} foi atualizada no Asaas.`,
        });
      } else if (res.motivo === "sem_assinatura") {
        toast.warning("Cliente sem assinatura ativa no Asaas.");
      } else {
        toast.info("Nova tentativa criada na fila.", {
          description:
            "Não foi possível sincronizar agora. A tentativa ficou agendada e será reprocessada automaticamente.",
        });
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reprocessar a sincronização.");
    } finally {
      setReprocessando(null);
    }
  };

  const [editing, setEditing] = useState<ClienteRow | null>(null);
  const [aExcluir, setAExcluir] = useState<ClienteRow | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [planoFiltro, setPlanoFiltro] = useState<string>("todos");

  const planosOpcoes = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => {
      if (c.planos?.nome) set.add(c.planos.nome);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [clientes]);

  const statusOpcoes = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => {
      if (c.status) set.add(c.status);
    });
    return Array.from(set);
  }, [clientes]);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoNum = termo.replace(/\D/g, "");
    return clientes.filter((c) => {
      if (statusFiltro !== "todos" && c.status !== statusFiltro) return false;
      if (vendedorFiltro !== "todos") {
        if (vendedorFiltro === "sem" ? !!c.vendedor_id : c.vendedor_id !== vendedorFiltro)
          return false;
      }
      if (planoFiltro !== "todos" && c.planos?.nome !== planoFiltro) return false;
      if (!termo) return true;
      const nome = (c.nome ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      const cpfNum = (c.cpf_cnpj ?? "").replace(/\D/g, "");
      const telNum = (c.telefone ?? "").replace(/\D/g, "");
      if (nome.includes(termo) || email.includes(termo)) return true;
      if (termoNum && (cpfNum.includes(termoNum) || telNum.includes(termoNum))) return true;
      return false;
    });
  }, [clientes, busca, statusFiltro, vendedorFiltro, planoFiltro]);

  const filtrosAtivos =
    !!busca || statusFiltro !== "todos" || vendedorFiltro !== "todos" || planoFiltro !== "todos";

  function limparFiltros() {
    setBusca("");
    setStatusFiltro("todos");
    setVendedorFiltro("todos");
    setPlanoFiltro("todos");
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await excluir({ data: { cliente_id: aExcluir.id } });
      toast.success("Cliente excluído.");
      setAExcluir(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir cliente.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail, CPF/CNPJ ou telefone…"
              className="pl-8"
            />
          </div>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statusOpcoes.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              <SelectItem value="sem">Sem vendedor</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome || v.codigo_indicacao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={planoFiltro} onValueChange={setPlanoFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os planos</SelectItem>
              {planosOpcoes.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Mostrando {clientesFiltrados.length} de {clientes.length} cliente
            {clientes.length === 1 ? "" : "s"}
          </span>
          {filtrosAtivos && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-7 gap-1 px-2">
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table className="min-w-[600px]">
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
            {clientesFiltrados.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{c.nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.email ?? ""}</div>
                </TableCell>
                <TableCell>{c.vendedor_id ? (vmap.get(c.vendedor_id) ?? "—") : "—"}</TableCell>
                <TableCell>{c.planos?.nome ?? "—"}</TableCell>
                <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.asaas_subscription_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={reprocessando === c.id}
                        onClick={() => reprocessarCliente(c)}
                        aria-label="Reprocessar sincronização com o Asaas"
                        title="Reprocessar sincronização com o Asaas"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${reprocessando === c.id ? "animate-spin" : ""}`}
                        />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                      Editar
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setAExcluir(c)}
                      aria-label="Excluir cliente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clientesFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  {clientes.length === 0
                    ? "Nenhum cliente cadastrado."
                    : "Nenhum cliente encontrado com esses filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ClienteFormDialog
          mode="editar"
          escopo="admin"
          cliente={editing}
          planos={planos.map((p) => ({ id: p.id, nome: p.nome, valor: p.valor }))}
          onOpenChange={(v) => !v && setEditing(null)}
          onSaved={onChanged}
        />
        <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                O acesso e todos os pagamentos de{" "}
                <strong>{aExcluir?.nome || "este cliente"}</strong> serão removidos permanentemente.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarExclusao}
                disabled={excluindo}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {excluindo ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
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
  const [gerandoLembretes, setGerandoLembretes] = useState(false);
  const gerarLembretes = useServerFn(gerarLembretesAgora);
  const buscarUltimaExecucao = useServerFn(ultimaExecucaoLembretes);
  const [ultimoLembrete, setUltimoLembrete] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarUltimaExecucao({})
      .then((r) => {
        if (ativo) setUltimoLembrete(r.ultimo);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [buscarUltimaExecucao]);


  const [testando, setTestando] = useState(false);
  const [tokenMascara, setTokenMascara] = useState("");
  const [tokenRevelado, setTokenRevelado] = useState<string | null>(null);
  const [tokenDefinido, setTokenDefinido] = useState(false);
  const [carregandoToken, setCarregandoToken] = useState(false);
  const [copiado, setCopiado] = useState<"token" | "url" | null>(null);
  const testar = useServerFn(testarChaveAsaas);
  const salvar = useServerFn(salvarConfiguracoes);
  const carregarToken = useServerFn(obterWebhookToken);

  useEffect(() => {
    carregarToken({ data: {} })
      .then((r) => {
        setTokenMascara(r.mascara);
        setTokenDefinido(r.definido);
      })
      .catch(() => {
        setTokenMascara("");
        setTokenDefinido(false);
      });
  }, [carregarToken]);

  /** Busca o token completo sob demanda (não fica na página por padrão). */
  async function obterTokenCompleto(): Promise<string | null> {
    if (tokenRevelado) return tokenRevelado;
    setCarregandoToken(true);
    try {
      const r = await carregarToken({ data: { revelar: true } });
      if (!r.token) {
        toast.error("Nenhum token configurado no servidor.");
        return null;
      }
      setTokenRevelado(r.token);
      return r.token;
    } catch {
      toast.error("Não foi possível ler o token.");
      return null;
    } finally {
      setCarregandoToken(false);
    }
  }

  async function copiar(texto: string, qual: "token" | "url") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      toast.success("Copiado!");
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  }

  async function copiarToken() {
    const t = await obterTokenCompleto();
    if (t) await copiar(t, "token");
  }

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
            <p className="text-xs text-muted-foreground">
              Clientes ativos recebem um lembrete automático no painel quando o vencimento
              estiver dentro desse prazo. A rotina roda todos os dias às 6h (horário de
              Brasília).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gerandoLembretes}
                onClick={async () => {
                  setGerandoLembretes(true);
                  try {
                    const r = await gerarLembretes({});
                    toast.success(
                      `Lembretes gerados: ${r.criados} novo(s) em ${r.avaliados} cliente(s).`,
                    );
                    const u = await buscarUltimaExecucao({});
                    setUltimoLembrete(u.ultimo);
                  } catch {
                    toast.error("Não foi possível gerar os lembretes agora.");
                  } finally {
                    setGerandoLembretes(false);
                  }
                }}
              >
                {gerandoLembretes ? "Gerando..." : "Gerar lembretes agora"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {ultimoLembrete
                  ? `Último lembrete criado em ${new Date(ultimoLembrete).toLocaleString("pt-BR")}`
                  : "Nenhum lembrete gerado ainda."}
              </span>
            </div>

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
              <PasswordInput
                id="ckey"
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

            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <Label htmlFor="ctoken" className="font-semibold">
                  Token de autenticação do webhook
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Este token protege seu webhook: o painel só aceita notificações do Asaas que enviem
                exatamente este valor. Por segurança ele fica oculto — use "Copiar" para colar
                direto no Asaas, ou "Revelar" se precisar conferir.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="ctoken"
                  readOnly
                  value={
                    tokenRevelado ?? (tokenDefinido ? tokenMascara : "Nenhum token configurado")
                  }
                  className="min-w-0 flex-1 font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!tokenDefinido || carregandoToken}
                  onClick={copiarToken}
                  aria-label="Copiar token"
                >
                  {copiado === "token" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!tokenDefinido || carregandoToken}
                  onClick={() =>
                    tokenRevelado ? setTokenRevelado(null) : void obterTokenCompleto()
                  }
                >
                  {tokenRevelado ? "Ocultar" : "Revelar"}
                </Button>
              </div>

              <div className="mt-1 rounded-md bg-background p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Como configurar no Asaas:</p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>
                    No painel do Asaas, acesse <strong>Integrações → Webhooks</strong> (ou
                    Configurações → Integrações).
                  </li>
                  <li>
                    Em <strong>URL</strong>, cole o endereço do webhook (campo acima).
                  </li>
                  <li>
                    No campo <strong>Token de autenticação</strong>, cole o token acima.
                  </li>
                  <li>
                    Ative os eventos de cobrança (PAYMENT_RECEIVED, PAYMENT_OVERDUE etc.) e salve.
                  </li>
                </ol>
              </div>
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
  const carregarAuditoria = useServerFn(listarAuditoria);
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { registros } = await carregarAuditoria({});
      setRows(registros as unknown as AuditoriaRow[]);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [carregarAuditoria]);

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
      <Table className="min-w-[600px]">
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
