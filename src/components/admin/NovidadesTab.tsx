import { useCallback, useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { obterWebhookToken } from "@/lib/config.functions";
import { criarNovidade, atualizarNovidade, excluirNovidade } from "@/lib/novidades.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Megaphone, Sparkles, History, RefreshCcw, EyeOff, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface Novidade {
  id: string;
  titulo: string;
  conteudo: string;
  versao: string | null;
  tipo: "novidade" | "comunicado";
  publico_cliente: boolean;
  publico_vendedor: boolean;
  publico_admin: boolean;
  publicado: boolean;
  data_publicacao: string | null;
  created_at: string;
}

const empty: Omit<Novidade, "id" | "created_at" | "data_publicacao"> = {
  titulo: "",
  conteudo: "",
  versao: null,
  tipo: "novidade",
  publico_cliente: false,
  publico_vendedor: false,
  publico_admin: true,
  publicado: true,
};

export function NovidadesTab() {
  const [rows, setRows] = useState<Novidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Novidade | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Novidade | null>(null);
  const [deploys, setDeploys] = useState<any[]>([]);
  const [loadingDeploys, setLoadingDeploys] = useState(false);
  const [changelogAtivo, setChangelogAtivo] = useState(true);
  const [webhookToken, setWebhookToken] = useState({ mascara: "", definido: false, token: null as string | null });
  const [versaoManual, setVersaoManual] = useState("");
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [revelandoToken, setRevelandoToken] = useState(false);
  const [copiadoToken, setCopiadoToken] = useState(false);

  const getWebhookToken = useServerFn(obterWebhookToken);

  const criar = useServerFn(criarNovidade);
  const atualizar = useServerFn(atualizarNovidade);
  const excluir = useServerFn(excluirNovidade);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("novidades")
      .select(
        "id,titulo,conteudo,versao,tipo,publico_cliente,publico_vendedor,publico_admin,publicado,data_publicacao,created_at",
      )
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Novidade[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    loadDeploys();
    loadChangelogConfig();
  }, [load]);

  async function loadChangelogConfig() {
    const { data } = await supabase.from("configuracoes").select("changelog_ativo, changelog_versao_atual").limit(1).single();
    if (data) {
      setChangelogAtivo(data.changelog_ativo);
      setVersaoManual(data.changelog_versao_atual);
    }
    const token = await getWebhookToken({ data: {} });
    setWebhookToken({ ...token, token: null });
  }

  async function loadDeploys() {
    setLoadingDeploys(true);
    const { data } = await supabase.from("deploys").select("*").order("criado_em", { ascending: false }).limit(20);
    setDeploys(data ?? []);
    setLoadingDeploys(false);
  }

  async function toggleChangelogAtivo(v: boolean) {
    setChangelogAtivo(v);
    await supabase.from("configuracoes").update({ changelog_ativo: v }).eq("id", (await supabase.from("configuracoes").select("id").limit(1).single()).data?.id);
    toast.success(v ? "Changelog automático ativado." : "Changelog automático desativado.");
  }

  async function atualizarVersaoManual() {
    await supabase.from("configuracoes").update({ changelog_versao_atual: versaoManual }).eq("id", (await supabase.from("configuracoes").select("id").limit(1).single()).data?.id);
    toast.success("Versão atualizada.");
  }

  async function reprocessarDeploy(d: any) {
    setReprocessando(d.id);
    try {
      const response = await fetch("/api/public/hooks/registrar-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deploy-token": await obterTokenCompleto() || "" },
        body: JSON.stringify({ sha: d.sha, branch: "main", commits: d.commits, arquivos_alterados: d.arquivos_alterados })
      });
      if (response.ok) {
        toast.success("Deploy reprocessado.");
        loadDeploys();
        load();
      } else {
        toast.error("Erro ao reprocessar.");
      }
    } catch (e) {
      toast.error("Falha na comunicação.");
    } finally {
      setReprocessando(null);
    }
  }

  async function obterTokenCompleto(): Promise<string | null> {
    if (webhookToken.token) return webhookToken.token;
    const r = await getWebhookToken({ data: { revelar: true } });
    if (r.token) {
      setWebhookToken(prev => ({ ...prev, token: r.token }));
      return r.token;
    }
    return null;
  }

  async function copiarToken() {
    const t = await obterTokenCompleto();
    if (t) {
      await navigator.clipboard.writeText(t);
      setCopiadoToken(true);
      toast.success("Token copiado!");
      setTimeout(() => setCopiadoToken(false), 2000);
    }
  }

  async function despublicarNovidade(id: string) {
    await supabase.from("novidades").update({ publicado: false }).eq("id", id);
    toast.success("Novidade despublicada.");
    load();
  }

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(n: Novidade) {
    setEditing(n);
    setForm({
      titulo: n.titulo,
      conteudo: n.conteudo,
      versao: n.versao,
      tipo: n.tipo,
      publico_cliente: n.publico_cliente,
      publico_vendedor: n.publico_vendedor,
      publico_admin: n.publico_admin,
      publicado: n.publicado,
    });
    setOpen(true);
  }

  async function submit() {
    if (form.titulo.trim().length < 3) {
      toast.error("Título precisa de ao menos 3 caracteres.");
      return;
    }
    if (!form.conteudo.trim()) {
      toast.error("Conteúdo é obrigatório.");
      return;
    }
    if (!form.publico_cliente && !form.publico_vendedor && !form.publico_admin) {
      toast.error("Selecione ao menos um público-alvo.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        conteudo: form.conteudo.trim(),
        versao: form.versao?.trim() ? form.versao.trim() : null,
        tipo: form.tipo,
        publico_cliente: form.publico_cliente,
        publico_vendedor: form.publico_vendedor,
        publico_admin: form.publico_admin,
        publicado: form.publicado,
      };
      if (editing) {
        await atualizar({ data: { id: editing.id, ...payload } });
        toast.success("Publicação atualizada.");
      } else {
        await criar({ data: payload });
        toast.success(form.publicado ? "Publicação publicada!" : "Rascunho salvo.");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublicado(n: Novidade) {
    try {
      await atualizar({
        data: {
          id: n.id,
          titulo: n.titulo,
          conteudo: n.conteudo,
          versao: n.versao,
          tipo: n.tipo,
          publico_cliente: n.publico_cliente,
          publico_vendedor: n.publico_vendedor,
          publico_admin: n.publico_admin,
          publicado: !n.publicado,
        },
      });
      toast.success(!n.publicado ? "Publicação publicada." : "Publicação despublicada.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  async function confirmarExclusao() {
    if (!confirmDel) return;
    try {
      await excluir({ data: { id: confirmDel.id } });
      toast.success("Publicação excluída.");
      setConfirmDel(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Novidades e comunicados</h2>
          <p className="text-sm text-muted-foreground">
            Publique atualizações do sistema e avisos para clientes, vendedores e admins.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Nova publicação
        </Button>
      </div>

      <Card className="mt-4 overflow-x-auto">
        <Table className="min-w-full sm:min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden lg:table-cell">Versão</TableHead>
              <TableHead className="hidden md:table-cell">Público</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Publicada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Nenhuma publicação ainda.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.titulo}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                        n.tipo === "comunicado"
                          ? "border-warning/40 bg-warning/15 text-warning-foreground"
                          : "border-primary/30 bg-primary/10 text-primary",
                      )}
                    >
                      {n.tipo === "comunicado" ? (
                        <Megaphone className="h-3 w-3" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {n.tipo === "comunicado" ? "Comunicado" : "Novidade"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {n.versao ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                        {n.versao}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">
                    <div className="flex gap-1">
                      {n.publico_cliente && (
                        <span className="rounded bg-muted px-1.5 py-0.5" title="Clientes">
                          C
                        </span>
                      )}
                      {n.publico_vendedor && (
                        <span className="rounded bg-muted px-1.5 py-0.5" title="Vendedores">
                          V
                        </span>
                      )}
                      {n.publico_admin && (
                        <span className="rounded bg-muted px-1.5 py-0.5" title="Admins">
                          A
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        n.publicado
                          ? "border-success/30 bg-success/15 text-success"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {n.publicado ? "Publicado" : "Rascunho"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {n.data_publicacao ? formatDate(n.data_publicacao) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePublicado(n)}
                        title={n.publicado ? "Despublicar" : "Publicar"}
                      >
                        {n.publicado ? "Despublicar" : "Publicar"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(n)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setConfirmDel(n)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar publicação" : "Nova publicação"}</DialogTitle>
            <DialogDescription>
              Preencha os dados. Rascunhos não são exibidos para os usuários.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ntitulo">Título</Label>
              <Input
                id="ntitulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex.: Novo painel administrativo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nconteudo">Conteúdo</Label>
              <Textarea
                id="nconteudo"
                rows={8}
                value={form.conteudo}
                onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                placeholder="Cole aqui o resumo da atualização"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nversao">Versão (opcional)</Label>
                <Input
                  id="nversao"
                  value={form.versao ?? ""}
                  onChange={(e) => setForm({ ...form, versao: e.target.value })}
                  placeholder="v1.4"
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm({ ...form, tipo: v as "novidade" | "comunicado" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novidade">Novidade</SelectItem>
                    <SelectItem value="comunicado">Comunicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Público-alvo</Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.publico_cliente}
                    onCheckedChange={(v) => setForm({ ...form, publico_cliente: v === true })}
                  />
                  Clientes
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.publico_vendedor}
                    onCheckedChange={(v) => setForm({ ...form, publico_vendedor: v === true })}
                  />
                  Vendedores
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.publico_admin}
                    onCheckedChange={(v) => setForm({ ...form, publico_admin: v === true })}
                  />
                  Admins
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Publicar imediatamente</p>
                <p className="text-xs text-muted-foreground">Desligue para salvar como rascunho.</p>
              </div>
              <Switch
                checked={form.publicado}
                onCheckedChange={(v) => setForm({ ...form, publicado: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar publicação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir publicação?</AlertDialogTitle>
            <AlertDialogDescription>
              A publicação "{confirmDel?.titulo}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Changelog automático</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Switch checked={changelogAtivo} onCheckedChange={toggleChangelogAtivo} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4" /> Webhook de Deploy
            </div>
            <p className="text-xs text-muted-foreground">
              Configure este URL e Token no seu repositório Git para automatizar o changelog.
            </p>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase text-muted-foreground">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input readOnly value={`${window.location.origin}/api/public/hooks/registrar-deploy`} className="text-xs font-mono" />
              </div>
              <Label className="text-[10px] uppercase text-muted-foreground">Token</Label>
              <div className="flex gap-2">
                <Input readOnly value={revelandoToken ? (webhookToken.token || "...") : (webhookToken.definido ? webhookToken.mascara : "Não definido")} className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={() => revelandoToken ? setRevelandoToken(false) : void obterTokenCompleto().then(() => setRevelandoToken(true))}>
                   {revelandoToken ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={copiarToken}>
                   {copiadoToken ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" /> Versão Atual
            </div>
            <p className="text-xs text-muted-foreground">A próxima versão automática será baseada neste valor.</p>
            <div className="flex gap-2">
              <Input value={versaoManual} onChange={e => setVersaoManual(e.target.value)} placeholder="1.0.0" className="max-w-[120px]" />
              <Button variant="outline" onClick={atualizarVersaoManual}>Atualizar</Button>
            </div>
          </Card>
        </div>

        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Públicos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDeploys ? (
                <TableRow><TableCell colSpan={5} className="text-center">Carregando histórico...</TableCell></TableRow>
              ) : deploys.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center">Nenhum deploy registrado.</TableCell></TableRow>
              ) : (
                deploys.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{formatDate(d.criado_em)}</TableCell>
                    <TableCell><Badge variant="outline">{d.versao}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        d.status === 'processado' ? "bg-success/10 text-success border-success/20" :
                        d.status === 'erro' ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted text-muted-foreground"
                      )}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex gap-1 text-[10px]">
                        {d.resumo_ia?.publicos?.cliente?.incluir && <span className="rounded bg-muted px-1" title="Cliente">C</span>}
                        {d.resumo_ia?.publicos?.vendedor?.incluir && <span className="rounded bg-muted px-1" title="Vendedor">V</span>}
                        {d.resumo_ia?.publicos?.admin?.incluir && <span className="rounded bg-muted px-1" title="Admin">A</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {d.status === 'erro' && (
                          <Button size="icon" variant="ghost" onClick={() => reprocessarDeploy(d)} disabled={!!reprocessando}>
                            <RefreshCcw className={cn("h-3 w-3", reprocessando === d.id && "animate-spin")} />
                          </Button>
                        )}
                        {d.novidade_id && d.status === 'processado' && (
                          <Button size="sm" variant="ghost" onClick={() => despublicarNovidade(d.novidade_id)}>Despublicar</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
