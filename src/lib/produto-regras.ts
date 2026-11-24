// Regras de plano para produtos, conferidas no servidor ANTES de gravar
// (o banco confere de novo por gatilho: defesa em profundidade).
import { requireFeature, type TenantPlano } from "./plans";

export function conferirPlanoProduto(
  tenant: TenantPlano,
  body: { video_url?: string | null; combina_com?: string[] },
) {
  requireFeature(tenant, "cardapio_foto");
  if (body.video_url) requireFeature(tenant, "reels");
  if (body.combina_com && body.combina_com.length > 0) requireFeature(tenant, "combina_com");
}
