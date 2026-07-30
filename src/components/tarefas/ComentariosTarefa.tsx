import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Download, Loader2, MessageSquare, Paperclip, Pencil, Trash2, X } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  listarComentarios,
  criarComentario,
  atualizarComentario,
  excluirComentario,
  type Comentario,
} from "@/lib/tarefa-comentarios.functions";
import {
  registrarAnexo,
  linkAnexo,
  excluirAnexo,
  BUCKET_ANEXOS,
  TAMANHO_MAX_ANEXO,
} from "@/lib/tarefa-anexos.functions";
import { supabase } from "@/integrations/supabase/client";

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

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nomeSeguro(nome: string): string {
  const ext = nome.includes(".") ? `.${nome.split(".").pop()!.toLowerCase().slice(0, 10)}` : "";
  return `${crypto.randomUUID()}${ext.replace(/[^a-z0-9.]/g, "")}`;
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
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  const listar = useServerFn(listarComentarios);
  const criar = useServerFn(criarComentario);
  const atualizar = useServerFn(atualizarComentario);
  const excluir = useServerFn(excluirComentario);
  const registrar = useServerFn(registrarAnexo);
  const gerarLink = useServerFn(linkAnexo);
  const removerAnexo = useServerFn(excluirAnexo);

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

  function selecionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const escolhidos = Array.from(lista);
    const grande = escolhidos.find((f) => f.size > TAMANHO_MAX_ANEXO);
    if (grande) {
      toast.error(`"${grande.name}" passa de 10 MB.`);
      return;
    }
    setArquivos((atual) => [...atual, ...escolhidos].slice(0, 5));
  }

  async function enviarAnexos(comentarioId: string) {
    for (const arquivo of arquivos) {
      const path = `${tarefaId}/${nomeSeguro(arquivo.name)}`;
      const { error } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .upload(path, arquivo, { contentType: arquivo.type || "application/octet-stream" });
      if (error) throw new Error(`Falha ao enviar "${arquivo.name}": ${error.message}`);

      await registrar({
        data: {
          comentario_id: comentarioId,
          tarefa_id: tarefaId,
          path,
          nome: arquivo.name.slice(0, 255),
          tamanho: arquivo.size,
          mime: arquivo.type || "application/octet-stream",
        },
      });
    }
  }

  async function baixar(id: string) {
    setBaixandoId(id);
    try {
      const { url } = await gerarLink({ data: { id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setBaixandoId(null);
    }
  }

  async function apagarAnexo(id: string) {
    try {
      await removerAnexo({ data: { id } });
      await carregar();
      toast.success("Anexo excluído.");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  async function enviar() {
    if (!corpo.trim()) return;
    setEnviando(true);
    try {
      const novo = await criar({
        data: { tarefa_id: tarefaId, corpo, interno: equipe ? interno : false },
      });
      if (arquivos.length > 0) {
        await enviarAnexos(novo.id);
        setArquivos([]);
        await carregar();
      } else {
        sincronizar([...comentarios, novo]);
      }
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

                    {c.anexos.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {c.anexos.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate text-xs">{a.nome}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {tamanhoLegivel(a.tamanho)}
                            </span>
                            <div className="ml-auto flex shrink-0 items-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                disabled={baixandoId === a.id}
                                onClick={() => baixar(a.id)}
                              >
                                {baixandoId === a.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              {(meu || isAdmin) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => apagarAnexo(a.id)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
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
            {arquivos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {arquivos.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setArquivos((a) => a.filter((_, idx) => idx !== i))}
                      aria-label={`Remover ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

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
              <div className="flex items-center gap-2">
                <input
                  id={`anexo-${tarefaId}`}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    selecionarArquivos(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor={`anexo-${tarefaId}`} className="cursor-pointer">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Anexar
                  </label>
                </Button>
                <Button onClick={enviar} disabled={enviando || !corpo.trim()}>
                  {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar
                </Button>
              </div>
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
