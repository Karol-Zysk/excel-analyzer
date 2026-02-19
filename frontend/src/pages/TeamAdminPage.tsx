import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { deleteUser, getAccounts, setUserAvatarUrl, updateUserRole } from "../api/backend";
import type { AccountListItem } from "../api/backend";
import { useAuth } from "../auth/AuthProvider";
import { getAvatarColor, getUserInitials } from "../lib/avatar";

const ADMIN_PASSWORD = "superhasło";

const DICEBEAR_STYLES = [
  { id: "initials", label: "Inicjały" },
  { id: "bottts", label: "Roboty" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "lorelei", label: "Lorelei" },
  { id: "avataaars", label: "Avataaars" },
] as const;

type DiceBearStyleId = (typeof DICEBEAR_STYLES)[number]["id"];

function dicebearUrl(style: DiceBearStyleId, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0ea5e9,6366f1,10b981,f59e0b,ef4444`;
}

// ─── Avatar Modal ─────────────────────────────────────────────────────────────

type AvatarModalProps = {
  user: AccountListItem;
  onClose: () => void;
  onApply: (url: string) => Promise<void>;
};

function AvatarModal({ user, onClose, onApply }: AvatarModalProps) {
  const [style, setStyle] = useState<DiceBearStyleId>("initials");
  const [seed, setSeed] = useState(user.name);
  const [applying, setApplying] = useState(false);

  const previewUrl = dicebearUrl(style, seed);

  async function handleApply() {
    setApplying(true);
    await onApply(previewUrl);
    setApplying(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 shadow-2xl ring-1 ring-slate-700">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-100">Zmień avatar – {user.name}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview */}
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt="Podgląd avatara"
              className="h-24 w-24 rounded-full border-2 border-slate-600 bg-slate-700"
            />
          </div>

          {/* Style picker */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Styl avatara</label>
            <div className="grid grid-cols-5 gap-1.5">
              {DICEBEAR_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-center transition ${
                    style === s.id
                      ? "bg-sky-500 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  <img
                    src={dicebearUrl(s.id, seed)}
                    alt={s.label}
                    className="h-10 w-10 rounded-full bg-slate-600"
                  />
                  <span className="text-[10px] leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seed input */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Seed (imię, losowy tekst…)</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-full rounded-xl bg-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="np. Jan Kowalski"
            />
          </div>

          {/* Quick seeds */}
          <div className="flex flex-wrap gap-1.5">
            {[user.name, user.email ?? "", String(Math.random().toFixed(5))].filter(Boolean).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeed(s)}
                className="rounded-full bg-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-600"
              >
                {s.length > 20 ? `${s.slice(0, 20)}…` : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={applying}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {applying ? "Zapisuję…" : "Zastosuj"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
          user={account}
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
