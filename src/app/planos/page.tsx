// /planos: fora do menu, aberta só por link, para o dono escolher o plano na apresentação.
// Ver preço aqui não libera nada: o acesso só existe quando o super-admin ativa o plano.
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { LogoMarca } from "@/components/ui/Marca";
import { PLANOS, PLANO_NOME, type Plano } from "@/lib/plans";

export const metadata: Metadata = { title: "Planos · Unlock Menu", robots: { index: false, follow: false }, icons: { icon: "/brand/icon.svg" } };

type Linha = { recurso: string; valores: Record<Plano, string | boolean> };
const LINHAS: Linha[] = [
  { recurso: "QR/NFC por mesa", valores: { essencial: "até 10 mesas", profissional: "até 25", completo: "ilimitado" } },
  { recurso: "Chamar garçom + pedir a conta", valores: { essencial: true, profissional: true, completo: true } },
  { recurso: "Painel do garçom", valores: { essencial: "básico (lista)", profissional: "grade + som", completo: "grade + som + setores + push" } },
  { recurso: "Cardápio com foto", valores: { essencial: true, profissional: true, completo: true } },
  { recurso: "Logo e cores do estabelecimento", valores: { essencial: "só logo", profissional: true, completo: true } },
  { recurso: "Reels do prato", valores: { essencial: false, profissional: true, completo: true } },
  { recurso: "“Combina com” (sugestão no Reels)", valores: { essencial: false, profissional: false, completo: true } },
  { recurso: "Pedido de avaliação no Google", valores: { essencial: false, profissional: false, completo: true } },
  { recurso: "Alerta de atraso para o gerente", valores: { essencial: false, profissional: false, completo: true } },
  { recurso: "Painel do dono", valores: { essencial: false, profissional: "básico (chamados)", completo: "completo (pico, ranking, pratos)" } },
  { recurso: "Pedido pelo celular → cozinha", valores: { essencial: false, profissional: false, completo: "em breve" } },
  { recurso: "Site próprio + domínio", valores: { essencial: false, profissional: false, completo: true } },
  { recurso: "Vídeos de pratos inclusos", valores: { essencial: false, profissional: false, completo: "5" } },
  { recurso: "Suporte", valores: { essencial: "E-mail", profissional: "WhatsApp", completo: "WhatsApp prioritário + cardápio atualizado por nós" } },
];

export const dynamic = "force-dynamic";

const DEMOS: Record<Plano, string> = { essencial: "demo-essencial", profissional: "demo-profissional", completo: "demo-completo" };

export default function Planos() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <LogoMarca />
      <h1 className="mt-8 font-serif text-5xl">Escolha o seu plano</h1>
      <p className="mt-2 text-grafite">Todos com 7 dias de teste grátis.</p>
      <div className="card mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr>
              <th className="p-4 text-left font-semibold text-grafite">Recurso</th>
              {PLANOS.map((p) => (
                <th key={p} className={`p-4 text-left ${p === "completo" ? "bg-areia/20" : ""}`}>
                  <span className="font-serif text-2xl font-normal">{PLANO_NOME[p]}</span>
                  <a href={`/${DEMOS[p]}/cardapio`} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold text-areia-escura">Ver demo →</a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((l) => (
              <tr key={l.recurso} className="border-t border-pedra">
                <td className="p-4 font-semibold">{l.recurso}</td>
                {PLANOS.map((p) => {
                  const v = l.valores[p];
                  return (
                    <td key={p} className={`p-4 ${p === "completo" ? "bg-areia/10" : ""}`}>
                      {v === true ? <Check className="h-5 w-5 text-estado-verde" aria-label="Incluso" /> : v === false ? <Minus className="h-5 w-5 text-pedra" aria-label="Não incluso" /> : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
