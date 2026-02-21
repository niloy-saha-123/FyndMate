import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Session } from "@supabase/supabase-js";
import { getOrCreateProfile, UserProfile } from "../services/profileService";

export type AppUser = {
  id: string;
  authId: string;
};

type AuthContextType = {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  setProfileLocally: (profile: UserProfile | null) => void;
  // For API client
  accessToken: string | null;
  supabaseUserId: string | null;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const bootstrapInFlightRef = useRef(false);
  const lastBootstrapKeyRef = useRef<string | null>(null);

  const loadProfile = useCallback(
    async (currentSession: Session | null) => {
      if (!currentSession) {
        setProfile(null);
        setProfileLoading(false);
        setProfileError(null);
        return;
      }

      setProfileLoading(true);
      setProfileError(null);

      try {
        const fetchedProfile = await getOrCreateProfile(currentSession.user.id, {
          name: currentSession.user.user_metadata?.full_name ?? "",
          onboardingCompleted: false,
        });
        setProfile(fetchedProfile);
      } catch (err: any) {
        console.error("Failed to load profile", err);
        setProfile(null);
        setProfileError(err?.message ?? "Unable to load profile");
      } finally {
        setProfileLoading(false);
      }
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  // Derived values for API client
  const accessToken = useMemo(() => session?.access_token ?? null, [session]);
  const supabaseUserId = useMemo(() => session?.user?.id ?? null, [session]);
  const isAuthenticated = useMemo(() => !!session?.access_token, [session]);

  const loadUser = useCallback(
    async (currentSession: Session | null) => {
      if (!currentSession) {
        setUser(null);
        setLoading(false);
        await loadProfile(null);
        return;
      }

      const authId = currentSession.user.id;

      // Load user from your User table for app-specific ID (best-effort)
      const { data, error } = await supabase
        .from("User")
        .select("id")
        .eq("supabaseId", authId)
        .maybeSingle();

      if (error) {
        console.error("Failed to load user row", error);
      }

      setUser({
        id: data?.id ?? authId,
        authId,
      });

      await loadProfile(currentSession);
      setLoading(false);
    },
    [loadProfile]
  );

  useEffect(() => {
    let mounted = true;

    const getBootstrapKey = (nextSession: Session | null) =>
      nextSession?.access_token ?? `anon:${nextSession?.user?.id ?? 'none'}`;

    const bootstrapAuth = async (nextSession: Session | null) => {
      if (!mounted) return;

      const nextKey = getBootstrapKey(nextSession);
      const sameAsLast = lastBootstrapKeyRef.current === nextKey;
      const alreadyInitialized = hasInitializedRef.current;

      if (alreadyInitialized && sameAsLast) {
        return;
      }
      if (bootstrapInFlightRef.current && sameAsLast) {
        return;
      }

      bootstrapInFlightRef.current = true;
      lastBootstrapKeyRef.current = nextKey;
      setSession(nextSession ?? null);
      setLoading(true);

      try {
        await loadUser(nextSession ?? null);
      } finally {
        hasInitializedRef.current = true;
        bootstrapInFlightRef.current = false;
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      bootstrapAuth(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      bootstrapAuth(nextSession ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUser]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        profile,
        profileLoading,
        profileError,
        refreshProfile,
        setProfileLocally: setProfile,
        accessToken,
        supabaseUserId,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
