// Passo 2 do upload: confere o conteúdo real do arquivo, re-encoda e publica.
import { HttpError, json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { midiaProcessar } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { baixarUpload, caminhoValido, FEATURE_POR_TIPO, processarImagem, processarVideo, REGRAS } from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = staffRoute(PODE_GERIR, async ({ tenant }, req) => {
  const body = midiaProcessar.parse(await readJson(req));
  requireFeature(tenant, FEATURE_POR_TIPO[body.tipo]);
  if (!caminhoValido(tenant.id, body.caminho, body.tipo)) throw new HttpError(400, "Arquivo inválido.");
  const buf = await baixarUpload(body.caminho, REGRAS[body.tipo].maxBytes);
  if (body.tipo === "video") return json(await processarVideo(tenant.id, buf));
  return json(await processarImagem(tenant.id, buf, body.tipo));
});
