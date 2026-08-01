import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/permissions";
import {
  CHAVE_BOAS_VINDAS,
  tutorialVisivel,
  tutoriaisVisiveis,
  type Tutorial,
} from "@/lib/onboarding";
import { marcarTutorial, meuProgressoOnboarding } from "@/lib/onboarding.functions";
import { TourGuiado } from "@/components/onboarding/TourGuiado";
import { DialogBoasVindas } from "@/components/onboarding/DialogBoasVindas";

interface OnboardingCtx {
  /** O progresso já foi carregado do servidor? */
  carregado: boolean;
  papel: AppRole | null;
  /** true se o tutorial já foi concluído ou pulado por este usuário. */
  visto: (chave: string) => boolean;
  iniciar: (chave: string) => void;
  concluir: (chave: string) => void;
  pular: (chave: string, passo?: number) => void;
  /**
   * Reinicia UM tutorial (ou todos, sem chave). Devolve false quando o
   * tutorial não existe para o papel/permissões do usuário — nesse caso nada
   * é apagado no servidor.
   */
  reiniciar: (chave?: string) => Promise<boolean>;
  /** Existe tutorial desta tela para este usuário (papel + permissões)? */
  temTutorial: (chave: string) => boolean;
  /** Algum tutorial (ou o dialog de boas-vindas) está na tela. */
  ocupado: boolean;
  tutoriais: readonly Tutorial[];
}

const Ctx = React.createContext<OnboardingCtx | undefined>(undefined);

export function useOnboarding(): OnboardingCtx {
  const ctx = React.useContext(Ctx);
  if (ctx) return ctx;
  // Fora do provider (ex.: telas públicas) o onboarding simplesmente não age.
  return {
    carregado: false,
    papel: null,
    visto: () => true,
    iniciar: () => {},
    concluir: () => {},
    pular: () => {},
    reiniciar: async () => false,
    temTutorial: () => false,
    ocupado: false,
    tutoriais: [],
  };
}

/**
 * Dispara o tour da tela na primeira visita, depois que os dados carregaram.
 * `pronto` deve ser false enquanto houver skeleton/spinner na tela.
 */
export function useTourDaTela(chave: string, pronto: boolean) {
  const { carregado, visto, iniciar, ocupado, temTutorial } = useOnboarding();
  const disparado = React.useRef(false);

  React.useEffect(() => {
    if (disparado.current) return;
    if (!carregado || !pronto || ocupado) return;
    // Sem tutorial visível para este papel/permissões não há o que abrir.
    if (!temTutorial(chave)) return;
    if (visto(chave)) return;
    disparado.current = true;
    const t = window.setTimeout(() => iniciar(chave), 450);
    return () => window.clearTimeout(t);
  }, [carregado, pronto, ocupado, chave, visto, iniciar, temTutorial]);
}

interface ItemProgresso {
  chave: string;
  status: string;
  passo_parou: number | null;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const jaExiste = React.useContext(Ctx) !== undefined;
  if (jaExiste) return <>{children}</>;
  return <ProviderInterno>{children}</ProviderInterno>;
}

function ProviderInterno({ children }: { children: React.ReactNode }) {
  const { user, role, roleResolvido, can } = useAuth();
  const carregar = useServerFn(meuProgressoOnboarding);
  const marcar = useServerFn(marcarTutorial);

  const [itens, setItens] = React.useState<ItemProgresso[]>([]);
  const [carregado, setCarregado] = React.useState(false);
  const [chaveAtiva, setChaveAtiva] = React.useState<string | null>(null);
  const [boasVindasAberto, setBoasVindasAberto] = React.useState(false);

  const userId = user?.id ?? null;

  // `can` vem do AuthProvider e muda quando as permissões carregam.
  const pode = React.useCallback(
    (permissao: string) => can(permissao as Parameters<typeof can>[0]),
    [can],
  );

  const tutorialDe = React.useCallback(
    (chave: string) => tutorialVisivel(chave, role, pode),
    [role, pode],
  );

  React.useEffect(() => {
    let ativo = true;
    if (!userId || !roleResolvido || !role) {
      setCarregado(false);
      return;
    }
    carregar({})
      .then((r) => {
        if (!ativo) return;
        setItens((r.itens ?? []) as ItemProgresso[]);
        // Em caso de falha de leitura não mostramos tutorial nenhum.
        setCarregado(!r.indeterminado);
        const jaViu = (r.itens ?? []).some(
          (i: ItemProgresso) =>
            i.chave === CHAVE_BOAS_VINDAS && (i.status === "concluido" || i.status === "pulado"),
        );
        if (!r.indeterminado && !jaViu) setBoasVindasAberto(true);
      })
      .catch(() => {
        if (ativo) setCarregado(false);
      });
    return () => {
      ativo = false;
    };
  }, [userId, role, roleResolvido, carregar]);

  const visto = React.useCallback(
    (chave: string) =>
      itens.some((i) => i.chave === chave && (i.status === "concluido" || i.status === "pulado")),
    [itens],
  );

  const salvar = React.useCallback(
    (chave: string, status: string, passo?: number) => {
      setItens((atuais) => {
        const outros = atuais.filter((i) => i.chave !== chave);
        return [...outros, { chave, status, passo_parou: passo ?? null }];
      });
      void marcar({ data: { chave, status, passo_parou: passo } }).catch(() => {});
    },
    [marcar],
  );

  const iniciar = React.useCallback((chave: string) => {
    setChaveAtiva((atual) => atual ?? chave);
  }, []);

  const concluir = React.useCallback(
    (chave: string) => {
      setChaveAtiva((atual) => (atual === chave ? null : atual));
      salvar(chave, "concluido");
    },
    [salvar],
  );

  /**
   * Dispensar é definitivo: marca o tutorial atual e TODOS os outros visíveis
   * como pulados, para nada mais abrir sozinho. Só "Rever tutoriais" traz de volta.
   */
  const pular = React.useCallback(
    (chave: string, passo?: number) => {
      setChaveAtiva((atual) => (atual === chave ? null : atual));
      setBoasVindasAberto(false);

      const chaves = new Set<string>([chave]);
      tutoriaisVisiveis(role, pode).forEach((t) => chaves.add(t.chave));
      chaves.add(CHAVE_BOAS_VINDAS);

      setItens((atuais) => {
        const outros = atuais.filter((i) => !chaves.has(i.chave));
        return [
          ...outros,
          ...Array.from(chaves).map((c) => ({
            chave: c,
            status: "pulado",
            passo_parou: c === chave ? (passo ?? null) : null,
          })),
        ];
      });

      chaves.forEach((c) => {
        void marcar({
          data: { chave: c, status: "pulado", passo_parou: c === chave ? passo : undefined },
        }).catch(() => {});
      });
    },
    [marcar, role, pode],
  );

  const registrarPasso = React.useCallback(
    (chave: string, passo: number) => {
      // Guarda onde o usuário está para não reiniciar do zero após recarregar.
      setItens((atuais) => {
        const existente = atuais.find((i) => i.chave === chave);
        if (existente && (existente.status === "concluido" || existente.status === "pulado")) {
          return atuais;
        }
        const outros = atuais.filter((i) => i.chave !== chave);
        return [...outros, { chave, status: "em_andamento", passo_parou: passo }];
      });
      void marcar({ data: { chave, status: "em_andamento", passo_parou: passo } }).catch(() => {});
    },
    [marcar],
  );

  /**
   * "Rever tutoriais" é SEMPRE manual: abre o tour agora, na hora, mas NÃO
   * apaga o progresso no servidor. Assim o tutorial não volta a aparecer
   * sozinho no próximo login — só quando o usuário pedir de novo.
   */
  const reiniciar = React.useCallback(
    async (chave?: string) => {
      // Reiniciar só o que este usuário pode ver: sem isso um vendedor sem
      // permissão tentaria abrir um tutorial que nunca existiria para ele.
      if (chave && !tutorialDe(chave)) return false;
      if (!chave && tutoriaisVisiveis(role, pode).length === 0) return false;

      // Zera o passo salvo apenas em memória, para o tour recomeçar do início.
      setItens((atuais) =>
        atuais.map((i) =>
          (chave ? i.chave === chave : true) && i.status === "em_andamento"
            ? { ...i, passo_parou: 0 }
            : i,
        ),
      );

      setChaveAtiva(null);
      if (!chave || chave === CHAVE_BOAS_VINDAS) setBoasVindasAberto(true);
      else setChaveAtiva(chave);
      return true;
    },
    [tutorialDe, role, pode],
  );

  const tutorialAtivo = chaveAtiva ? tutorialDe(chaveAtiva) : undefined;
  const passoInicial = chaveAtiva
    ? (itens.find((i) => i.chave === chaveAtiva && i.status === "em_andamento")?.passo_parou ?? 0)
    : 0;

  const valor = React.useMemo<OnboardingCtx>(
    () => ({
      carregado,
      papel: role,
      visto,
      iniciar,
      concluir,
      pular,
      reiniciar,
      temTutorial: (chave: string) => Boolean(tutorialDe(chave)),
      ocupado: boasVindasAberto || chaveAtiva !== null,
      tutoriais: tutoriaisVisiveis(role, pode),
    }),
    [
      carregado,
      role,
      visto,
      iniciar,
      concluir,
      pular,
      reiniciar,
      tutorialDe,
      pode,
      boasVindasAberto,
      chaveAtiva,
    ],
  );

  const tutorialBoasVindas = tutorialDe(CHAVE_BOAS_VINDAS);

  return (
    <Ctx.Provider value={valor}>
      {children}

      {boasVindasAberto && tutorialBoasVindas && (
        <DialogBoasVindas
          tutorial={tutorialBoasVindas}
          papel={role}
          onComecar={() => {
            setBoasVindasAberto(false);
            setChaveAtiva(CHAVE_BOAS_VINDAS);
          }}
          onAgoraNao={() => {
            setBoasVindasAberto(false);
            pular(CHAVE_BOAS_VINDAS, 0);
          }}
        />
      )}

      {!boasVindasAberto && tutorialAtivo && (
        <TourGuiado
          key={tutorialAtivo.chave}
          tutorial={tutorialAtivo}
          passoInicial={passoInicial}
          onPasso={(i) => registrarPasso(tutorialAtivo.chave, i)}
          onConcluir={() => concluir(tutorialAtivo.chave)}
          onPular={(i) => pular(tutorialAtivo.chave, i)}
        />
      )}
    </Ctx.Provider>
  );
}
