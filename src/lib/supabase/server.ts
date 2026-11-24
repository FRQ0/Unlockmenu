// Cliente do usuário logado (anon key + sessão em cookie). O RLS se aplica.
// Cookies httpOnly + secure + SameSite=Lax: o JavaScript da página não lê o refresh token.
import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "../env";

export const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export async function serverClient() {
  const store = await cookies();
  return createServerClient(serverEnv.supabaseUrl, serverEnv.anonKey, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, ...COOKIE_OPTIONS }));
        } catch {
          // chamado de um Server Component: o middleware renova os cookies
        }
      },
    },
  });
}
