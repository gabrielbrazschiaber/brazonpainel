import { WhatsAppIndicator } from "@/components/WhatsAppIndicator";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MessageCircle,
  PhoneOff,
  PlayCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { formatCurrency, formatDate } from "@/lib/format";
import { ESTAGIO_LABEL, apenasDigitos, estagioClasse, type LeadEstagio } from "@/lib/leads";
import { ADIAMENTOS, ESTAGIOS_RESPOSTA, resumoCadencia } from "@/lib/follow-up";
import { FollowUpSequencialDialog } from "@/components/comercial/FollowUpSequencialDialog";
import {
  painelFollowUps,
  registrarFollowUp,
  reativarCadencia,
  type FollowUp,
  type PainelFollowUps,
} from "@/lib/leads.functions";

type Aba = "atrasados" | "hoje" | "proximos";

interface Registro {
  lead_id: string;
  resultado: "sem_resposta" | "respondeu" | "adiar";
  nota?: string;
  novo_estagio?: LeadEstagio;
  adiar_dias?: number;
}

/** Popover de "Respondeu": escolhe o novo estágio e registra a nota do contato. */
function RespondeuPopover({
  item,
  ocupado,
  onRegistrar,
}: {
  item: FollowUp;
  ocupado: boolean;
  onRegistrar: (r: Registro) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={ocupado}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Respondeu
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="space-y-1.5">
          <Label htmlFor={`nota-${item.id}`} className="text-xs">
            Nota do contato (opcional)
          </Label>
          <Textarea
            id={`nota-${item.id}`}
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="O que ele respondeu?"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Mover para</p>
          <div className="flex flex-wrap gap-1.5">
            {ESTAGIOS_RESPOSTA.map((e) => (
              <Button
                key={e}
                size="sm"
                variant="outline"
                disabled={ocupado}
                onClick={() => {
                  setAberto(false);
                  onRegistrar({
                    lead_id: item.id,
                    resultado: "respondeu",
                    novo_estagio: e,
                    ...(nota.trim() ? { nota: nota.trim() } : {}),
                  });
                  setNota("");
                }}
              >
                {ESTAGIO_LABEL[e]}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ItemFollowUp({
  item,
  isAdmin,
  atrasado,
  onRegistrar,
  onReativar,
  ocupado,
}: {
  item: FollowUp;
  isAdmin: boolean;
  atrasado: boolean;
  onRegistrar: (r: Registro) => void;
  onReativar: (id: string) => void;
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
            {item.cadencia_encerrada && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                Cadência encerrada
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{resumoCadencia(item)}</p>
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
          <WhatsAppIndicator telefone={item.telefone} />
          {whatsapp && (
            <Button asChild variant="outline" size="sm">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}

          {item.cadencia_encerrada ? (
            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => onReativar(item.id)}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reativar cadência
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={ocupado}
                onClick={() => onRegistrar({ lead_id: item.id, resultado: "sem_resposta" })}
              >
                <PhoneOff className="mr-1.5 h-4 w-4" /> Sem resposta
              </Button>

              <RespondeuPopover item={item} ocupado={ocupado} onRegistrar={onRegistrar} />

              <Select
                disabled={ocupado}
                value=""
                onValueChange={(v) =>
                  onRegistrar({ lead_id: item.id, resultado: "adiar", adiar_dias: Number(v) })
                }
              >
                <SelectTrigger className="h-9 w-[7.5rem]" aria-label="Adiar follow-up">
                  <SelectValue placeholder="Adiar" />
                </SelectTrigger>
                <SelectContent>
                  {ADIAMENTOS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      +{d} dias
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Painel priorizado de follow-ups: atrasados, de hoje e próximos 7 dias.
 * Vendedor vê só os seus (RLS); admin vê todos, com filtro por vendedor.
 */
export function FollowUpsPanel({
  isAdmin,
  vendedorId,
  onAtualizado,
  abaInicial,
}: {
  isAdmin: boolean;
  /** Filtro de vendedor já resolvido pela página (apenas admin). */
  vendedorId?: string | undefined;
  onAtualizado?: () => void;
  /** Aba forçada de fora (ex.: card do dashboard). */
  abaInicial?: Aba;
}) {
  const carregar = useServerFn(painelFollowUps);
  const registrar = useServerFn(registrarFollowUp);
  const reativar = useServerFn(reativarCadencia);

  const [dados, setDados] = useState<PainelFollowUps | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<Aba>("atrasados");
  const [sequencialAberto, setSequencialAberto] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const d = await carregar({ data: vendedorId ? { vendedor_id: vendedorId } : {} });
      setDados(d);
      setAba(d.totalAtrasados > 0 ? "atrasados" : d.totalHoje > 0 ? "hoje" : "proximos");
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

  useEffect(() => {
    if (abaInicial) setAba(abaInicial);
  }, [abaInicial]);

  const lista = useMemo(() => {
    if (!dados) return [] as FollowUp[];
    if (aba === "atrasados") return dados.atrasados;
    if (aba === "hoje") return dados.hoje;
    return dados.proximos;
  }, [dados, aba]);

  /** Fila do modo sequencial: atrasados primeiro, depois os de hoje. */
  const filaDoDia = useMemo(() => {
    if (!dados) return [] as FollowUp[];
    return [...dados.atrasados, ...dados.hoje].filter((i) => !i.cadencia_encerrada);
  }, [dados]);

  async function aplicarRegistro(r: Registro) {
    setOcupado(true);
    try {
      await registrar({ data: r });
      toast.success(
        r.resultado === "sem_resposta"
          ? "Tentativa registrada. Próximo contato reagendado."
          : r.resultado === "adiar"
            ? "Follow-up adiado."
            : "Resposta registrada.",
      );
      await buscar();
      onAtualizado?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível registrar o follow-up.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function aplicarReativacao(id: string) {
    setOcupado(true);
    try {
      await reativar({ data: { lead_id: id } });
      toast.success("Cadência reativada.");
      await buscar();
      onAtualizado?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível reativar a cadência.",
      );
    } finally {
      setOcupado(false);
    }
  }

  const vazioTitulo =
    aba === "atrasados"
      ? "Nenhum follow-up atrasado. Fila em dia!"
      : aba === "hoje"
        ? "Nenhum follow-up marcado para hoje."
        : "Nenhum follow-up nos próximos 7 dias.";

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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setSequencialAberto(true)}
            disabled={carregando || filaDoDia.length === 0}
          >
            <PlayCircle className="mr-2 h-4 w-4" /> Iniciar follow-up do dia
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void buscar()} disabled={carregando}>
            {carregando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
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
        <Button
          size="sm"
          variant={aba === "proximos" ? "default" : "outline"}
          onClick={() => setAba("proximos")}
        >
          <CalendarDays className="mr-1.5 h-4 w-4" /> Próximos 7 dias (
          {dados?.totalProximos ?? 0})
        </Button>
        {(dados?.totalEncerrados ?? 0) > 0 && (
          <Badge
            variant="outline"
            className="self-center border-amber-500/40 text-amber-600 dark:text-amber-400"
          >
            {dados?.totalEncerrados} com cadência encerrada
          </Badge>
        )}
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
          <p className="text-sm font-medium text-foreground">{vazioTitulo}</p>
          <p className="text-xs text-muted-foreground">
            Novos leads entram na fila automaticamente.
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
              onRegistrar={(r) => void aplicarRegistro(r)}
              onReativar={(id) => void aplicarReativacao(id)}
            />
          ))}
        </ul>
      )}

      <FollowUpSequencialDialog
        aberto={sequencialAberto}
        onOpenChange={setSequencialAberto}
        itens={filaDoDia}
        onRegistrado={() => {
          void buscar();
          onAtualizado?.();
        }}
      />
    </Card>
  );
}
