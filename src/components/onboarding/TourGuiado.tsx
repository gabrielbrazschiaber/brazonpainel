import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { PassoTutorial, Tutorial } from "@/lib/onboarding";

interface TourGuiadoProps {
  tutorial: Tutorial;
  passoInicial?: number;
  onPasso?: (indice: number) => void;
  onConcluir: () => void;
  onPular: (indice: number) => void;
}

interface Retangulo {
  top: number;
  left: number;
  width: number;
  height: number;
}

function alvoNoDom(passo: PassoTutorial): HTMLElement | null {
  if (!passo.alvo) return null;
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(passo.alvo);
  if (!el) return null;
  // Elemento existente mas invisível também não serve como alvo.
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return el;
}

/** Passo é utilizável se for centrado (sem alvo) ou se o alvo existir no DOM. */
function passoValido(passo: PassoTutorial): boolean {
  return !passo.alvo || alvoNoDom(passo) !== null;
}

/**
 * Overlay de tour com recorte no elemento marcado com data-tour.
 * Passos cujo alvo não existe são pulados em silêncio (a tela varia por papel
 * e por permissão), então o tour nunca trava nem mostra balão vazio.
 */
export function TourGuiado({
  tutorial,
  passoInicial = 0,
  onPasso,
  onConcluir,
  onPular,
}: TourGuiadoProps) {
  const passos = tutorial.passos;

  const proximoValido = React.useCallback(
    (de: number, direcao: 1 | -1): number | null => {
      for (let i = de; i >= 0 && i < passos.length; i += direcao) {
        if (passoValido(passos[i])) return i;
      }
      return null;
    },
    [passos],
  );

  const [indice, setIndice] = React.useState<number | null>(null);
  const [rect, setRect] = React.useState<Retangulo | null>(null);
  const balaoRef = React.useRef<HTMLDivElement>(null);

  const reduzido =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Escolhe o primeiro passo utilizável a partir do ponto onde o usuário parou.
  React.useEffect(() => {
    const inicio = Math.min(Math.max(passoInicial, 0), Math.max(passos.length - 1, 0));
    const alvo = proximoValido(inicio, 1) ?? proximoValido(0, 1);
    if (alvo === null) {
      onConcluir();
      return;
    }
    setIndice(alvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBodyScrollLock(indice !== null);
  useFocusTrap(indice !== null, balaoRef);

  const passo = indice === null ? null : passos[indice];

  // Mantém o recorte alinhado ao alvo (scroll, resize, layout tardio).
  React.useEffect(() => {
    if (!passo) return;
    let cancelado = false;

    function medir() {
      if (cancelado || !passo) return;
      const el = alvoNoDom(passo);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    const el = alvoNoDom(passo);
    el?.scrollIntoView({ block: "center", behavior: reduzido ? "auto" : "smooth" });
    medir();
    const t = window.setTimeout(medir, reduzido ? 0 : 320);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [passo, reduzido]);

  const avancar = React.useCallback(() => {
    if (indice === null) return;
    const prox = proximoValido(indice + 1, 1);
    if (prox === null) {
      onConcluir();
      return;
    }
    setIndice(prox);
    onPasso?.(prox);
  }, [indice, proximoValido, onConcluir, onPasso]);

  const voltar = React.useCallback(() => {
    if (indice === null) return;
    const ant = proximoValido(indice - 1, -1);
    if (ant === null) return;
    setIndice(ant);
    onPasso?.(ant);
  }, [indice, proximoValido, onPasso]);

  const pular = React.useCallback(() => {
    onPular(indice ?? 0);
  }, [indice, onPular]);

  React.useEffect(() => {
    if (indice === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        pular();
      } else if (e.key === "Enter") {
        const alvo = e.target as HTMLElement | null;
        if (alvo && alvo.tagName === "BUTTON") return;
        e.preventDefault();
        avancar();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [indice, avancar, pular]);

  if (indice === null || !passo) return null;

  // Numeração amigável: conta apenas os passos utilizáveis nesta tela.
  const utilizaveis = passos.map((p, i) => ({ p, i })).filter(({ p }) => passoValido(p));
  const total = utilizaveis.length;
  const atual = utilizaveis.findIndex(({ i }) => i === indice) + 1;
  const ehUltimo = proximoValido(indice + 1, 1) === null;
  const temAnterior = proximoValido(indice - 1, -1) !== null;

  const estiloBalao = posicionarBalao(rect, passo.posicao);

  return (
    <div className="fixed inset-0 z-[70]" data-tour-overlay={tutorial.chave} aria-live="polite">
      {/* Fundo escuro com recorte no alvo */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px hsl(0 0% 0% / 0.62)",
            transition: reduzido ? "none" : "all 180ms ease-out",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      <div
        ref={balaoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-corpo"
        className="fixed inset-x-3 bottom-3 z-[71] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl sm:max-w-sm"
        style={estiloBalao}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow">
            Passo {atual} de {total} · {tutorial.titulo}
          </p>
          <button
            type="button"
            onClick={pular}
            aria-label="Pular tutorial"
            data-tour-acao="fechar"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 id="tour-titulo" className="mt-1 text-base font-semibold leading-tight">
          {passo.titulo}
        </h2>
        <p id="tour-corpo" className="mt-1.5 text-sm text-muted-foreground">
          {passo.corpo}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={pular} data-tour-acao="pular">
            Pular tutorial
          </Button>
          <div className="flex items-center gap-2">
            {temAnterior && (
              <Button variant="outline" size="sm" onClick={voltar} data-tour-acao="anterior">
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={avancar} data-tour-acao={ehUltimo ? "concluir" : "proximo"}>
              {ehUltimo ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * No mobile o balão fica fixo na base ocupando a largura (classes padrão).
 * No desktop ele se posiciona ao lado do alvo, sem cobri-lo.
 */
function posicionarBalao(
  rect: Retangulo | null,
  posicao: PassoTutorial["posicao"],
): React.CSSProperties {
  if (typeof window === "undefined") return {};
  const ehMobile = window.innerWidth < 640;
  if (ehMobile || !rect) {
    if (!rect && !ehMobile) {
      return {
        top: "50%",
        left: "50%",
        right: "auto",
        bottom: "auto",
        transform: "translate(-50%, -50%)",
      };
    }
    return {};
  }

  const largura = 360;
  const margem = 16;
  const estimativaAltura = 210;
  let top = rect.top;
  let left = rect.left + rect.width + margem;

  switch (posicao) {
    case "left":
      left = rect.left - largura - margem;
      break;
    case "top":
      left = rect.left;
      top = rect.top - estimativaAltura - margem;
      break;
    case "bottom":
      left = rect.left;
      top = rect.top + rect.height + margem;
      break;
    default:
      break;
  }

  left = Math.min(Math.max(left, margem), window.innerWidth - largura - margem);
  top = Math.min(Math.max(top, margem), window.innerHeight - estimativaAltura - margem);

  return { top, left, width: largura, right: "auto", bottom: "auto" };
}
