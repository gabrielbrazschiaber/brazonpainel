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
