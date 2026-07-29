import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

/**
 * Simula uma viewport (retrato/paisagem) para os testes do drawer.
 * Reimplementa window.matchMedia interpretando max-width/max-height/pointer,
 * que é o que o hook useIsMobile consulta.
 */
export function setViewport({
  width,
  height,
  coarsePointer = true,
}: {
  width: number;
  height: number;
  coarsePointer?: boolean;
}) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });

  const matches = (query: string) =>
    query.split(",").some((part) => {
      const conditions = part.match(/\(([^)]+)\)/g) ?? [];
      return conditions.every((raw) => {
        const cond = raw.slice(1, -1);
        const maxW = cond.match(/max-width:\s*(\d+)px/);
        if (maxW) return width <= Number(maxW[1]);
        const maxH = cond.match(/max-height:\s*(\d+)px/);
        if (maxH) return height <= Number(maxH[1]);
        if (cond.includes("pointer")) return coarsePointer === cond.includes("coarse");
        return false;
      });
    });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom não implementa estas APIs usadas pelo Radix Dialog.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
