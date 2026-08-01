import { describe, expect, it } from "vitest";
import { algumSegredoConfere, segredoConfere } from "./token-compare.server";

describe("comparação segura de segredos", () => {
  it("aceita o segredo correto", () => {
    expect(segredoConfere("tok-123", "tok-123")).toBe(true);
  });

  it("rejeita segredo diferente, vazio ou prefixo", () => {
    expect(segredoConfere("tok-124", "tok-123")).toBe(false);
    expect(segredoConfere("", "tok-123")).toBe(false);
    expect(segredoConfere("tok-123", "")).toBe(false);
    expect(segredoConfere("tok", "tok-123")).toBe(false);
  });

  it("aceita quando bate com qualquer segredo da lista", () => {
    expect(algumSegredoConfere("b", ["a", "b"])).toBe(true);
    expect(algumSegredoConfere("c", ["a", "b"])).toBe(false);
    expect(algumSegredoConfere("a", [])).toBe(false);
  });
});
