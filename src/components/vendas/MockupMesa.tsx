import { Bell, BookOpen, Receipt } from "lucide-react";
import type { CSSProperties } from "react";
import { temaVars } from "@/lib/color";

/** Celular mostrando a tela da mesa com a cor de um estabelecimento (demonstra o white-label). */
export function MockupMesa({ nome, cor, className = "" }: { nome: string; cor: string; className?: string }) {
  return (
    <div style={temaVars(cor) as CSSProperties} className={`w-[230px] rounded-[38px] border-[8px] border-carvao bg-papel p-4 shadow-2xl ${className}`}>
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-carvao/80" />
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-marca text-lg font-bold text-marca-texto ring-4 ring-white">{nome.charAt(0)}</div>
        <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wide">{nome}</p>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="selo bg-white px-2 text-[9px] text-carvao shadow-suave">Mesa 01</span>
          <span className="flex items-center gap-1 text-[9px] font-semibold text-estado-verde"><i className="h-1.5 w-1.5 rounded-full bg-estado-verde" /> Presença confirmada</span>
        </div>
        <p className="mt-4 text-sm font-extrabold">Como podemos ajudar?</p>
        <div className="mt-3 rounded-2xl bg-marca px-3 py-4 text-marca-texto">
          <p className="text-[8px] font-bold uppercase tracking-[.2em] opacity-75">Ação principal</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-extrabold"><Bell className="h-4 w-4" /> Chamar garçom</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-left text-[10px] font-bold">
          <div className="rounded-xl bg-white p-2.5 shadow-suave"><BookOpen className="mb-1 h-3.5 w-3.5" />Ver cardápio</div>
          <div className="rounded-xl bg-white p-2.5 shadow-suave"><Receipt className="mb-1 h-3.5 w-3.5" />Pedir a conta</div>
        </div>
      </div>
    </div>
  );
}
