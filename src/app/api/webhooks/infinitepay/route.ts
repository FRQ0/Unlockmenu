// Aviso da InfinitePay (pagamento aprovado). O aviso não tem assinatura, então:
// 1) exige o token secreto da cobrança na URL; 2) confere o pagamento direto na API da InfinitePay.
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { json, readJson } from "@/lib/http";
import { adminClient } from "@/lib/supabase/admin";
import { conferirPagamento } from "@/lib/infinitepay";
import { clientIp, hashIp, rateLimit } from "@/lib/security";

const corpo = z
  .object({
    invoice_slug: z.string().max(120),
    transaction_nsu: z.string().max(120),
    order_nsu: z.string().max(120),
    capture_method: z.string().max(40).optional(),
    paid_amount: z.number().optional(),
    amount: z.number().optional(),
    receipt_url: z.string().max(500).optional(),
  })
  .passthrough();

function igual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`webhook-ip:${hashIp(await clientIp())}`, 120, 60))) return json({ error: "limite" }, 429);
    const u = new URL(req.url);
    const id = u.searchParams.get("c") ?? "";
    const token = u.searchParams.get("t") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{32}$/.test(token)) return json({ error: "inválido" }, 400);

    const db = adminClient();
    const { data: c } = await db.from("cobrancas").select("id,status,valor,token,tenant_id,tenants(infinitepay_handle)").eq("id", id).maybeSingle();
    if (!c || !igual(c.token, token)) return json({ error: "inválido" }, 400);
    if (c.status !== "pendente") return json({ ok: true }); // já processado

    const b = corpo.parse(await readJson(req, 32 * 1024));
    if (b.order_nsu !== id) return json({ error: "inválido" }, 400);
    const handle = (c.tenants as unknown as { infinitepay_handle: string | null } | null)?.infinitepay_handle;
    if (!handle) return json({ error: "inválido" }, 400);

    const conf = await conferirPagamento({ handle, orderNsu: id, transactionNsu: b.transaction_nsu, slug: b.invoice_slug });
    const centavos = Math.round(Number(c.valor) * 100);
    if (!conf.paid || conf.amount < centavos) return json({ error: "não pago" }, 400);

    const metodo = (conf.capture_method ?? b.capture_method) === "pix" ? "pix" : "credito";
    await db.rpc("confirmar_cobranca", {
      p_id: id, p_metodo: metodo, p_transaction_nsu: b.transaction_nsu, p_aut: null, p_slug: b.invoice_slug, p_receipt: b.receipt_url ?? null,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("[webhook infinitepay]", e instanceof Error ? e.message : e);
    return json({ error: "erro" }, 400);
  }
}
