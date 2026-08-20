import { describe, it, expect } from "vitest";
import { calcularVersao, COMMITS_IGNORADOS, ARQUIVOS_IGNORADOS, filtrarItensCliente } from "./changelog";

describe("Changelog Logic", () => {
  describe("calcularVersao", () => {
    it("incrementa patch para commits comuns", () => {
      const commits = [{ sha: "1", mensagem: "fix: erro no login", autor: "dev" }];
      expect(calcularVersao("1.0.0", commits)).toBe("1.0.1");
    });

    it("incrementa minor para novas features", () => {
      const commits = [{ sha: "1", mensagem: "feat: novo dashboard", autor: "dev" }];
      expect(calcularVersao("1.0.0", commits)).toBe("1.1.0");
    });

    it("incrementa major para breaking changes", () => {
      const commits = [{ sha: "1", mensagem: "feat!: mudança radical", autor: "dev" }];
      expect(calcularVersao("1.0.0", commits)).toBe("2.0.0");
      
      const commits2 = [{ sha: "2", mensagem: "fix: ajuste\n\nBREAKING CHANGE: mudou tudo", autor: "dev" }];
      expect(calcularVersao("1.0.0", commits2)).toBe("2.0.0");
    });
  });

  describe("Filtros", () => {
    it("ignora commits de manutenção", () => {
      expect(COMMITS_IGNORADOS.test("chore: update deps")).toBe(true);
      expect(COMMITS_IGNORADOS.test("ci: fix workflow")).toBe(true);
      expect(COMMITS_IGNORADOS.test("feat: ok")).toBe(false);
    });

    it("filtra termos proibidos para clientes", () => {
      const itens = [
        { tipo: "novidade", texto: "Novo boleto disponível" },
        { tipo: "melhoria", texto: "Ajuste no admin de leads" }
      ];
      const { filtrados, descartados } = filtrarItensCliente(itens as any);
      expect(filtrados).toHaveLength(1);
      expect(descartados).toContain("Ajuste no admin de leads");
    });
  });
});
