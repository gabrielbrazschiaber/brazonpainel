import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { criarAdmin, excluirAdmin } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { Plus, Shield, Trash2 } from "lucide-react";
export function AdminsTab({
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
        <Table className="min-w-full sm:min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Administrador</TableHead>
              <TableHead className="hidden sm:table-cell">E-mail</TableHead>
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
                  <div className="mt-1 break-all text-xs text-muted-foreground sm:hidden">
                    {a.email ?? ""}
                  </div>
                </TableCell>
                <TableCell className="hidden break-all text-sm text-muted-foreground sm:table-cell">
                  {a.email ?? ""}
                </TableCell>
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
