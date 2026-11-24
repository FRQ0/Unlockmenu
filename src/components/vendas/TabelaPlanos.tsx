"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { LogoMarca } from "@/components/ui/Marca";
import { PLANO_NOME, PRECOS, type Plano } from "@/lib/plans";

// Cores da arte de referência
const LARANJA = "#E8A33C";

type Item = { texto: string; inclui: boolean };
const ITENS: Record<Plano, Item[]> = {
  essencial: [
    { texto: "Chamar garçom e pedir a conta", inclui: true },
    { texto: "QR/NFC em até 10 mesas", inclui: true },
    { texto: "Cardápio digital com fotos", inclui: true },
    { texto: "Painel do garçom (lista simples)", inclui: true },
    { texto: "Logo e cores do seu restaurante", inclui: false },
    { texto: "Reels dos pratos (vídeo estilo TikTok)", inclui: false },
    { texto: "Painel do dono", inclui: false },
    { texto: "“Combina com”: sugestões que aumentam o ticket", inclui: false },
    { texto: "Pedido pelo celular direto na cozinha", inclui: false },
    { texto: "Pedido de avaliação no Google", inclui: false },
    { texto: "Alerta quando uma mesa espera 5 min", inclui: false },
    { texto: "Site do restaurante com domínio próprio", inclui: false },
    { texto: "5 vídeos de pratos inclusos", inclui: false },
    { texto: "Suporte por e-mail", inclui: true },
  ],
  profissional: [
    { texto: "Chamar garçom e pedir a conta", inclui: true },
    { texto: "QR/NFC em até 25 mesas", inclui: true },
    { texto: "Cardápio digital com fotos", inclui: true },
    { texto: "Painel do garçom com grade e som", inclui: true },
    { texto: "Logo e cores do seu restaurante", inclui: true },
    { texto: "Reels dos pratos (vídeo estilo TikTok)", inclui: true },
    { texto: "Painel do dono básico", inclui: true },
    { texto: "“Combina com”: sugestões que aumentam o ticket", inclui: false },
    { texto: "Pedido pelo celular direto na cozinha", inclui: false },
    { texto: "Pedido de avaliação no Google", inclui: false },
    { texto: "Alerta quando uma mesa espera 5 min", inclui: false },
    { texto: "Site do restaurante com domínio próprio", inclui: false },
    { texto: "5 vídeos de pratos inclusos", inclui: false },
    { texto: "Suporte por WhatsApp", inclui: true },
  ],
  completo: [
    { texto: "Chamar garçom e pedir a conta", inclui: true },
    { texto: "QR/NFC em mesas ilimitadas", inclui: true },
    { texto: "Cardápio digital com fotos", inclui: true },
    { texto: "Painel do garçom com setores e notificação", inclui: true },
    { texto: "Logo e cores do seu restaurante", inclui: true },
    { texto: "Reels dos pratos (vídeo estilo TikTok)", inclui: true },
    { texto: "Painel do dono completo: vendas, pico e ranking de garçons", inclui: true },
    { texto: "“Combina com”: sugestões que aumentam o ticket", inclui: true },
    { texto: "Pedido pelo celular direto na cozinha", inclui: true },
    { texto: "Pedido de avaliação no Google", inclui: true },
    { texto: "Alerta quando uma mesa espera 5 min", inclui: true },
    { texto: "Site do restaurante com domínio próprio", inclui: true },
    { texto: "5 vídeos de pratos inclusos", inclui: true },
    { texto: "Suporte prioritário e cardápio atualizado por nós", inclui: true },
  ],
};

const INFO: Record<Plano, { sub: string; nota: string }> = {
  essencial: { sub: "O básico para tirar o cardápio do papel", nota: "Sem vídeos e sem números do negócio" },
  profissional: { sub: "Pratos em vídeo e painel do dono básico", nota: "Por mais R$ 50 você leva tudo do Completo" },
  completo: { sub: "Resolve o salão, a cozinha e as vendas", nota: "Tudo incluso. Só R$ 50 a mais que o Profissional" },
};

export function TabelaPlanos({ restaurante, implantacao, inicial, whatsapp }: { restaurante: string | null; implantacao: string | null; inicial: Plano; whatsapp: string }) {
  const [sel, setSel] = useState<Plano>(inicial);
  const msg = `Olá! Quero começar os 7 dias grátis do plano ${PLANO_NOME[sel]} (R$ ${PRECOS[sel]}/mês)${restaurante ? ` para o ${restaurante}` : ""}.`;

  return (
    <div className="min-h-dvh bg-[#F5F4EF] pb-10">
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-6">
          <LogoMarca size={30} />
          {restaurante && (
            <p className="text-right text-sm text-grafite">
              Apresentação para <strong className="font-bold text-carvao">{restaurante}</strong>
            </p>
          )}
        </header>

        <section className="mt-6 text-center">
          <span className="inline-block rounded-full bg-[#FDECCD] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#8A5D16]">
            7 dias grátis · sem fidelidade
          </span>
          <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.05] tracking-tight sm:text-6xl">Escolha o plano do seu restaurante</h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-grafite">
            Teste por uma semana. Se não fizer sentido para o seu negócio, você não paga nada.
          </p>
        </section>

        <section className="mt-10 grid items-start gap-5 md:grid-cols-3">
          {(["essencial", "profissional", "completo"] as const).map((p) => {
            const escuro = sel === p;
            return (
              <div key={p} className="relative">
                {p === "completo" && (
                  <span
                    className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.12em] text-carvao"
                    style={{ background: LARANJA }}
                  >
                    Recomendado
                  </span>
                )}
                <article
                  className={`rounded-[24px] p-6 transition ${escuro ? "bg-carvao text-papel md:-mt-2" : "border border-[#E9E5DD] bg-white text-carvao"}`}
                  style={escuro ? { boxShadow: `6px 6px 0 0 ${LARANJA}` } : undefined}
                >
                  <h2 className="text-xl font-extrabold">{PLANO_NOME[p]}</h2>
                  <p className={`mt-1 text-sm ${escuro ? "text-papel/65" : "text-grafite"}`}>{INFO[p].sub}</p>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-sm font-bold">R$</span>
                    <span className="text-5xl font-extrabold tracking-tight">{PRECOS[p]}</span>
                    <span className={`text-sm ${escuro ? "text-papel/60" : "text-grafite"}`}>/mês</span>
                  </p>
                  <p className="mt-4 text-[13px] font-bold" style={{ color: escuro ? LARANJA : "#8A5D16" }}>{INFO[p].nota}</p>
                  <button
                    onClick={() => setSel(p)}
                    aria-pressed={escuro}
                    className={`mt-4 w-full rounded-2xl py-3 text-[15px] font-bold transition active:scale-[.98] ${escuro ? "text-carvao" : "border-[1.5px] border-carvao bg-white text-carvao hover:bg-papel"}`}
                    style={escuro ? { background: LARANJA } : undefined}
                  >
                    {escuro ? "Selecionado" : `Escolher ${PLANO_NOME[p]}`}
                  </button>
                  <ul className="mt-6 space-y-3">
                    {ITENS[p].map((it) => (
                      <li key={it.texto} className="flex gap-2.5 text-[13.5px] leading-snug">
                        {it.inclui ? (
                          <Check className="mt-px h-4 w-4 shrink-0" style={{ color: escuro ? LARANJA : "#3F7A5F" }} strokeWidth={2.5} aria-label="Incluso" />
                        ) : (
                          <X className={`mt-px h-4 w-4 shrink-0 ${escuro ? "text-papel/35" : "text-[#B4B4B4]"}`} aria-label="Não incluso" />
                        )}
                        <span className={it.inclui ? "" : `line-through ${escuro ? "text-papel/40" : "text-[#A1A29D]"}`}>{it.texto}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            );
          })}
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { rot: "Extra", tit: "Pacote de vídeos · 5 pratos", txt: "Você manda as fotos, a gente entrega os Reels prontos.", valor: "R$ 200" },
            { rot: "Implantação", tit: "Placas, QR/NFC e cadastro", txt: "Instalamos tudo no salão e cadastramos seu cardápio.", valor: implantacao ?? "Sob consulta" },
            { rot: "Garantia", tit: "1ª semana por nossa conta", txt: "Use com seus clientes de verdade. Não gostou, não paga.", valor: null },
          ].map((c) => (
            <div key={c.rot} className="rounded-[18px] border border-[#E9E5DD] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-grafite">{c.rot}</p>
              <p className="mt-2 text-lg font-extrabold leading-snug">{c.tit}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-grafite">
                {c.txt} {c.valor && <strong className="font-bold text-carvao">{c.valor}</strong>}
              </p>
            </div>
          ))}
        </section>

        <div className="sticky bottom-4 z-20 mt-8 flex items-center justify-between gap-4 rounded-[20px] bg-carvao px-5 py-4 text-papel shadow-2xl">
          <div className="min-w-0">
            <p className="text-xs text-papel/60">Plano selecionado</p>
            <p className="truncate text-base font-extrabold sm:text-lg">{PLANO_NOME[sel]} · R$ {PRECOS[sel]}/mês</p>
          </div>
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-2xl px-5 py-3 text-sm font-extrabold text-carvao transition active:scale-[.98] sm:text-[15px]"
            style={{ background: LARANJA }}
          >
            Começar 7 dias grátis
          </a>
        </div>
      </div>
    </div>
  );
}
