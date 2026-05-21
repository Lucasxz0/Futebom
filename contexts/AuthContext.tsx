"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Session, User, AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ⚠️ IMPORTANTE: Criar cliente uma só vez, não usar como dependência
  const supabase = createClient();

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        console.log("🔐 Tentando login com:", email);
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log("✅ Login result:", result);
        if (result.error) {
          console.error("❌ Erro de login:", result.error.message);
        }
        return { error: result.error };
      } catch (err) {
        console.error("❌ Erro na requisição:", err);
        return { error: err as any };
      }
    },
    [] // VAZIO - não adicionar supabase aqui
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      return { error };
    },
    [] // VAZIO
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []); // VAZIO

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("📋 Sessão carregada:", session?.user?.email ?? "nenhuma");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🔄 Auth state changed:", _event, session?.user?.email ?? "nenhuma");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
