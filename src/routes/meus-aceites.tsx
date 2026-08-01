import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, FileCheck2 } from "lucide-react";
import { listarMeusAceites } from "@/lib/termos.functions";
import { useAuth, roleHome } from "@/lib/auth";
import { BrazonLogo } from "@/components/BrazonLogo";
import { SairButton } from "@/components/SairButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/meus-aceites")({
  head: () => ({
    meta: [
      { title: "Meus aceites do Termo de Uso — Brazon" },
      {
        name: "description",
        content:
          "Consulte o histórico dos Termos de Uso que você aceitou, com versão, data, hora e o texto integral registrado.",
      },
      { property: "og:title", content: "Meus aceites do Termo de Uso — Brazon" },
      {
        property: "og:description",
        content: "Histórico de aceites com versão, data/hora e texto integral registrado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeusAceitesPage,
});

interface Aceite {
  id: string;
  versao: string;
  texto: string;
  origem: string | null;
  aceito_em: string;
  email: string | null;
}

const ORIGEM_LABEL: Record<string, string> = {
  cadastro_publico: "Cadastro na plataforma",
  revalidacao: "Aceite de nova versão",
};

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function MeusAceitesPage() {
  const navigate = useNavigate();
  const { session, role, loading: authLoading } = useAuth();
  const listar = useServerFn(listarMeusAceites);

  const [aceites, setAceites] = useState<Aceite[]>([]);
  const [versaoAtual, setVersaoAtual] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/login" });
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    let ativo = true;
    setCarregando(true);
    listar({})
      .then((r) => {
        if (!ativo) return;
        setAceites(r.aceites as Aceite[]);
        setVersaoAtual(r.versaoAtual);
      })
      .catch(() => ativo && setErro(true))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [session, listar]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <ThemeToggle className="fixed right-3 top-3 z-50 bg-card/70 backdrop-blur sm:right-4 sm:top-4" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link to={roleHome(role)}>
            <Button variant="ghost" size="sm" className="gap-1 pl-2">
              <ChevronLeft className="h-4 w-4" />
              Voltar ao painel
            </Button>
          </Link>
          <BrazonLogo />
          <div className="ml-auto">
            <SairButton variante="texto" />
          </div>
        </div>

        <Card className="p-6 md:p-8">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground md:text-2xl">
                Meus aceites do Termo de Uso
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Histórico com a versão aceita, a data e hora do aceite e o texto integral registrado
                no momento da confirmação.
                {versaoAtual ? ` Versão vigente: ${versaoAtual}.` : ""}
              </p>
            </div>
          </div>

          <div className="mt-6">
            {carregando ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : erro ? (
              <p className="py-8 text-center text-sm text-destructive">
                Não foi possível carregar seu histórico. Tente novamente mais tarde.
              </p>
            ) : aceites.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum aceite registrado até o momento.
              </p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {aceites.map((a) => (
                  <AccordionItem key={a.id} value={a.id}>
                    <AccordionTrigger className="text-left">
                      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-2">
                        <span className="font-medium text-foreground">Versão {a.versao}</span>
                        {versaoAtual === a.versao ? (
                          <Badge variant="secondary">Vigente</Badge>
                        ) : null}
                        <span className="text-sm text-muted-foreground">
                          {formatarDataHora(a.aceito_em)}
                        </span>
                        {a.origem ? (
                          <span className="text-xs text-muted-foreground">
                            · {ORIGEM_LABEL[a.origem] ?? a.origem}
                          </span>
                        ) : null}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Registrado para o e-mail {a.email || "—"}.
                      </p>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-sans text-xs leading-relaxed text-foreground">
                        {a.texto}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ver a{" "}
            <Link
              to="/termos-de-uso"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              versão vigente dos Termos de Uso
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  );
}
