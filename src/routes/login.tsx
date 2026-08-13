import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/auth";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import { enviarResetEmail } from "@/lib/auth.functions";
import { usarCodigoRecuperacaoMfa } from "@/lib/mfa.functions";
import {
  lerNivelSeguranca,
  listarFatoresTotp,
  mensagemErroMfa,
  verificarCodigoTotp,
} from "@/lib/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card } from "@/components/ui/card";
import { BrazonLogo } from "@/components/BrazonLogo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Brazon" },
      { name: "description", content: "Acesse sua conta para gerenciar assinaturas." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, role, roleResolvido, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);

  // Segunda etapa (2FA): guardamos o fator verificado da conta.
  const [fatorPendente, setFatorPendente] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [codigoRecuperacao, setCodigoRecuperacao] = useState("");
  const usarCodigo = useServerFn(usarCodigoRecuperacaoMfa);
  const triggerReset = useServerFn(enviarResetEmail);

  useEffect(() => {
    // Aguarda o papel resolver para não mandar o usuário ao painel errado.
    // Enquanto o segundo fator estiver pendente, ninguém entra no painel.
    if (!loading && session && roleResolvido && !fatorPendente) {
      navigate({ to: roleHome(role) });
    }
  }, [loading, session, role, roleResolvido, fatorPendente, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      toast.error("E-mail ou senha incorretos.");
      return;
    }

    try {
      const nivel = await lerNivelSeguranca();
      if (nivel.precisaSegundoFator) {
        const fatores = await listarFatoresTotp();
        const verificado = fatores.find((f) => f.verificado);
        if (verificado) {
          setFatorPendente(verificado.id);
          setOtp("");
          setSubmitting(false);
          return;
        }
      }
    } catch {
      // Se não conseguirmos ler o nível, o MfaGate ainda protege o painel.
    }
    setSubmitting(false);
    toast.success("Bem-vindo de volta!");
  }

  async function confirmarSegundoFator(e: React.FormEvent) {
    e.preventDefault();
    if (!fatorPendente || otp.replace(/\D/g, "").length < 6) {
      toast.error("Digite o código de 6 dígitos do app autenticador.");
      return;
    }
    setSubmitting(true);
    try {
      await verificarCodigoTotp(fatorPendente, otp);
      setFatorPendente(null);
      toast.success("Bem-vindo de volta!");
    } catch (err) {
      toast.error(mensagemErroMfa(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmarRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    if (codigoRecuperacao.trim().length < 4) {
      toast.error("Informe um código de recuperação.");
      return;
    }
    setSubmitting(true);
    try {
      await usarCodigo({ data: { codigo: codigoRecuperacao } });
      await supabase.auth.refreshSession();
      setCodigoRecuperacao("");
      setModoRecuperacao(false);
      setFatorPendente(null);
      toast.success("Acesso liberado. Cadastre a verificação em duas etapas novamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código de recuperação inválido.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelarSegundoFator() {
    setFatorPendente(null);
    setOtp("");
    setModoRecuperacao(false);
    setCodigoRecuperacao("");
    await supabase.auth.signOut();
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }
    setSubmitting(true);

    try {
      // Usamos uma Server Function para garantir que o envio ocorra no backend
      // sem as restrições de CORS/CSP do navegador para o endpoint de auth.
      const res = await triggerReset({ data: { email: email.trim() } });

      if (res && "ok" in res && !res.ok) {
        console.error("[handleForgot] Erro retornado:", res.error);
        // Mesmo com erro, mantemos o estado visual de enviado para evitar ataques de enumeração,
        // mas logamos internamente para debug.
      }

      setResetSent(true);
      toast.success("Link enviado! Verifique seu e-mail.");
    } catch (err) {
      console.error("[handleForgot] Runtime error:", err);
      // Sempre mostramos sucesso por segurança
      setResetSent(true);
      toast.success("Link enviado! Verifique seu e-mail.");
    } finally {
      setSubmitting(false);
    }
  }

  if (fatorPendente) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <ThemeToggle className="fixed right-3 top-3 z-50 bg-card/70 backdrop-blur sm:right-4 sm:top-4" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <Card className="fade-in-up relative w-full max-w-md rounded-2xl p-6 shadow-lg sm:p-8">
          <div className="mb-6 text-center">
            <BrazonLogo
              className="mb-4 justify-center"
              symbolClassName="h-10 w-10"
              textClassName="text-2xl"
            />
            <h1 className="text-2xl font-bold text-foreground">Verificação em duas etapas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {modoRecuperacao
                ? "Informe um dos códigos de recuperação que você guardou."
                : "Digite o código de 6 dígitos do seu app autenticador."}
            </p>
          </div>

          {modoRecuperacao ? (
            <form onSubmit={confirmarRecuperacao} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-recuperacao">Código de recuperação</Label>
                <Input
                  id="login-recuperacao"
                  autoComplete="one-time-code"
                  value={codigoRecuperacao}
                  onChange={(e) => setCodigoRecuperacao(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                />
                <p className="text-xs text-muted-foreground">
                  O código só pode ser usado uma vez. A verificação em duas etapas será desativada e
                  você deverá cadastrá-la novamente.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? "Validando..." : "Usar código"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setModoRecuperacao(false)}
                disabled={submitting}
              >
                Voltar
              </Button>
            </form>
          ) : (
            <form onSubmit={confirmarSegundoFator} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-otp">Código do app</Label>
                <InputOTP id="login-otp" maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? "Verificando..." : "Confirmar"}
              </Button>
              <button
                type="button"
                onClick={() => setModoRecuperacao(true)}
                className="w-full text-xs text-primary underline-offset-2 hover:underline"
              >
                Perdi o acesso ao app — usar código de recuperação
              </button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void cancelarSegundoFator()}
                disabled={submitting}
              >
                Cancelar e voltar ao login
              </Button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <ThemeToggle className="fixed right-3 top-3 z-50 bg-card/70 backdrop-blur sm:right-4 sm:top-4" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <Card className="fade-in-up relative w-full max-w-md rounded-2xl p-6 shadow-lg sm:p-8">
          <div className="mb-6 text-center">
            <BrazonLogo
              className="mb-4 justify-center"
              symbolClassName="h-10 w-10"
              textClassName="text-2xl"
            />
            <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enviaremos um link para você definir uma nova senha.
            </p>
          </div>
          {resetSent ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Se existir uma conta com esse e-mail, você receberá um link para redefinir a senha.
                Verifique também a caixa de spam.
              </p>
              <Button
                className="mt-6 w-full"
                variant="outline"
                onClick={() => {
                  setMode("login");
                  setResetSent(false);
                }}
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-forgot">E-mail</Label>
                <Input
                  id="email-forgot"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Enviando..." : "Enviar link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("login")}
              >
                Voltar
              </Button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <ThemeToggle className="fixed right-3 top-3 z-50 bg-card/70 backdrop-blur sm:right-4 sm:top-4" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <Card className="fade-in-up relative w-full max-w-md rounded-2xl p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <BrazonLogo
            className="mb-4 justify-center"
            symbolClassName="h-10 w-10"
            textClassName="text-2xl"
          />
          <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Coloque seus dados para acessar o painel
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link to="/cadastro">Criar minha conta e assinar</Link>
        </Button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com os{" "}
          <Link to="/termos-de-uso" className="text-primary underline-offset-2 hover:underline">
            Termos de Uso
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
