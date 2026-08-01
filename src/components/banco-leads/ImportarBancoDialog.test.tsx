import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErroLimite } from "@/components/ErroLimite";
import { ImportarBancoDialog } from "@/components/banco-leads/ImportarBancoDialog";
import type { ArquivoLido } from "@/lib/leads-import";

/**
 * Planilha real problemática: uma coluna SEM cabeçalho e outra com cabeçalho
 * desconhecido — as duas caem em "Ignorar coluna". Antes do sentinela, o
 * mapeamento gerava <SelectItem value=""> e o Radix derrubava a tela.
 */
const ARQUIVO: ArquivoLido = {
  nome: "mailing.csv",
  temCabecalho: true,
  cabecalhos: ["CNPJ", "", "TELEFONE", "coluna sem uso", "CIDADE", "UF"],
  matriz: [
    ["231947000103", "lixo", "(11) 98765-4321", "x", "São Paulo", "SP"],
    ["2,31947E+11", "", "11 3333-4444", "", "Santos", "SP"],
    ["11222333000181", "", "999", "", "", ""],
  ],
};

vi.mock("@/lib/leads-import", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/leads-import")>();
  return { ...original, lerArquivo: vi.fn(async () => ARQUIVO) };
});

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(async () => ({ lote_id: "l1", importados: 0, ignorados: 0 })),
}));

vi.mock("@/lib/banco-leads.functions", () => ({
  criarLoteBanco: vi.fn(),
  importarBlocoBanco: vi.fn(),
  finalizarLoteBanco: vi.fn(),
}));

/** Radix precisa dessas APIs, ausentes no jsdom. */
function prepararJsdom() {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
}

async function abrirComArquivo() {
  prepararJsdom();
  const user = userEvent.setup();
  render(
    <ImportarBancoDialog
      aberto
      onOpenChange={() => {}}
      // Segmentos e CNAEs sujos: vazios, espaços e duplicados vindos do banco.
      segmentos={["Alimentação", "", "   ", "Alimentação"]}
      cnaes={[
        { codigo: "4721102", descricao: "Padaria", segmento_sugerido: "Alimentação", ativo: true },
        { codigo: "", descricao: "Sem código", segmento_sugerido: "", ativo: true },
        { codigo: "4721102", descricao: "Duplicado", segmento_sugerido: "", ativo: true },
      ] as never}
      horasReservaPadrao={24}
      onConcluido={() => {}}
    />,
  );

  const input = screen.getByLabelText("Arquivo") as HTMLInputElement;
  await user.upload(input, new File(["a"], "mailing.csv", { type: "text/csv" }));
  await waitFor(() => expect(screen.getByText("mailing.csv")).toBeInTheDocument());
  return user;
}

describe("ImportarBancoDialog — sentinela dos selects", () => {
  it("não gera nenhum item de select com value vazio e não trava a tela", async () => {
    await abrirComArquivo();

    // A tela do limite de erro NÃO aparece.
    expect(screen.queryByText(/Não foi possível carregar esta parte da tela/i)).toBeNull();

    const itens = document.querySelectorAll("[data-radix-select-item], [role='option']");
    itens.forEach((item) => {
      const valor = item.getAttribute("data-value") ?? "";
      expect(valor.trim()).not.toBe("");
    });
  });

  it("mostra 'Ignorar coluna' para colunas sem cabeçalho e opções todas com value", async () => {
    const user = await abrirComArquivo();

    const gatilhos = screen.getAllByRole("combobox");
    // Os selects de mapeamento vêm depois dos de origem/reserva; usamos o do CNPJ.
    const mapeamentos = gatilhos.filter((g) => g.textContent?.includes("Ignorar coluna"));
    expect(mapeamentos.length).toBeGreaterThan(0);

    await user.click(mapeamentos[0]);
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(1));
    // Todo item renderizado tem rótulo e valor: nenhum item vazio no menu.
    screen.getAllByRole("option").forEach((o) => {
      expect((o.textContent ?? "").trim()).not.toBe("");
    });
    expect(screen.getByRole("option", { name: "Ignorar coluna" })).toBeInTheDocument();
  });

  it("mostra os avisos por linha na prévia e permite filtrar só os problemas", async () => {
    const user = await abrirComArquivo();

    expect(screen.getByText("Prévia da importação")).toBeInTheDocument();
    // CNPJ em notação científica aparece como aviso da linha.
    expect(screen.getAllByText(/CNPJ corrompido pelo Excel/i).length).toBeGreaterThan(0);

    const filtro = screen.getByRole("button", { name: /Só linhas com aviso ou erro/i });
    await user.click(filtro);
    expect(screen.getByRole("button", { name: /Mostrar todas as linhas/i })).toBeInTheDocument();
  });
});

describe("ErroLimite — mensagem do erro de Select.Item", () => {
  it("explica a causa e como corrigir o mapeamento", () => {
    const Quebra = () => {
      throw new Error(
        "A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.",
      );
    };
    const erroConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErroLimite area="Banco de Leads">
        <Quebra />
      </ErroLimite>,
    );
    expect(screen.getByText(/Ignorar coluna/)).toBeInTheDocument();
    erroConsole.mockRestore();
  });
});
