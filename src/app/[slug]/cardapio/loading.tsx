// Esqueleto neutro do cardápio.
export default function Carregando() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse px-4 pt-4" aria-busy="true" aria-label="Carregando">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-pedra" />
        <div className="h-5 w-40 rounded-lg bg-pedra" />
      </div>
      <div className="mt-3 h-11 rounded-xl bg-white" />
      <div className="mt-3 flex gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-9 w-24 rounded-full bg-white" />)}</div>
      <div className="mt-4 space-y-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[120px] rounded-[18px] bg-white" />)}</div>
    </main>
  );
}
