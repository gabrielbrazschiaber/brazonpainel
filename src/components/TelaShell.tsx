import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrazonLogo } from "@/components/BrazonLogo";
import { AvisosSino } from "@/components/AvisosSino";
import { SairButton } from "@/components/SairButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErroLimite } from "@/components/ErroLimite";
import { PularParaConteudo } from "@/components/PularParaConteudo";
import { Trilha, type TrilhaItem } from "@/components/ui/trilha";

interface TelaShellProps {
  /** rota do painel principal do usuário (destino do "Voltar") */
  voltarPara: string;
  /** nome da área, usado no limite de erro */
  area: string;
  /** trilha de navegação (breadcrumbs); o último item é a página atual */
  trilha?: readonly TrilhaItem[];
  /** slot à esquerda do seletor de tema (ex.: ajuda da tela) */
  headerExtra?: ReactNode;
  /** largura máxima do conteúdo */
  larguraMax?: string;
  children: ReactNode;
}

/**
 * Chrome padrão das telas secundárias (comercial, tarefas, solicitações).
 * Espelha o header do AppShell para que todas as telas tenham a mesma
 * altura, o mesmo vidro translúcido e a mesma ordem de ações à direita.
 */
export function TelaShell({
  voltarPara,
  area,
  trilha,
  headerExtra,
  larguraMax = "max-w-6xl",
  children,
}: TelaShellProps) {

  return (
    <div className="min-h-dvh bg-background">
      <PularParaConteudo />
      <header className="glass-header sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/60 px-2 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-5">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="shrink-0 sm:h-9 sm:w-auto sm:px-3"
          aria-label="Voltar ao painel"
        >
          <Link to={voltarPara}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden text-sm sm:inline">Painel</span>
          </Link>
        </Button>

        <BrazonLogo className="hidden sm:flex" symbolClassName="h-7 w-7" textClassName="text-lg" />

        {trilha && trilha.length > 0 && (
          <Trilha itens={trilha} className="hidden md:block" />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          {headerExtra}
          <ThemeToggle />
          <span data-tour="avisos" className="inline-flex">
            <AvisosSino />
          </span>
          <SairButton variante="icone" />
        </div>
      </header>

      <main
        id="conteudo"
        className={`mx-auto w-full ${larguraMax} space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8`}
      >
        {trilha && trilha.length > 0 && <Trilha itens={trilha} className="md:hidden" />}
        <ErroLimite area={area}>{children}</ErroLimite>
      </main>
    </div>
  );

}
