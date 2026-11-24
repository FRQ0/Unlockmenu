// Site de vendas do SaaS (unlockmenu.com.br). Único lugar público com a marca Unlock Menu.
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { BellRing, Clock, Eye, Hand, Receipt, Smartphone, Sparkles, UtensilsCrossed, Video, Wifi, MessageCircle, Footprints, QrCode as QrIcon } from "lucide-react";
import { LogoMarca } from "@/components/ui/Marca";
import { MockupMesa } from "@/components/vendas/MockupMesa";
import { DemoPainel } from "@/components/vendas/DemoPainel";
import { adminClient } from "@/lib/supabase/admin";
import { urlMesa } from "@/lib/urls";
import type { TenantPlano } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Unlock Menu · Seu cliente chama. Seu garçom vê. Seu prato se vende sozinho.",
  description: "Chamar garçom pelo celular, cardápio com Reels dos pratos e painel em tempo real para restaurantes, bares, padarias, pizzarias, sorveterias e lanchonetes.",
  icons: { icon: "/brand/icon.svg", apple: "/brand/apple-touch-icon.png" },
  openGraph: { title: "Unlock Menu", description: "Seu cliente chama. Seu garçom vê. Seu prato se vende sozinho.", images: ["/brand/icon-512.png"] },
};

// dinâmica: a CSP com nonce exige renderização por requisição
export const dynamic = "force-dynamic";

const WHATS = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS ?? "";
const wa = (msg: string) => `https://wa.me/${WHATS}?text=${encodeURIComponent(msg)}`;

async function mesaDemo(): Promise<string | null> {
  const slug = process.env.NEXT_PUBLIC_DEMO_SLUG;
  if (!slug || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const db = adminClient();
    const { data: t } = await db.from("tenants").select("id,slug,plano,status,trial_ends_at,dominio_custom").eq("slug", slug).maybeSingle();
    if (!t) return null;
    const { data: m } = await db.from("tables").select("token_publico").eq("tenant_id", t.id).eq("ativa", true).order("ordem").limit(1).maybeSingle();
    return m ? urlMesa(t as TenantPlano & { slug: string; dominio_custom: string | null }, m.token_publico) : null;
  } catch {
    return null;
  }
}

const DORES = [
  { icone: Hand, titulo: "Mão levantada, ninguém vê", texto: "O cliente se irrita, consome menos e sai com avaliação ruim." },
  { icone: Footprints, titulo: "Garçom rodando à toa", texto: "Ou esquecendo as mesas do fundo bem no horário de pico." },
  { icone: UtensilsCrossed, titulo: "Cardápio impresso velho", texto: "Preço antigo, prato que acabou e foto feia (ou nenhuma)." },
  { icone: Video, titulo: "Foto e vídeo vendem", texto: "O cliente pede o que parece gostoso. Prato em vídeo puxa os itens mais caros." },
  { icone: Receipt, titulo: "Conta que demora", texto: "A mesa demora a girar e o faturamento do pico vai embora." },
  { icone: Eye, titulo: "Dono no escuro", texto: "Sem saber o que vende mais, qual o horário forte ou quem atende mais rápido." },
];

const FAQ = [
  { p: "Precisa de internet?", r: "Sim, o celular do cliente usa a internet dele (4G) ou o Wi-Fi da casa. O sistema foi feito para funcionar bem até em Android simples com sinal fraco, e tem modo foto para quando a internet está ruim." },
  { p: "O cliente precisa baixar app?", r: "Não. Ele aproxima o celular da placa ou lê o QR code e já cai na página da mesa. Sem cadastro e sem login." },
  { p: "Quanto tempo para instalar?", r: "Em geral, um dia: cadastramos seu cardápio, imprimimos as placas e a equipe já usa o painel no próprio celular." },
  { p: "E se eu não tiver vídeo dos pratos?", r: "A gente cria. Os vídeos são gerados a partir da foto do prato, e o plano Completo já inclui 5 vídeos. Sem vídeo, o cardápio funciona com foto normalmente." },
  { p: "Aparece a marca de vocês para o meu cliente?", r: "Não. O cliente vê só o seu logo, o seu nome e as suas cores." },
];

export default async function Vendas() {
  const demo = await mesaDemo();
  const qr = demo ? await QRCode.toDataURL(demo, { margin: 1, width: 360, color: { dark: "#17181C", light: "#FFFFFF" } }) : null;

  return (
    <div className="bg-papel">
      <header className="sticky top-0 z-30 border-b border-pedra/70 bg-papel/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <LogoMarca size={30} />
          <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold text-grafite md:flex">
            <a href="#como">Como funciona</a>
            <a href="#demo">Demo ao vivo</a>
            <a href="#faq">Perguntas</a>
            <Link href="/login">Entrar</Link>
          </nav>
          <a href={wa("Olá! Quero ver o Unlock Menu no meu restaurante.")} className="btn-escuro ml-4 md:ml-6">Agendar demonstração</a>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="selo bg-areia/25 text-areia-escura">Para restaurantes, bares e padarias</p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight md:text-7xl">
              Seu cliente chama.<br />Seu garçom vê.<br /><em className="text-areia-escura">Seu prato se vende sozinho.</em>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-grafite">
              Uma placa na mesa com QR code e NFC. O cliente chama o garçom, pede a conta e vê cada prato em vídeo, no estilo Reels. Sua equipe recebe tudo na hora, no celular.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={wa("Olá! Quero ver o Unlock Menu no meu restaurante.")} className="btn-primario px-6 py-3.5 text-base">
                <MessageCircle className="h-5 w-5" /> Quero ver no meu restaurante
              </a>
              <a href="#demo" className="btn-secundario px-6 py-3.5 text-base">Testar agora</a>
            </div>
          </div>
          <div className="relative flex justify-center">
            <MockupMesa nome="Seu Restaurante" cor="#C8A574" className="relative z-10 rotate-[-4deg]" />
            <MockupMesa nome="Pizzaria Forno" cor="#B65A52" className="absolute right-0 top-10 hidden scale-90 rotate-[6deg] opacity-90 lg:block" />
          </div>
        </section>

        {/* dores */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="max-w-2xl font-serif text-4xl md:text-5xl">O que o salão perde todo dia sem perceber</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DORES.map((d) => (
                <div key={d.titulo} className="rounded-[18px] border border-pedra p-6">
                  <d.icone className="h-6 w-6 text-areia-escura" />
                  <h3 className="mt-4 font-bold">{d.titulo}</h3>
                  <p className="mt-1 text-sm text-grafite">{d.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* como funciona */}
        <section id="como" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <h2 className="font-serif text-4xl md:text-5xl">Como funciona</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icone: QrIcon, t: "Placa na mesa", d: "QR code + NFC com o seu logo. O cliente aproxima o celular e pronto." },
              { icone: Smartphone, t: "Cliente chama ou vê os Reels", d: "Chamar garçom, pedir a conta e ver cada prato em vídeo vertical." },
              { icone: BellRing, t: "Garçom atende", d: "Som, vibração e cronômetro no celular da equipe. Atraso vira alerta para o gerente." },
            ].map((s, i) => (
              <li key={s.t} className="card p-6">
                <span className="font-serif text-5xl text-areia">{i + 1}</span>
                <s.icone className="mt-3 h-6 w-6" />
                <h3 className="mt-3 text-lg font-bold">{s.t}</h3>
                <p className="mt-1 text-sm text-grafite">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* demo ao vivo */}
        <section id="demo" className="scroll-mt-20 bg-carvao py-20 text-papel">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-4xl md:text-5xl">Teste agora, no seu celular</h2>
              <p className="mt-4 text-papel/75">Aponte a câmera para o QR code, toque em “Chamar garçom” e veja o chamado aparecer aqui do lado, em tempo real.</p>
              {qr && demo ? (
                <div className="mt-6 flex items-center gap-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR code da mesa demo" className="h-40 w-40 rounded-2xl bg-white p-2" />
                  <a href={demo} target="_blank" rel="noopener noreferrer" className="btn-primario">Abrir mesa demo</a>
                </div>
              ) : (
                <p className="mt-6 text-sm text-papel/60">A mesa demo aparece aqui quando o estabelecimento demo estiver configurado.</p>
              )}
            </div>
            <DemoPainel />
          </div>
        </section>

        {/* para quem é */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="font-serif text-4xl md:text-5xl">Para quem é</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {["Restaurante", "Padaria", "Sorveteria", "Bar", "Pizzaria", "Lanchonete"].map((x) => (
              <span key={x} className="rounded-full bg-white px-5 py-2.5 text-base font-semibold shadow-suave">{x}</span>
            ))}
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icone: Sparkles, t: "Com a sua cara", d: "Seu logo, suas cores e seu domínio. Seu cliente não vê a nossa marca." },
              { icone: Clock, t: "Tempo de atendimento medido", d: "Saiba quanto cada mesa esperou e qual garçom atende mais rápido." },
              { icone: Wifi, t: "Leve de verdade", d: "Funciona em celular simples com 4G fraco. Sem app para baixar." },
            ].map((b) => (
              <div key={b.t} className="rounded-[18px] border border-pedra bg-white p-6">
                <b.icone className="h-6 w-6 text-areia-escura" />
                <h3 className="mt-3 font-bold">{b.t}</h3>
                <p className="mt-1 text-sm text-grafite">{b.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* planos: apresentados pessoalmente */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="font-serif text-4xl md:text-5xl">Três planos, do básico ao completo</h2>
            <p className="mt-4 text-grafite">A gente apresenta os planos pessoalmente, com o sistema rodando no seu salão. Teste grátis por 7 dias.</p>
            <a href={wa("Olá! Quero agendar uma demonstração do Unlock Menu.")} className="btn-escuro mt-8 px-6 py-3.5 text-base">Agende uma demonstração</a>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20">
          <h2 className="font-serif text-4xl md:text-5xl">Perguntas frequentes</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.p} className="card group p-5">
                <summary className="cursor-pointer list-none font-bold">{f.p}</summary>
                <p className="mt-2 text-grafite">{f.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="rounded-[28px] bg-areia p-10 text-center md:p-16">
            <h2 className="font-serif text-4xl text-carvao md:text-6xl">Bora destravar o seu salão?</h2>
            <a href={wa("Olá! Quero o Unlock Menu no meu estabelecimento.")} className="btn-escuro mt-8 px-6 py-3.5 text-base">Falar no WhatsApp</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-pedra py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-sm text-grafite">
          <LogoMarca size={24} />
          <span className="ml-auto">© {new Date().getFullYear()} Unlock</span>
        </div>
      </footer>

      <a href={wa("Olá! Vim pelo site do Unlock Menu.")} aria-label="WhatsApp" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-estado-verde text-white shadow-2xl">
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
