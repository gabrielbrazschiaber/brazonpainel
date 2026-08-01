import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, BellRing, RefreshCw, ShieldCheck } from "lucide-react";

interface Alerta {
  app_version: string;
  rota: string;
  eventos_janela: number;
  incidentes_janela: number;
  taxa_janela: number;
  eventos_base: number;
  incidentes_base: number;
  taxa_base: number;
  fator: number;
  severidade: "critico" | "atencao" | "estavel";
  ultimo_erro: string | null;
  ultima: string;
}

/**
 * Alertas automáticos de acesso: compara a janela recente com a média das
 * últimas horas e aponta a versão + rota em que as falhas do gate cresceram.
 * A ideia é reagir antes de o problema aparecer para os usuários.
 */
export function AlertasAcesso({ janelaHoras = 6 }: { janelaHoras?: number }) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(
    async (avisar = false) => {
      setCarregando(true);
      const { data, error } = await supabase.rpc("auth_telemetria_alertas", {
        _janela_horas: janelaHoras,
        _base_horas: 72,
        _minimo_incidentes: 3,
      });
      setCarregando(false);
      if (error) {
        toast.error("Não foi possível verificar os alertas de acesso.");
        return;
      }
      const lista = (data ?? []) as unknown as Alerta[];
      setAlertas(lista);
      const criticos = lista.filter((a) => a.severidade === "critico");
      if (avisar && criticos.length > 0) {
        toast.error(
          `Aumento de falhas de acesso em ${criticos.length} rota(s). Verifique a versão ${criticos[0].app_version}.`,
        );
      }
    },
    [janelaHoras],
  );

  useEffect(() => {
    void carregar(true);
    // Revisita a cada 5 minutos enquanto o painel estiver aberto.
    const t = setInterval(() => void carregar(true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [carregar]);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Alertas de acesso (últimas {janelaHoras}h)
          </h3>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}>
          <RefreshCw className={carregando ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
          Verificar agora
        </Button>
      </div>

      {alertas.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Nenhum aumento de falhas de acesso detectado no período.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {alertas.map((a) => (
            <li
              key={`${a.app_version}-${a.rota}`}
              className="rounded-md border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={a.severidade === "critico" ? "destructive" : "outline"}>
                  {a.severidade === "critico" ? "Crítico" : "Atenção"}
                </Badge>
                <span className="font-medium text-foreground">{a.rota}</span>
                <span className="text-xs text-muted-foreground">versão {a.app_version}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.incidentes_janela} falha(s) em {a.eventos_janela} acesso(s) —{" "}
                {Number(a.taxa_janela).toLocaleString("pt-BR")}% agora contra{" "}
                {Number(a.taxa_base).toLocaleString("pt-BR")}% na média anterior (
                {Number(a.fator).toLocaleString("pt-BR")}x). Última em{" "}
                {new Date(a.ultima).toLocaleString("pt-BR")}.
              </p>
              {a.ultimo_erro && (
                <p className="mt-1 flex items-start gap-1 break-words text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {a.ultimo_erro}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
