import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { cadastroPublico } from "@/lib/vendedor.functions";
import { validarCupomPublico } from "@/lib/cupons.functions";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import { Card } from "@/components/ui/card";
import { BrazonLogo } from "@/components/BrazonLogo";
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
import { TERMOS_VERSAO } from "@/lib/termos";
import { Checkbox } from "@/components/ui/checkbox";

import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const searchSchema = z.object({
  ref: z.string().optional(),
  cupom: z.string().optional(),
});

export const Route = createFileRoute("/cadastro")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Criar conta e assinar — Brazon" },
      {
        name: "description",
        content:
          "Cadastre-se, escolha seu plano e ative a assinatura na hora. Use o cupom 100OFF e ganhe R$ 100,00 de desconto na primeira mensalidade.",
      },
      { property: "og:title", content: "Criar conta e assinar — Brazon" },
      {
        property: "og:description",
        content: "Assine em minutos, sem intervenção humana. Cupom 100OFF: R$ 100 off na 1ª mensalidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

interface CupomAplicado {
  codigo: string;
  valor_desconto: number;
  apenas_primeira_mensalidade: boolean;
}

// O vencimento inicial é calculado no servidor (não é enviado pelo formulário).

function CadastroPage() {
  const { ref, cupom: cupomUrl } = Route.useSearch();
  const navigate = useNavigate();
  const cadastrar = useServerFn(cadastroPublico);
  const validarCupom = useServerFn(validarCupomPublico);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [planoId, setPlanoId] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [done, setDone] = useState<{
    email: string;
    emailEnviado: boolean;
    cupom: CupomAplicado | null;
    planoNome: string | null;
    faturaUrl: string | null;
    faturaValor: number | null;
  } | null>(null);

  const [cooldown, setCooldown] = useState(0);
  const [codigoCupom, setCodigoCupom] = useState(cupomUrl ?? "");
  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null);
  const [validando, setValidando] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Registra (uma vez por navegador) a visita ao link de indicação, para o
  // vendedor acompanhar visitantes x leads x conversões.
  useEffect(() => {
    if (!ref) return;
    const chave = `ref-visita:${ref}`;
    if (localStorage.getItem(chave)) return;
    let sessao = localStorage.getItem("ref-sessao");
    if (!sessao) {
      sessao = crypto.randomUUID();
      localStorage.setItem("ref-sessao", sessao);
    }
    localStorage.setItem(chave, "1");
    void fetch("/api/public/ref-visita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: ref, session: sessao }),
    }).catch(() => {});
  }, [ref]);

  useEffect(() => {
    supabase
      .from("planos")
      .select("id,nome,valor,descricao")
      .eq("ativo", true)
      .order("valor")
      .then(({ data }) => setPlanos((data ?? []) as Plano[]));
  }, []);

  async function aplicarCupom(codigo?: string) {
    const cod = (codigo ?? codigoCupom).trim();
    if (!cod) {
      toast.error("Digite o código do cupom.");
      return;
    }
    setValidando(true);
    try {
      const res = await validarCupom({ data: { codigo: cod } });
      if (!res.valido) {
        setCupomAplicado(null);
        toast.error(res.mensagem);
        return;
      }
      setCodigoCupom(res.codigo);
      setCupomAplicado({
        codigo: res.codigo,
        valor_desconto: res.valor_desconto,
        apenas_primeira_mensalidade: res.apenas_primeira_mensalidade,
      });
      toast.success(`Cupom ${res.codigo} aplicado: ${formatCurrency(res.valor_desconto)} de desconto.`);
    } catch {
      toast.error("Não foi possível validar o cupom agora.");
    } finally {
      setValidando(false);
    }
  }

  const plano = planos.find((p) => p.id === planoId) ?? null;
  const desconto = cupomAplicado ? Math.min(cupomAplicado.valor_desconto, plano?.valor ?? 0) : 0;
  const totalPrimeira = Math.max((plano?.valor ?? 0) - desconto, 0);

  async function submit() {
    if (nome.trim().length < 2 || !email.trim() || !planoId) {
      toast.error("Preencha nome, e-mail e selecione um plano.");
      return;
    }
    if (!cpfCnpj.trim()) {
      toast.error("Informe seu CPF ou CNPJ.");
      return;
    }
    if (!aceite) {
      toast.error("É necessário aceitar os Termos de Uso para criar a conta.");
      return;
    }
    setSaving(true);
    try {
      const emailCliente = email.trim();
      const res = await cadastrar({
        data: {
          ref: ref ?? null,
          nome: nome.trim(),
          email: emailCliente,
          plano_id: planoId,
          cupom: cupomAplicado?.codigo ?? null,
          cpf_cnpj: cpfCnpj.trim(),
          telefone: telefone.trim() || null,
          aceite_termos: true as const,
          termos_versao: TERMOS_VERSAO,
        },
      });
      const { error: resetErr } = await enviarLinkDefinicaoSenha(emailCliente);
      setDone({
        email: emailCliente,
        emailEnviado: !resetErr,
        cupom: res?.cupom
          ? {
              codigo: res.cupom.codigo,
              valor_desconto: Number(res.cupom.valor_desconto),
              apenas_primeira_mensalidade: true,
            }
          : null,
        planoNome: plano?.nome ?? null,
        faturaUrl: res?.cobranca?.invoice_url ?? null,
        faturaValor: res?.cobranca?.valor ?? null,

      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg && !msg.toLowerCase().includes("fetch") && !msg.startsWith("[")
          ? msg
          : "Não foi possível concluir o cadastro. Tente novamente."
      );
      setCooldown(60);

    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Cadastro concluído!</h1>
          {done.cupom && (
            <div className="mt-4 rounded-lg border border-success/40 bg-success/10 p-3 text-left text-sm">
              <p className="font-semibold text-foreground">
                Cupom {done.cupom.codigo} aplicado
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatCurrency(done.cupom.valor_desconto)} de desconto na primeira mensalidade
                {done.planoNome ? ` do plano ${done.planoNome}` : ""}.
              </p>
            </div>
          )}
          {done.faturaUrl && (
            <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-3 text-left text-sm">
              <p className="font-semibold text-foreground">Sua primeira cobrança já foi gerada</p>
              <p className="mt-1 text-muted-foreground">
                Assinatura mensal{done.planoNome ? ` do plano ${done.planoNome}` : ""}
                {done.faturaValor != null ? ` — ${formatCurrency(done.faturaValor)}/mês` : ""}. Você
                pode pagar agora ou depois, pela sua área do cliente.
              </p>
              <Button asChild className="mt-3 w-full">
                <a href={done.faturaUrl} target="_blank" rel="noopener noreferrer">
                  Pagar agora
                </a>
              </Button>
            </div>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            {done.emailEnviado ? (
              <>
                Enviamos um e-mail para <strong>{done.email}</strong> com um link para você
                confirmar o endereço e definir sua senha de acesso. A conta só é ativada depois
                desse passo. Verifique também a caixa de spam.
              </>
            ) : (
              <>
                Sua conta foi criada. Para confirmar seu e-mail e definir a senha, acesse a tela de
                login e clique em <strong>"Esqueci minha senha"</strong> usando o e-mail{" "}
                <strong>{done.email}</strong>.
              </>
            )}
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
      <Card className="w-full max-w-md p-6 sm:p-8">
        <BrazonLogo className="mb-5" />
        <h1 className="text-xl font-bold text-foreground">Crie sua conta e assine</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ref
            ? "Você foi indicado por um vendedor."
            : "Cadastro rápido: escolha o plano e ative sua assinatura na hora."}
        </p>




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
            <Label htmlFor="cpf">CPF ou CNPJ</Label>
            <Input
              id="cpf"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder="Somente números"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tel">Telefone (opcional)</Label>
            <Input
              id="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
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

          <div className="grid gap-2">
            <Label htmlFor="cupom">Cupom de desconto (opcional)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="cupom"
                value={codigoCupom}
                onChange={(e) => {
                  setCodigoCupom(e.target.value.toUpperCase());
                  setCupomAplicado(null);
                }}
                className="uppercase"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => aplicarCupom()}
                disabled={validando}
                className="sm:w-32"
              >
                {validando ? "Validando..." : cupomAplicado ? "Aplicado" : "Aplicar"}
              </Button>
            </div>
          </div>

          {/* Carrinho / resumo da compra */}
          {plano && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-foreground">Resumo da assinatura</p>
              <div className="mt-2 flex justify-between text-muted-foreground">
                <span>{plano.nome} (mensal)</span>
                <span>{formatCurrency(plano.valor)}</span>
              </div>
              {desconto > 0 && cupomAplicado && (
                <div className="mt-1 flex justify-between text-success">
                  <span>Cupom {cupomAplicado.codigo}</span>
                  <span>-{formatCurrency(desconto)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>1ª mensalidade</span>
                <span>{formatCurrency(totalPrimeira)}</span>
              </div>
              {desconto > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  A partir do 2º mês: {formatCurrency(plano.valor)}/mês.
                </p>
              )}
            </div>
          )}

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <Checkbox
              id="aceite"
              checked={aceite}
              onCheckedChange={(v) => setAceite(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="aceite" className="text-sm font-normal leading-relaxed text-muted-foreground">
              Li e aceito os{" "}
              <Link
                to="/termos-de-uso"
                target="_blank"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Termos de Uso
              </Link>{" "}
              . O aceite será registrado com data e hora.
            </Label>
          </div>
          <Button onClick={submit} disabled={saving || cooldown > 0 || !aceite}>
            {saving ? "Enviando..." : cooldown > 0 ? `Aguarde ${cooldown}s...` : "Criar conta e assinar"}
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
