import { describe, expect, it } from "vitest";
import { opcoesUnicas, ordenarPtBr, resumoEscopo, SEM_RESTRICAO } from "@/lib/escopo";

describe("opcoesUnicas", () => {
  it("remove vazios e duplicados preservando a ordem", () => {
    expect(opcoesUnicas([" Comércio ", "", null, "Comércio", "Saúde"])).toEqual([
      "Comércio",
      "Saúde",
    ]);
  });
});

describe("ordenarPtBr", () => {
  it("ordena com acentos", () => {
    expect(ordenarPtBr(["Saúde", "Alimentação", "Comércio"])).toEqual([
      "Alimentação",
      "Comércio",
      "Saúde",
    ]);
  });
});

describe("resumoEscopo", () => {
  it("listas vazias significam sem restrição", () => {
    expect(resumoEscopo({ segmentos: [], estados: [], cnaes: [] })).toBe(SEM_RESTRICAO);
    expect(resumoEscopo({})).toBe(SEM_RESTRICAO);
  });

  it("resume as três dimensões", () => {
    expect(
      resumoEscopo({ segmentos: ["Comércio"], estados: ["SP", "RJ"], cnaes: ["4711302"] }),
    ).toBe("Comércio · SP/RJ · 1 CNAE");
  });

  it("abrevia listas longas", () => {
    expect(resumoEscopo({ segmentos: ["A", "B", "C", "D"], estados: [], cnaes: [] })).toBe(
      "A, B +2",
    );
  });
});
