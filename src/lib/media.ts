// Upload restrito: tipo, tamanho e conteúdo conferidos no servidor.
// Toda mídia é RE-ENCODADA (imagem → webp sem metadados; vídeo → mp4 720p 9:16),
// o que neutraliza arquivo disfarçado e reduz o peso para celular com 4G fraco.
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { adminClient } from "./supabase/admin";
import { HttpError } from "./http";

export type TipoMidia = "foto" | "video" | "logo" | "capa";

export const REGRAS: Record<TipoMidia, { mimes: string[]; maxBytes: number }> = {
  foto: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 10 * 1024 * 1024 },
  logo: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 5 * 1024 * 1024 },
  capa: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 10 * 1024 * 1024 },
  video: { mimes: ["video/mp4", "video/quicktime"], maxBytes: 50 * 1024 * 1024 },
};

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function validarPedidoUpload(tipo: TipoMidia, mime: string, tamanho: number) {
  const r = REGRAS[tipo];
  if (!r.mimes.includes(mime)) throw new HttpError(415, "Formato de arquivo não aceito.");
  if (tamanho > r.maxBytes) throw new HttpError(413, `Arquivo grande demais (máx. ${Math.round(r.maxBytes / 1048576)} MB).`);
}

export async function urlDeUpload(tenantId: string, tipo: TipoMidia, mime: string) {
  const caminho = `${tenantId}/${tipo}-${randomUUID()}.${EXT[mime]}`;
  const { data, error } = await adminClient().storage.from("uploads").createSignedUploadUrl(caminho);
  if (error || !data) throw new HttpError(500, "Não foi possível preparar o envio.");
  return { caminho, url: data.signedUrl };
}

/** Confere os primeiros bytes do arquivo (não confia na extensão nem no Content-Type). */
export function tipoReal(buf: Buffer): "jpeg" | "png" | "webp" | "mp4" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") return "mp4";
  return null;
}

export function caminhoValido(tenantId: string, caminho: string, tipo: TipoMidia) {
  const re = new RegExp(`^${tenantId}/${tipo}-[0-9a-f-]{36}\\.(jpg|png|webp|mp4|mov)$`);
  return re.test(caminho);
}

function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("ffmpeg-static") as string;
  } catch {
    return "ffmpeg";
  }
}

function rodar(args: string[], timeoutMs = 50_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr = (stderr + d.toString()).slice(-20_000);
    });
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

export function duracaoDoLog(stderr: string): number | null {
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

async function publicar(tenantId: string, ext: "webp" | "mp4", corpo: Buffer, contentType: string) {
  const caminho = `${tenantId}/${randomUUID()}.${ext}`;
  const db = adminClient();
  const { error } = await db.storage.from("media").upload(caminho, corpo, { contentType, cacheControl: "31536000", upsert: false });
  if (error) throw new HttpError(500, "Falha ao salvar o arquivo.");
  return db.storage.from("media").getPublicUrl(caminho).data.publicUrl;
}

export async function processarImagem(tenantId: string, buf: Buffer, tipo: TipoMidia) {
  const real = tipoReal(buf);
  if (!real || real === "mp4") throw new HttpError(415, "O arquivo não é uma imagem válida.");
  const lado = tipo === "capa" ? 1600 : tipo === "logo" ? 512 : 1080;
  const out = await sharp(buf, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(lado, lado, { fit: tipo === "capa" ? "inside" : "cover", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer(); // sharp não copia EXIF/GPS por padrão
  return { url: await publicar(tenantId, "webp", out, "image/webp") };
}

export async function processarVideo(tenantId: string, buf: Buffer) {
  if (tipoReal(buf) !== "mp4") throw new HttpError(415, "O arquivo não é um vídeo MP4/MOV válido.");
  const dir = await mkdtemp(path.join(tmpdir(), "um-"));
  try {
    const entrada = path.join(dir, "in");
    const saida = path.join(dir, "out.mp4");
    const poster = path.join(dir, "poster.jpg");
    await writeFile(entrada, buf);

    const probe = await rodar(["-hide_banner", "-i", entrada], 15_000);
    const dur = duracaoDoLog(probe.stderr);
    if (dur === null) throw new HttpError(415, "Não foi possível ler o vídeo.");
    if (dur < 3 || dur > 20) throw new HttpError(400, "O vídeo precisa ter entre 5 e 15 segundos.");

    for (const crf of [28, 32]) {
      const r = await rodar([
        "-y", "-hide_banner", "-i", entrada, "-t", "15",
        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf), "-maxrate", "1400k", "-bufsize", "2800k",
        "-profile:v", "main", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "64k", "-ac", "1",
        "-movflags", "+faststart", "-map_metadata", "-1",
        saida,
      ]);
      if (r.code !== 0) throw new HttpError(500, "Falha ao comprimir o vídeo.");
      if ((await stat(saida)).size <= 3.2 * 1024 * 1024) break;
    }

    await rodar(["-y", "-hide_banner", "-ss", "0.5", "-i", saida, "-frames:v", "1", "-q:v", "3", poster], 15_000);
    const posterWebp = await sharp(await readFile(poster)).webp({ quality: 75 }).toBuffer();

    const [videoUrl, posterUrl] = await Promise.all([
      publicar(tenantId, "mp4", await readFile(saida), "video/mp4"),
      publicar(tenantId, "webp", posterWebp, "image/webp"),
    ]);
    return { url: videoUrl, poster_url: posterUrl };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function baixarUpload(caminho: string, maxBytes: number): Promise<Buffer> {
  const db = adminClient();
  const { data, error } = await db.storage.from("uploads").download(caminho);
  if (error || !data) throw new HttpError(404, "Arquivo não encontrado. Envie de novo.");
  if (data.size > maxBytes) throw new HttpError(413, "Arquivo grande demais.");
  const buf = Buffer.from(await data.arrayBuffer());
  await db.storage.from("uploads").remove([caminho]);
  return buf;
}

import type { Feature } from "./plans";
/** Recurso do plano exigido por tipo de mídia. */
export const FEATURE_POR_TIPO: Record<TipoMidia, Feature> = { foto: "cardapio_foto", video: "reels", logo: "logo", capa: "cores" };
