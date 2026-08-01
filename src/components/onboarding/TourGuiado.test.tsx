import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourGuiado } from "@/components/onboarding/TourGuiado";
import type { Tutorial } from "@/lib/onboarding";

const TUTORIAL: Tutorial = {
  chave: "tela:teste",
  titulo: "Tour de teste",
  papeis: ["admin"],
  passos: [
    { alvo: '[data-tour="alvo-1"]', titulo: "Primeiro passo", corpo: "Corpo do primeiro." },
    { alvo: '[data-tour="alvo-2"]', titulo: "Segundo passo", corpo: "Corpo do segundo." },
    { titulo: "Último passo", corpo: "Corpo do último." },
  ],
};

/** matchMedia controlável: o padrão é "sem preferência de movimento reduzido". */
function mockMatchMedia(reduzido: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduzido && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function montarAlvos() {
  const host = document.createElement("div");
  host.innerHTML = `
    <button data-tour="alvo-1">Alvo 1</button>
    <button data-tour="alvo-2">Alvo 2</button>
  `;
  document.body.appendChild(host);
  // jsdom devolve 0x0 em getBoundingClientRect; damos tamanho aos alvos para
  // que o tour os considere visíveis.
  host.querySelectorAll<HTMLElement>("[data-tour]").forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({ top: 40 + i * 80, left: 20, width: 120, height: 36, right: 140, bottom: 76 + i * 80, x: 20, y: 40 + i * 80, toJSON: () => ({}) }) as DOMRect;
    el.scrollIntoView = vi.fn();
  });
  return host;
}

function renderizar(props?: Partial<Parameters<typeof TourGuiado>[0]>) {
  const onConcluir = vi.fn();
  const onPular = vi.fn();
  const onPasso = vi.fn();
  const utils = render(
    <TourGuiado
      tutorial={TUTORIAL}
      onConcluir={onConcluir}
      onPular={onPular}
      onPasso={onPasso}
      {...props}
    />,
  );
  return { ...utils, onConcluir, onPular, onPasso };
}

beforeEach(() => {
  document.body.innerHTML = "";
  mockMatchMedia(false);
  montarAlvos();
});

describe("TourGuiado — acessibilidade e teclado", () => {
  it("abre como diálogo modal descrito pelo título e corpo do passo", async () => {
    renderizar();
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Primeiro passo")).toBeInTheDocument();
    expect(screen.getByText("Corpo do primeiro.")).toBeInTheDocument();
  });

  it("prende o foco no balão: Tab circula apenas entre os botões do tour", async () => {
    const user = userEvent.setup();
    renderizar();
    const dialogo = await screen.findByRole("dialog");

    // O trap já foca o primeiro elemento do balão ao abrir.
    await waitFor(() => expect(dialogo.contains(document.activeElement)).toBe(true));

    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialogo.contains(document.activeElement)).toBe(true);
    }
  });

  it("avança com Enter e conclui no último passo", async () => {
    const user = userEvent.setup();
    const { onConcluir, onPasso } = renderizar();
    await screen.findByRole("dialog");

    await user.keyboard("{Enter}");
    expect(await screen.findByText("Segundo passo")).toBeInTheDocument();
    expect(onPasso).toHaveBeenCalledWith(1);

    await user.keyboard("{Enter}");
    expect(await screen.findByText("Último passo")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onConcluir).toHaveBeenCalledTimes(1);
  });

  it("Esc pula o tour informando o passo em que o usuário parou", async () => {
    const user = userEvent.setup();
    const { onPular } = renderizar();
    await screen.findByRole("dialog");

    await user.keyboard("{Enter}");
    await screen.findByText("Segundo passo");
    await user.keyboard("{Escape}");

    expect(onPular).toHaveBeenCalledWith(1);
  });

  it("navega pelos botões Próximo/Anterior com o teclado", async () => {
    const user = userEvent.setup();
    renderizar();
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(await screen.findByText("Segundo passo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("Primeiro passo")).toBeInTheDocument();
  });

  it("respeita prefers-reduced-motion: sem transição no recorte e scroll instantâneo", async () => {
    mockMatchMedia(true);
    document.body.innerHTML = "";
    const host = montarAlvos();
    const alvo = host.querySelector<HTMLElement>('[data-tour="alvo-1"]')!;

    renderizar();
    await screen.findByRole("dialog");

    await waitFor(() =>
      expect((alvo.scrollIntoView as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
        behavior: "auto",
      }),
    );

    const recorte = document.querySelector<HTMLElement>(".ring-primary");
    expect(recorte?.style.transition).toBe("none");
  });

  it("com movimento normal usa transição e scroll suave", async () => {
    const host = document.body.querySelector<HTMLElement>("div")!;
    const alvo = host.querySelector<HTMLElement>('[data-tour="alvo-1"]')!;

    renderizar();
    await screen.findByRole("dialog");

    await waitFor(() =>
      expect((alvo.scrollIntoView as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
        behavior: "smooth",
      }),
    );

    const recorte = document.querySelector<HTMLElement>(".ring-primary");
    expect(recorte?.style.transition).toContain("180ms");
  });
});
