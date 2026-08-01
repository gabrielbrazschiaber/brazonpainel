import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  gerarCodigosRecuperacaoMfa,
  obterStatusMfa,
  salvarTelefoneContato,
} from "@/lib/mfa.functions";
import {
  iniciarCadastroTotp,
  listarFatoresTotp,
  mensagemErroMfa,
  removerFatorTotp,
  verificarCodigoTotp,
  type CadastroTotp,
} from "@/lib/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, Copy, Loader2 } from "lucide-react";

/** Máscara simples de telefone brasileiro com DDD. */
function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Cartão de verificação em duas etapas para a tela "Minha conta".
 * O único fator aceito é o app autenticador (TOTP); o telefone serve apenas
 * para o suporte confirmar identidade em caso de perda de acesso.
 */
export function DoisFatoresCard() {
  const buscarStatus = useServerFn(obterStatusMfa);
  const gerarCodigos = useServerFn(gerarCodigosRecuperacaoMfa);
  const salvarTelefone = useServerFn(salvarTelefoneContato);

  const [carregando, setCarregando] = useState(true);
  const [ativo, setAtivo] = useState(false);
  const [obrigatorio, setObrigatorio] = useState(false);
  const [codigosDisponiveis, setCodigosDisponiveis] = useState(0);
  const [telefone, setTelefone] = useState("");
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);

  const [cadastro, setCadastro] = useState<CadastroTotp | null>(null);
  const [otp, setOtp] = useState("");
  const [processando, setProcessando] = useState(false);
  const [codigos, setCodigos] = useState<string[] | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const r = await buscarStatus({});
      setAtivo(r.ativo);
      setObrigatorio(r.obrigatorio);
      setCodigosDisponiveis(r.codigosDisponiveis);
      setTelefone(mascararTelefone(r.telefone ?? ""));
    } catch {
      // Falha de rede não deve travar a tela de conta.
    } finally {
      setCarregando(false);
    }
  }, [buscarStatus]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function iniciar() {
    setProcessando(true);
    try {
      const c = await iniciarCadastroTotp();
      setCadastro(c);
      setOtp("");
    } catch (e) {
      toast.error(mensagemErroMfa(e));
    } finally {
      setProcessando(false);
    }
  }

  async function confirmar() {
    if (!cadastro || otp.replace(/\D/g, "").length < 6) {
      toast.error("Digite o código de 6 dígitos do app autenticador.");
      return;
    }
    setProcessando(true);
    try {
      await verificarCodigoTotp(cadastro.factorId, otp);
      const r = await gerarCodigos({});
      setCodigos(r.codigos);
      setCadastro(null);
      setOtp("");
      toast.success("Verificação em duas etapas ativada!");
      await recarregar();
    } catch (e) {
      toast.error(mensagemErroMfa(e));
    } finally {
      setProcessando(false);
    }
  }

  async function desativar() {
    setProcessando(true);
    try {
      const fatores = await listarFatoresTotp();
      for (const f of fatores) await removerFatorTotp(f.id);
      setCodigos(null);
      toast.success("Verificação em duas etapas desativada.");
      await recarregar();
    } catch (e) {
      toast.error(mensagemErroMfa(e));
    } finally {
      setProcessando(false);
    }
  }

  async function novosCodigos() {
    setProcessando(true);
    try {
      const r = await gerarCodigos({});
      setCodigos(r.codigos);
      toast.success("Novos códigos gerados. Os anteriores não valem mais.");
      await recarregar();
    } catch {
      toast.error("Não foi possível gerar os códigos agora.");
    } finally {
      setProcessando(false);
    }
  }

  async function gravarTelefone() {
    setSalvandoTelefone(true);
    try {
      await salvarTelefone({ data: { telefone } });
      toast.success("Telefone de contato salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o telefone.");
    } finally {
      setSalvandoTelefone(false);
    }
  }

  async function copiarCodigos() {
    if (!codigos) return;
    try {
      await navigator.clipboard.writeText(codigos.join("\n"));
      toast.success("Códigos copiados.");
    } catch {
      toast.error("Não foi possível copiar. Anote os códigos manualmente.");
    }
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {ativo ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Verificação em duas etapas</p>
          <p className="text-sm text-muted-foreground">
            {carregando
              ? "Verificando..."
              : ativo
                ? `Ativa com app autenticador. Códigos de recuperação disponíveis: ${codigosDisponiveis}.`
                : "Adicione um código do app autenticador (Google Authenticator, Authy, 1Password) ao entrar."}
          </p>
          {obrigatorio && !ativo && !carregando ? (
            <p className="mt-1 text-sm font-medium text-destructive">
              A verificação em duas etapas é obrigatória para o seu perfil.
            </p>
          ) : null}
        </div>
      </div>

      {/* Telefone de contato (não é fator de autenticação) */}
      <div className="grid gap-2">
        <Label htmlFor="mfa-telefone">Telefone de contato</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="mfa-telefone"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            placeholder="(11) 99999-9999"
          />
          <Button
            variant="outline"
            onClick={gravarTelefone}
            disabled={salvandoTelefone}
            className="w-full sm:w-auto"
          >
            {salvandoTelefone ? "Salvando..." : "Salvar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Usado apenas para o suporte confirmar sua identidade se você perder o app autenticador.
          Não enviamos códigos por SMS.
        </p>
      </div>

      {/* Cadastro do fator */}
      {cadastro ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">
            1. Leia o QR Code no seu app autenticador. 2. Digite o código de 6 dígitos.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <img
              src={cadastro.qrCode}
              alt="QR Code para cadastrar a verificação em duas etapas"
              className="h-40 w-40 rounded-md bg-white p-2"
            />
            <div className="min-w-0 space-y-2">
              <p className="text-xs text-muted-foreground">
                Não consegue ler o QR Code? Use a chave:
              </p>
              <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
                {cadastro.segredo}
              </code>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-otp">Código do app</Label>
            <InputOTP id="mfa-otp" maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setCadastro(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={processando}>
              {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ativar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Códigos de recuperação recém-gerados */}
      {codigos ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium text-foreground">
            Guarde seus códigos de recuperação agora
          </p>
          <p className="text-xs text-muted-foreground">
            Cada código pode ser usado uma única vez para recuperar o acesso. Eles não serão
            mostrados novamente.
          </p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-3">
            {codigos.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={copiarCodigos}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar códigos
          </Button>
        </div>
      ) : null}

      {!cadastro ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {ativo ? (
            <>
              <Button variant="outline" onClick={novosCodigos} disabled={processando}>
                Gerar novos códigos de recuperação
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={desativar}
                disabled={processando || obrigatorio}
                title={
                  obrigatorio
                    ? "Obrigatória para o seu perfil — fale com um administrador."
                    : undefined
                }
              >
                Desativar
              </Button>
            </>
          ) : (
            <Button onClick={iniciar} disabled={processando || carregando}>
              {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ativar verificação em duas etapas
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
