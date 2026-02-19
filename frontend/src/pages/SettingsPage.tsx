import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAccounts, setUserAvatarUrl, updateMyProfile } from "../api/backend";
import { useAuth } from "../auth/AuthProvider";
import { buildFallbackAccountFromSession } from "../lib/accountFallback";
import { AvatarModal } from "../components/AvatarModal";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nieznany blad";
}

function getMetadataStringValue(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function SettingsPage() {
  const { session, isLoading, displayName, isUserOnline, refreshUser } = useAuth();
  const [profileName, setProfileName] = useState("");
  const [profilePosition, setProfilePosition] = useState("");
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  useEffect(() => {
    const metadata = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
    setProfileName(getMetadataStringValue(metadata, "name") ?? displayName ?? "");
    setProfilePosition(getMetadataStringValue(metadata, "position") ?? "");
  }, [session?.user.id, displayName]);

  const accountsQuery = useQuery({
    queryKey: ["accounts-list", session?.access_token],
    queryFn: () => getAccounts(session!.access_token),
    enabled: Boolean(session?.access_token),
    refetchInterval: 15000
  });

  const fallbackAccount = useMemo(
    () => buildFallbackAccountFromSession(session, displayName),
    [session, displayName]
  );

  const sortedAccounts = useMemo(() => {
    const sourceAccounts =
      accountsQuery.data?.accounts && accountsQuery.data.accounts.length > 0
        ? accountsQuery.data.accounts
        : fallbackAccount
          ? [fallbackAccount]
          : [];

    return sourceAccounts
      .map((account) => ({
        ...account,
        isOnline: isUserOnline(account.id)
      }))
      .sort((left, right) => Number(right.isOnline) - Number(left.isOnline) || left.name.localeCompare(right.name));
  }, [accountsQuery.data?.accounts, fallbackAccount, isUserOnline]);

  const profileMutation = useMutation({
    mutationFn: ({
      name,
      position,
      accessToken
    }: {
      name: string | undefined;
      position: string | undefined;
      accessToken: string;
    }) => updateMyProfile({ name, position }, accessToken),
    onSuccess: async (result) => {
      if (!result.updated) {
        setProfileNotice(`Blad zapisu profilu: ${result.error ?? "Nieznany blad"}`);
        return;
      }

      setProfileNotice("Profil zostal zapisany.");
      await refreshUser();
      void accountsQuery.refetch();
    },
    onError: (error) => {
      setProfileNotice(`Blad zapisu profilu: ${getErrorMessage(error)}`);
    }
  });

  const onProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.access_token) {
      setProfileNotice("Zaloguj sie, aby edytowac profil.");
      return;
    }

    const normalizedName = profileName.trim();
    const normalizedPosition = profilePosition.trim();

    if (!normalizedName && !normalizedPosition) {
      setProfileNotice("Podaj przynajmniej jedno pole: imie lub stanowisko.");
      return;
    }

    setProfileNotice(null);
    profileMutation.mutate({
      name: normalizedName || undefined,
      position: normalizedPosition || undefined,
      accessToken: session.access_token
    });
  };

  async function handleApplyDicebear(url: string) {
    if (!session?.access_token) return;
    await setUserAvatarUrl(session.user.id, url, session.access_token);
    setUploadedAvatarUrl(url);
    setShowAvatarModal(false);
    await refreshUser();
    void accountsQuery.refetch();
  }

  const currentAvatarUrl =
    uploadedAvatarUrl ??
    (typeof session?.user.user_metadata?.avatar_url === "string"
      ? session.user.user_metadata.avatar_url
      : null);

  return (
    <section className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Ustawienia</h2>
        <p className="mt-2 text-sm text-slate-600">
          Zarzadzaj profilem, avatarem i lista kont w aplikacji.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {isLoading && "Sprawdzanie sesji..."}
          {!isLoading && !session && "Brak aktywnej sesji."}
          {!isLoading && session && `Zalogowano jako: ${session.user.email ?? "unknown"}`}
        </p>
      </div>

      <form onSubmit={onProfileSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Profil</h3>
        <p className="mt-1 text-sm text-slate-600">Te dane beda widoczne m.in. w sidebarze i naglowku.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="profile-name" className="text-sm font-medium text-slate-800">
              Imie / nazwa wyswietlana
            </label>
            <input
              id="profile-name"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Np. Karol"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="profile-position" className="text-sm font-medium text-slate-800">
              Stanowisko
            </label>
            <input
              id="profile-position"
              value={profilePosition}
              onChange={(event) => setProfilePosition(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Np. Kierownik projektu"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={profileMutation.isPending || !session}
          className="mt-5 inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {profileMutation.isPending ? "Zapisywanie..." : "Zapisz profil"}
        </button>

        {profileNotice && <p className="mt-3 text-sm text-slate-700">{profileNotice}</p>}
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Avatar</h3>
            <p className="mt-1 text-sm text-slate-600">Wygeneruj avatar na podstawie swojej nazwy użytkownika.</p>
          </div>
          {currentAvatarUrl && (
            <img src={currentAvatarUrl} alt="Aktualny avatar" className="h-12 w-12 rounded-full border border-slate-200 object-cover" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAvatarModal(true)}
          disabled={!session}
          className="mt-4 inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-50"
        >
          Generuj avatar
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Konta w aplikacji</h3>
        <p className="mt-1 text-sm text-slate-600">Status online jest aktualizowany na zywo.</p>

        {accountsQuery.isLoading && <p className="mt-4 text-sm text-slate-600">Ladowanie listy kont...</p>}
        {accountsQuery.isError && (
          <p className="mt-4 text-sm text-amber-700">
            Nie udalo sie pobrac pelnej listy kont ({getErrorMessage(accountsQuery.error)}). Wyswietlam konto biezacego
            uzytkownika.
          </p>
        )}

        {!accountsQuery.isLoading && sortedAccounts.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 font-medium">Uzytkownik</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Stanowisko</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {account.avatarUrl ? (
                          <img
                            src={account.avatarUrl}
                            alt={account.name}
                            className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {account.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-slate-900">
                          {account.name}
                          {account.id === session?.user.id ? " (Ty)" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{account.email ?? "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{account.position ?? "-"}</td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            account.isOnline ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                        <span className={account.isOnline ? "text-emerald-700" : "text-slate-500"}>
                          {account.isOnline ? "Online" : "Offline"}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!accountsQuery.isLoading && sortedAccounts.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">Brak kont do wyswietlenia.</p>
        )}
      </div>

      {showAvatarModal && session && (
        <AvatarModal
          userName={displayName ?? session.user.email ?? ""}
          userEmail={session.user.email}
          onClose={() => setShowAvatarModal(false)}
          onApply={handleApplyDicebear}
        />
      )}
    </section>
  );
}
