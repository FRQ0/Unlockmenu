// Página de vendas dos planos: cada plano tem o próprio botão, que abre a conversa
// no WhatsApp de vendas já com o plano escrito. Sem estado no navegador: funciona até sem JavaScript.
import { Check, ChevronDown, MessageCircle, X } from "lucide-react";
import { LogoMarca } from "@/components/ui/Marca";
import { PLANO_NOME, PRECOS, type Plano } from "@/lib/plans";

const LARANJA = "#E8A33C";
const MARROM = "#8A5D16";

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

const FAQ = [
  { p: "Como funciona o teste grátis?", r: "Instalamos as placas e cadastramos seu cardápio. Você usa 7 dias com seus clientes de verdade. Se não fizer sentido, não paga nada e não tem multa." },
  { p: "Tem fidelidade ou contrato longo?", r: "Não. O pagamento é mensal e você pode cancelar quando quiser." },
  { p: "Meu cliente precisa baixar aplicativo?", r: "Não. Ele aproxima o celular da placa ou lê o QR code e já usa. Sem cadastro." },
  { p: "Posso trocar de plano depois?", r: "Pode. Você sobe ou desce de plano a qualquer momento, e a mudança vale na hora." },
  { p: "E se eu não tiver vídeo dos pratos?", r: "A gente cria a partir das fotos. O Completo já inclui 5 vídeos, e nos outros planos existe o pacote extra." },
];

function linkWhats(numero: string, texto: string) {
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}

function Botao({ href, escuro, children }: { href: string | null; escuro?: boolean; children: React.ReactNode }) {
  const cls = `flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold transition active:scale-[.98] ${
    escuro ? "text-carvao hover:brightness-105" : "border-[1.5px] border-carvao bg-white text-carvao hover:bg-papel"
  }`;
  const style = escuro ? { background: LARANJA } : undefined;
  if (!href) return <span className={`${cls} cursor-not-allowed opacity-60`} style={style}>WhatsApp não configurado</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
      {children}
    </a>
  );
}

export function PaginaPlanos({ restaurante, implantacao, whatsapp }: { restaurante: string | null; implantacao: string | null; whatsapp: string }) {
  const para = restaurante ? ` Restaurante: ${restaurante}.` : "";
  const msgPlano = (p: Plano) => `Olá! Quero testar 7 dias grátis o plano ${PLANO_NOME[p]} (R$ ${PRECOS[p]}/mês) do Unlock Menu.${para}`;
  const ordem: Plano[] = ["essencial", "profissional", "completo"];

  return (
    <div className="min-h-dvh bg-[#F5F4EF] text-carvao">
      <header className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5 sm:px-6">
        <span className="whitespace-nowrap"><LogoMarca size={28} /></span>
        {restaurante && (
          <p className="text-sm text-grafite">
            Apresentação para <strong className="font-bold text-carvao">{restaurante}</strong>
          </p>
        )}
      </header>

      <main className="mx-auto max-w-[1040px] px-4 pb-16 sm:px-6">
        <section className="pt-6 text-center sm:pt-10">
          <span className="inline-block rounded-full bg-[#FDECCD] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] sm:text-xs" style={{ color: MARROM }}>
            7 dias grátis · sem fidelidade
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[2.5rem] leading-[1.05] tracking-tight sm:text-6xl">Escolha o plano do seu restaurante</h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-grafite sm:text-base">
            Teste por uma semana. Se não fizer sentido para o seu negócio, você não paga nada.
          </p>
        </section>

        {/* No celular o Completo (recomendado) vem primeiro */}
        <section className="mt-12 grid items-start gap-6 md:mt-14 md:grid-cols-3 md:gap-5">
          {ordem.map((p) => {
            const destaque = p === "completo";
            return (
              <article
                key={p}
                className={`relative rounded-[24px] p-6 ${destaque ? "order-first bg-carvao text-papel md:order-none md:-mt-3" : "border border-[#E9E5DD] bg-white"}`}
                style={destaque ? { boxShadow: `6px 6px 0 0 ${LARANJA}` } : undefined}
              >
                {destaque && (
                  <span
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.12em] text-carvao"
                    style={{ background: LARANJA }}
                  >
                    Recomendado
                  </span>
                )}
                <h2 className="text-xl font-extrabold">{PLANO_NOME[p]}</h2>
                <p className={`mt-1 text-sm ${destaque ? "text-papel/65" : "text-grafite"}`}>{INFO[p].sub}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-sm font-bold">R$</span>
                  <span className="text-5xl font-extrabold tracking-tight">{PRECOS[p]}</span>
                  <span className={`text-sm ${destaque ? "text-papel/60" : "text-grafite"}`}>/mês</span>
                </p>
                <p className="mt-4 text-[13px] font-bold" style={{ color: destaque ? LARANJA : MARROM }}>{INFO[p].nota}</p>
                <div className="mt-5">
                  <Botao href={linkWhats(whatsapp, msgPlano(p))} escuro={destaque}>
                    Testar {PLANO_NOME[p]} grátis
                  </Botao>
                </div>
                <ul className="mt-6 space-y-3">
                  {ITENS[p].map((it) => (
                    <li key={it.texto} className="flex gap-2.5 text-[13.5px] leading-snug">
                      {it.inclui ? (
                        <Check className="mt-px h-4 w-4 shrink-0" style={{ color: destaque ? LARANJA : "#3F7A5F" }} strokeWidth={2.5} aria-label="Incluso" />
                      ) : (
                        <X className="mt-px h-4 w-4 shrink-0 text-[#B4B4B4]" aria-label="Não incluso" />
                      )}
                      <span className={it.inclui ? "" : "text-[#A1A29D] line-through"}>{it.texto}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { rot: "Extra", tit: "Pacote de vídeos · 5 pratos", txt: "Você manda as fotos, a gente entrega os Reels prontos.", valor: "R$ 200" },
            { rot: "Implantação", tit: "Placas, QR/NFC e cadastro", txt: "Instalamos tudo no salão e cadastramos seu cardápio.", valor: implantacao ?? "Sob consulta" },
            { rot: "Garantia", tit: "1ª semana por nossa conta", txt: "Use com seus clientes de verdade. Não gostou, não paga.", valor: null },
          ].map((c) => (
            <div key={c.rot} className="rounded-[18px] border border-[#E9E5DD] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-grafite">{c.rot}</p>
              <p className="mt-2 text-lg font-extrabold leading-snug">{c.tit}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-grafite">
                {c.txt} {c.valor && <strong className="whitespace-nowrap font-bold text-carvao">{c.valor}</strong>}
              </p>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-16 max-w-2xl">
          <h2 className="text-center font-serif text-4xl sm:text-5xl">Perguntas frequentes</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.p} className="group rounded-[18px] border border-[#E9E5DD] bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">
                  {f.p}
                  <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-grafite">{f.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-[24px] bg-carvao px-6 py-10 text-center text-papel sm:py-14">
          <h2 className="font-serif text-4xl sm:text-5xl">Ficou com alguma dúvida?</h2>
          <p className="mx-auto mt-3 max-w-md text-papel/70">Fale com a gente e veja o sistema funcionando no seu salão.</p>
          <div className="mx-auto mt-7 max-w-xs">
            <Botao href={linkWhats(whatsapp, `Olá! Tenho uma dúvida sobre os planos do Unlock Menu.${para}`)} escuro>
              <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
            </Botao>
          </div>
        </section>
      </main>
    </div>
  );
}
