import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Credentials = {
  email: string;
  password: string;
};

class SupabaseAuthApiError extends Error {
  readonly code: string | null | undefined;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = "SupabaseAuthApiError";
    this.code = code;
  }
}

function throwIfAuthError(error: AuthError | null) {
  if (error) {
    throw new SupabaseAuthApiError(error.message, error.code);
  }
}

function getEmailRedirectTo() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/auth`;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  throwIfAuthError(error);
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  throwIfAuthError(error);
  return data.user as User | null;
}

export function subscribeToAuthChanges(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

export async function signUpWithPassword(credentials: Credentials) {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: getEmailRedirectTo()
    }
  });

  throwIfAuthError(error);
  return data;
}

export async function signInWithPassword(credentials: Credentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password
  });

  throwIfAuthError(error);
  return data;
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: getEmailRedirectTo()
    }
  });

  throwIfAuthError(error);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  throwIfAuthError(error);
}
