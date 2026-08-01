import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { formatCurrency, formatDate } from "@/lib/format";
import { ESTAGIO_LABEL, apenasDigitos, estagioClasse } from "@/lib/leads";
import {
  painelFollowUps,
  reagendarFollowUp,
  type FollowUp,
  type PainelFollowUps,
} from "@/lib/leads.functions";

/** Soma dias a hoje e devolve no formato AAAA-MM-DD (fuso local). */
function dataRelativa(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const ADIAMENTOS = [
  { label: "Hoje", dias: 0 },
  { label: "Amanhã", dias: 1 },
  { label: "+3 dias", dias: 3 },
  { label: "+7 dias", dias: 7 },
];

function ItemFollowUp({
  item,
  isAdmin,
  atrasado,
  onReagendar,
  ocupado,
}: {
  item: FollowUp;
  isAdmin: boolean;
  atrasado: boolean;
  onReagendar: (id: string, dias: number) => void;
  ocupado: boolean;
}) {
  const digitos = apenasDigitos(item.telefone);
  const whatsapp = digitos ? `https://wa.me/55${digitos}` : null;

  return (
    <li
      className={`rounded-lg border p-3 sm:p-4 ${
        atrasado ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{item.nome_contato}</p>
            <Badge variant="outline" className={estagioClasse(item.estagio)}>
              {ESTAGIO_LABEL[item.estagio]}
            </Badge>
            {atrasado && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {item.atraso} dia{item.atraso === 1 ? "" : "s"} de atraso
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[item.empresa, item.segmento].filter(Boolean).join(" · ") || "Sem empresa"}
            {isAdmin && item.vendedor_nome ? ` · ${item.vendedor_nome}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Follow-up {formatDate(item.proximo_contato)} · {formatCurrency(item.valor_estimado)} ·
            prioridade {item.prioridade}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {whatsapp && (
            <Button asChild variant="outline" size="sm">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          <Select
            disabled={ocupado}
            value=""
            onValueChange={(v) => onReagendar(item.id, Number(v))}
          >
            <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Reagendar follow-up">
              <SelectValue placeholder="Reagendar" />
            </SelectTrigger>
            <SelectContent>
              {ADIAMENTOS.map((a) => (
                <SelectItem key={a.dias} value={String(a.dias)}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </li>
  );
}

/**
 * Painel priorizado de follow-ups atrasados e de hoje.
 * Vendedor vê só os seus (RLS); admin vê todos, com filtro por vendedor.
 */
export function FollowUpsPanel({
  isAdmin,
  vendedorId,
  onAtualizado,
}: {
  isAdmin: boolean;
  /** Filtro de vendedor já resolvido pela página (apenas admin). */
  vendedorId?: string | undefined;
  onAtualizado?: () => void;
}) {
  const carregar = useServerFn(painelFollowUps);
  const reagendar = useServerFn(reagendarFollowUp);

  const [dados, setDados] = useState<PainelFollowUps | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<"atrasados" | "hoje">("atrasados");

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const d = await carregar({ data: vendedorId ? { vendedor_id: vendedorId } : {} });
      setDados(d);
      setAba(d.totalAtrasados > 0 ? "atrasados" : "hoje");
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Não foi possível carregar os follow-ups.",
      );
    } finally {
      setCarregando(false);
    }
  }, [carregar, vendedorId]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  const lista = useMemo(() => {
    if (!dados) return [] as FollowUp[];
    return aba === "atrasados" ? dados.atrasados : dados.hoje;
  }, [dados, aba]);

  async function aplicarReagendamento(id: string, dias: number) {
    setOcupado(true);
    try {
      await reagendar({ data: { id, proximo_contato: dataRelativa(dias) } });
      toast.success("Follow-up reagendado.");
      await buscar();
      onAtualizado?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível reagendar o follow-up.",
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Follow-ups
          </p>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            Sua fila priorizada
          </h2>
          <p className="text-xs text-muted-foreground">
            Ordenada por atraso, estágio do funil e valor estimado.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void buscar()} disabled={carregando}>
          {carregando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={aba === "atrasados" ? "default" : "outline"}
          onClick={() => setAba("atrasados")}
        >
          <AlertTriangle className="mr-1.5 h-4 w-4" /> Atrasados ({dados?.totalAtrasados ?? 0})
        </Button>
        <Button
          size="sm"
          variant={aba === "hoje" ? "default" : "outline"}
          onClick={() => setAba("hoje")}
        >
          <CalendarClock className="mr-1.5 h-4 w-4" /> Hoje ({dados?.totalHoje ?? 0})
        </Button>
      </div>

      {carregando ? (
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : erro ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center"
        >
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-xs text-muted-foreground">{erro}</p>
          <Button variant="outline" size="sm" onClick={() => void buscar()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border/60 px-4 py-8 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <p className="text-sm font-medium text-foreground">
            {aba === "atrasados"
              ? "Nenhum follow-up atrasado. Fila em dia!"
              : "Nenhum follow-up marcado para hoje."}
          </p>
          <p className="text-xs text-muted-foreground">
            Defina o próximo contato ao editar um lead para ele aparecer aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((item) => (
            <ItemFollowUp
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              atrasado={aba === "atrasados"}
              ocupado={ocupado}
              onReagendar={(id, dias) => void aplicarReagendamento(id, dias)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
