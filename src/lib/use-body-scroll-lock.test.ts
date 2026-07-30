import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useBodyScrollLock, __locksAtivos } from "@/lib/use-body-scroll-lock";

function limparBody() {
  document.body.removeAttribute("style");
  document.body.removeAttribute("data-scroll-locked");
  document.body.innerHTML = "";
}

describe("useBodyScrollLock — contagem de referências", () => {
  beforeEach(() => {
    limparBody();
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
  });

  it("trava e destrava com um único consumidor", () => {
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.position).toBe("fixed");
    expect(__locksAtivos()).toBe(1);

    act(() => unmount());
    expect(__locksAtivos()).toBe(0);
    expect(document.body.style.position).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("mantém o body travado ao fechar em ordem inversa (A, B → fecha A → fecha B)", () => {
    const a = renderHook(() => useBodyScrollLock(true));
    const b = renderHook(() => useBodyScrollLock(true));
    expect(__locksAtivos()).toBe(2);
    expect(document.body.style.overflow).toBe("hidden");

    // fecha A primeiro: ainda há B aberto
    act(() => a.unmount());
    expect(__locksAtivos()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");

    // fecha B: agora sim destrava
    act(() => b.unmount());
    expect(__locksAtivos()).toBe(0);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
  });

  it("mantém o body travado ao fechar na mesma ordem (fecha B → fecha A)", () => {
    const a = renderHook(() => useBodyScrollLock(true));
    const b = renderHook(() => useBodyScrollLock(true));

    act(() => b.unmount());
    expect(__locksAtivos()).toBe(1);
    expect(document.body.style.position).toBe("fixed");

    act(() => a.unmount());
    expect(__locksAtivos()).toBe(0);
    expect(document.body.style.position).toBe("");
  });

  it("restaura a posição de rolagem apenas quando o último lock é liberado", () => {
    Object.defineProperty(window, "scrollY", { value: 420, writable: true, configurable: true });
    const a = renderHook(() => useBodyScrollLock(true));
    const b = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.top).toBe("-420px");

    act(() => a.unmount());
    expect(window.scrollTo).not.toHaveBeenCalled();

    act(() => b.unmount());
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420);
  });

  it("alternar `ativo` de um consumidor não destrava enquanto o outro segue aberto", () => {
    const fixo = renderHook(() => useBodyScrollLock(true));
    const alternante = renderHook(({ ativo }) => useBodyScrollLock(ativo), {
      initialProps: { ativo: true },
    });
    expect(__locksAtivos()).toBe(2);

    act(() => alternante.rerender({ ativo: false }));
    expect(__locksAtivos()).toBe(1);
    expect(document.body.style.position).toBe("fixed");

    act(() => alternante.rerender({ ativo: true }));
    expect(__locksAtivos()).toBe(2);

    act(() => alternante.unmount());
    act(() => fixo.unmount());
    expect(__locksAtivos()).toBe(0);
    expect(document.body.style.position).toBe("");
  });

  it("não fica com contagem negativa nem preserva estilos após ciclos repetidos", () => {
    for (let i = 0; i < 3; i++) {
      const h = renderHook(() => useBodyScrollLock(true));
      act(() => h.unmount());
    }
    expect(__locksAtivos()).toBe(0);
    expect(document.body.getAttribute("style")).toBeFalsy();
  });

  it("preserva estilos inline pré-existentes do body", () => {
    document.body.style.overflow = "auto";
    document.body.style.width = "50%";

    const h = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe("hidden");

    act(() => h.unmount());
    expect(document.body.style.overflow).toBe("auto");
    expect(document.body.style.width).toBe("50%");
  });

  it("adia a restauração enquanto outro overlay (dialog) continuar aberto", async () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);

    const h = renderHook(() => useBodyScrollLock(true));
    act(() => h.unmount());

    // lock liberado, mas o body segue travado por causa do dialog
    expect(__locksAtivos()).toBe(0);
    expect(document.body.style.position).toBe("fixed");

    dialog.setAttribute("data-state", "closed");
    await vi.waitFor(() => {
      expect(document.body.style.position).toBe("");
    });
  });
});
