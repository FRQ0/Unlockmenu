// Baixa o PDF das placas (todas as mesas ou as escolhidas em ?ids=a,b,c).
import { HttpError } from "@/lib/http";
import { staffRoute } from "@/lib/route";
import { PODE_GERIR } from "@/lib/staff";
import { uuid } from "@/lib/schemas";
import { gerarPlacas } from "@/lib/placas";
import { urlMesa } from "@/lib/urls";
import { tenantHas } from "@/lib/plans";

export const runtime = "nodejs";

export const GET = staffRoute(PODE_GERIR, async ({ supabase, tenant }, req) => {
  const sp = new URL(req.url).searchParams;
  const idsParam = sp.get("ids");
  const formato = sp.get("formato") === "a6" ? "a6" : "a4";
  const ids = idsParam ? idsParam.split(",").slice(0, 200).map((i) => uuid.parse(i)) : null;
  let q = supabase.from("tables").select("nome,token_publico").eq("tenant_id", tenant.id).eq("arquivada", false).eq("ativa", true).order("ordem").order("nome");
  if (ids) q = q.in("id", ids);
  const { data: mesas } = await q;
  if (!mesas?.length) throw new HttpError(404, "Nenhuma mesa.");
  const pdf = await gerarPlacas({
    nome: tenant.nome,
    logoUrl: tenant.logo_url,
    cor: tenantHas(tenant, "cores") ? tenant.cor_primaria : null,
    mesas: mesas.map((m) => ({ nome: m.nome, url: urlMesa(tenant, m.token_publico) })),
    formato,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="placas-${tenant.slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
