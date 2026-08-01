import { createFileRoute, Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/card";
import { BrazonLogo } from "@/components/BrazonLogo";
import { Button } from "@/components/ui/button";
import { SairButton } from "@/components/SairButton";
import { useAuth, roleHome } from "@/lib/auth";
import { ChevronLeft } from "lucide-react";
import {
  TERMOS_ATUALIZADO_EM,
  TERMOS_RODAPE,
  TERMOS_SECOES,
  TERMOS_VERSAO,
} from "@/lib/termos";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Brazon" },
      { name: "description", content: "Termos de Uso da plataforma Brazon de gestão de assinaturas." },
      { property: "og:title", content: "Termos de Uso — Brazon" },
      { property: "og:description", content: "Termos de Uso da plataforma Brazon de gestão de assinaturas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermosDeUsoPage,
});

function TermosDeUsoPage() {
  const { session, role } = useAuth();
  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <ThemeToggle className="fixed right-3 top-3 z-50 bg-card/70 backdrop-blur sm:right-4 sm:top-4" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link to={session ? roleHome(role) : "/login"}>
            <Button variant="ghost" size="sm" className="gap-1 pl-2">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <BrazonLogo />
          {session ? (
            <div className="ml-auto">
              <SairButton variante="texto" />
            </div>
          ) : null}
        </div>

        <Card className="p-6 md:p-10">
          <article className="prose prose-sm max-w-none text-foreground">
            <h1 className="text-2xl font-bold md:text-3xl">Termos de Uso</h1>
            <p className="text-muted-foreground">
              Versão {TERMOS_VERSAO} — última atualização: {TERMOS_ATUALIZADO_EM}
            </p>

            {TERMOS_SECOES.map((secao, idx) => (
              <section key={secao.titulo} className={idx === 0 ? "mt-8" : "mt-6"}>
                <h2 className="text-lg font-semibold">{secao.titulo}</h2>
                {secao.paragrafo ? <p>{secao.paragrafo}</p> : null}
                {secao.lista ? (
                  secao.ordenada ? (
                    <ol className="list-decimal space-y-3 pl-5">
                      {secao.lista.map((item) => (
                        <li key={item.texto}>
                          {item.titulo ? <strong>{item.titulo}:</strong> : null} {item.texto}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5">
                      {secao.lista.map((item) => (
                        <li key={item.texto}>
                          {item.titulo ? <strong>{item.titulo}:</strong> : null} {item.texto}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </section>
            ))}

            <p className="mt-8 text-sm text-muted-foreground">{TERMOS_RODAPE}</p>
          </article>
        </Card>
      </div>
    </div>
  );
}
