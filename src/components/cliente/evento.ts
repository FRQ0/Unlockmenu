export function enviarEvento(slug: string, token: string | null, tipo: string, productId?: string) {
  try {
    const body = JSON.stringify({ slug, token, tipo, product_id: productId ?? null });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/public/evento", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/public/evento", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}
