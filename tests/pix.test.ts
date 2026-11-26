import { describe, expect, it } from "vitest";
import { crc16, pixCopiaECola } from "@/lib/pix";

describe("Pix copia e cola (BR Code)", () => {
  it("CRC16-CCITT confere com o vetor padrão", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("monta o payload com valor, nome, cidade e CRC válido", () => {
    const p = pixCopiaECola({ chave: "34998841800", nome: "Espetaria do Fabinho", cidade: "Frutal", valor: 42, txid: "MESA03" });
    expect(p.startsWith("000201")).toBe(true);
    expect(p).toContain("br.gov.bcb.pix");
    expect(p).toContain("540542.00");
    expect(p).toContain("ESPETARIA DO FABINHO");
    expect(p).toContain("6006FRUTAL");
    expect(p).toContain("0506MESA03");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
  it("remove acentos do nome", () => {
    expect(pixCopiaECola({ chave: "a@b.com", nome: "Casa de Terê", cidade: "São Paulo", valor: 1 })).toContain("CASA DE TERE");
  });
});
