import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { Session } from "@supabase/supabase-js";

export type AppUser = {
  id: string;       
  authId: string;   
};

type AuthContextType = {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadUser = async (session: Session | null) => {
      if (!mounted) return;

      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }

      const authId = session.user.id;

      // Load user from your User table
      const { data, error } = await supabase
        .from("User")
        .select("id")
        .eq("supabaseId", authId)
        .single();

      if (!mounted) return;

      if (error || !data) {
        console.error("Failed to load user:", error);
        setUser(null);
      } else {
        setUser({
          id: data.id,
          authId,
        });
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      loadUser(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      setLoading(true);
      loadUser(session ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
