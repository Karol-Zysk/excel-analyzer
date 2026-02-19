import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { bootstrapAdmin, deleteUser, getAccounts, setUserAvatarUrl, updateUserRole } from "../api/backend";
import type { AccountListItem } from "../api/backend";
import { useAuth } from "../auth/AuthProvider";
import { getAvatarColor, getUserInitials } from "../lib/avatar";
import { AvatarModal } from "../components/AvatarModal";

const ADMIN_PASSWORD = "superhasło";

// ─── Delete Confirm ───────────────────────────────────────────────────────────

type DeleteDialogProps = {
  user: AccountListItem;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

function DeleteDialog({ user, onClose, onConfirm }: DeleteDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-2xl ring-1 ring-slate-700">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-slate-100">Usuń konto</h3>
        <p className="mb-5 text-sm text-slate-400">
          Czy na pewno chcesz usunąć konto użytkownika <span className="font-medium text-slate-200">{user.name}</span>?
          Tej operacji nie można cofnąć.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "Usuwam…" : "Usuń konto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

type UserRowProps = {
  account: AccountListItem;
  isSelf: boolean;
  accessToken: string;
  onRefresh: () => void;
};

function UserRow({ account, isSelf, accessToken, onRefresh }: UserRowProps) {
  const [roleLoading, setRoleLoading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleToggle() {
    setRoleLoading(true);
    setError(null);
    const newRole = account.role === "ADMIN" ? "USER" : "ADMIN";
    try {
      await updateUserRole(account.id, newRole, accessToken);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zmiany roli");
    }
    setRoleLoading(false);
  }

  async function handleApplyAvatar(url: string) {
    setError(null);
    try {
      await setUserAvatarUrl(account.id, url, accessToken);
      setShowAvatarModal(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ustawienia avatara");
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteUser(account.id, accessToken);
      setShowDeleteDialog(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd usuwania konta");
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3 ring-1 ring-slate-700">
        {/* Avatar */}
        <button
          type="button"
          onClick={() => setShowAvatarModal(true)}
          title="Zmień avatar"
          className="relative flex-shrink-0 group"
        >
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt={account.name} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(account.name)}`}>
              {getUserInitials(account.name)}
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
            Zmień
          </span>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-100">{account.name}</p>
            {isSelf && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">Ty</span>}
          </div>
          <p className="truncate text-[11px] text-slate-500">{account.email}</p>
        </div>

        {/* Role badge + toggle */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              account.role === "ADMIN" ? "bg-violet-500/20 text-violet-300" : "bg-slate-700 text-slate-400"
            }`}
          >
            {account.role === "ADMIN" && <Shield className="h-3 w-3" />}
            {account.role}
          </span>

          {!isSelf && (
            <>
              <button
                type="button"
                onClick={() => void handleRoleToggle()}
                disabled={roleLoading}
                title={account.role === "ADMIN" ? "Ustaw USER" : "Ustaw ADMIN"}
                className="flex items-center gap-1 rounded-lg bg-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-600 disabled:opacity-50"
              >
                <ChevronDown className="h-3 w-3" />
                {roleLoading ? "…" : account.role === "ADMIN" ? "→ USER" : "→ ADMIN"}
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                title="Usuń konto"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {showAvatarModal && (
        <AvatarModal
          userName={account.name}
          userEmail={account.email}
          onClose={() => setShowAvatarModal(false)}
          onApply={handleApplyAvatar}
        />
      )}

      {showDeleteDialog && (
        <DeleteDialog
          user={account}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TeamAdminPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapDone, setBootstrapDone] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ["accounts-list-admin", session?.access_token],
    queryFn: () => getAccounts(session!.access_token),
    enabled: Boolean(session?.access_token) && unlocked,
  });

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  }

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ["accounts-list-admin"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts-list"] });
  }

  async function handleBootstrapAdmin() {
    if (!session?.access_token) return;
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      await bootstrapAdmin(ADMIN_PASSWORD, session.access_token);
      setBootstrapDone(true);
      handleRefresh();
    } catch (e) {
      setBootstrapError(e instanceof Error ? e.message : "Błąd nadawania roli");
    }
    setBootstrapping(false);
  }

  // ── Ekran hasła ──────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
              <Shield className="h-7 w-7 text-violet-400" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Panel administracyjny</h1>
            <p className="text-center text-sm text-slate-500">Podaj hasło, aby uzyskać dostęp do zarządzania zespołem.</p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              placeholder="Hasło administratora"
              autoFocus
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${
                passwordError
                  ? "border-red-300 bg-red-50 focus:ring-red-100"
                  : "border-slate-200 bg-white focus:border-sky-300 focus:ring-sky-100"
              }`}
            />
            {passwordError && (
              <p className="text-xs text-red-500">Nieprawidłowe hasło. Spróbuj ponownie.</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Wejdź
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Panel admina ─────────────────────────────────────────────────────────────
  const accounts = accountsQuery.data?.accounts ?? [];
  const currentUserId = session?.user.id ?? "";
  const myAccount = accounts.find((a) => a.id === currentUserId);
  const isSelfUser = myAccount?.role !== "ADMIN";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Zarządzanie zespołem</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {accounts.length} {accounts.length === 1 ? "konto" : "konta/kont"}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-600">
          <Shield className="h-3.5 w-3.5" />
          Tryb admina
        </span>
      </div>

      {/* Banner dla użytkownika bez roli ADMIN */}
      {!accountsQuery.isLoading && isSelfUser && !bootstrapDone && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <div>
            <p className="text-sm font-medium text-amber-800">Twoja rola to USER</p>
            <p className="mt-0.5 text-xs text-amber-600">
              Nie możesz zmieniać ról ani usuwać kont. Kliknij przycisk, aby nadać sobie rolę ADMIN, a następnie wyloguj i zaloguj ponownie.
            </p>
            {bootstrapError && <p className="mt-1 text-xs text-red-500">{bootstrapError}</p>}
          </div>
          <button
            type="button"
            onClick={() => void handleBootstrapAdmin()}
            disabled={bootstrapping}
            className="ml-4 flex-shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
          >
            {bootstrapping ? "Nadaję…" : "Nadaj sobie ADMIN"}
          </button>
        </div>
      )}

      {bootstrapDone && (
        <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-sm font-medium text-emerald-800">Rola ADMIN nadana!</p>
          <p className="mt-0.5 text-xs text-emerald-600">
            Wyloguj się i zaloguj ponownie — wtedy będziesz mógł zarządzać rolami innych użytkowników.
          </p>
        </div>
      )}

      {accountsQuery.isLoading && (
        <p className="py-8 text-center text-sm text-slate-400">Ładowanie kont…</p>
      )}

      {accountsQuery.isError && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
          Nie udało się załadować listy kont.
        </p>
      )}

      <div className="space-y-2">
        {accounts.map((account) => (
          <UserRow
            key={account.id}
            account={account}
            isSelf={account.id === currentUserId}
            accessToken={session!.access_token}
            onRefresh={handleRefresh}
          />
        ))}
      </div>
    </div>
  );
}
