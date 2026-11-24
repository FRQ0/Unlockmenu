"use client";
export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || "Algo deu errado. Tente de novo.");
  return j as T;
}

export type TipoMidia = "foto" | "video" | "logo" | "capa";

/** Upload em 3 passos: pede URL assinada → envia o arquivo → servidor valida e re-encoda. */
export async function enviarMidia(file: File, tipo: TipoMidia): Promise<{ url: string; poster_url?: string }> {
  const mime = file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "");
  const { caminho, url } = await api<{ caminho: string; url: string }>("/api/app/midia/upload-url", "POST", { tipo, mime, tamanho: file.size });
  const fd = new FormData();
  fd.append("cacheControl", "60");
  fd.append("", file);
  const up = await fetch(url, { method: "PUT", body: fd });
  if (!up.ok) throw new Error("Falha no envio do arquivo.");
  return api("/api/app/midia/processar", "POST", { tipo, caminho });
}
