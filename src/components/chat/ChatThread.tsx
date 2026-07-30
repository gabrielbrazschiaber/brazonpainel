import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  editarMensagem,
  enviarMensagem,
  excluirMensagem,
  listarMensagens,
  marcarConversaLida,
  type Mensagem,
} from "@/lib/chat.functions";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const ROTULO_PAPEL: Record<string, string> = {
  admin: "Admin",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

function diaDe(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function ChatThread({
  conversaId,
  titulo,
  aoAtualizar,
  ativo,
}: {
  conversaId: string;
  titulo: string;
  /** Avisa o pai (badge de não-lidas) que houve leitura ou nova mensagem. */
  aoAtualizar?: () => void;
  /** Enquanto true, mantém o polling de 15s. */
  ativo: boolean;
}) {
  const { user, role } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [corpo, setCorpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const fimRef = useRef<HTMLDivElement | null>(null);
  const montado = useRef(true);

  const buscar = useServerFn(listarMensagens);
  const enviar = useServerFn(enviarMensagem);
  const editar = useServerFn(editarMensagem);
  const excluir = useServerFn(excluirMensagem);
  const marcarLida = useServerFn(marcarConversaLida);

  const rolarParaFim = useCallback((suave = false) => {
    requestAnimationFrame(() => {
      fimRef.current?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "end" });
    });
  }, []);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarregando(true);
      try {
        const lista = await buscar({ data: { conversa_id: conversaId } });
        if (!montado.current) return;
        setMensagens(lista);
        if (!silencioso) rolarParaFim();
      } catch (e) {
        if (!silencioso) {
          toast.error("Não foi possível carregar a conversa", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      } finally {
        if (montado.current && !silencioso) setCarregando(false);
      }
    },
    [buscar, conversaId, rolarParaFim],
  );

  useEffect(() => {
    montado.current = true;
    void carregar();
    void marcarLida({ data: { conversa_id: conversaId } })
      .then(() => aoAtualizar?.())
      .catch(() => undefined);
    return () => {
      montado.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId]);

  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void carregar(true);
    }, 15000);
    return () => clearInterval(id);
  }, [ativo, carregar]);

  async function handleEnviar() {
    const texto = corpo.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    try {
      const nova = await enviar({ data: { conversa_id: conversaId, corpo: texto } });
      setMensagens((m) => [...m, nova]);
      setCorpo("");
      rolarParaFim(true);
      aoAtualizar?.();
    } catch (e) {
      toast.error("Não foi possível enviar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setEnviando(false);
    }
  }

  async function handleSalvarEdicao(id: string) {
    const texto = textoEdicao.trim();
    if (!texto) return;
    try {
      const res = await editar({ data: { id, corpo: texto } });
      setMensagens((m) =>
        m.map((x) => (x.id === id ? { ...x, corpo: texto, updated_at: res.updated_at, editado: true } : x)),
      );
      setEditandoId(null);
      toast.success("Mensagem atualizada.");
    } catch (e) {
      toast.error("Não foi possível editar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      setMensagens((m) => m.filter((x) => x.id !== id));
      toast.success("Mensagem excluída.");
    } catch (e) {
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setExcluirId(null);
    }
  }

  let diaAnterior = "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-1 pb-3">
        <p className="truncate text-sm font-semibold">{titulo}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-2">
        {carregando ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : mensagens.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Escreva a primeira.
          </p>
        ) : (
          <div className="space-y-3 py-4">
            {mensagens.map((m) => {
              const dia = diaDe(m.created_at);
              const mostrarDia = dia !== diaAnterior;
              diaAnterior = dia;
              const propria = m.autor_id === user?.id;
              const podeExcluir = propria || role === "admin";

              return (
                <div key={m.id}>
                  {mostrarDia && (
                    <div className="my-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {dia}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  {m.sistema ? (
                    <p className="py-1 text-center text-xs text-muted-foreground">{m.corpo}</p>
                  ) : (
                    <div className={cn("flex gap-2", propria && "flex-row-reverse")}>
                      <Avatar className="mt-1 h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                          {initials(m.autor_nome)}
                        </AvatarFallback>
                      </Avatar>

                      <div className={cn("max-w-[80%] space-y-1", propria && "items-end text-right")}>
                        <div
                          className={cn(
                            "flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground",
                            propria && "justify-end",
                          )}
                        >
                          <span className="font-medium text-foreground">{m.autor_nome}</span>
                          {m.autor_papel && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                              {ROTULO_PAPEL[m.autor_papel]}
                            </Badge>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(m.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                          {m.editado && <span className="italic">(editado)</span>}
                        </div>

                        {editandoId === m.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={textoEdicao}
                              onChange={(e) => setTextoEdicao(e.target.value)}
                              rows={3}
                              className="text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                                <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                              </Button>
                              <Button size="sm" onClick={() => handleSalvarEdicao(m.id)}>
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm",
                              propria
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                            )}
                          >
                            {m.corpo}
                          </div>
                        )}

                        {editandoId !== m.id && (propria || podeExcluir) && (
                          <div className={cn("flex gap-1", propria && "justify-end")}>
                            {propria && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px] text-muted-foreground"
                                onClick={() => {
                                  setEditandoId(m.id);
                                  setTextoEdicao(m.corpo);
                                }}
                              >
                                <Pencil className="mr-1 h-3 w-3" /> Editar
                              </Button>
                            )}
                            {podeExcluir && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px] text-muted-foreground"
                                onClick={() => setExcluirId(m.id)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" /> Excluir
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={fimRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t pt-3">
        <Textarea
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleEnviar();
            }
          }}
          placeholder="Escreva sua mensagem… (Enter envia, Shift+Enter quebra linha)"
          rows={3}
          className="resize-none text-sm"
          maxLength={4000}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleEnviar} disabled={enviando || corpo.trim().length === 0}>
            {enviando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar
          </Button>
        </div>
      </div>

      <AlertDialog open={Boolean(excluirId)} onOpenChange={(o) => !o && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem some da conversa para todos os participantes. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluirId && handleExcluir(excluirId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
