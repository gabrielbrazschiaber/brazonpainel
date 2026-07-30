import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LayoutDashboard, Users } from "lucide-react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { setViewport } from "@/test/setup";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type AppNavItem } from "@/components/AppSidebar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
  useRouterState: () => "/admin",
}));

const sair = vi.fn();
vi.mock("@/lib/use-sair", () => ({
  useSair: () => ({ sair, saindo: false }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, role: "admin" }),
}));


const items: readonly AppNavItem[] = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "clientes", label: "Clientes", icon: Users },
];

function Harness({ onTab = vi.fn(), onConta = vi.fn() }) {
  return (
    <SidebarProvider>
      <SidebarTrigger aria-label="Abrir menu" />
      <AppSidebar items={items} tab="dashboard" onTab={onTab} onConta={onConta} />
    </SidebarProvider>
  );
}

/** O drawer mobile é um dialog do Radix; no desktop a sidebar é estática. */
function drawer() {
  return screen.queryByRole("dialog");
}

const RETRATO = { width: 390, height: 844 };
const PAISAGEM = { width: 844, height: 390 };
const DESKTOP = { width: 1280, height: 900, coarsePointer: false };

describe("AppSidebar — drawer mobile", () => {
  beforeEach(() => {
    sair.mockClear();
    document.body.style.pointerEvents = "";
  });

  it.each([
    ["retrato", RETRATO],
    ["paisagem", PAISAGEM],
  ])("abre como drawer em %s", async (_nome, viewport) => {
    setViewport(viewport);
    const user = userEvent.setup();
    render(<Harness />);

    expect(drawer()).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Abrir menu"));
    await waitFor(() => expect(drawer()).toBeInTheDocument());
    expect(screen.getByText("Clientes")).toBeVisible();
  });

  it.each([
    ["retrato", RETRATO],
    ["paisagem", PAISAGEM],
  ])("bloqueia o scroll da página enquanto aberto em %s", async (_nome, viewport) => {
    setViewport(viewport);
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Abrir menu"));
    await waitFor(() => expect(document.body).toHaveStyle({ overflow: "hidden" }));
  });

  it("fecha ao clicar fora (overlay)", async () => {
    setViewport(RETRATO);
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Abrir menu"));
    await waitFor(() => expect(drawer()).toBeInTheDocument());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    await waitFor(() => expect(document.body).not.toHaveStyle({ overflow: "hidden" }));
  });

  it("navega e fecha o drawer ao escolher um item", async () => {
    setViewport(RETRATO);
    const onTab = vi.fn();
    const user = userEvent.setup();
    render(<Harness onTab={onTab} />);

    await user.click(screen.getByLabelText("Abrir menu"));
    await waitFor(() => expect(drawer()).toBeInTheDocument());

    await user.click(screen.getByText("Clientes"));
    expect(onTab).toHaveBeenCalledWith("clientes");
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
  });

  it("aciona Minha conta e Sair fechando o drawer", async () => {
    setViewport(PAISAGEM);
    const onConta = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConta={onConta} />);

    await user.click(screen.getByLabelText("Abrir menu"));
    await waitFor(() => expect(drawer()).toBeInTheDocument());
    await user.click(screen.getByText("Minha conta"));
    expect(onConta).toHaveBeenCalled();
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());

    await user.click(screen.getByLabelText("Abrir menu"));
    await waitFor(() => expect(drawer()).toBeInTheDocument());
    await user.click(screen.getByText("Sair"));
    expect(sair).toHaveBeenCalled();
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
  });

  it("no desktop a navegação fica sempre visível, sem drawer", async () => {
    setViewport(DESKTOP);
    render(<Harness />);

    expect(drawer()).not.toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
  });
});
