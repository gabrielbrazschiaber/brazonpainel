import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle, Phone, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatCurrency, formatDate } from "@/lib/format";
import { apenasDigitos, ESTAGIO_LABEL, estagioClasse, type LeadEstagio } from "@/lib/leads";
import { registrarFollowUp, type FollowUp } from "@/lib/leads.functions";
import { ADIAMENTOS, ESTAGIOS_RESPOSTA, resumoCadencia } from "@/lib/follow-up";

/**
 * Modo sequencial: percorre a fila do dia um lead por vez.
 * Mesmo padrão do CompletarLeadsDialog — dados grandes, ações diretas,
 * contador "3 de 12" e avanço automático ao registrar.
 */
export function FollowUpSequencialDialog({
  aberto,
  onOpenChange,
  itens,
  onRegistrado,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  itens: FollowUp[];
  onRegistrado: () => void;
}) {
  const registrar = useServerFn(registrarFollowUp);
  const [indice, setIndice] = useState(0);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [feitos, setFeitos] = useState(0);

  const atual = itens[indice];
  const digitos = useMemo(() => apenasDigitos(atual?.telefone), [atual?.telefone]);
  const progresso = itens.length ? ((indice + 1) / itens.length) * 100 : 0;

  useEffect(() => {
    if (aberto) {
      setIndice(0);
      setFeitos(0);
    }
  }, [aberto]);

  useEffect(() => {
    setNota("");
  }, [indice]);

  function proximo() {
    if (indice + 1 >= itens.length) {
      onOpenChange(false);
      onRegistrado();
      return;
    }
    setIndice((i) => i + 1);
  }

  async function aplicar(
    resultado: "sem_resposta" | "respondeu" | "adiar",
    extra?: { novo_estagio?: LeadEstagio; adiar_dias?: number },
  ) {
    if (!atual) return;
    setOcupado(true);
    try {
      await registrar({
        data: {
          lead_id: atual.id,
          resultado,
          ...(nota.trim() ? { nota: nota.trim() } : {}),
          ...extra,
        },
      });
      setFeitos((f) => f + 1);
      onRegistrado();
      proximo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar o follow-up.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !ocupado && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Follow-up do dia</DialogTitle>
          <DialogDescription>
            {itens.length === 0
              ? "Nenhum follow-up na fila de hoje."
              : `${indice + 1} de ${itens.length} · ${feitos} registrado(s) nesta sessão`}
          </DialogDescription>
        </DialogHeader>

        {!atual ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Fila do dia concluída.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Progress value={progresso} />

            <div className="space-y-2 rounded-xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-semibold leading-tight">{atual.nome_contato}</p>
                <Badge variant="outline" className={estagioClasse(atual.estagio)}>
                  {ESTAGIO_LABEL[atual.estagio]}
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground">{atual.telefone}</p>
              <p className="text-xs text-muted-foreground">
                {[atual.empresa, atual.segmento].filter(Boolean).join(" · ") || "Sem empresa"} ·{" "}
                {formatCurrency(atual.valor_estimado)}
              </p>
              <p className="text-xs text-muted-foreground">
                {resumoCadencia(atual)} · agendado para {formatDate(atual.proximo_contato)}
              </p>
              {atual.observacoes && (
                <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                  {atual.observacoes}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${digitos}`}>
                    <Phone className="mr-2 h-4 w-4" /> Ligar
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/55${digitos}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="follow-up-nota">Nota do contato (opcional)</Label>
              <Textarea
                id="follow-up-nota"
                rows={3}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="O que aconteceu neste toque?"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Respondeu — novo estágio</p>
              <div className="flex flex-wrap gap-2">
                {ESTAGIOS_RESPOSTA.map((e) => (
                  <Button
                    key={e}
                    size="sm"
                    variant="outline"
                    disabled={ocupado}
                    onClick={() => void aplicar("respondeu", { novo_estagio: e })}
                  >
                    {ESTAGIO_LABEL[e]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                disabled={ocupado}
                value=""
                onValueChange={(v) => void aplicar("adiar", { adiar_dias: Number(v) })}
              >
                <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Adiar follow-up">
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
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="ghost" disabled={ocupado || !atual} onClick={proximo}>
            <SkipForward className="mr-2 h-4 w-4" /> Pular
          </Button>
          <Button disabled={ocupado || !atual} onClick={() => void aplicar("sem_resposta")}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sem resposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
