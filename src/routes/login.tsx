import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/auth";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BrazonLogo } from "@/components/BrazonLogo";
import { toast } from "sonner";

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
  const { session, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: roleHome(role) });
    }
  }, [loading, session, role, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("E-mail ou senha incorretos.");
      return;
    }
    toast.success("Bem-vindo de volta!");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }
    setSubmitting(true);
    const { error } = await enviarLinkDefinicaoSenha(email);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar o link. Tente novamente.");
      return;
    }
    setResetSent(true);
    toast.success("Link enviado! Verifique seu e-mail.");
  }

  if (mode === "forgot") {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <Card className="relative w-full max-w-md rounded-2xl p-8 shadow-lg">
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
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <Card className="relative w-full max-w-md rounded-2xl p-8 shadow-lg">
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
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Cadastro imediato, sem precisar de vendedor. Tem um link de indicação? Use-o para manter seu
          vendedor vinculado.
        </p>
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
