import { useNavigate } from "react-router-dom";
import { DEFAULT_APP_ROUTE } from "../config/navigation";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-slate-200">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-slate-800">Strona nie istnieje</h1>
        <p className="mt-2 text-sm text-slate-500">Nie znaleziono strony, której szukasz.</p>
        <button
          type="button"
          onClick={() => navigate(DEFAULT_APP_ROUTE)}
          className="mt-6 rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600"
        >
          Wróć do panelu
        </button>
      </div>
    </div>
  );
}
