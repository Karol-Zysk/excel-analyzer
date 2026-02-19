type LogoLoadingScreenProps = {
  message?: string;
};

export function LogoLoadingScreen({
  message = "Trwa uruchamianie aplikacji..."
}: LogoLoadingScreenProps) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_14px_36px_rgba(15,23,42,0.12)]">
        <div className="mx-auto grid w-fit place-items-center">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-[3px] border-sky-100" />
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-sky-500 border-r-sky-400" />
            <div className="absolute inset-[10px] animate-pulse rounded-full bg-sky-100/70" />
          </div>

          <div className="mt-4 flex items-center gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500" />
          </div>
        </div>

        <p className="mt-5 text-center text-sm font-medium text-slate-700">{message}</p>
        <p className="mt-1 text-center text-xs text-slate-500">Przygotowujemy Twoj widok...</p>
      </section>
    </div>
  );
}
