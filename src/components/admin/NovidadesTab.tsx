import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  criarNovidade,
  atualizarNovidade,
  excluirNovidade,
} from "@/lib/novidades.functions";
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
import { Plus, Pencil, Trash2, Megaphone, Sparkles } from "lucide-react";
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
  }, [load]);

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
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Público</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Publicada em</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {n.versao ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                        {n.versao}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
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
                      <Button size="icon" variant="ghost" onClick={() => openEdit(n)} title="Editar">
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
                  onValueChange={(v) =>
                    setForm({ ...form, tipo: v as "novidade" | "comunicado" })
                  }
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
                    onCheckedChange={(v) =>
                      setForm({ ...form, publico_cliente: v === true })
                    }
                  />
                  Clientes
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.publico_vendedor}
                    onCheckedChange={(v) =>
                      setForm({ ...form, publico_vendedor: v === true })
                    }
                  />
                  Vendedores
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.publico_admin}
                    onCheckedChange={(v) =>
                      setForm({ ...form, publico_admin: v === true })
                    }
                  />
                  Admins
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Publicar imediatamente</p>
                <p className="text-xs text-muted-foreground">
                  Desligue para salvar como rascunho.
                </p>
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
    </div>
  );
}
