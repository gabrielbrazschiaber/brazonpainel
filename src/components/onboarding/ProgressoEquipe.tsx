import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { progressoEquipe } from "@/lib/onboarding.functions";
import { CHAVE_BOAS_VINDAS } from "@/lib/onboarding";

/**
 * Quem da equipe já concluiu (ou pulou) o tutorial de boas-vindas.
 * Uma única consulta por montagem, compartilhada por todas as linhas.
 */
export function useProgressoEquipe() {
  const carregar = useServerFn(progressoEquipe);
  const [concluidos, setConcluidos] = React.useState<Set<string>>(new Set());
  const [carregado, setCarregado] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    carregar({})
      .then((r) => {
        if (!ativo) return;
        const set = new Set<string>();
        r.usuarios.forEach((u) => {
          if (u.boasVindas || u.chaves.includes(CHAVE_BOAS_VINDAS)) set.add(u.user_id);
        });
        setConcluidos(set);
        setCarregado(true);
      })
      .catch(() => {
        if (ativo) setCarregado(true);
      });
    return () => {
      ativo = false;
    };
  }, [carregar]);

  return { concluidos, carregado };
}

export function BadgeOnboarding({ concluido }: { concluido: boolean }) {
  return concluido ? (
    <Badge variant="outline" className="border-success/40 text-success">
      Tutorial concluído
    </Badge>
  ) : (
    <Badge variant="outline" className="border-warning/40 text-warning-foreground">
      Não fez o tutorial
    </Badge>
  );
}
