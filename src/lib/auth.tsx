import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppPermission } from "@/lib/permissions";

export type AppRole = "cliente" | "vendedor" | "admin";

interface Profile {
  id: string;
  email: string;
  nome: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  permissoes: AppPermission[];
  can: (permissao: AppPermission) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissoes, setPermissoes] = useState<AppPermission[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUserData(userId: string) {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,nome").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof ?? null);
    const roleList = (roles ?? []).map((r) => r.role as AppRole);
    const priority: AppRole[] = ["admin", "vendedor", "cliente"];
    setRole(priority.find((p) => roleList.includes(p)) ?? null);

    // Permissões do(s) papel(éis) — usadas só para desenhar a interface.
    // A autorização real é sempre revalidada no servidor a cada chamada.
    if (roleList.length > 0) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", roleList);
      setPermissoes(
        Array.from(new Set((perms ?? []).map((p) => p.permission as AppPermission))),
      );
    } else {
      setPermissoes([]);
    }
  }

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      await loadUserData(data.session.user.id);
    } else {
      setProfile(null);
      setRole(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => {
          if (mounted) loadUserData(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadUserData(data.session.user.id);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        role,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function roleHome(role: AppRole | null): string {
  if (role === "admin") return "/admin";
  if (role === "vendedor") return "/vendedor";
  return "/cliente";
}
