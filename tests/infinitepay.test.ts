import { describe, expect, it } from "vitest";
import { deeplinkTap } from "@/lib/infinitepay";

describe("InfiniteTap deeplink", () => {
  it("monta o link com valor em centavos e crédito parcelado", () => {
    const u = new URL(deeplinkTap({ centavos: 4200, metodo: "credito", parcelas: 3, orderId: "abc", resultUrl: "https://x.app/app/pagamento/retorno", handle: "loja", ios: false }));
    expect(u.protocol).toBe("infinitepaydash:");
    expect(u.searchParams.get("amount")).toBe("4200");
    expect(u.searchParams.get("payment_method")).toBe("credit");
    expect(u.searchParams.get("installments")).toBe("3");
    expect(u.searchParams.get("order_id")).toBe("abc");
    expect(u.searchParams.get("result_url")).toBe("https://x.app/app/pagamento/retorno");
    expect(u.searchParams.get("af_force_deeplink")).toBeNull();
  });
  it("débito não manda parcelas e iPhone força o deeplink", () => {
    const u = new URL(deeplinkTap({ centavos: 100, metodo: "debito", parcelas: 1, orderId: "x", resultUrl: "https://x", handle: "l", ios: true }));
    expect(u.searchParams.get("payment_method")).toBe("debit");
    expect(u.searchParams.get("installments")).toBeNull();
    expect(u.searchParams.get("af_force_deeplink")).toBe("true");
  });
});
