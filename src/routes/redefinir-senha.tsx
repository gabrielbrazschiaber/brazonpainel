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

  // Enquanto carrega, aguarda o Supabase detectar a sessão de recuperação da URL.
  const semSessao = !loading && !session;

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
      toast.error("Não foi possível alterar a senha. Solicite um novo link.");
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
            <Button type="submit" className="w-full" disabled={submitting || loading}>
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
