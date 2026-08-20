import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  PhoneOff,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ESTAGIO_LABEL, apenasDigitos, type LeadEstagio } from "@/lib/leads";
import { ADIAMENTOS, ESTAGIOS_RESPOSTA } from "@/lib/follow-up";
import {
  registrarFollowUp,
  reativarCadencia,
  listarMensagensRapidas,
  registrarEnvioMensagem,
  type Lead,
} from "@/lib/leads.functions";

interface Props {
  lead: Lead;
  /** Recarrega a listagem depois de qualquer registro. */
  onAtualizado: () => void;
  onEditar?: (lead: Lead) => void;
  onExcluir?: (lead: Lead) => void;
  onDetalhes?: (lead: Lead) => void;
}

/**
 * Ações de um lead direto na listagem: "Respondeu" e "Não respondeu" em
 * destaque; adiar, reativar cadência, editar e excluir no menu "…".
 */
export function AcoesFollowUpLead({ lead, onAtualizado, onEditar, onExcluir, onDetalhes }: Props) {
  const registrar = useServerFn(registrarFollowUp);
  const reativar = useServerFn(reativarCadencia);
  const carregarMensagens = useServerFn(listarMensagensRapidas);
  const registrarMensagem = useServerFn(registrarEnvioMensagem);

  const [ocupado, setOcupado] = useState(false);
  const [respondeuAberto, setRespondeuAberto] = useState(false);
  const [mensagensAberto, setMensagensAberto] = useState(false);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);
  const [nota, setNota] = useState("");
  const [enviadasLocais, setEnviadasLocais] = useState<string[]>(() =>
    Array.isArray(lead.mensagens_enviadas) ? (lead.mensagens_enviadas as string[]) : [],
  );

  const digitos = apenasDigitos(lead.telefone);

  async function semResposta() {
    setOcupado(true);
    try {
      await registrar({ data: { lead_id: lead.id, resultado: "sem_resposta" } });
      toast.success("Tentativa registrada. Próximo contato reagendado.");
      onAtualizado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar o contato.");
    } finally {
      setOcupado(false);
    }
  }

  async function respondeu(estagio: LeadEstagio) {
    setOcupado(true);
    setRespondeuAberto(false);
    try {
      await registrar({
        data: {
          lead_id: lead.id,
          resultado: "respondeu",
          novo_estagio: estagio,
          ...(nota.trim() ? { nota: nota.trim() } : {}),
        },
      });
      setNota("");
      toast.success(`Resposta registrada · ${ESTAGIO_LABEL[estagio]}.`);
      onAtualizado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a resposta.");
    } finally {
      setOcupado(false);
    }
  }

  async function adiar(dias: number) {
    setOcupado(true);
    try {
      await registrar({ data: { lead_id: lead.id, resultado: "adiar", adiar_dias: dias } });
      toast.success(`Follow-up adiado em ${dias} dias.`);
      onAtualizado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível adiar o follow-up.");
    } finally {
      setOcupado(false);
    }
  }

  async function reativarCadenciaLead() {
    setOcupado(true);
    try {
      await reativar({ data: { lead_id: lead.id } });
      toast.success("Cadência reativada.");
      onAtualizado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reativar a cadência.");
    } finally {
      setOcupado(false);
    }
  }

  async function abrirMensagens() {
    if (mensagens.length > 0) {
      setMensagensAberto(true);
      return;
    }
    setCarregandoMsgs(true);
    try {
      const data = await carregarMensagens();
      setMensagens(data);
      setMensagensAberto(true);
    } catch (err) {
      toast.error("Erro ao carregar mensagens rápidas");
    } finally {
      setCarregandoMsgs(false);
    }
  }

  function extrairPrimeiroNome(nomeCompleto: string) {
    // Pega o primeiro pedaço que realmente parece um nome: ignora números,
    // pontuação (ex.: "55.182.605") e conectivos soltos.
    const tokens = (nomeCompleto ?? "")
      .split(/[\s/|,;-]+/)
      .map((t) => t.replace(/[^\p{L}]/gu, ""))
      .filter((t) => t.length >= 2);
    const primeiro = tokens[0];
    if (!primeiro) return "";
    return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
  }


  async function copiarMensagem(msg: any) {
    try {
      const nome = extrairPrimeiroNome(lead.nome_contato);
      const textoProcessado = msg.texto.replace(/\[nome\]/gi, nome);

      await navigator.clipboard.writeText(textoProcessado);
      toast.success("Mensagem copiada!");

      // Marca localmente como enviada (sem recarregar a listagem, para o lead
      // não sair da tela). O registro no banco acontece em segundo plano.
      setEnviadasLocais((atual) => (atual.includes(msg.id) ? atual : [...atual, msg.id]));
      await registrarMensagem({ data: { lead_id: lead.id, mensagem_id: msg.id } });
    } catch (err) {
      toast.error("Erro ao copiar mensagem");
    }
  }


  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {digitos && (
        <Button asChild variant="outline" size="sm" aria-label="Abrir WhatsApp">
          <a href={`https://wa.me/55${digitos}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </Button>
      )}

      <Popover open={mensagensAberto} onOpenChange={setMensagensAberto}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" onClick={abrirMensagens} disabled={carregandoMsgs}>
            <Copy className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Copiar Mensagem</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2 space-y-1" align="start">
          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Mensagens Rápidas
          </p>
          {mensagens.length === 0 && !carregandoMsgs && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma mensagem configurada.
            </p>
          )}
          {mensagens.map((msg) => {
            const jaEnviada = enviadasLocais.includes(msg.id);
            return (
              <button
                key={msg.id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors relative group"
                onClick={() => void copiarMensagem(msg)}
              >
                <p className="text-sm line-clamp-2 pr-6">{msg.texto}</p>
                {jaEnviada && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-green-500" title="Já enviada para este lead" />
                )}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      <Popover open={respondeuAberto} onOpenChange={setRespondeuAberto}>
        <PopoverTrigger asChild>
          <Button size="sm" disabled={ocupado}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Respondeu
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="end">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Como ficou o lead?</p>
            <div className="flex flex-wrap gap-1.5">
              {ESTAGIOS_RESPOSTA.map((e) => (
                <Button
                  key={e}
                  size="sm"
                  variant="outline"
                  disabled={ocupado}
                  onClick={() => void respondeu(e)}
                >
                  {ESTAGIO_LABEL[e]}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`nota-${lead.id}`} className="text-xs">
              Nota do contato (opcional)
            </Label>
            <Textarea
              id={`nota-${lead.id}`}
              rows={2}
              value={nota}
              onChange={(ev) => setNota(ev.target.value)}
              placeholder="O que ele respondeu?"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void semResposta()}>
        <PhoneOff className="mr-1.5 h-4 w-4" /> Não respondeu
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={ocupado} aria-label="Mais ações do lead">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs">Adiar follow-up</DropdownMenuLabel>
          {ADIAMENTOS.map((d) => (
            <DropdownMenuItem key={d} onSelect={() => void adiar(d)}>
              +{d} dias
            </DropdownMenuItem>
          ))}
          {lead.cadencia_encerrada && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void reativarCadenciaLead()}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reativar cadência
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          {onDetalhes && (
            <DropdownMenuItem onSelect={() => onDetalhes(lead)}>
              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
            </DropdownMenuItem>
          )}
          {onEditar && (
            <DropdownMenuItem onSelect={() => onEditar(lead)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar lead
            </DropdownMenuItem>
          )}
          {onExcluir && (
            <DropdownMenuItem className="text-destructive" onSelect={() => onExcluir(lead)}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir lead
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
