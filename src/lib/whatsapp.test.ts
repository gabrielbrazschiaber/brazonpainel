import { describe, expect, it } from "vitest";

import { mapaWhatsApp, statusWhatsApp, telefoneNacional, temWhatsApp } from "@/lib/whatsapp";

describe("statusWhatsApp", () => {
  it("celular com DDD é ativo", () => {
    expect(statusWhatsApp("(11) 99999-9999")).toBe("ativo");
    expect(statusWhatsApp("5511999999999")).toBe("ativo");
    expect(temWhatsApp("11999999999")).toBe(true);
  });

  it("fixo fica incerto", () => {
    expect(statusWhatsApp("(11) 3333-4444")).toBe("incerto");
    expect(temWhatsApp("1133334444")).toBe(false);
  });

  it("incompleto ou vazio é inválido", () => {
    expect(statusWhatsApp("")).toBe("invalido");
    expect(statusWhatsApp(null)).toBe("invalido");
    expect(statusWhatsApp("119999")).toBe("invalido");
  });

  it("normaliza o prefixo 55", () => {
    expect(telefoneNacional("+55 (11) 99999-9999")).toBe("11999999999");
  });

  it("mapeia coleções carregadas", () => {
    const mapa = mapaWhatsApp([
      { id: "a", telefone: "11999999999" },
      { id: "b", telefone: "1133334444" },
      { id: "c", telefone: null },
    ]);
    expect(mapa.get("a")).toBe("ativo");
    expect(mapa.get("b")).toBe("incerto");
    expect(mapa.get("c")).toBe("invalido");
  });
});
