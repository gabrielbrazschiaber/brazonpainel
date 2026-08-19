import { describe, it, expect } from "vitest";
import { statusWhatsApp, telefoneNacional } from "./whatsapp";

describe("whatsapp validation", () => {
  it("should identify valid mobile numbers with 9 prefix as 'ativo'", () => {
    expect(statusWhatsApp("11999999999")).toBe("ativo");
    expect(statusWhatsApp("(11) 99999-9999")).toBe("ativo");
    expect(statusWhatsApp("5511999999999")).toBe("ativo");
  });

  it("should identify landline numbers (10 digits) as 'incerto'", () => {
    expect(statusWhatsApp("1133334444")).toBe("incerto");
    expect(statusWhatsApp("(11) 3333-4444")).toBe("incerto");
  });

  it("should handle problematic cases reported by the user", () => {
    // Caso o número venha sem o 9 (antigo ou fixo com 8 dígitos + DDD)
    expect(statusWhatsApp("1188887777")).toBe("incerto");
    
    // Números com 11 dígitos mas que não começam com 9 no terceiro dígito (nacional[2])
    // No Brasil, todos os celulares começam com 9.
    expect(statusWhatsApp("11777777777")).toBe("invalido");
  });
});
