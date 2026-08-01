import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/permissions";
import {
  CHAVE_BOAS_VINDAS,
  tutorialPara,
  tutoriaisDoPapel,
  type Tutorial,
} from "@/lib/onboarding";
import {
  marcarTutorial,
  meuProgressoOnboarding,
  reiniciarOnboarding,
} from "@/lib/onboarding.functions";
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
  reiniciar: (chave?: string) => Promise<void>;
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
    reiniciar: async () => {},
    ocupado: false,
    tutoriais: [],
  };
}

/**
 * Dispara o tour da tela na primeira visita, depois que os dados carregaram.
 * `pronto` deve ser false enquanto houver skeleton/spinner na tela.
 */
export function useTourDaTela(chave: string, pronto: boolean) {
  const { carregado, visto, iniciar, ocupado } = useOnboarding();
  const disparado = React.useRef(false);

  React.useEffect(() => {
    if (disparado.current) return;
    if (!carregado || !pronto || ocupado) return;
    if (visto(chave)) return;
    disparado.current = true;
    const t = window.setTimeout(() => iniciar(chave), 450);
    return () => window.clearTimeout(t);
  }, [carregado, pronto, ocupado, chave, visto, iniciar]);
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
  const { user, role, roleResolvido } = useAuth();
  const carregar = useServerFn(meuProgressoOnboarding);
  const marcar = useServerFn(marcarTutorial);
  const reiniciarFn = useServerFn(reiniciarOnboarding);

  const [itens, setItens] = React.useState<ItemProgresso[]>([]);
  const [carregado, setCarregado] = React.useState(false);
  const [chaveAtiva, setChaveAtiva] = React.useState<string | null>(null);
  const [boasVindasAberto, setBoasVindasAberto] = React.useState(false);

  const userId = user?.id ?? null;

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
      itens.some(
        (i) => i.chave === chave && (i.status === "concluido" || i.status === "pulado"),
      ),
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

  const pular = React.useCallback(
    (chave: string, passo?: number) => {
      setChaveAtiva((atual) => (atual === chave ? null : atual));
      salvar(chave, "pulado", passo);
    },
    [salvar],
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

  const reiniciar = React.useCallback(
    async (chave?: string) => {
      await reiniciarFn({ data: { chave: chave ?? null } });
      setItens((atuais) => (chave ? atuais.filter((i) => i.chave !== chave) : []));
      setChaveAtiva(null);
      if (!chave || chave === CHAVE_BOAS_VINDAS) setBoasVindasAberto(true);
      else setChaveAtiva(chave);
    },
    [reiniciarFn],
  );

  const tutorialAtivo = chaveAtiva ? tutorialPara(chaveAtiva, role) : undefined;
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
      ocupado: boasVindasAberto || chaveAtiva !== null,
      tutoriais: tutoriaisDoPapel(role),
    }),
    [carregado, role, visto, iniciar, concluir, pular, reiniciar, boasVindasAberto, chaveAtiva],
  );

  const tutorialBoasVindas = tutorialPara(CHAVE_BOAS_VINDAS, role);

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
