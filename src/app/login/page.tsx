import type { Metadata } from "next";
import { headers } from "next/headers";
import { LoginForm } from "./LoginForm";
import { LogoMarca } from "@/components/ui/Marca";

export const metadata: Metadata = {
  title: "Entrar · Unlock Menu",
  robots: { index: false },
  icons: { icon: "/brand/icon.svg", apple: "/brand/apple-touch-icon.png" },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><LogoMarca size={36} /></div>
        <LoginForm nonce={nonce} next={next} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />
        <p className="mt-6 text-center text-xs text-grafite">Acesso restrito à equipe dos estabelecimentos.</p>
      </div>
    </main>
  );
}
