import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { PasswordInput, validarSenha } from "@/components/ui/password-input";

function Campo(props: Partial<React.ComponentProps<typeof PasswordInput>>) {
  const [v, setV] = React.useState("");
  return (
    <>
      <PasswordInput
        aria-label="Senha"
        value={v}
        onChange={(e) => setV(e.target.value)}
        {...props}
      />
      <button type="button">outro campo</button>
    </>
  );
}

const campo = () => screen.getByLabelText("Senha") as HTMLInputElement;
const botao = () => screen.getByRole("button", { name: /senha/i });

afterEach(() => vi.useRealTimers());

describe("validarSenha", () => {
  it("exige 8 caracteres, letra e número", () => {
    expect(validarSenha("abc").valida).toBe(false);
    expect(validarSenha("abcdefgh").valida).toBe(false);
    expect(validarSenha("12345678").valida).toBe(false);
    expect(validarSenha("abcd1234").valida).toBe(true);
  });
});

describe("PasswordInput", () => {
  it("começa oculto e revela ao clicar no olho", async () => {
    const user = userEvent.setup();
    render(<Campo />);
    await user.type(campo(), "segredo123");

    expect(campo()).toHaveAttribute("type", "password");
    await user.click(botao());
    expect(campo()).toHaveAttribute("type", "text");
    expect(botao()).toHaveAttribute("aria-pressed", "true");

    await user.click(botao());
    expect(campo()).toHaveAttribute("type", "password");
  });

  it("oculta sozinho após o tempo de revelação", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Campo tempoRevelacao={1000} />);
    await user.click(botao());
    expect(campo()).toHaveAttribute("type", "text");

    await vi.advanceTimersByTimeAsync(1100);
    await waitFor(() => expect(campo()).toHaveAttribute("type", "password"));
  });

  it("oculta ao sair do campo", async () => {
    const user = userEvent.setup();
    render(<Campo />);
    await user.click(botao());
    expect(campo()).toHaveAttribute("type", "text");

    await user.click(campo());
    await user.click(screen.getByRole("button", { name: "outro campo" }));
    await waitFor(() => expect(campo()).toHaveAttribute("type", "password"));
  });

  it("mostra as regras de senha conforme o usuário digita", async () => {
    const user = userEvent.setup();
    render(<Campo mostrarRegras />);
    expect(screen.queryByText("Um número")).not.toBeInTheDocument();

    await user.type(campo(), "abc");
    expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Um número")).toBeInTheDocument();
  });

  it("não revela quando desabilitado", async () => {
    const user = userEvent.setup();
    render(<Campo disabled />);
    await user.click(botao()).catch(() => {});
    expect(campo()).toHaveAttribute("type", "password");
  });
});
