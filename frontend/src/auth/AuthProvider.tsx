import type { Session } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  getCurrentUser as getCurrentUserApi,
  getCurrentSession,
  resendSignupConfirmation as resendSignupConfirmationApi,
  signInWithPassword as signInWithPasswordApi,
  signOut as signOutApi,
  signUpWithPassword as signUpWithPasswordApi,
  subscribeToAuthChanges
} from "../api/auth";
import { supabase } from "../lib/supabase";

type Credentials = {
  email: string;
  password: string;
};

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  displayName: string;
  isUserOnline: (userId: string) => boolean;
  signInWithPassword: (credentials: Credentials) => Promise<void>;
  signUpWithPassword: (credentials: Credentials) => Promise<void>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toFirstName(rawValue: string) {
  const parts = rawValue
    .trim()
    .split(/[.\-_@\s]+/)
    .filter((part) => part.length > 0);
  const first = parts[0] ?? rawValue.trim();

  if (!first) {
    return "Uzytkownik";
  }

  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function buildDisplayName(session: Session | null) {
  if (!session) {
    return "Uzytkownik";
  }

  const metadataName = session.user.user_metadata?.name ?? session.user.user_metadata?.full_name;
  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return toFirstName(metadataName);
  }

  const email = session.user.email;
  if (!email) {
    return "Uzytkownik";
  }

  return toFirstName(email.split("@")[0] || "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    void getCurrentSession()
      .then((currentSession) => {
        if (mounted) {
          setSession(currentSession);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription }
    } = subscribeToAuthChanges((nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const displayName = useMemo(() => buildDisplayName(session), [session]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel("presence:app-users", {
      config: {
        presence: {
          key: userId
        }
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineUserIds(new Set(Object.keys(state)));
    });

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") {
        return;
      }

      void channel.track({
        userId,
        email: session?.user.email ?? null,
        displayName,
        onlineAt: new Date().toISOString()
      });
    });

    return () => {
      setOnlineUserIds(new Set());
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id, session?.user.email, displayName]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      displayName,
      isUserOnline: (userId: string) => onlineUserIds.has(userId),
      signInWithPassword: async (credentials: Credentials) => {
        await signInWithPasswordApi(credentials);
      },
      signUpWithPassword: async (credentials: Credentials) => {
        await signUpWithPasswordApi(credentials);
      },
      resendSignupConfirmation: async (email: string) => {
        await resendSignupConfirmationApi(email);
      },
      refreshUser: async () => {
        const nextUser = await getCurrentUserApi();
        if (!nextUser) {
          return;
        }

        setSession((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            user: nextUser
          };
        });
      },
      signOut: async () => {
        await signOutApi();
      }
    }),
    [session, isLoading, displayName, onlineUserIds]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
