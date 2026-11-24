// Cores do estabelecimento (white-label) e contraste automático do texto.
export const COR_PADRAO = "#C8A574"; // Areia

export function hexToRgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? COR_PADRAO.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lum([r, g, b]: [number, number, number]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a: string, b: string) {
  const la = lum(hexToRgb(a));
  const lb = lum(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Branco ou carvão: o que der mais contraste sobre a cor de fundo. */
export function corTexto(fundo: string): "#FFFFFF" | "#17181C" {
  return contraste(fundo, "#FFFFFF") >= contraste(fundo, "#17181C") ? "#FFFFFF" : "#17181C";
}

/** Variáveis CSS do tema do cliente final. */
export function temaVars(primaria?: string | null, secundaria?: string | null): Record<string, string> {
  const p = primaria && /^#[0-9a-f]{6}$/i.test(primaria) ? primaria : COR_PADRAO;
  const s = secundaria && /^#[0-9a-f]{6}$/i.test(secundaria) ? secundaria : "#17181C";
  return {
    "--cor-primaria": hexToRgb(p).join(" "),
    "--cor-primaria-texto": hexToRgb(corTexto(p)).join(" "),
    "--cor-secundaria": hexToRgb(s).join(" "),
  };
}
