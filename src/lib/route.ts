// Atalho para rotas da equipe: autentica no servidor, confere papel, bloqueia CSRF
// e trata erros sem vazar detalhes.
import "server-only";
import { assertSameOrigin, handle } from "./http";
import { requireStaff, type StaffCtx } from "./staff";
import type { Papel } from "./types";

type Params = Record<string, string>;

export function staffRoute<P extends Params = Params>(
  papeis: Papel[] | undefined,
  fn: (ctx: StaffCtx, req: Request, params: P) => Promise<Response>,
) {
  return handle<{ params: Promise<P> }>(async (req, { params }) => {
    if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
    const ctx = await requireStaff(papeis);
    return fn(ctx, req, await params);
  });
}
