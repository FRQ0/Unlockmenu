// PDF das placas de mesa (A6, uma por página): logo + nome do estabelecimento,
// QR code e texto de instrução. Sem a marca do SaaS (white-label).
import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { hexToRgb, COR_PADRAO } from "./color";

const MM = 72 / 25.4;

async function baixarLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  // só busca imagens do nosso Storage (evita SSRF)
  const sb = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!sb || !url.startsWith(`${new URL(sb).origin}/storage/v1/object/public/media/`)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    return await sharp(buf).resize(300, 300, { fit: "cover" }).png().toBuffer();
  } catch {
    return null;
  }
}

export async function gerarPlacas(opts: {
  nome: string;
  logoUrl: string | null;
  cor: string | null;
  mesas: { nome: string; url: string }[];
  formato?: "a4" | "a6";
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Placas de mesa - ${opts.nome}`);
  pdf.setProducer(opts.nome);
  pdf.setCreator(opts.nome);
  const fonte = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonteReg = await pdf.embedFont(StandardFonts.Helvetica);
  const [r, g, b] = hexToRgb(opts.cor ?? COR_PADRAO).map((v) => v / 255);
  const cor = rgb(r, g, b);
  const carvao = rgb(0x17 / 255, 0x18 / 255, 0x1c / 255);
  const logoPng = await baixarLogo(opts.logoUrl);
  const logo = logoPng ? await pdf.embedPng(logoPng) : null;

  // Cada placa: A6 (10,5 × 14,8 cm). Folha A4 com 4 placas (2 × 2) e linhas de corte.
  const W = 105 * MM;
  const H = 148 * MM;
  const A4W = 210 * MM;
  const A4H = 297 * MM;
  const centro = (txt: string, f: typeof fonte, size: number) => (W - f.widthOfTextAtSize(txt, size)) / 2;
  const qrs = await Promise.all(
    opts.mesas.map(async (m) => pdf.embedPng(await QRCode.toBuffer(m.url, { errorCorrectionLevel: "M", margin: 1, width: 600, color: { dark: "#17181C", light: "#FFFFFF" } }))),
  );

  type Pagina = ReturnType<typeof pdf.addPage>;
  function placa(page: Pagina, ox: number, oy: number, mesa: { nome: string }, qrImg: (typeof qrs)[number]) {
    page.drawRectangle({ x: ox, y: oy, width: W, height: H, color: rgb(0xf6 / 255, 0xf4 / 255, 0xef / 255) });
    page.drawRectangle({ x: ox, y: oy + H - 6 * MM, width: W, height: 6 * MM, color: cor });
    let y = oy + H - 14 * MM;
    if (logo) {
      const s = 20 * MM;
      page.drawImage(logo, { x: ox + (W - s) / 2, y: y - s, width: s, height: s });
      y -= s + 5 * MM;
    } else {
      y -= 4 * MM;
    }
    const nome = opts.nome.toUpperCase().slice(0, 32);
    page.drawText(nome, { x: ox + centro(nome, fonte, 12), y, size: 12, font: fonte, color: carvao });
    y -= 9 * MM;
    const q = 56 * MM;
    page.drawRectangle({ x: ox + (W - q) / 2 - 3 * MM, y: y - q - 3 * MM, width: q + 6 * MM, height: q + 6 * MM, color: rgb(1, 1, 1), borderColor: cor, borderWidth: 2 });
    page.drawImage(qrImg, { x: ox + (W - q) / 2, y: y - q, width: q, height: q });
    y -= q + 12 * MM;
    const m = mesa.nome.slice(0, 20);
    page.drawText(m, { x: ox + centro(m, fonte, 20), y, size: 20, font: fonte, color: carvao });
    y -= 9 * MM;
    for (const linha of ["Aproxime ou escaneie para chamar", "o garçom e ver o cardápio"]) {
      page.drawText(linha, { x: ox + centro(linha, fonteReg, 10), y, size: 10, font: fonteReg, color: rgb(0x5e / 255, 0x5c / 255, 0x57 / 255) });
      y -= 5 * MM;
    }
  }

  if (opts.formato === "a6") {
    opts.mesas.forEach((mesa, i) => placa(pdf.addPage([W, H]), 0, 0, mesa, qrs[i]));
  } else {
    const cinza = rgb(0.7, 0.7, 0.7);
    const mx = (A4W - 2 * W) / 2;
    const my = (A4H - 2 * H) / 2;
    for (let i = 0; i < opts.mesas.length; i += 4) {
      const page = pdf.addPage([A4W, A4H]);
      for (let k = 0; k < 4 && i + k < opts.mesas.length; k++) {
        const col = k % 2;
        const lin = Math.floor(k / 2);
        placa(page, mx + col * W, my + (1 - lin) * H, opts.mesas[i + k], qrs[i + k]);
      }
      // linhas de corte (tracejadas)
      const tr = { thickness: 0.5, color: cinza, dashArray: [4, 3] };
      page.drawLine({ start: { x: A4W / 2, y: 0 }, end: { x: A4W / 2, y: A4H }, ...tr });
      page.drawLine({ start: { x: 0, y: A4H / 2 }, end: { x: A4W, y: A4H / 2 }, ...tr });
      page.drawText("Recorte nas linhas tracejadas · imprimir em tamanho real (100%)", { x: 10 * MM, y: 2 * MM, size: 7, font: fonteReg, color: cinza });
    }
  }
  return pdf.save();
}
