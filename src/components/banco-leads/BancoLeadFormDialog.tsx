import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { ESTADOS_BR } from "@/lib/banco-leads";
import { LEAD_ORIGENS, ORIGEM_LABEL, type LeadOrigem } from "@/lib/leads";
import { salvarBancoLeadSchema } from "@/lib/banco-leads.schemas";
import { salvarBancoLead, type BancoLead } from "@/lib/banco-leads.functions";

const SEM = "__sem__";

interface Form {
  nome_contato: string;
  empresa: string;
  cargo: string;
  telefone: string;
  email: string;
  segmento: string;
  cidade: string;
  estado: string;
  origem: LeadOrigem;
  observacoes: string;
  reservado_segmento: string;
  reservado_estado: string;
}

const VAZIO: Form = {
  nome_contato: "",
  empresa: "",
  cargo: "",
  telefone: "",
  email: "",
  segmento: "",
  cidade: "",
  estado: SEM,
  origem: "prospeccao_ativa",
  observacoes: "",
  reservado_segmento: SEM,
  reservado_estado: SEM,
};

/** Cadastro/edição manual de um lead do banco (só admin). */
export function BancoLeadFormDialog({
  aberto,
  onOpenChange,
  lead,
  segmentos,
  onSalvo,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  lead: BancoLead | null;
  segmentos: string[];
  onSalvo: () => void;
}) {
  const salvar = useServerFn(salvarBancoLead);
  const [form, setForm] = useState<Form>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    if (!lead) {
      setForm(VAZIO);
      return;
    }
    setForm({
      nome_contato: lead.nome_contato,
      empresa: lead.empresa ?? "",
      cargo: lead.cargo ?? "",
      telefone: lead.telefone,
      email: lead.email ?? "",
      segmento: lead.segmento ?? "",
      cidade: lead.cidade ?? "",
      estado: lead.estado ?? SEM,
      origem: lead.origem,
      observacoes: lead.observacoes ?? "",
      reservado_segmento: lead.reservado_segmento ?? SEM,
      reservado_estado: lead.reservado_estado ?? SEM,
      data_abertura: lead.data_abertura ?? "",
    });
  }, [aberto, lead]);

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function enviar() {
    const bruto = {
      ...(lead ? { id: lead.id } : {}),
      nome_contato: form.nome_contato,
      empresa: form.empresa,
      cargo: form.cargo,
      telefone: form.telefone,
      email: form.email,
      segmento: form.segmento,
      cidade: form.cidade,
      estado: form.estado === SEM ? "" : form.estado,
      origem: form.origem,
      observacoes: form.observacoes,
      reservado_segmento: form.reservado_segmento === SEM ? "" : form.reservado_segmento,
      reservado_estado: form.reservado_estado === SEM ? "" : form.reservado_estado,
      data_abertura: form.data_abertura || null,
    };
    const parsed = salvarBancoLeadSchema.safeParse(bruto);
    if (!parsed.success) {
      const mapa: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const campo = String(issue.path[0] ?? "");
        if (campo && !mapa[campo]) mapa[campo] = issue.message;
      }
      setErros(mapa);
      toast.error("Confira os campos destacados.");
      return;
    }
    setSalvando(true);
    try {
      await salvar({ data: parsed.data });
      toast.success(lead ? "Lead atualizado." : "Lead adicionado ao banco.");
      onOpenChange(false);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead do banco" : "Novo lead no banco"}</DialogTitle>
          <DialogDescription>
            Leads do banco ficam disponíveis para os vendedores puxarem para a carteira deles.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bl-nome">Nome do contato</Label>
            <Input
              id="bl-nome"
              value={form.nome_contato}
              onChange={(e) => set("nome_contato", e.target.value)}
              maxLength={120}
            />
            {erros.nome_contato ? (
              <p className="text-xs text-destructive">{erros.nome_contato}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-empresa">Empresa</Label>
            <Input
              id="bl-empresa"
              value={form.empresa}
              onChange={(e) => set("empresa", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-cargo">Cargo</Label>
            <Input
              id="bl-cargo"
              value={form.cargo}
              onChange={(e) => set("cargo", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-telefone">Telefone (com DDD)</Label>
            <Input
              id="bl-telefone"
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="(11) 90000-0000"
            />
            {erros.telefone ? <p className="text-xs text-destructive">{erros.telefone}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-email">E-mail</Label>
            <Input
              id="bl-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              maxLength={200}
            />
            {erros.email ? <p className="text-xs text-destructive">{erros.email}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-segmento">Segmento</Label>
            <Input
              id="bl-segmento"
              value={form.segmento}
              onChange={(e) => set("segmento", e.target.value)}
              list="bl-segmentos"
              maxLength={120}
            />
            <datalist id="bl-segmentos">
              {segmentos.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={form.origem} onValueChange={(v) => set("origem", v as LeadOrigem)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_ORIGENS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {ORIGEM_LABEL[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-cidade">Cidade</Label>
            <Input
              id="bl-cidade"
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-abertura">Data de abertura</Label>
            <Input
              id="bl-abertura"
              type="date"
              value={form.data_abertura}
              onChange={(e) => set("data_abertura", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Não informado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM}>Não informado</SelectItem>
                {ESTADOS_BR.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reservar para o segmento</Label>
            <Select
              value={form.reservado_segmento}
              onValueChange={(v) => set("reservado_segmento", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem reserva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM}>Sem reserva</SelectItem>
                {segmentos.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reservar para o estado</Label>
            <Select value={form.reservado_estado} onValueChange={(v) => set("reservado_estado", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem reserva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM}>Sem reserva</SelectItem>
                {ESTADOS_BR.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bl-obs">Observações</Label>
            <Textarea
              id="bl-obs"
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={salvando}>
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
