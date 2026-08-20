import { describe, it, expect } from "vitest";
import { Commit, calcularVersao, COMMITS_IGNORADOS, ARQUIVOS_IGNORADOS } from "./changelog";

describe("changelog.ts", () => {
  describe("calcularVersao", () => {
    it("deve incrementar major em BREAKING CHANGE", () => {
      const commits: Commit[] = [{ sha: "1", mensagem: "feat!: algo novo", autor: "a" }];
      expect(calcularVersao("1.8.3", commits)).toBe("2.0.0");
      
      const commitsBody: Commit[] = [{ sha: "2", mensagem: "fix: algo\n\nBREAKING CHANGE: quebra tudo", autor: "a" }];
      expect(calcularVersao("1.8.3", commitsBody)).toBe("2.0.0");
    });

    it("deve incrementar minor em feat", () => {
      const commits: Commit[] = [{ sha: "1", mensagem: "feat: nova funcionalidade", autor: "a" }];
      expect(calcularVersao("1.8.3", commits)).toBe("1.9.0");
    });

    it("deve incrementar patch em fix ou outros", () => {
      const commits: Commit[] = [{ sha: "1", mensagem: "fix: erro bobo", autor: "a" }];
      expect(calcularVersao("1.8.3", commits)).toBe("1.8.4");
    });

    it("deve retornar a mesma versão se lista for vazia", () => {
      expect(calcularVersao("1.0.0", [])).toBe("1.0.0");
    });
  });

  describe("filtros", () => {
    it("deve filtrar commits de ruído", () => {
      expect(COMMITS_IGNORADOS.test("chore: update deps")).toBe(true);
      expect(COMMITS_IGNORADOS.test("ci: fix pipeline")).toBe(true);
      expect(COMMITS_IGNORADOS.test("docs: update readme")).toBe(true);
      expect(COMMITS_IGNORADOS.test("feat: cool feature")).toBe(false);
      expect(COMMITS_IGNORADOS.test("fix: some bug")).toBe(false);
    });
  });
});
