import { describe, expect, it } from "vitest";
import { ADMIN_NAV_ITEMS, SECOES_CONFIG_META, abasInternas } from "@/lib/admin-nav";

describe("navegação do admin", () => {
  it("não mostra Auditoria no menu lateral", () => {
    const rotulos = ADMIN_NAV_ITEMS.map((i) => i.label);
    expect(rotulos).not.toContain("Auditoria");
    expect(ADMIN_NAV_ITEMS.some((i) => i.value === "auditoria")).toBe(false);
  });

  it("mostra Auditoria apenas como seção de Configurações", () => {
    const auditoria = SECOES_CONFIG_META.find((s) => s.value === "auditoria");
    expect(auditoria).toBeDefined();
    expect(auditoria?.label).toBe("Auditoria");
    expect(auditoria?.permissao).toBe("auditoria.ler");
    // Configurações continua sendo o único ponto de entrada.
    expect(ADMIN_NAV_ITEMS.some((i) => i.value === "config")).toBe(true);
  });

  it("restringe Auditoria ao papel admin", () => {
    const auditoria = SECOES_CONFIG_META.find((s) => s.value === "auditoria");
    expect(auditoria?.roles).toEqual(["admin"]);
    expect(auditoria?.roles).not.toContain("vendedor");
    expect(auditoria?.roles).not.toContain("cliente");
  });

  it("as demais seções não restringem papel além da permissão", () => {
    for (const secao of SECOES_CONFIG_META.filter((s) => !s.roles?.length)) {
      expect(secao.roles).toBeUndefined();
    }
  });

  it("não duplica nenhuma seção de configurações no menu lateral", () => {
    const navValues = new Set(ADMIN_NAV_ITEMS.map((i) => i.value));
    for (const secao of SECOES_CONFIG_META) {
      expect(navValues.has(secao.value)).toBe(false);
    }
  });
});

describe("abasInternas", () => {
  it("exclui itens que apontam para outra rota", () => {
    const valores = abasInternas().map((i) => i.value);
    expect(valores).not.toContain("tarefas");
    expect(valores).toEqual(["dashboard", "clientes", "novidades", "config"]);
  });

  it("mantém itens sem rota e ignora somente os com `to`", () => {
    const items = [
      { value: "a", label: "A", icon: ADMIN_NAV_ITEMS[0].icon },
      { value: "b", label: "B", icon: ADMIN_NAV_ITEMS[0].icon, to: "/b" },
    ];
    expect(abasInternas(items).map((i) => i.value)).toEqual(["a"]);
  });

  it("todo item com rota tem caminho absoluto", () => {
    for (const item of ADMIN_NAV_ITEMS) {
      if (item.to) expect(item.to.startsWith("/")).toBe(true);
    }
  });
});
