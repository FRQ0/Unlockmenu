// Erros e respostas de API. Nunca devolvemos stack, SQL ou detalhes internos ao cliente.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Traduz erros do Postgres/Supabase em mensagens seguras. */
export function fromDbError(err: { message?: string; code?: string } | null | undefined): HttpError {
  const msg = err?.message ?? "";
  if (msg.includes("recurso_indisponivel_no_plano")) return new HttpError(403, "Recurso não disponível no seu plano.");
  if (msg.includes("limite_de_mesas_do_plano")) return new HttpError(403, "Seu plano chegou ao limite de mesas.");
  if (msg.includes("combina_com_invalido")) return new HttpError(400, "Sugestão inválida.");
  if (msg.includes("muitos_chamados")) return new HttpError(429, "Muitos chamados seguidos. Aguarde um pouco.");
  if (msg.includes("mesa_nao_encontrada")) return new HttpError(404, "Mesa não encontrada.");
  if (msg.includes("estabelecimento_inativo")) return new HttpError(403, "Atendimento indisponível no momento.");
  if (msg.includes("transicao_invalida")) return new HttpError(409, "Já foi atualizado por outra pessoa. Atualize a tela.");
  if (msg.includes("item_invalido")) return new HttpError(400, "Algum item está esgotado ou não existe mais.");
  if (msg.includes("pedido_invalido")) return new HttpError(400, "Pedido inválido.");
  if (msg.includes("pagamento_insuficiente")) return new HttpError(400, "O valor pago não cobre o total.");
  if (msg.includes("pagamento_maior_que_total")) return new HttpError(400, "O valor passa do total. Para troco, use dinheiro.");
  if (msg.includes("pagamento_invalido")) return new HttpError(400, "Pagamento inválido.");
  if (msg.includes("conta_nao_paga")) return new HttpError(409, "Falta receber o pagamento antes de fechar a conta.");
  if (msg.includes("mesa_sem_conta")) return new HttpError(404, "Esta mesa não tem conta aberta.");
  if (msg.includes("venda_nao_encontrada")) return new HttpError(404, "Venda não encontrada ou já cancelada.");
  if (msg.includes("pagamento_nao_encontrado")) return new HttpError(404, "Pagamento não encontrado.");
  if (msg.includes("cobranca_nao_paga")) return new HttpError(409, "O pagamento na InfinitePay ainda não foi confirmado.");
  if (msg.includes("cobranca_invalida")) return new HttpError(400, "Cobrança inválida (valor mínimo R$ 1,00; débito sem parcelas).");
  if (msg.includes("pedido_ja_fechado")) return new HttpError(409, "Esta conta já foi fechada.");
  if (err?.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied"))
    return new HttpError(403, "Sem permissão.");
  if (err?.code === "23505") return new HttpError(409, "Já existe um registro com esses dados.");
  return new HttpError(500, "Erro interno. Tente novamente.");
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Envolve um route handler: valida, captura erros e responde sem vazar detalhes. */
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof ZodError) return json({ error: "Dados inválidos." }, 400);
      console.error("[api]", e instanceof Error ? e.message : e);
      return json({ error: "Erro interno. Tente novamente." }, 500);
    }
  };
}

/** Lê JSON com limite de tamanho (evita payload gigante). */
export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "Requisição grande demais.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Requisição grande demais.");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}

/** Bloqueia POST/PATCH/DELETE vindos de outro site (CSRF), além do SameSite dos cookies. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // navegadores modernos sempre mandam em fetch cross-site
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Origem não permitida.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Origem não permitida.");
  }
}
