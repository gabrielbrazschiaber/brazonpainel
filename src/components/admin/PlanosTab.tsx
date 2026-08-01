import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { StatusBadge } from "@/components/StatusBadge";
import { salvarPlano } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Plano } from "@/lib/admin-tipos";

export function PlanosTab({ planos, onChanged }: { planos: Plano[]; onChanged: () => void }) {
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
        <Table className="min-w-full sm:min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.descricao ?? ""}</div>
                  <div className="mt-1 sm:hidden">
                    <StatusBadge status={p.ativo ? "ativo" : "cancelado"} />
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(p.valor)}</TableCell>
                <TableCell className="hidden sm:table-cell">
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
