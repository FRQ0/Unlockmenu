// InfinitePay: link de pagamento (Checkout Integrado) e cartão por aproximação no celular (InfiniteTap).
// Docs: infinitepay.io/checkout-documentacao e infinitepay.io/checkout-tap
const API = "https://api.checkout.infinitepay.io";

/** Deeplink do InfiniteTap (abre o app InfinitePay no celular já com o valor). Valor em centavos. */
export function deeplinkTap(o: {
  centavos: number;
  metodo: "debito" | "credito";
  parcelas: number;
  orderId: string;
  resultUrl: string;
  handle: string;
  ios: boolean;
}) {
  const q = new URLSearchParams({
    amount: String(Math.round(o.centavos)),
    payment_method: o.metodo === "debito" ? "debit" : "credit",
    ...(o.metodo === "credito" ? { installments: String(o.parcelas) } : {}),
    order_id: o.orderId,
    result_url: o.resultUrl,
    app_client_referrer: "UnlockMenu",
    handle: o.handle,
    ...(o.ios ? { af_force_deeplink: "true" } : {}),
  });
  return `infinitepaydash://infinitetap-app?${q.toString()}`;
}

export async function criarLink(o: { handle: string; orderNsu: string; centavos: number; descricao: string; redirectUrl: string; webhookUrl: string }) {
  const r = await fetch(`${API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: o.handle,
      order_nsu: o.orderNsu,
      items: [{ quantity: 1, price: Math.round(o.centavos), description: o.descricao.slice(0, 80) }],
      redirect_url: o.redirectUrl,
      webhook_url: o.webhookUrl,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as { url?: string; link?: string; checkout_url?: string; slug?: string; invoice_slug?: string };
  const url = j.url ?? j.link ?? j.checkout_url;
  if (!r.ok || !url) throw new Error(`InfinitePay recusou o link (${r.status})`);
  return { url, slug: j.slug ?? j.invoice_slug ?? null };
}

export type ConferenciaPagamento = { paid: boolean; amount: number; paid_amount: number; capture_method: string | null };

/** Confere na InfinitePay se o pagamento foi mesmo aprovado (o aviso deles não tem assinatura). */
export async function conferirPagamento(o: { handle: string; orderNsu: string; transactionNsu: string; slug: string }): Promise<ConferenciaPagamento> {
  const r = await fetch(`${API}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle: o.handle, order_nsu: o.orderNsu, transaction_nsu: o.transactionNsu, slug: o.slug }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean; paid?: boolean; amount?: number; paid_amount?: number; capture_method?: string };
  return { paid: r.ok && j.success === true && j.paid === true, amount: Number(j.amount ?? 0), paid_amount: Number(j.paid_amount ?? 0), capture_method: j.capture_method ?? null };
}
