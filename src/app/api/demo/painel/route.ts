// Painel de garçom DEMO do site de vendas: só lê o estabelecimento demo, só o necessário.
import { handle, json } from "@/lib/http";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp, hashIp, rateLimit } from "@/lib/security";

export const GET = handle(async () => {
  const slug = process.env.NEXT_PUBLIC_DEMO_SLUG;
  if (!slug) return json({ chamados: [] });
  if (!(await rateLimit(`demo:${hashIp(await clientIp())}`, 120, 300))) return json({ chamados: [] });
  const db = adminClient();
  const { data: t } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!t) return json({ chamados: [] });
  const { data } = await db
    .from("calls")
    .select("id,tipo,status,criado_em,tables(nome)")
    .eq("tenant_id", t.id)
    .in("status", ["aberto", "a_caminho"])
    .order("criado_em")
    .limit(12);
  return json({
    chamados: (data ?? []).map((c) => ({
      id: c.id,
      tipo: c.tipo,
      status: c.status,
      criado_em: c.criado_em,
      mesa: (c.tables as unknown as { nome: string } | null)?.nome ?? "Mesa",
    })),
  });
});
