import { describe, expect, it } from "vitest";
import {
  AVISO_CNPJ_CIENTIFICO,
  AVISO_CNPJ_COMPLETADO,
  AVISO_CNPJ_DIGITO,
  AVISO_CNPJ_INVALIDO,
  explicacaoCnpj,
  formatarCnpj,
  normalizarCnpj,
} from "@/lib/leads-import";


describe("normalizarCnpj", () => {
  it("completa zeros à esquerda quando faltam dígitos", () => {
    const r = normalizarCnpj("231947000103");
    expect(r.cnpj).toBe("00231947000103");
    expect(r.completado).toBe(true);
    expect(r.aviso).toBe(AVISO_CNPJ_COMPLETADO);
  });

  it("mantém CNPJ de 14 dígitos válido sem aviso", () => {
    const r = normalizarCnpj("67958067000104");
    expect(r.cnpj).toBe("67958067000104");
    expect(r.aviso).toBeNull();
    expect(r.completado).toBe(false);
  });

  it("rejeita notação científica sem completar zeros", () => {
    const r = normalizarCnpj("2,31947E+11");
    expect(r.cnpj).toBeNull();
    expect(r.cientifico).toBe(true);
    expect(r.aviso).toBe(AVISO_CNPJ_CIENTIFICO);
  });

  it("limpa máscara e completa", () => {
    expect(normalizarCnpj("23.194.700/0103").cnpj).toBe("00231947000103");
  });

  it("grava CNPJ com dígito verificador inválido, com aviso", () => {
    const r = normalizarCnpj("67958067000100");
    expect(r.cnpj).toBe("67958067000100");
    expect(r.aviso).toBe(AVISO_CNPJ_DIGITO);
  });

  it("descarta valores com menos de 8 dígitos", () => {
    const r = normalizarCnpj("1234567");
    expect(r.cnpj).toBeNull();
    expect(r.aviso).toBe(AVISO_CNPJ_INVALIDO);
  });

  it("descarta valores com mais de 14 dígitos", () => {
    expect(normalizarCnpj("123456789012345").cnpj).toBeNull();
  });

  it("aceita vazio sem aviso", () => {
    expect(normalizarCnpj("")).toEqual({
      cnpj: null,
      aviso: null,
      cientifico: false,
      completado: false,
    });
  });
});

describe("normalizarCnpj — entradas traiçoeiras", () => {
  it("aceita separadores misturados (., / e -)", () => {
    expect(normalizarCnpj("67.958-067/0001.04").cnpj).toBe("67958067000104");
    expect(normalizarCnpj("67/958/067-0001-04").cnpj).toBe("67958067000104");
  });

  it("ignora espaços no início, no fim e no meio", () => {
    const r = normalizarCnpj("  67.958.067 / 0001-04  ");
    expect(r.cnpj).toBe("67958067000104");
    expect(r.aviso).toBeNull();
  });

  it("trata valor só com vírgula como dígitos, sem notação científica", () => {
    const r = normalizarCnpj("67958067,000104");
    expect(r.cientifico).toBe(false);
    expect(r.cnpj).toBe("67958067000104");
  });

  it("vírgula com poucos dígitos continua inválido", () => {
    const r = normalizarCnpj("2,31947");
    expect(r.cnpj).toBeNull();
    expect(r.cientifico).toBe(false);
    expect(r.aviso).toBe(AVISO_CNPJ_INVALIDO);
  });

  it("detecta notação científica com ponto e sem sinal de mais", () => {
    expect(normalizarCnpj("2.31947E11").cientifico).toBe(true);
    expect(normalizarCnpj("6,7958067e+13").cientifico).toBe(true);
  });

  it("só pontuação vira inválido", () => {
    expect(normalizarCnpj("./-").aviso).toBe(AVISO_CNPJ_INVALIDO);
  });

  it("é consistente entre chamadas repetidas (cliente e servidor)", () => {
    const entradas = ["23.194.700/0103", "  67958067000104 ", "2,31947E+11", "./-"];
    for (const e of entradas) {
      expect(normalizarCnpj(e)).toEqual(normalizarCnpj(normalizarCnpj(e).cnpj ?? e));
    }
  });
});

describe("formatarCnpj", () => {
  it("usa sempre a mesma máscara", () => {
    expect(formatarCnpj("67958067000104")).toBe("67.958.067/0001-04");
    expect(formatarCnpj("67.958-067/0001.04")).toBe("67.958.067/0001-04");
  });

  it("aplica a máscara progressivamente em valores parciais", () => {
    expect(formatarCnpj("6")).toBe("6");
    expect(formatarCnpj("679")).toBe("67.9");
    expect(formatarCnpj("6795806")).toBe("67.958.06");
    expect(formatarCnpj("679580670001")).toBe("67.958.067/0001");
  });

  it("descarta excesso de dígitos e devolve vazio para nulo", () => {
    expect(formatarCnpj("679580670001040000")).toBe("67.958.067/0001-04");
    expect(formatarCnpj(null)).toBe("");
  });
});

describe("explicacaoCnpj", () => {
  it("explica cada regra aplicada", () => {
    expect(explicacaoCnpj(normalizarCnpj("2,31947E+11"))).toContain("notação científica");
    expect(explicacaoCnpj(normalizarCnpj("231947000103"))).toContain("zeros à esquerda");
    expect(explicacaoCnpj(normalizarCnpj("67958067000100"))).toContain("módulo 11");
    expect(explicacaoCnpj(normalizarCnpj("1234567"))).toContain("menos de 8");
    expect(explicacaoCnpj(normalizarCnpj("67958067000104"))).toBeNull();
  });
});
