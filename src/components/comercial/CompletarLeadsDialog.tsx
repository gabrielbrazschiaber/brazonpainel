import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle, Phone, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { apenasDigitos, ESTAGIO_LABEL, type LeadEstagio } from "@/lib/leads";
import { salvarLead, type Lead } from "@/lib/leads.functions";

const ATALHOS: LeadEstagio[] = ["interessado", "nao_interessado", "em_negociacao"];

interface Rascunho {
  empresa: string;
  cargo: string;
  email: string;
  segmento: string;
  observacoes: string;
}

function doLead(l: Lead): Rascunho {
  return {
    empresa: l.empresa ?? "",
    cargo: l.cargo ?? "",
    email: l.email ?? "",
    segmento: l.segmento ?? "",
    observacoes: l.observacoes ?? "",
  };
}

/** Modo preenchimento rápido: um lead por vez, com atalhos de estágio. */
export function CompletarLeadsDialog({
  aberto,
  onOpenChange,
  leads,
  segmentos,
  onAtualizado,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  leads: Lead[];
  segmentos: string[];
  onAtualizado: () => void;
}) {
  const salvar = useServerFn(salvarLead);
  const [indice, setIndice] = useState(0);
  const [rascunho, setRascunho] = useState<Rascunho>({
    empresa: "",
    cargo: "",
    email: "",
    segmento: "",
    observacoes: "",
  });
  const [ocupado, setOcupado] = useState(false);
  const [concluidos, setConcluidos] = useState(0);

  const atual = leads[indice];

  useEffect(() => {
    if (aberto) {
      setIndice(0);
      setConcluidos(0);
    }
  }, [aberto]);

  useEffect(() => {
    if (atual) setRascunho(doLead(atual));
  }, [atual]);

  const digitos = useMemo(() => apenasDigitos(atual?.telefone), [atual?.telefone]);
  const progresso = leads.length ? ((indice + 1) / leads.length) * 100 : 0;

  function proximo() {
    if (indice + 1 >= leads.length) {
      onOpenChange(false);
      onAtualizado();
      return;
    }
    setIndice((i) => i + 1);
  }

  async function salvarAtual(estagio?: LeadEstagio) {
    if (!atual) return;
    setOcupado(true);
    try {
      await salvar({
        data: {
          id: atual.id,
          nome_contato: atual.nome_contato,
          telefone: atual.telefone,
          empresa: rascunho.empresa,
          cargo: rascunho.cargo,
          email: rascunho.email,
          segmento: rascunho.segmento,
          observacoes: rascunho.observacoes,
          origem: atual.origem,
          estagio: estagio ?? atual.estagio,
          valor_estimado: atual.valor_estimado,
          motivo_perda:
            estagio === "nao_interessado"
              ? (atual.motivo_perda ?? "Sem interesse informado no contato")
              : (atual.motivo_perda ?? ""),
          proximo_contato: atual.proximo_contato ?? "",
          contatado_em: atual.contatado_em,
        },
      });
      setConcluidos((c) => c + 1);
      onAtualizado();
      proximo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o lead.");
    } finally {
      setOcupado(false);
    }
  }

  const preenchidos = atual
    ? [atual.empresa, atual.cargo, atual.email, atual.segmento].filter(Boolean).length
    : 0;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !ocupado && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Completar leads</DialogTitle>
          <DialogDescription>
            {leads.length === 0
              ? "Nenhum lead incompleto por aqui."
              : `${indice + 1} de ${leads.length} · ${concluidos} salvo(s) nesta sessão`}
          </DialogDescription>
        </DialogHeader>

        {!atual ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Tudo em ordem — nenhum lead pendente de preenchimento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Progress value={progresso} />

            <div className="space-y-2 rounded-xl border border-border/60 p-4">
              <p className="text-xl font-semibold leading-tight">{atual.nome_contato}</p>
              <p className="text-lg text-muted-foreground">{atual.telefone}</p>
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
                <span className="ml-auto self-center text-xs text-muted-foreground">
                  {preenchidos}/4 campos
                </span>
              </div>
            </div>

            {/* Campos vazios em destaque */}
            <div className="space-y-3">
              {(
                [
                  { campo: "empresa" as const, label: "Empresa" },
                  { campo: "cargo" as const, label: "Cargo" },
                  { campo: "email" as const, label: "E-mail" },
                  { campo: "segmento" as const, label: "Segmento" },
                ] satisfies { campo: keyof Rascunho; label: string }[]
              )
                .filter((c) => !doLead(atual)[c.campo])
                .map((c) => (
                  <div key={c.campo} className="space-y-1.5">
                    <Label htmlFor={`rapido-${c.campo}`}>{c.label}</Label>
                    <Input
                      id={`rapido-${c.campo}`}
                      autoFocus={c.campo === "empresa"}
                      value={rascunho[c.campo]}
                      list={c.campo === "segmento" ? "segmentos-rapido" : undefined}
                      onChange={(e) => setRascunho((r) => ({ ...r, [c.campo]: e.target.value }))}
                    />
                  </div>
                ))}
              <datalist id="segmentos-rapido">
                {segmentos.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Já preenchidos: recolhidos */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 text-xs">
                  Ver e editar campos já preenchidos
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {(
                  [
                    { campo: "empresa" as const, label: "Empresa" },
                    { campo: "cargo" as const, label: "Cargo" },
                    { campo: "email" as const, label: "E-mail" },
                    { campo: "segmento" as const, label: "Segmento" },
                  ] satisfies { campo: keyof Rascunho; label: string }[]
                )
                  .filter((c) => Boolean(doLead(atual)[c.campo]))
                  .map((c) => (
                    <div key={c.campo} className="space-y-1.5">
                      <Label htmlFor={`cheio-${c.campo}`}>{c.label}</Label>
                      <Input
                        id={`cheio-${c.campo}`}
                        value={rascunho[c.campo]}
                        onChange={(e) => setRascunho((r) => ({ ...r, [c.campo]: e.target.value }))}
                      />
                    </div>
                  ))}
                <div className="space-y-1.5">
                  <Label htmlFor="rapido-obs">Observações</Label>
                  <Textarea
                    id="rapido-obs"
                    rows={3}
                    value={rascunho.observacoes}
                    onChange={(e) => setRascunho((r) => ({ ...r, observacoes: e.target.value }))}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap gap-2">
              {ATALHOS.map((e) => (
                <Button
                  key={e}
                  size="sm"
                  variant="outline"
                  disabled={ocupado}
                  onClick={() => void salvarAtual(e)}
                >
                  {ESTAGIO_LABEL[e]}
                </Button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="ghost" disabled={ocupado || !atual} onClick={proximo}>
            <SkipForward className="mr-2 h-4 w-4" /> Pular
          </Button>
          <Button disabled={ocupado || !atual} onClick={() => void salvarAtual()}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar e próximo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
