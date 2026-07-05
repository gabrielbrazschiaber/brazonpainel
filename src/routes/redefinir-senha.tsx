import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleHome } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BrazonLogo } from "@/components/BrazonLogo";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Brazon" },
      { name: "description", content: "Defina uma nova senha para acessar sua conta." },
    ],
  }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const { session, role, loading, refresh } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [processandoLink, setProcessandoLink] = useState(true);
  const [temSessaoRecuperacao, setTemSessaoRecuperacao] = useState(false);

  // Processa o token de recuperação presente na URL (hash implícito ou code PKCE).
  useEffect(() => {
    let ativo = true;
    async function processarLink() {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = url.searchParams.get("code");
        const errorDescription =
          hashParams.get("error_description") || url.searchParams.get("error_description");

        if (errorDescription) {
          if (ativo) setTemSessaoRecuperacao(false);
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (ativo) setTemSessaoRecuperacao(!error);
          window.history.replaceState(null, "", url.pathname);
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (ativo) setTemSessaoRecuperacao(!error);
          window.history.replaceState(null, "", url.pathname);
        } else {
          // Sem token na URL: pode já haver uma sessão ativa (ex.: refresh da página).
          const { data } = await supabase.auth.getSession();
          if (ativo) setTemSessaoRecuperacao(!!data.session);
        }
      } catch {
        if (ativo) setTemSessaoRecuperacao(false);
      } finally {
        if (ativo) setProcessandoLink(false);
      }
    }
    processarLink();
    return () => {
      ativo = false;
    };
  }, []);

  // Enquanto processa o link ou carrega a sessão, não mostramos "link inválido".
  const semSessao = !processandoLink && !loading && !session && !temSessaoRecuperacao;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSubmitting(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("session") || msg.includes("jwt") || msg.includes("token")) {
        toast.error("Sessão de recuperação expirada. Solicite um novo link de redefinição.");
      } else if (msg.includes("different") || msg.includes("should be")) {
        toast.error("Escolha uma senha diferente da anterior.");
      } else {
        toast.error(error.message || "Não foi possível alterar a senha. Solicite um novo link.");
      }
      return;
    }
    await refresh();
    setDone(true);
    toast.success("Senha definida com sucesso!");
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Senha atualizada!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua nova senha já está ativa. Você pode acessar o painel agora.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate({ to: roleHome(role) })}>
            Ir para o painel
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <BrazonLogo className="mb-4 justify-center" symbolClassName="h-10 w-10" textClassName="text-2xl" />
          <h1 className="text-2xl font-bold text-foreground">Definir nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha uma senha forte para proteger sua conta.
          </p>
        </div>

        {semSessao ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Este link é inválido ou expirou. Solicite um novo link de redefinição pela tela de
              login.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirma">Confirmar senha</Label>
              <Input
                id="confirma"
                type="password"
                autoComplete="new-password"
                required
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || loading || processandoLink}>
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
