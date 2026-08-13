import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listarStatusMfaEquipe,
  obterStatusMfa,
  resetarMfaUsuario,
  salvarPoliticaMfa,
} from "@/lib/mfa.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface UsuarioMfa {
  user_id: string;
  nome: string;
  email: string;
  telefone: string;
  papeis: string[];
  ativo: boolean;
  codigosDisponiveis: number;
}

/**
 * Política de 2FA por papel + situação de cada acesso interno, com reset
 * assistido para quem perdeu o app autenticador (sempre auditado).
 */
export function DoisFatoresEquipeCard() {
  const buscarStatus = useServerFn(obterStatusMfa);
  const listar = useServerFn(listarStatusMfaEquipe);
  const salvar = useServerFn(salvarPoliticaMfa);
  const resetar = useServerFn(resetarMfaUsuario);

  const [admin, setAdmin] = useState(false);
  const [vendedor, setVendedor] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioMfa[]>([]);
  const [aResetar, setAResetar] = useState<UsuarioMfa | null>(null);
  const [motivo, setMotivo] = useState("");
  const [resetando, setResetando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [status, lista] = await Promise.all([buscarStatus({}), listar({})]);
      setAdmin(status.politica.admin);
      setVendedor(status.politica.vendedor);
      setUsuarios(lista.usuarios);
    } catch {
      // Silencioso: a aba de configurações não deve quebrar por isso.
    }
  }, [buscarStatus, listar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarPolitica(novo: { admin: boolean; vendedor: boolean }) {
    setSalvando(true);
    try {
      await salvar({ data: novo });
      setAdmin(novo.admin);
      setVendedor(novo.vendedor);
      toast.success("Política de verificação em duas etapas salva.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a política.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarReset() {
    if (!aResetar) return;
    if (motivo.trim().length < 5) {
      toast.error("Descreva como a identidade foi confirmada (mín. 5 caracteres).");
      return;
    }
    setResetando(true);
    try {
      await resetar({ data: { user_id: aResetar.user_id, motivo: motivo.trim() } });
      toast.success("Verificação em duas etapas removida. O usuário deve cadastrar novamente.");
      setAResetar(null);
      setMotivo("");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível resetar o 2FA.");
    } finally {
      setResetando(false);
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <p className="section-title">Verificação em duas etapas</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Somente app autenticador (TOTP). Não usamos SMS como fator de segurança.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="mfa-admin">Exigir de administradores</Label>
            <p className="text-xs text-muted-foreground">
              Só é possível ativar depois que a sua conta já tem 2FA e códigos de recuperação.
            </p>
          </div>
          <Switch
            id="mfa-admin"
            checked={admin}
            disabled={salvando}
            onCheckedChange={(v) => void salvarPolitica({ admin: v, vendedor })}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="mfa-vendedor">Exigir de vendedores</Label>
            <p className="text-xs text-muted-foreground">
              Vendedores sem 2FA verão a tela de ativação ao entrar.
            </p>
          </div>
          <Switch
            id="mfa-vendedor"
            checked={vendedor}
            disabled={salvando}
            onCheckedChange={(v) => void salvarPolitica({ admin, vendedor: v })}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium text-foreground">Acessos internos</p>
        {usuarios.map((u) => (
          <div
            key={u.user_id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {u.ativo ? (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-medium text-foreground">{u.nome || u.email}</span>
              </div>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">
                {u.papeis.join(", ")} · {u.ativo ? "2FA ativo" : "sem 2FA"} · {u.codigosDisponiveis}{" "}
                código(s) de recuperação
                {u.telefone ? ` · tel. ${u.telefone}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!u.ativo}
              onClick={() => {
                setAResetar(u);
                setMotivo("");
              }}
              className="w-full sm:w-auto"
            >
              Resetar 2FA
            </Button>
          </div>
        ))}
        {usuarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acesso interno encontrado.</p>
        ) : null}
      </div>

      <Dialog open={!!aResetar} onOpenChange={(v) => !v && setAResetar(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Resetar verificação em duas etapas</DialogTitle>
            <DialogDescription>
              Confirme a identidade de {aResetar?.nome || aResetar?.email} pelo telefone de contato
              {aResetar?.telefone ? ` (${aResetar.telefone})` : ""} antes de continuar. A remoção
              fica registrada na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="motivo-reset">Como a identidade foi confirmada</Label>
            <Input
              id="motivo-reset"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: ligação para (11) 99999-9999 em 01/08"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAResetar(null)} disabled={resetando}>
              Cancelar
            </Button>
            <Button onClick={confirmarReset} disabled={resetando}>
              {resetando ? "Removendo..." : "Remover 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
