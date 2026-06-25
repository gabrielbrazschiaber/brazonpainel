import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { cadastroPublico } from "@/lib/vendedor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const searchSchema = z.object({
  ref: z.string().optional(),
});

export const Route = createFileRoute("/cadastro")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Criar conta — Assinatura" },
      { name: "description", content: "Cadastre-se e ative sua assinatura." },
    ],
  }),
  component: CadastroPage,
});

interface Plano {
  id: string;
  nome: string;
  valor: number;
  descricao: string | null;
}

function defaultVencimento() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function CadastroPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const cadastrar = useServerFn(cadastroPublico);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [planoId, setPlanoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ senha: string } | null>(null);

  useEffect(() => {
    supabase
      .from("planos")
      .select("id,nome,valor,descricao")
      .eq("ativo", true)
      .order("valor")
      .then(({ data }) => setPlanos((data ?? []) as Plano[]));
  }, []);

  async function submit() {
    if (!ref) {
      toast.error("Link de indicação ausente.");
      return;
    }
    if (nome.trim().length < 2 || !email.trim() || !planoId) {
      toast.error("Preencha nome, e-mail e selecione um plano.");
      return;
    }
    setSaving(true);
    try {
      const res = await cadastrar({
        data: {
          ref,
          nome: nome.trim(),
          email: email.trim(),
          plano_id: planoId,
          data_vencimento: defaultVencimento(),
        },
      });
      setDone({ senha: res.senha });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao concluir cadastro.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Cadastro concluído!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta foi criada. Use seu e-mail e a senha inicial abaixo para entrar e trocar
            sua senha.
          </p>
          <p className="mt-4 rounded-md bg-muted px-3 py-2 font-mono text-sm">
            Senha: {done.senha}
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate({ to: "/login" })}>
            Ir para o login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-foreground">Crie sua conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ref ? "Você foi indicado por um vendedor." : "Link de indicação não informado."}
        </p>

        {!ref ? (
          <p className="mt-6 text-sm text-destructive">
            Este formulário precisa de um link de indicação válido.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Plano</Label>
              <Select value={planoId} onValueChange={setPlanoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {formatCurrency(p.valor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enviando..." : "Criar conta"}
            </Button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
