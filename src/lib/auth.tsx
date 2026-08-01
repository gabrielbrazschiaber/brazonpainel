import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppPermission } from "@/lib/permissions";


export type AppRole = "cliente" | "vendedor" | "admin";

/**
 * Estado explícito do papel. `role: null` sozinho é ambíguo (não sabemos ainda
 * vs. sabemos que não tem), e essa ambiguidade fazia a tela "Acesso não
 * liberado" piscar durante o carregamento.
 */
export type EstadoPapel = "carregando" | "resolvido" | "sem_papel" | "erro";

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
  /** Situação da consulta de papel — use antes de decidir qualquer bloqueio. */
  estadoPapel: EstadoPapel;
  /** true quando já sabemos com certeza se o usuário tem (ou não) papel. */
  roleResolvido: boolean;
  permissoes: AppPermission[];
  can: (permissao: AppPermission) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  /** A sessão já foi lida do storage/rede pelo menos uma vez? */
  const [sessaoResolvida, setSessaoResolvida] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [estadoPapel, setEstadoPapel] = useState<EstadoPapel>("carregando");
  const [permissoes, setPermissoes] = useState<AppPermission[]>([]);

  // Evita corridas: apenas o carregamento mais recente pode gravar estado.
  const cargaAtual = useRef(0);
  // Evita recarregar perfil/papéis a cada TOKEN_REFRESHED (a cada ~1h e ao
  // focar a aba), que gerava requisições duplicadas sem necessidade.
  const usuarioCarregado = useRef<string | null>(null);
  const montado = useRef(true);

  const limparDadosUsuario = useCallback(() => {
    usuarioCarregado.current = null;
    setProfile(null);
    setRole(null);
    setEstadoPapel("carregando");
    setPermissoes([]);
  }, []);


  const loadUserData = useCallback(async (userId: string) => {
    const id = ++cargaAtual.current;
    const aindaValido = () => montado.current && cargaAtual.current === id;
    // Papel volta a "não resolvido" antes da consulta: nenhum consumidor pode
    // reaproveitar o estado anterior durante a transição.
    setEstadoPapel("carregando");

    try {
      const [{ data: prof, error: erroProf }, { data: roles, error: erroRoles }] =
        await Promise.all([
          supabase.from("profiles").select("id,email,nome").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);
      if (!aindaValido()) return;
      // Erro na consulta de papel NÃO é ausência de papel.
      if (erroRoles) throw erroRoles;
      if (erroProf) throw erroProf;

      setProfile(prof ?? null);
      const roleList = (roles ?? []).map((r) => r.role as AppRole);
      const priority: AppRole[] = ["admin", "vendedor", "cliente"];
      const papel = priority.find((p) => roleList.includes(p)) ?? null;
      setRole(papel);
      setEstadoPapel(papel ? "resolvido" : "sem_papel");

      // Permissões do(s) papel(éis) — usadas só para desenhar a interface.
      // A autorização real é sempre revalidada no servidor a cada chamada.
      if (roleList.length > 0) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("permission")
          .in("role", roleList);
        if (!aindaValido()) return;
        setPermissoes(
          Array.from(new Set((perms ?? []).map((p) => p.permission as AppPermission))),
        );
      } else if (aindaValido()) {
        setPermissoes([]);
      }
      usuarioCarregado.current = userId;
    } catch {
      // Falha de rede fica em estado de erro (com opção de tentar novamente),
      // nunca como "sem papel".
      if (aindaValido()) {
        usuarioCarregado.current = null;
        setEstadoPapel("erro");
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setSessaoResolvida(true);
    if (data.session?.user) {
      usuarioCarregado.current = null;
      await loadUserData(data.session.user.id);
    } else {
      limparDadosUsuario();
    }
  }, [loadUserData, limparDadosUsuario]);

  useEffect(() => {
    montado.current = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!montado.current) return;
      setSession(newSession);
      setSessaoResolvida(true);

      if (!newSession?.user) {
        limparDadosUsuario();
        return;
      }
      // Só recarrega quando muda de usuário ou quando ainda não há dados.
      if (event === "TOKEN_REFRESHED" && usuarioCarregado.current === newSession.user.id) {
        return;
      }
      if (usuarioCarregado.current === newSession.user.id) return;

      // Troca de conta: invalida o papel antigo imediatamente, ainda dentro do
      // callback, para que ninguém decida com base nele.
      if (usuarioCarregado.current !== null) limparDadosUsuario();
      setEstadoPapel("carregando");

      const userId = newSession.user.id;
      // setTimeout(0): não fazer chamadas ao Supabase dentro do callback de auth.
      setTimeout(() => {
        if (!montado.current) return;
        void loadUserData(userId);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!montado.current) return;
      setSession(data.session);
      if (data.session?.user && usuarioCarregado.current !== data.session.user.id) {
        // Marca a sessão como resolvida junto com o papel pendente, para que
        // `loading` nunca fique false com o papel ainda em voo.
        setSessaoResolvida(true);
        await loadUserData(data.session.user.id);
      } else {
        if (!data.session) limparDadosUsuario();
        setSessaoResolvida(true);
      }
    });

    return () => {
      montado.current = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData, limparDadosUsuario]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Mesmo que a chamada remota falhe, o estado local precisa ser limpo.
      cargaAtual.current++;
      limparDadosUsuario();
      setSession(null);
      setSessaoResolvida(true);
    }
  }, [limparDadosUsuario]);

  // Carregando enquanto a sessão OU o papel ainda estiverem em voo.
  const loading = !sessaoResolvida || (Boolean(session) && estadoPapel === "carregando");

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      estadoPapel,
      roleResolvido: estadoPapel === "resolvido" || estadoPapel === "sem_papel",
      permissoes,
      can: (permissao: AppPermission) => permissoes.includes(permissao),
      loading,
      signOut,
      refresh,
    }),
    [session, profile, role, estadoPapel, permissoes, loading, signOut, refresh],
  );


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
