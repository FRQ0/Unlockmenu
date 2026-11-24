// Aparece na hora em que o usuário toca num item do menu, enquanto o servidor monta a página.
export default function Carregando() {
  return (
    <main className="mx-auto max-w-6xl animate-pulse p-4 lg:p-8" aria-busy="true" aria-label="Carregando">
      <div className="h-8 w-48 rounded-xl bg-pedra" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[18px] bg-white" />)}
      </div>
      <div className="mt-6 h-64 rounded-[18px] bg-white" />
    </main>
  );
}
