import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WhatsAppIndicator } from "@/components/WhatsAppIndicator";

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

import { salvarLead, type Lead } from "@/lib/leads.functions";
import {
  ESTAGIOS_COM_MOTIVO,
  ESTAGIO_LABEL,
  LEAD_ESTAGIOS,
  LEAD_ORIGENS,
  ORIGEM_LABEL,
  SEGMENTOS_SUGERIDOS,
  apenasDigitos,
  type LeadEstagio,
  type LeadOrigem,
} from "@/lib/leads";

interface Props {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: Lead | null;
  segmentos: string[];
  vendedores?: { id: string; nome: string }[];
  isAdmin: boolean;
  onSalvo: () => void;
}

interface FormState {
  nome_contato: string;
  empresa: string;
  cargo: string;
  telefone: string;
  email: string;
  segmento: string;
  origem: LeadOrigem;
  estagio: LeadEstagio;
  valor_estimado: string;
  motivo_perda: string;
  observacoes: string;
  contatado_em: string;
  proximo_contato: string;
  vendedor_id: string;
}

const vazio: FormState = {
  nome_contato: "",
  empresa: "",
  cargo: "",
  telefone: "",
  email: "",
  segmento: "",
  origem: "prospeccao_ativa",
  estagio: "contatado",
  valor_estimado: "0",
  motivo_perda: "",
  observacoes: "",
  contatado_em: new Date().toISOString().slice(0, 10),
  proximo_contato: "",
  vendedor_id: "",
};

export function LeadFormDialog({
  aberto,
  onOpenChange,
  lead,
  segmentos,
  vendedores = [],
  isAdmin,
  onSalvo,
}: Props) {
  const salvar = useServerFn(salvarLead);
  const [form, setForm] = useState<FormState>(vazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    if (lead) {
      setForm({
        nome_contato: lead.nome_contato,
        empresa: lead.empresa ?? "",
        cargo: lead.cargo ?? "",
        telefone: lead.telefone,
        email: lead.email ?? "",
        segmento: lead.segmento ?? "",
        origem: lead.origem,
        estagio: lead.estagio,
        valor_estimado: String(lead.valor_estimado ?? 0),
        motivo_perda: lead.motivo_perda ?? "",
        observacoes: lead.observacoes ?? "",
        contatado_em: lead.contatado_em,
        proximo_contato: lead.proximo_contato ?? "",
        vendedor_id: lead.vendedor_id,
      });
    } else {
      setForm({ ...vazio, contatado_em: new Date().toISOString().slice(0, 10) });
    }
  }, [aberto, lead]);

  const sugestoes = useMemo(
    () => Array.from(new Set([...segmentos, ...SEGMENTOS_SUGERIDOS])),
    [segmentos],
  );

  const exigeMotivo = ESTAGIOS_COM_MOTIVO.includes(form.estagio);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (form.nome_contato.trim().length < 2) e.nome_contato = "Informe o nome do contato";
    const d = apenasDigitos(form.telefone);
    if (d.length < 10 || d.length > 11) e.telefone = "Telefone com DDD (10 ou 11 dígitos)";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "E-mail inválido";
    if (Number(form.valor_estimado.replace(",", ".")) < 0 || Number.isNaN(Number(form.valor_estimado.replace(",", "."))))
      e.valor_estimado = "Valor inválido";
    if (exigeMotivo && !form.motivo_perda.trim()) e.motivo_perda = "Informe o motivo da perda";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar() {
    if (!validar()) return;
    setSalvando(true);
    try {
      await salvar({
        data: {
          ...(lead ? { id: lead.id } : {}),
          ...(isAdmin && form.vendedor_id ? { vendedor_id: form.vendedor_id } : {}),
          nome_contato: form.nome_contato.trim(),
          empresa: form.empresa.trim(),
          cargo: form.cargo.trim(),
          telefone: form.telefone.trim(),
          email: form.email.trim(),
          segmento: form.segmento.trim(),
          origem: form.origem,
          estagio: form.estagio,
          valor_estimado: Number(form.valor_estimado.replace(",", ".")) || 0,
          motivo_perda: form.motivo_perda.trim(),
          observacoes: form.observacoes.trim(),
          contatado_em: form.contatado_em,
          proximo_contato: form.proximo_contato,
        },
      });
      toast.success(lead ? "Lead atualizado." : "Lead cadastrado.");
      onOpenChange(false);
      onSalvo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o lead.");
    } finally {
      setSalvando(false);
    }
  }

  function campo(chave: keyof FormState) {
    return (v: string) => setForm((f) => ({ ...f, [chave]: v }));
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>
            Registre o contato prospectado e mantenha o estágio do funil atualizado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nome_contato">Nome do contato *</Label>
            <Input
              id="nome_contato"
              value={form.nome_contato}
              onChange={(e) => campo("nome_contato")(e.target.value)}
            />
            {erros.nome_contato && (
              <p className="text-xs text-destructive">{erros.nome_contato}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="empresa">Empresa</Label>
            <Input
              id="empresa"
              value={form.empresa}
              onChange={(e) => campo("empresa")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo">Cargo</Label>
            <Input id="cargo" value={form.cargo} onChange={(e) => campo("cargo")(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="telefone"
                value={form.telefone}
                placeholder="(11) 99999-9999"
                onChange={(e) => campo("telefone")(e.target.value)}
              />
              <WhatsAppIndicator telefone={form.telefone} />
            </div>
            {erros.telefone && <p className="text-xs text-destructive">{erros.telefone}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              value={form.email}
              onChange={(e) => campo("email")(e.target.value)}
            />
            {erros.email && <p className="text-xs text-destructive">{erros.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="segmento">Segmento</Label>
            <Input
              id="segmento"
              list="segmentos-sugeridos"
              value={form.segmento}
              placeholder="Ex.: Comércio"
              onChange={(e) => campo("segmento")(e.target.value)}
            />
            <datalist id="segmentos-sugeridos">
              {sugestoes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select
              value={form.origem}
              onValueChange={(v) => setForm((f) => ({ ...f, origem: v as LeadOrigem }))}
            >
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
            <Label>Estágio</Label>
            <Select
              value={form.estagio}
              onValueChange={(v) => setForm((f) => ({ ...f, estagio: v as LeadEstagio }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_ESTAGIOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTAGIO_LABEL[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valor">Valor estimado (R$)</Label>
            <Input
              id="valor"
              inputMode="decimal"
              value={form.valor_estimado}
              onChange={(e) => campo("valor_estimado")(e.target.value)}
            />
            {erros.valor_estimado && (
              <p className="text-xs text-destructive">{erros.valor_estimado}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contatado_em">Data do contato</Label>
            <Input
              id="contatado_em"
              type="date"
              value={form.contatado_em}
              onChange={(e) => campo("contatado_em")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proximo_contato">Próximo contato</Label>
            <Input
              id="proximo_contato"
              type="date"
              value={form.proximo_contato}
              onChange={(e) => campo("proximo_contato")(e.target.value)}
            />
          </div>

          {isAdmin && !lead && vendedores.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vendedor responsável</Label>
              <Select
                value={form.vendedor_id}
                onValueChange={(v) => setForm((f) => ({ ...f, vendedor_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {exigeMotivo && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="motivo_perda">Motivo da perda *</Label>
              <Input
                id="motivo_perda"
                value={form.motivo_perda}
                onChange={(e) => campo("motivo_perda")(e.target.value)}
              />
              {erros.motivo_perda && (
                <p className="text-xs text-destructive">{erros.motivo_perda}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={4}
              maxLength={4000}
              value={form.observacoes}
              placeholder="Detalhes da conversa, necessidades do cliente, próximos passos..."
              onChange={(e) => campo("observacoes")(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {lead ? "Salvar alterações" : "Cadastrar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
