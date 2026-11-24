// Middleware: força HTTPS, aplica CSP/headers, renova a sessão do Supabase
// (cookies httpOnly) e resolve domínio próprio/subdomínio do estabelecimento.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildCsp, SECURITY_HEADERS } from "@/lib/csp";

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase();
const cacheDominio = new Map<string, { slug: string | null; ate: number }>();

function hostPrincipal(host: string) {
  return (
    !ROOT ||
    host === ROOT ||
    host === `www.${ROOT}` ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".vercel.app")
  );
}

async function slugDoHost(host: string): Promise<string | null> {
  if (ROOT && host.endsWith(`.${ROOT}`)) {
    const sub = host.slice(0, -(ROOT.length + 1));
    return /^[a-z0-9-]{3,40}$/.test(sub) ? sub : null;
  }
  const c = cacheDominio.get(host);
  if (c && c.ate > Date.now()) return c.slug;
  let slug: string | null = null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/slug_por_dominio`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_host: host }),
    });
    if (r.ok) slug = ((await r.json()) as string | null) ?? null;
  } catch {
    slug = null;
  }
  cacheDominio.set(host, { slug, ate: Date.now() + 5 * 60_000 });
  return slug;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];

  // HTTPS obrigatório em produção
  const local = host === "localhost" || host === "127.0.0.1";
  if (process.env.NODE_ENV === "production" && !local && req.headers.get("x-forwarded-proto") === "http") {
    return NextResponse.redirect(`https://${req.headers.get("host")}${url.pathname}${url.search}`, 308);
  }

  // domínio próprio / subdomínio → reescreve para /{slug}/...
  let rewrite: URL | null = null;
  if (!hostPrincipal(host) && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/_next")) {
    const slug = await slugDoHost(host);
    if (!slug) return new NextResponse("Not found", { status: 404 });
    if (!url.pathname.startsWith(`/${slug}`)) {
      rewrite = url.clone();
      rewrite.pathname = url.pathname === "/" ? `/${slug}` : `/${slug}${url.pathname}`;
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, undefined, !local);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", csp);

  let res = rewrite
    ? NextResponse.rewrite(rewrite, { request: { headers: reqHeaders } })
    : NextResponse.next({ request: { headers: reqHeaders } });

  // renova a sessão só onde existe login (painéis, admin, APIs internas)
  const precisaSessao = /^\/(app|admin-master|login|api\/app|api\/admin|api\/auth)/.test(url.pathname);
  if (precisaSessao && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = rewrite
            ? NextResponse.rewrite(rewrite, { request: { headers: reqHeaders } })
            : NextResponse.next({ request: { headers: reqHeaders } });
          list.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" }),
          );
        },
      },
    });
    // só renova o token se venceu; quem autoriza de verdade é o getUser() nas páginas/rotas
    await supabase.auth.getSession();
  }

  res.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  if (/^\/(app|admin-master|login|api)/.test(url.pathname)) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|demo-media/|sw.js|manifest.webmanifest).*)"],
};
