import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { EmptyState } from "@/components/ui/empty-state";
import { ListaEsqueleto } from "@/components/ui/loading-state";

import { excluirCnae, listarCnaes, salvarCnae, type Cnae } from "@/lib/cnaes.functions";
import { formatarCnae } from "@/lib/cnaes";

interface Rascunho {
  codigo: string;
  descricao: string;
  segmento_sugerido: string;
  ativo: boolean;
}

const VAZIO: Rascunho = { codigo: "", descricao: "", segmento_sugerido: "", ativo: true };

/**
 * Gestão do catálogo de CNAEs.
 *
 * O catálogo se abastece sozinho na importação do Banco de Leads; aqui o admin
 * corrige descrições, ajusta o segmento sugerido, desativa o que não interessa
 * e cadastra CNAEs à mão quando precisa reservar um lote antes de importar.
 */
export function CnaesTab() {
  const buscar = useServerFn(listarCnaes);
  const salvar = useServerFn(salvarCnae);
  const remover = useServerFn(excluirCnae);

  const [lista, setLista] = useState<Cnae[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [salvandoCodigo, setSalvandoCodigo] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [novo, setNovo] = useState<Rascunho | null>(null);
  const [confirmar, setConfirmar] = useState<Cnae | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await buscar({ data: { limite: 1000 } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar os CNAEs.");
    } finally {
      setCarregando(false);
    }
  }, [buscar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    const digitos = termo.replace(/\D/g, "");
    return lista.filter(
      (c) =>
        (digitos && c.codigo.includes(digitos)) ||
        (c.descricao ?? "").toLowerCase().includes(termo) ||
        (c.segmento_sugerido ?? "").toLowerCase().includes(termo),
    );
  }, [lista, busca]);

  async function gravar(dados: Rascunho, codigoOriginal?: string) {
    const codigo = dados.codigo.replace(/\D/g, "");
    if (codigo.length !== 7) {
      toast.error("O código do CNAE precisa ter 7 dígitos.");
      return;
    }
    setSalvandoCodigo(codigoOriginal ?? codigo);
    try {
      await salvar({
        data: {
          codigo,
          descricao: dados.descricao.trim() || null,
          segmento_sugerido: dados.segmento_sugerido.trim() || null,
          ativo: dados.ativo,
        },
      });
      toast.success(`CNAE ${formatarCnae(codigo)} salvo.`);
      setEditando(null);
      setNovo(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o CNAE.");
    } finally {
      setSalvandoCodigo(null);
    }
  }

  async function alternarAtivo(cnae: Cnae) {
    setSalvandoCodigo(cnae.codigo);
    try {
      await salvar({
        data: {
          codigo: cnae.codigo,
          descricao: cnae.descricao,
          segmento_sugerido: cnae.segmento_sugerido,
          ativo: !cnae.ativo,
        },
      });
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar o CNAE.");
    } finally {
      setSalvandoCodigo(null);
    }
  }

  async function confirmarExclusao() {
    if (!confirmar) return;
    try {
      await remover({ data: { id: confirmar.id } });
      toast.success("CNAE removido do catálogo.");
      setConfirmar(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover o CNAE.");
    }
  }

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-foreground">CNAEs</h3>
        <p className="text-sm text-muted-foreground">
          O catálogo cresce sozinho a cada importação do Banco de Leads. Ajuste aqui a descrição e o
          segmento sugerido — é isso que o sistema usa para classificar leads novos e para reservar
          lotes por CNAE.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, descrição ou segmento"
            className="pl-8"
            aria-label="Buscar CNAE"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNovo({ ...VAZIO });
            setEditando(null);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo CNAE
        </Button>
      </div>

      {novo ? (
        <div className="grid gap-3 rounded-md border border-border bg-muted/40 p-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,12rem)_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="novo-cnae">Código</Label>
            <Input
              id="novo-cnae"
              value={novo.codigo}
              onChange={(e) => setNovo({ ...novo, codigo: e.target.value })}
              placeholder="1091102"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-desc">Descrição</Label>
            <Input
              id="novo-desc"
              value={novo.descricao}
              onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
              placeholder="Fabricação de produtos de panificação"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-seg">Segmento sugerido</Label>
            <Input
              id="novo-seg"
              value={novo.segmento_sugerido}
              onChange={(e) => setNovo({ ...novo, segmento_sugerido: e.target.value })}
              placeholder="Alimentação"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={() => void gravar(novo)} disabled={salvandoCodigo !== null}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNovo(null)}>
              <X className="h-4 w-4" />
              <span className="sr-only">Cancelar</span>
            </Button>
          </div>
        </div>
      ) : null}

      {carregando ? (
        <ListaEsqueleto linhas={6} />
      ) : filtrados.length === 0 ? (
        <EmptyState
          titulo="Nenhum CNAE no catálogo"
          descricao="Importe uma planilha no Banco de Leads ou cadastre um CNAE manualmente."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Segmento sugerido</TableHead>
                <TableHead className="hidden sm:table-cell w-20 text-right">Leads</TableHead>
                <TableHead className="w-24">Ativo</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => {
                const emEdicao = editando === c.codigo;
                const ocupado = salvandoCodigo === c.codigo;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatarCnae(c.codigo)}
                    </TableCell>
                    <TableCell>
                      {emEdicao ? (
                        <Input
                          value={rascunho.descricao}
                          onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                          className="h-9"
                          aria-label={`Descrição do CNAE ${c.codigo}`}
                        />
                      ) : (
                        <>
                          <span className="block">{c.descricao ?? "—"}</span>
                          <span className="block text-xs text-muted-foreground md:hidden">
                            {c.segmento_sugerido ?? "Sem segmento"} · {c.total_leads ?? 0} lead(s)
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {emEdicao ? (
                        <Input
                          value={rascunho.segmento_sugerido}
                          onChange={(e) =>
                            setRascunho({ ...rascunho, segmento_sugerido: e.target.value })
                          }
                          className="h-9"
                          aria-label={`Segmento do CNAE ${c.codigo}`}
                        />
                      ) : (
                        (c.segmento_sugerido ?? "—")
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      <Badge variant="secondary">{c.total_leads ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.ativo}
                        disabled={ocupado}
                        onCheckedChange={() => void alternarAtivo(c)}
                        aria-label={`CNAE ${c.codigo} ativo`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {emEdicao ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={ocupado}
                            onClick={() => void gravar(rascunho, c.codigo)}
                          >
                            {ocupado ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            <span className="sr-only">Salvar</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditando(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="sr-only">Cancelar</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setNovo(null);
                              setEditando(c.codigo);
                              setRascunho({
                                codigo: c.codigo,
                                descricao: c.descricao ?? "",
                                segmento_sugerido: c.segmento_sugerido ?? "",
                                ativo: c.ativo,
                              });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar {c.codigo}</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setConfirmar(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Excluir {c.codigo}</span>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={Boolean(confirmar)} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover CNAE do catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar
                ? `${formatarCnae(confirmar.codigo)} sai do catálogo. Os leads já importados continuam com o código gravado, e ele volta ao catálogo na próxima importação.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmarExclusao()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
