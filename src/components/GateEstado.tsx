import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useSair } from "@/lib/use-sair";
import { Button } from "@/components/ui/button";
import { registrarAuthTelemetria } from "@/lib/auth-telemetry";
import {
  GATE_ESTADOS,
  GATE_RETRY,
  GATE_TEXTOS,
  atrasoBackoffMs,
} from "@/lib/gate-textos";

/** Estado neutro de carregamento — nunca insinua bloqueio de acesso. */
export function GateSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label={GATE_TEXTOS.carregando.aria}
      data-gate-estado={GATE_ESTADOS.carregando}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** Conta autenticada, porém sem papel atribuído: evita spinner infinito. */
export function GateSemPapel() {
  const { sair, saindo } = useSair();
  const t = GATE_TEXTOS.sem_papel;
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      data-gate-estado={GATE_ESTADOS.semPapel}
    >
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground" data-gate-titulo>
          {t.titulo}
        </h1>
        <p className="text-sm text-muted-foreground">{t.descricao}</p>
        <Button onClick={() => void sair()} disabled={saindo} data-gate-acao="sair">
          {saindo ? t.acaoOcupado : t.acao}
        </Button>
      </div>
    </div>
  );
}

/**
 * Falha de rede/consulta ao verificar o papel. Nunca confundir com ausência de
 * perfil: aqui o usuário provavelmente TEM acesso, então tentamos de novo
 * sozinhos com backoff exponencial (1s, 2s, 4s, 8s...) até o teto de
 * tentativas. O comportamento visível continua carregando → erro → sem papel:
 * durante cada tentativa o estado do papel volta a "carregando" no provider e
 * só voltamos a este gate se a tentativa falhar.
 */
export function GateFalhaConexao() {
  const { refresh, user } = useAuth();
  const [tentando, setTentando] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const [esperaSeg, setEsperaSeg] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t = GATE_TEXTOS.erro;
  const esgotado = tentativas >= GATE_RETRY.maxTentativas;

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const tentar = useCallback(
    (numero: number, automatico: boolean) => {
      setTentando(true);
      registrarAuthTelemetria({
        tipo: "papel_retry",
        userId: user?.id ?? null,
        tentativa: numero,
        automatico,
      });
      void refresh().finally(() => setTentando(false));
    },
    [refresh, user?.id],
  );

  // Agenda a próxima tentativa automática sempre que este gate reaparece.
  useEffect(() => {
    if (tentando || esgotado) return;
    const proxima = tentativas + 1;
    const atraso = atrasoBackoffMs(proxima);
    setEsperaSeg(Math.ceil(atraso / 1000));

    const contagem = setInterval(() => {
      setEsperaSeg((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    const agendado = setTimeout(() => {
      setTentativas(proxima);
      tentar(proxima, true);
    }, atraso);
    timers.current.push(agendado);

    return () => {
      clearInterval(contagem);
      clearTimeout(agendado);
    };
    // Reagenda quando o número de tentativas muda (novo erro após retry).
  }, [tentativas, tentando, esgotado, tentar]);

  const rotulo = tentando
    ? t.acaoOcupado
    : esgotado || esperaSeg <= 0
      ? t.acao
      : t.acaoAguardando(esperaSeg);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      data-gate-estado={GATE_ESTADOS.erro}
      data-gate-tentativas={tentativas}
      data-gate-esgotado={esgotado ? "true" : "false"}
    >
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground" data-gate-titulo>
          {t.titulo}
        </h1>
        <p className="text-sm text-muted-foreground">
          {esgotado ? t.esgotado : t.descricao}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            disabled={tentando}
            data-gate-acao="retry"
            onClick={() => {
              timers.current.forEach(clearTimeout);
              timers.current = [];
              const proxima = tentativas + 1;
              setTentativas(esgotado ? 1 : proxima);
              tentar(esgotado ? 1 : proxima, false);
            }}
          >
            {rotulo}
          </Button>
          {esgotado && (
            <Button
              variant="outline"
              data-gate-acao="recarregar"
              onClick={() => window.location.reload()}
            >
              {t.recarregar}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Envelope único para todo gate que depende do papel do usuário.
 * Ordem obrigatória: carregando → erro → sem papel → conteúdo.
 * `pronto` deve ser true somente quando a rota já pode renderizar o conteúdo.
 */
export function GateDependenteDePapel({
  pronto,
  children,
}: {
  pronto: boolean;
  children: ReactNode;
}) {
  const { loading, session, estadoPapel, roleResolvido } = useAuth();

  if (loading || !session) return <GateSpinner />;
  if (estadoPapel === "erro") return <GateFalhaConexao />;
  if (!roleResolvido) return <GateSpinner />;
  if (estadoPapel === "sem_papel") return <GateSemPapel />;
  if (!pronto) return <GateSpinner />;
  return <>{children}</>;
}
