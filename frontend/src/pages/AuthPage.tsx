import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { DEFAULT_APP_ROUTE } from "../config/navigation";

type AuthErrorWithCode = {
  message?: string;
  code?: string;
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const authError = error as AuthErrorWithCode;

    if (authError.code === "anonymous_provider_disabled") {
      return "Rejestracja wymaga email i hasla. Upewnij sie, ze oba pola sa wypelnione.";
    }

    if (authError.code === "email_not_confirmed") {
      return "Email nie jest potwierdzony. Sprawdz skrzynke i kliknij link aktywacyjny.";
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message;

    if (message.includes("anonymous_provider_disabled")) {
      return "Rejestracja wymaga email i hasla. Upewnij sie, ze oba pola sa wypelnione.";
    }

    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Nieznany blad";
}

export function AuthPage() {
  const { session, isLoading, signInWithPassword, signUpWithPassword, resendSignupConfirmation } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const fromState = location.state as { from?: string } | null;
  const redirectTo = fromState?.from || DEFAULT_APP_ROUTE;

  if (!isLoading && session) {
    return <Navigate to={redirectTo} replace />;
  }

  const normalizedEmail = email.trim();
  const normalizedPassword = password;

  const validateCredentials = () => {
    if (!normalizedEmail || !normalizedPassword) {
      setNotice("Email i haslo sa wymagane.");
      return false;
    }

    if (normalizedPassword.length < 6) {
      setNotice("Haslo musi miec co najmniej 6 znakow.");
      return false;
    }

    return true;
  };

  const onLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!validateCredentials()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithPassword({ email: normalizedEmail, password: normalizedPassword });
      setPendingConfirmationEmail(null);
    } catch (error) {
      const errorWithCode = error as AuthErrorWithCode;
      if (errorWithCode.code === "email_not_confirmed") {
        setPendingConfirmationEmail(normalizedEmail);
      }
      setNotice(`Blad logowania: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignupClick = async () => {
    setNotice(null);
    if (!validateCredentials()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signUpWithPassword({ email: normalizedEmail, password: normalizedPassword });
      setPendingConfirmationEmail(normalizedEmail);
      setNotice("Konto utworzone. Sprawdz email i potwierdz konto linkiem aktywacyjnym.");
    } catch (error) {
      setNotice(`Blad rejestracji: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendConfirmationClick = async () => {
    const targetEmail = pendingConfirmationEmail ?? normalizedEmail;
    if (!targetEmail) {
      setNotice("Podaj email, aby wyslac ponownie link aktywacyjny.");
      return;
    }

    setNotice(null);
    setIsResendingConfirmation(true);

    try {
      await resendSignupConfirmation(targetEmail);
      setPendingConfirmationEmail(targetEmail);
      setNotice("Wyslano ponownie email aktywacyjny.");
    } catch (error) {
      setNotice(`Blad ponownego wyslania: ${getErrorMessage(error)}`);
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dem-Bud</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Logowanie</h1>
        <p className="mt-2 text-sm text-slate-600">
          Aby wejsc do aplikacji, zaloguj sie kontem Supabase Auth.
        </p>

        <form onSubmit={onLoginSubmit} className="mt-6 grid gap-4">
          <div className="grid gap-1">
            <label htmlFor="auth-email" className="text-sm font-medium text-slate-800">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="auth-password" className="text-sm font-medium text-slate-800">
              Haslo
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting || isLoading || isResendingConfirmation}
              className="inline-flex items-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Logowanie..." : "Zaloguj"}
            </button>
            <button
              type="button"
              onClick={onSignupClick}
              disabled={
                isSubmitting ||
                isLoading ||
                isResendingConfirmation ||
                !normalizedEmail ||
                !normalizedPassword
              }
              className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Tworzenie..." : "Zaloz konto"}
            </button>
            <button
              type="button"
              onClick={onResendConfirmationClick}
              disabled={
                isSubmitting ||
                isLoading ||
                isResendingConfirmation ||
                (!normalizedEmail && !pendingConfirmationEmail)
              }
              className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResendingConfirmation ? "Wysylanie..." : "Wyslij ponownie link"}
            </button>
          </div>
        </form>

        {notice && <p className="mt-4 text-sm text-slate-700">{notice}</p>}
        {pendingConfirmationEmail && (
          <p className="mt-2 text-xs text-slate-500">Oczekuje na potwierdzenie: {pendingConfirmationEmail}</p>
        )}
      </section>
    </main>
  );
}
