import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { obterStatusMfa, usarCodigoRecuperacaoMfa } from "@/lib/mfa.functions";
import {
  lerNivelSeguranca,
  listarFatoresTotp,
  mensagemErroMfa,
  verificarCodigoTotp,
} from "@/lib/mfa";
import { DoisFatoresCard } from "@/components/conta/DoisFatoresCard";
import { useSair } from "@/lib/use-sair";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type Bloqueio = "nenhum" | "verificar" | "cadastrar";

/**
 * Bloqueia o painel em dois casos:
 * 1. a sessão tem 2FA ativo mas ainda não passou pelo segundo fator (aal1);
 * 2. o 2FA é obrigatório para o papel do usuário e ele ainda não ativou.
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuth();
  const userId = user?.id ?? null;
  const { sair, saindo } = useSair();

  const buscarStatus = useServerFn(obterStatusMfa);
  const usarCodigo = useServerFn(usarCodigoRecuperacaoMfa);

  const [bloqueio, setBloqueio] = useState<Bloqueio>("nenhum");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [codigoRecuperacao, setCodigoRecuperacao] = useState("");
  const [processando, setProcessando] = useState(false);

  const avaliar = useCallback(async () => {
    if (!userId) {
      setBloqueio("nenhum");
      return;
    }
    try {
      const nivel = await lerNivelSeguranca();
      if (nivel.precisaSegundoFator) {
        const fatores = await listarFatoresTotp();
        const verificado = fatores.find((f) => f.verificado);
        if (verificado) {
          setFactorId(verificado.id);
          setBloqueio("verificar");
          return;
        }
      }
      const status = await buscarStatus({});
      setBloqueio(status.obrigatorio && !status.ativo ? "cadastrar" : "nenhum");
    } catch {
      // Falha de rede nunca bloqueia o painel — o servidor continua validando
      // cada requisição por conta própria.
      setBloqueio("nenhum");
    }
  }, [userId, buscarStatus]);

  useEffect(() => {
    void avaliar();
  }, [avaliar]);

  async function confirmarCodigo() {
    if (!factorId || otp.replace(/\D/g, "").length < 6) {
      toast.error("Digite o código de 6 dígitos do app autenticador.");
      return;
    }
    setProcessando(true);
    try {
      await verificarCodigoTotp(factorId, otp);
      setOtp("");
      await refresh();
      await avaliar();
      toast.success("Verificação concluída.");
    } catch (e) {
      toast.error(mensagemErroMfa(e));
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarRecuperacao() {
    if (codigoRecuperacao.trim().length < 4) {
      toast.error("Informe um código de recuperação.");
      return;
    }
    setProcessando(true);
    try {
      const r = await usarCodigo({ data: { codigo: codigoRecuperacao } });
      setCodigoRecuperacao("");
      setModoRecuperacao(false);
      await supabase.auth.refreshSession();
      await refresh();
      await avaliar();
      toast.success(
        `Acesso liberado. Cadastre novamente a verificação em duas etapas. Códigos restantes: ${r.codigosRestantes}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código de recuperação inválido.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <>
      {children}

      <Dialog open={bloqueio === "verificar"}>
        <DialogContent
          className="max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-left">
            <DialogTitle>Confirme sua identidade</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Sua conta usa verificação em duas etapas. Digite o código do seu app autenticador para
              continuar.
            </p>
          </DialogHeader>

          {modoRecuperacao ? (
            <div className="space-y-3">
              <Label htmlFor="gate-recuperacao">Código de recuperação</Label>
              <Input
                id="gate-recuperacao"
                value={codigoRecuperacao}
                onChange={(e) => setCodigoRecuperacao(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground">
                Ao usar um código de recuperação, a verificação em duas etapas será desativada e
                você deverá cadastrá-la novamente.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setModoRecuperacao(false)}
                  disabled={processando}
                >
                  Voltar
                </Button>
                <Button onClick={confirmarRecuperacao} disabled={processando}>
                  {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Usar código
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="gate-otp">Código de 6 dígitos</Label>
              <InputOTP id="gate-otp" maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <button
                type="button"
                onClick={() => setModoRecuperacao(true)}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Perdi o acesso ao app — usar código de recuperação
              </button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => void sair()}
                  disabled={processando || saindo}
                >
                  Sair da conta
                </Button>
                <Button onClick={confirmarCodigo} disabled={processando}>
                  {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bloqueio === "cadastrar"}>
        <DialogContent
          className="max-h-[90dvh] max-w-lg overflow-y-auto [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-left">
            <DialogTitle>Ative a verificação em duas etapas</DialogTitle>
            <p className="text-sm text-muted-foreground">
              O seu perfil exige verificação em duas etapas. Ative agora para continuar usando o
              painel.
            </p>
          </DialogHeader>
          <DoisFatoresCard />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => void sair()} disabled={saindo}>
              Sair da conta
            </Button>
            <Button variant="outline" onClick={() => void avaliar()}>
              Já ativei, continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
