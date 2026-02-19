type FeatureInProgressPageProps = {
  title: string;
};

export function FeatureInProgressPage({ title }: FeatureInProgressPageProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">Funkcjonalnosc w trakcie implementacji.</p>
    </section>
  );
}
