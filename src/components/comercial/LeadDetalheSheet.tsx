import { WhatsAppIndicator } from "@/components/WhatsAppIndicator";
import { useCallback, useEffect, useState } from "react";
import { statusWhatsApp, WHATSAPP_MENSAGEM, type WhatsAppStatus } from "@/lib/whatsapp";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Loader2, MessageSquarePlus, Phone } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatCurrency, formatDate } from "@/lib/format";
import {
  ESTAGIOS_COM_MOTIVO,
  ESTAGIO_LABEL,
  LEAD_ESTAGIOS,
  ORIGEM_LABEL,
  REUNIAO_LABEL,
  apenasDigitos,
  estagioClasse,
  linkWhatsApp,
  type LeadEstagio,
  type ReuniaoStatus,
} from "@/lib/leads";
import {
  listarAtividades,
  listarReunioes,
  mudarEstagio,
  registrarAtividade,
  salvarReuniao,
  type Atividade,
  type Lead,
  type Reuniao,
} from "@/lib/leads.functions";

interface Props {
  lead: Lead | null;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  onAtualizado: () => void;
}

function agora() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function LeadDetalheSheet({ lead, aberto, onOpenChange, onAtualizado }: Props) {
  const carregarAtividades = useServerFn(listarAtividades);
  const carregarReunioes = useServerFn(listarReunioes);
  const mudar = useServerFn(mudarEstagio);
  const novaNota = useServerFn(registrarAtividade);
  const gravarReuniao = useServerFn(salvarReuniao);

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  /** Revalidado sempre que a tela abre, para refletir telefones editados há pouco. */
  const [zap, setZap] = useState<WhatsAppStatus>(() => statusWhatsApp(lead?.telefone));

  const [formReuniao, setFormReuniao] = useState({
    aberto: false,
    id: "" as string,
    agendada_para: agora(),
    status: "marcada" as ReuniaoStatus,
    notas: "",
    nova_data: agora(),
  });

  const recarregar = useCallback(async () => {
    if (!lead) return;
    setCarregando(true);
    try {
      const [a, r] = await Promise.all([
        carregarAtividades({ data: { lead_id: lead.id } }),
        carregarReunioes({ data: { lead_id: lead.id } }),
      ]);
      setAtividades(a);
      setReunioes(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
    } finally {
      setCarregando(false);
    }
  }, [lead, carregarAtividades, carregarReunioes]);

  useEffect(() => {
    if (aberto && lead) void recarregar();
  }, [aberto, lead, recarregar]);

  if (!lead) return null;

  async function trocarEstagio(estagio: LeadEstagio) {
    if (!lead) return;
    let motivo = lead.motivo_perda ?? "";
    if (ESTAGIOS_COM_MOTIVO.includes(estagio) && !motivo) {
      const resposta = window.prompt("Qual o motivo da perda?");
      if (!resposta || !resposta.trim()) return;
      motivo = resposta.trim();
    }
    setOcupado(true);
    try {
      await mudar({
        data: {
          id: lead.id,
          estagio,
          ...(ESTAGIOS_COM_MOTIVO.includes(estagio) ? { motivo_perda: motivo } : {}),
        },
      });
      toast.success(`Estágio alterado para ${ESTAGIO_LABEL[estagio]}.`);
      onAtualizado();
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível mudar o estágio.");
    } finally {
      setOcupado(false);
    }
  }

  async function enviarNota() {
    if (!lead || !nota.trim()) return;
    setOcupado(true);
    try {
      await novaNota({ data: { lead_id: lead.id, corpo: nota.trim() } });
      setNota("");
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a nota.");
    } finally {
      setOcupado(false);
    }
  }

  async function enviarReuniao() {
    if (!lead) return;
    setOcupado(true);
    try {
      await gravarReuniao({
        data: {
          ...(formReuniao.id ? { id: formReuniao.id } : {}),
          lead_id: lead.id,
          agendada_para: new Date(formReuniao.agendada_para).toISOString(),
          status: formReuniao.status,
          notas: formReuniao.notas,
          ...(formReuniao.status === "remarcada"
            ? { nova_data: new Date(formReuniao.nova_data).toISOString() }
            : {}),
        },
      });
      toast.success("Reunião registrada.");
      setFormReuniao((f) => ({ ...f, aberto: false, id: "", notas: "" }));
      onAtualizado();
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a reunião.");
    } finally {
      setOcupado(false);
    }
  }

  async function statusRapido(r: Reuniao, status: ReuniaoStatus) {
    if (status === "remarcada") {
      setFormReuniao({
        aberto: true,
        id: r.id,
        agendada_para: r.agendada_para.slice(0, 16),
        status: "remarcada",
        notas: r.notas ?? "",
        nova_data: agora(),
      });
      return;
    }
    setOcupado(true);
    try {
      await gravarReuniao({
        data: {
          id: r.id,
          lead_id: r.lead_id,
          agendada_para: r.agendada_para,
          status,
          notas: r.notas ?? "",
        },
      });
      onAtualizado();
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a reunião.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-8">{lead.nome_contato}</SheetTitle>
          <SheetDescription>
            {[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || "Sem empresa informada"}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="resumo" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="resumo" className="flex-1">
              Resumo
            </TabsTrigger>
            <TabsTrigger value="reunioes" className="flex-1">
              Reuniões
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1">
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={estagioClasse(lead.estagio)}>
                {ESTAGIO_LABEL[lead.estagio]}
              </Badge>
              <Badge variant="outline">{ORIGEM_LABEL[lead.origem]}</Badge>
              {lead.segmento && <Badge variant="outline">{lead.segmento}</Badge>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${apenasDigitos(lead.telefone)}`}>
                  <Phone className="mr-2 h-4 w-4" /> Ligar
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={linkWhatsApp(lead.telefone)} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </Button>
              <WhatsAppIndicator telefone={lead.telefone} />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Telefone</dt>
                <dd className="flex items-center gap-1.5">
                  {lead.telefone}
                  <WhatsAppIndicator telefone={lead.telefone} size="sm" />
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">E-mail</dt>
                <dd className="break-all">{lead.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valor estimado</dt>
                <dd>{formatCurrency(lead.valor_estimado)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contato em</dt>
                <dd>{formatDate(lead.contatado_em)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Próximo contato</dt>
                <dd>{lead.proximo_contato ? formatDate(lead.proximo_contato) : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reuniões</dt>
                <dd>{reunioes.length}</dd>
              </div>
              {lead.motivo_perda && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Motivo da perda</dt>
                  <dd>{lead.motivo_perda}</dd>
                </div>
              )}
              {lead.observacoes && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Observações</dt>
                  <dd className="whitespace-pre-wrap">{lead.observacoes}</dd>
                </div>
              )}
            </dl>

            <div className="space-y-2">
              <p className="text-sm font-medium">Mudar estágio</p>
              <div className="flex flex-wrap gap-2">
                {LEAD_ESTAGIOS.filter((e) => e !== lead.estagio).map((e) => (
                  <Button
                    key={e}
                    size="sm"
                    variant="outline"
                    disabled={ocupado}
                    onClick={() => void trocarEstagio(e)}
                  >
                    {ESTAGIO_LABEL[e]}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reunioes" className="space-y-3 pt-4">
            <Button
              size="sm"
              onClick={() =>
                setFormReuniao({
                  aberto: true,
                  id: "",
                  agendada_para: agora(),
                  status: "marcada",
                  notas: "",
                  nova_data: agora(),
                })
              }
            >
              <CalendarPlus className="mr-2 h-4 w-4" /> Agendar reunião
            </Button>

            {formReuniao.aberto && (
              <Card className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <Label>Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={formReuniao.agendada_para}
                    onChange={(e) =>
                      setFormReuniao((f) => ({ ...f, agendada_para: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Situação</Label>
                  <Select
                    value={formReuniao.status}
                    onValueChange={(v) =>
                      setFormReuniao((f) => ({ ...f, status: v as ReuniaoStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REUNIAO_LABEL) as ReuniaoStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {REUNIAO_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formReuniao.status === "remarcada" && (
                  <div className="space-y-1.5">
                    <Label>Nova data e hora</Label>
                    <Input
                      type="datetime-local"
                      value={formReuniao.nova_data}
                      onChange={(e) =>
                        setFormReuniao((f) => ({ ...f, nova_data: e.target.value }))
                      }
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Textarea
                    rows={3}
                    value={formReuniao.notas}
                    onChange={(e) => setFormReuniao((f) => ({ ...f, notas: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormReuniao((f) => ({ ...f, aberto: false }))}
                    disabled={ocupado}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={() => void enviarReuniao()} disabled={ocupado}>
                    {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </Card>
            )}

            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando reuniões...</p>
            ) : reunioes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma reunião registrada para este lead.
              </p>
            ) : (
              reunioes.map((r) => (
                <Card key={r.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {new Date(r.agendada_para).toLocaleString("pt-BR")}
                    </p>
                    <Badge variant="outline">{REUNIAO_LABEL[r.status]}</Badge>
                  </div>
                  {r.remarcada_de && (
                    <p className="text-xs text-muted-foreground">Remarcada de outra reunião</p>
                  )}
                  {r.notas && <p className="text-sm text-muted-foreground">{r.notas}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ocupado}
                      onClick={() => void statusRapido(r, "realizada")}
                    >
                      Realizada
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ocupado}
                      onClick={() => void statusRapido(r, "no_show")}
                    >
                      No-show
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ocupado}
                      onClick={() => void statusRapido(r, "remarcada")}
                    >
                      Remarcar
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Textarea
                rows={3}
                placeholder="Adicionar nota sobre este lead..."
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <Button size="sm" onClick={() => void enviarNota()} disabled={ocupado || !nota.trim()}>
                <MessageSquarePlus className="mr-2 h-4 w-4" /> Adicionar nota
              </Button>
            </div>

            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            ) : atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {atividades.map((a) => (
                  <li key={a.id} className="space-y-1">
                    <p className="text-sm">
                      {a.tipo === "estagio" ? (
                        <>
                          Estágio:{" "}
                          <span className="text-muted-foreground">
                            {ESTAGIO_LABEL[(a.de ?? "") as LeadEstagio] ?? a.de}
                          </span>{" "}
                          →{" "}
                          <span className="font-medium">
                            {ESTAGIO_LABEL[(a.para ?? "") as LeadEstagio] ?? a.para}
                          </span>
                        </>
                      ) : (
                        a.corpo
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.autor_nome} ·{" "}
                      {formatDistanceToNow(new Date(a.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
