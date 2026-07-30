import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  listarComentarios,
  criarComentario,
  atualizarComentario,
  excluirComentario,
  type Comentario,
} from "@/lib/tarefa-comentarios.functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function quando(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : "Não foi possível concluir a ação.";
}

interface Props {
  tarefaId: string;
  tarefaTitulo: string;
  equipe: boolean;
  quantidade: number;
  onQuantidadeChange?: (tarefaId: string, quantidade: number) => void;
}

export function ComentariosTarefa({
  tarefaId,
  tarefaTitulo,
  equipe,
  quantidade,
  onQuantidadeChange,
}: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";

  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [corpo, setCorpo] = useState("");
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [corpoEdicao, setCorpoEdicao] = useState("");
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const listar = useServerFn(listarComentarios);
  const criar = useServerFn(criarComentario);
  const atualizar = useServerFn(atualizarComentario);
  const excluir = useServerFn(excluirComentario);

  const sincronizar = useCallback(
    (lista: Comentario[]) => {
      setComentarios(lista);
      onQuantidadeChange?.(tarefaId, lista.length);
    },
    [onQuantidadeChange, tarefaId],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await listar({ data: { tarefa_id: tarefaId } });
      sincronizar(lista);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [listar, tarefaId, sincronizar]);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  async function enviar() {
    if (!corpo.trim()) return;
    setEnviando(true);
    try {
      const novo = await criar({
        data: { tarefa_id: tarefaId, corpo, interno: equipe ? interno : false },
      });
      sincronizar([...comentarios, novo]);
      setCorpo("");
      setInterno(false);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function salvarEdicao(id: string) {
    if (!corpoEdicao.trim()) return;
    setEnviando(true);
    try {
      await atualizar({ data: { id, corpo: corpoEdicao } });
      setEditandoId(null);
      setCorpoEdicao("");
      await carregar();
      toast.success("Comentário atualizado.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluirId) return;
    try {
      await excluir({ data: { id: excluirId } });
      sincronizar(comentarios.filter((c) => c.id !== excluirId));
      toast.success("Comentário excluído.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setExcluirId(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <MessageSquare className="mr-2 h-4 w-4" />
        Conversa
        {quantidade > 0 && (
          <span className="ml-2 rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
            {quantidade}
          </span>
        )}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conversa da tarefa</DialogTitle>
            <DialogDescription className="line-clamp-2">{tarefaTitulo}</DialogDescription>
          </DialogHeader>

          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comentarios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum comentário ainda. Escreva a primeira mensagem.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {comentarios.map((c) => {
                const meu = c.autor_id === user?.id;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-lg border p-3",
                      c.interno ? "border-amber-300 bg-amber-50" : "bg-card",
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {meu ? "Você" : (c.autor_nome ?? "Usuário")}
                      </span>
                      {!meu && c.autor_papel && c.autor_papel !== "cliente" && (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {c.autor_papel === "admin" ? "Admin" : "Vendedor"}
                        </Badge>
                      )}
                      {c.interno && (
                        <Badge className="border-amber-300 bg-amber-100 text-[10px] text-amber-800">
                          Interno — só a equipe vê
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {quando(c.created_at)}
                        {c.editado ? " · editado" : ""}
                      </span>
                    </div>

                    {editandoId === c.id ? (
                      <div className="grid gap-2">
                        <Textarea
                          rows={3}
                          maxLength={4000}
                          value={corpoEdicao}
                          onChange={(e) => setCorpoEdicao(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => salvarEdicao(c.id)}
                            disabled={enviando || !corpoEdicao.trim()}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-line text-sm">{c.corpo}</p>
                    )}

                    {editandoId !== c.id && (meu || isAdmin) && (
                      <div className="mt-2 flex gap-1">
                        {meu && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditandoId(c.id);
                              setCorpoEdicao(c.corpo);
                            }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setExcluirId(c.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-2 border-t pt-3">
            <Textarea
              rows={3}
              maxLength={4000}
              placeholder="Escreva sua mensagem..."
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {equipe ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`interno-${tarefaId}`}
                    checked={interno}
                    onCheckedChange={(v) => setInterno(v === true)}
                  />
                  <Label htmlFor={`interno-${tarefaId}`} className="text-sm font-normal">
                    Nota interna (o cliente não vê)
                  </Label>
                </div>
              ) : (
                <span />
              )}
              <Button onClick={enviar} disabled={enviando || !corpo.trim()}>
                {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluirId} onOpenChange={(o) => !o && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O comentário será removido da conversa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
