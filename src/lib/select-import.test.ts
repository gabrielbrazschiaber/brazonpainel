import { describe, expect, it } from "vitest";
import {
  IGNORAR_COLUNA,
  SEM_RESERVA,
  explicacaoErroSelect,
  opcoesSelectSeguras,
  valorDoSelect,
  valorSelect,
  valorSelectValido,
} from "@/lib/select-import";

describe("valorSelectValido", () => {
  it("rejeita vazio, espaços e não-string", () => {
    expect(valorSelectValido("")).toBe(false);
    expect(valorSelectValido("   ")).toBe(false);
    expect(valorSelectValido(null)).toBe(false);
    expect(valorSelectValido(undefined)).toBe(false);
    expect(valorSelectValido(0)).toBe(false);
    expect(valorSelectValido("cnpj")).toBe(true);
  });
});

describe("sentinelas", () => {
  it("nunca são vazios", () => {
    expect(valorSelectValido(SEM_RESERVA)).toBe(true);
    expect(valorSelectValido(IGNORAR_COLUNA)).toBe(true);
  });

  it("convertem vazio em sentinela e voltam", () => {
    expect(valorSelect("", IGNORAR_COLUNA)).toBe(IGNORAR_COLUNA);
    expect(valorSelect(undefined, IGNORAR_COLUNA)).toBe(IGNORAR_COLUNA);
    expect(valorSelect("telefone", IGNORAR_COLUNA)).toBe("telefone");
    expect(valorDoSelect(IGNORAR_COLUNA, IGNORAR_COLUNA)).toBe("");
    expect(valorDoSelect("telefone", IGNORAR_COLUNA)).toBe("telefone");
    expect(valorDoSelect("", IGNORAR_COLUNA)).toBe("");
  });
});

describe("opcoesSelectSeguras", () => {
  it("descarta vazios, espaços, duplicados e sentinelas", () => {
    const opcoes = opcoesSelectSeguras([
      "Alimentação",
      "",
      "   ",
      "Alimentação",
      SEM_RESERVA,
      IGNORAR_COLUNA,
      null,
      undefined,
      " Varejo ",
    ]);
    expect(opcoes.map((o) => o.value)).toEqual(["Alimentação", "Varejo"]);
    expect(opcoes.every((o) => o.value.trim() !== "")).toBe(true);
  });

  it("aceita objetos e usa o value como rótulo de reserva", () => {
    const opcoes = opcoesSelectSeguras([
      { value: "4721102", label: "Padaria" },
      { value: "  ", label: "Sem código" },
      { value: "4721102", label: "Duplicado" },
      { value: "5611203", label: "" },
    ]);
    expect(opcoes).toEqual([
      { value: "4721102", label: "Padaria" },
      { value: "5611203", label: "5611203" },
    ]);
  });
});

describe("explicacaoErroSelect", () => {
  it("explica o erro do Radix e orienta o mapeamento", () => {
    const texto = explicacaoErroSelect(
      new Error(
        "A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.",
      ),
    );
    expect(texto).toContain("sem valor");
    expect(texto).toContain("Ignorar coluna");
  });

  it("devolve null para outros erros", () => {
    expect(explicacaoErroSelect(new Error("Falha de rede"))).toBeNull();
    expect(explicacaoErroSelect(null)).toBeNull();
  });
});
