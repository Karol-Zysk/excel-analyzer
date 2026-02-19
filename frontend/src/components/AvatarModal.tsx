import { X } from "lucide-react";
import { useState } from "react";

const DICEBEAR_STYLES = [
  { id: "initials", label: "Inicjały" },
  { id: "bottts", label: "Roboty" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "lorelei", label: "Lorelei" },
  { id: "avataaars", label: "Avataaars" },
] as const;

type DiceBearStyleId = (typeof DICEBEAR_STYLES)[number]["id"];

export function dicebearUrl(style: DiceBearStyleId, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0ea5e9,6366f1,10b981,f59e0b,ef4444`;
}

type AvatarModalProps = {
  userName: string;
  userEmail?: string | null;
  onClose: () => void;
  onApply: (url: string) => Promise<void>;
};

export function AvatarModal({ userName, userEmail, onClose, onApply }: AvatarModalProps) {
  const [style, setStyle] = useState<DiceBearStyleId>("initials");
  const [seed, setSeed] = useState(userName);
  const [applying, setApplying] = useState(false);

  const previewUrl = dicebearUrl(style, seed);

  async function handleApply() {
    setApplying(true);
    await onApply(previewUrl);
    setApplying(false);
  }

  const quickSeeds = [userName, userEmail ?? ""].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 shadow-2xl ring-1 ring-slate-700">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-100">Zmień avatar – {userName}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
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
            {quickSeeds.map((s) => (
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
            disabled={applying || !seed.trim()}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {applying ? "Zapisuję…" : "Zastosuj"}
          </button>
        </div>
      </div>
    </div>
  );
}
