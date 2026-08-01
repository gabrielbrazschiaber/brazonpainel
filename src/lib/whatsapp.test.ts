import { describe, expect, it } from "vitest";

import {
  mapaWhatsApp,
  mensagemTooltipWhatsApp,
  statusWhatsApp,
  telefoneNacional,
  temWhatsApp,
} from "@/lib/whatsapp";

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

  describe("mensagemTooltipWhatsApp", () => {
    it("indica celular válido com WhatsApp ativo", () => {
      const msg = mensagemTooltipWhatsApp("(11) 99999-9999");
      expect(msg).toContain("celular válido");
      expect(msg).toContain("WhatsApp ativo");
      expect(msg).toContain("11 9 9999-9999");
    });

    it("indica telefone fixo com WhatsApp não confirmado", () => {
      const msg = mensagemTooltipWhatsApp("1133334444");
      expect(msg).toContain("telefone fixo");
      expect(msg).toContain("não confirmado");
      expect(msg).toContain("11 3333-4444");
    });

    it("indica número ausente quando não informado", () => {
      expect(mensagemTooltipWhatsApp(null)).toBe("Telefone não informado — WhatsApp ausente");
      expect(mensagemTooltipWhatsApp("")).toBe("Telefone não informado — WhatsApp ausente");
    });

    it("indica número incompleto como WhatsApp ausente", () => {
      const msg = mensagemTooltipWhatsApp("119999");
      expect(msg).toContain("incompleto ou inválido");
      expect(msg).toContain("WhatsApp ausente");
    });
  });
});
