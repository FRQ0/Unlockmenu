// Colunas por hora (série única: sem legenda, o título diz o que é).
// Cor validada (#B0782C: contraste ≥ 3:1, croma acima do piso). Tooltip por coluna + tabela.
export function GraficoHoras({ porHora }: { porHora: number[] }) {
  const max = Math.max(1, ...porHora);
  const passo = max <= 4 ? 1 : Math.ceil(max / 4);
  const topo = Math.ceil(max / passo) * passo;
  const ticks = Array.from({ length: Math.floor(topo / passo) + 1 }, (_, i) => i * passo);
  const pico = porHora.indexOf(Math.max(...porHora));
  const temDados = porHora.some((v) => v > 0);

  return (
    <div className="mt-4">
      <div className="relative flex h-48 pl-8">
        {/* eixo y + grade */}
        {ticks.map((t) => (
          <div key={t} className="absolute left-0 right-0 flex items-center" style={{ bottom: `${(t / topo) * 100}%` }}>
            <span className="w-7 pr-1 text-right text-[10px] tabular-nums text-grafite">{t}</span>
            <span className="h-px flex-1 bg-pedra" />
          </div>
        ))}
        <div className="relative z-10 flex flex-1 items-end gap-[2px]">
          {porHora.map((v, h) => (
            <div key={h} className="group relative flex h-full flex-1 items-end justify-center">
              {v > 0 && (
                <div
                  className="w-full max-w-[24px] rounded-t-[4px] bg-[#B0782C] transition group-hover:brightness-110"
                  style={{ height: `${(v / topo) * 100}%` }}
                />
              )}
              {temDados && h === pico && v > 0 && (
                <span className="absolute text-[10px] font-bold text-carvao" style={{ bottom: `calc(${(v / topo) * 100}% + 2px)` }}>{v}</span>
              )}
              <span className="pointer-events-none absolute bottom-full z-20 mb-1 hidden whitespace-nowrap rounded-lg bg-carvao px-2 py-1 text-xs font-semibold text-papel group-hover:block">
                {String(h).padStart(2, "0")}h · {v} chamado{v === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex pl-8 text-[10px] text-grafite">
        {porHora.map((_, h) => <span key={h} className="flex-1 text-center">{h % 3 === 0 ? `${h}h` : ""}</span>)}
      </div>
      {temDados && <p className="mt-2 text-sm text-grafite">Pico às <strong className="text-carvao">{pico}h</strong>.</p>}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-grafite">Ver em tabela</summary>
        <table className="mt-2 w-full max-w-xs text-xs">
          <tbody>
            {porHora.map((v, h) => v > 0 && (
              <tr key={h} className="border-t border-pedra"><td className="py-1">{String(h).padStart(2, "0")}h</td><td className="py-1 text-right tabular-nums">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
