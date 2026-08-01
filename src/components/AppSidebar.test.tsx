import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { ClipboardList, LayoutDashboard, Users } from "lucide-react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { setViewport } from "@/test/setup";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type AppNavItem } from "@/components/AppSidebar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: () => "/admin",
  useNavigate: () => vi.fn(),
  // O prefetch por intenção usa o router para pré-carregar rotas no hover.
  useRouter: () => ({ preloadRoute: vi.fn(() => Promise.resolve()) }),
}));


vi.mock("@/lib/use-tarefas-abertas", () => ({
  useTarefasAbertas: () => ({ abertas: 3, atualizar: vi.fn() }),
}));

vi.mock("@/lib/use-chat-nao-lidas", () => ({
  useChatNaoLidas: () => ({ naoLidas: 0, atualizar: vi.fn() }),
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
  { value: "tarefas", label: "Tarefas", icon: ClipboardList, to: "/tarefas" },
];

function Harness({ onTab = vi.fn(), onConta = vi.fn() }) {
  // O prefetch por intenção usa o cache de queries, então o menu precisa do provider.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <SidebarTrigger aria-label="Abrir menu" />
        <AppSidebar items={items} tab="dashboard" onTab={onTab} onConta={onConta} />
      </SidebarProvider>
    </QueryClientProvider>
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

describe("AppSidebar — itens de rota", () => {
  it("renderiza item com rota como link e mostra o contador de tarefas", () => {
    setViewport(DESKTOP);
    render(<Harness />);
    const link = screen.getByRole("link", { name: /Tarefas/ });
    expect(link).toHaveAttribute("href", "/tarefas");
    expect(link).toHaveTextContent("3");
  });

  it("não mostra Auditoria na navegação lateral", () => {
    setViewport(DESKTOP);
    render(<Harness />);
    expect(screen.queryByText("Auditoria")).toBeNull();
  });
});
