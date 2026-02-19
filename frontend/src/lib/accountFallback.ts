import type { Session } from "@supabase/supabase-js";
import type { AccountListItem } from "../api/backend";

function getMetadataStringValue(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getNameFromEmail(email: string | null) {
  if (!email) {
    return "Uzytkownik";
  }

  const firstPart = email.split("@")[0] ?? "";
  if (!firstPart) {
    return "Uzytkownik";
  }

  return firstPart;
}

export function buildFallbackAccountFromSession(
  session: Session | null,
  displayName?: string
): AccountListItem | null {
  if (!session) {
    return null;
  }

  const metadata = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const metadataName =
    getMetadataStringValue(metadata, "name") ??
    getMetadataStringValue(metadata, "full_name") ??
    displayName?.trim() ??
    getNameFromEmail(session.user.email ?? null);

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: metadataName,
    position: getMetadataStringValue(metadata, "position"),
    avatarUrl: getMetadataStringValue(metadata, "avatar_url"),
    createdAt: session.user.created_at ?? new Date().toISOString(),
    lastSignInAt: session.user.last_sign_in_at ?? null,
    emailConfirmedAt: session.user.email_confirmed_at ?? null
  };
}
