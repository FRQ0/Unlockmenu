// Passo 1 do upload: o servidor confere papel, plano, tipo e tamanho e devolve
// uma URL assinada (válida por pouco tempo) para enviar o arquivo bruto.
import { json, readJson } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { midiaPedirUpload } from "@/lib/schemas";
import { PODE_GERIR } from "@/lib/staff";
import { requireFeature } from "@/lib/plans";
import { FEATURE_POR_TIPO, urlDeUpload, validarPedidoUpload } from "@/lib/media";
import { requireRateLimit } from "@/lib/security";

export const POST = staffRoute(PODE_GERIR, async ({ tenant }, req) => {
  const body = midiaPedirUpload.parse(await readJson(req));
  requireFeature(tenant, FEATURE_POR_TIPO[body.tipo]);
  validarPedidoUpload(body.tipo, body.mime, body.tamanho);
  await requireRateLimit(`upload:${tenant.id}`, 60, 3600);
  return json(await urlDeUpload(tenant.id, body.tipo, body.mime));
});
