import { describe, expect, it } from "vitest";
import { contraste, corTexto, temaVars } from "@/lib/color";

describe("contraste automático do botão (white-label)", () => {
  it("texto escuro na areia, branco no vermelho e no verde", () => {
    expect(corTexto("#C8A574")).toBe("#17181C");
    expect(corTexto("#B65A52")).toBe("#FFFFFF");
    expect(corTexto("#3F7A5F")).toBe("#FFFFFF");
    expect(corTexto("#FFE600")).toBe("#17181C");
  });
  it("o texto escolhido sempre tem contraste ≥ 3:1 (texto grande e negrito)", () => {
    for (let i = 0; i < 200; i++) {
      const hex = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
      expect(contraste(hex, corTexto(hex))).toBeGreaterThanOrEqual(3);
    }
  });
  it("cor inválida cai no padrão areia", () => {
    expect(temaVars("vermelho")["--cor-primaria"]).toBe("200 165 116");
  });
});
