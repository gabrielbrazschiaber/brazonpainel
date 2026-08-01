import { GATE_TEXTOS } from "@/lib/gate-textos";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  criarSessao,
  criarSupabaseMock,
  papeis,
  papeisErro,
  perfilOk,
} from "@/test/supabase-mock";
import { limparAuthTelemetria, lerAuthTelemetria } from "@/lib/auth-telemetry";

const mock = await vi.hoisted(async () => {
  const m = await import("@/test/supabase-mock");
  return { sb: m.criarSupabaseMock(), navigate: vi.fn(async () => {}) };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.sb.supabase }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mock.navigate }));
vi.mock("@/lib/use-sair", () => ({ useSair: () => ({ sair: async () => {}, saindo: false }) }));
vi.mock("@/components/TermosGate", () => ({
  TermosGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AuthProvider, useAuth, type AppRole } from "@/lib/auth";
import { RequireRole } from "@/components/RequireRole";

const BLOQUEIO = GATE_TEXTOS.sem_papel.titulo;
const FALHA = GATE_TEXTOS.erro.titulo;

/** Observa TODA mutação do DOM: pega estados transitórios entre renders. */
function observarTextos() {
  const textos: string[] = [document.body.textContent ?? ""];
  const obs = new MutationObserver(() => textos.push(document.body.textContent ?? ""));
  obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  return { textos, parar: () => obs.disconnect() };
}

function Painel({ nome }: { nome: string }) {
  return <div>PAINEL {nome}</div>;
}

beforeEach(() => {
  mock.navigate.mockClear();
  limparAuthTelemetria();
});

describe("gates dependentes de papel", () => {
  // Simula rede lenta: a consulta de user_roles demora a responder, que é
  // exatamente a janela em que o falso "Acesso não liberado" aparecia.
  it.each<AppRole>(["admin", "vendedor", "cliente"])(
    "recarregar /%s com rede lenta mostra só spinner e então o painel",
    async (papel) => {
      mock.sb.definirSessao(criarSessao(`u-${papel}`));
      mock.sb.definirRespostas({
        profiles: perfilOk(`u-${papel}`),
        user_roles: papeis([papel], 150),
        role_permissions: papeis([], 20),
      });

      const { textos, parar } = observarTextos();
      render(
        <AuthProvider>
          <RequireRole role={papel}>
            <Painel nome={papel.toUpperCase()} />
          </RequireRole>
        </AuthProvider>,
      );

      // Antes de resolver o papel: apenas o estado de carregamento.
      await waitFor(() =>
        expect(document.querySelector('[data-gate-estado="carregando"]')).not.toBeNull(),
      );
      await screen.findByText(`PAINEL ${papel.toUpperCase()}`, undefined, { timeout: 3000 });
      parar();

      expect(textos.some((t) => t.includes(BLOQUEIO))).toBe(false);
      expect(textos.some((t) => t.includes(FALHA))).toBe(false);
      // Nenhum redirecionamento indevido por papel.
      expect(mock.navigate).not.toHaveBeenCalled();
    },
  );

  it("falha na consulta de papel mostra 'Falha de conexão' com retry que recupera", async () => {
    mock.sb.definirSessao(criarSessao("u1"));
    mock.sb.definirRespostas({
      profiles: perfilOk("u1"),
      user_roles: papeisErro(10),
      role_permissions: papeis([]),
    });

    const { textos, parar } = observarTextos();
    render(
      <AuthProvider>
        <RequireRole role="admin">
          <Painel nome="ADMIN" />
        </RequireRole>
      </AuthProvider>,
    );

    await screen.findByText(FALHA);
    parar();
    // Erro de rede nunca deve ser apresentado como falta de perfil.
    expect(textos.some((t) => t.includes(BLOQUEIO))).toBe(false);
    expect(lerAuthTelemetria().some((e) => e.tipo === "papel_erro")).toBe(true);

    mock.sb.definirRespostas({
      profiles: perfilOk("u1"),
      user_roles: papeis(["admin"], 10),
      role_permissions: papeis([]),
    });
    await userEvent.click(document.querySelector('[data-gate-acao="retry"]') as HTMLElement);
    await screen.findByText("PAINEL ADMIN");
    expect(lerAuthTelemetria().some((e) => e.tipo === "papel_retry")).toBe(true);
  });

  it("conta realmente sem papel mostra o bloqueio e registra sem_papel", async () => {
    mock.sb.definirSessao(criarSessao("u2"));
    mock.sb.definirRespostas({
      profiles: perfilOk("u2"),
      user_roles: papeis([], 10),
      role_permissions: papeis([]),
    });

    render(
      <AuthProvider>
        <RequireRole role="admin">
          <Painel nome="ADMIN" />
        </RequireRole>
      </AuthProvider>,
    );

    await screen.findByText(BLOQUEIO);
    const eventos = lerAuthTelemetria();
    expect(eventos.some((e) => e.tipo === "papel_sem_papel")).toBe(true);
    expect(eventos.some((e) => e.tipo === "papel_erro")).toBe(false);
  });
});

describe("troca de conta sem recarregar a página", () => {
  it("nunca deixa o papel antigo vazar antes do novo resolver", async () => {
    mock.sb.definirSessao(criarSessao("admin-1"));
    mock.sb.definirRespostas({
      profiles: perfilOk("admin-1"),
      user_roles: papeis(["admin"], 10),
      role_permissions: papeis([]),
    });

    const historico: { papel: string; estado: string }[] = [];
    function Sonda() {
      const { role, estadoPapel } = useAuth();
      historico.push({ papel: role ?? "-", estado: estadoPapel });
      return <div data-testid="sonda">{`${role ?? "-"}|${estadoPapel}`}</div>;
    }

    render(
      <AuthProvider>
        <Sonda />
        <RequireRole role="admin">
          <Painel nome="ADMIN" />
        </RequireRole>
      </AuthProvider>,
    );

    await screen.findByText("PAINEL ADMIN");

    // Agora troca para uma conta de cliente, com papel lento a resolver.
    mock.sb.definirRespostas({
      profiles: perfilOk("cliente-9"),
      user_roles: papeis(["cliente"], 120),
      role_permissions: papeis([]),
    });
    const marco = historico.length;
    const { textos, parar } = observarTextos();

    await act(async () => {
      mock.sb.emitir("SIGNED_IN", criarSessao("cliente-9"));
    });

    await waitFor(() => expect(screen.getByTestId("sonda").textContent).toBe("cliente|resolvido"), {
      timeout: 3000,
    });
    parar();

    const depois = historico.slice(marco);
    const primeiroCliente = depois.findIndex((h) => h.papel === "cliente");
    // Do momento da troca até o novo papel resolver, "admin" não pode reaparecer.
    expect(depois.slice(0, primeiroCliente).every((h) => h.papel === "-")).toBe(true);
    // O painel do papel antigo não pode ser renderizado durante a transição
    // (o índice 0 é a foto anterior à troca, por isso é descartado).
    const durante = textos.slice(1);
    expect(durante.some((t) => t.includes("PAINEL ADMIN"))).toBe(false);
    expect(durante.some((t) => t.includes(BLOQUEIO))).toBe(false);
    // E o usuário é levado ao painel correto do novo papel.
    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith({ to: "/cliente", replace: true }),
    );
    expect(lerAuthTelemetria().some((e) => e.tipo === "troca_de_conta")).toBe(true);
  });
});
