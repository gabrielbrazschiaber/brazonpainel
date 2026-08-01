import { WhatsAppIndicator } from "@/components/WhatsAppIndicator";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { StatusBadge } from "@/components/StatusBadge";
import { ClienteFormDialog } from "@/components/vendedor/ClienteFormDialog";
import { excluirCliente, reprocessarSyncCliente } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Search, X, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Plano, VendedorRow, ClienteRow } from "@/lib/admin-tipos";

export function ClientesTab({
  clientes,
  vendedores,
  planos,
  onChanged,
}: {
  clientes: ClienteRow[];
  vendedores: VendedorRow[];
  planos: Plano[];
  onChanged: () => void;
}) {
  const vmap = useMemo(
    () => new Map(vendedores.map((v) => [v.id, v.nome || v.codigo_indicacao])),
    [vendedores],
  );
  const excluir = useServerFn(excluirCliente);
  const reprocessarSync = useServerFn(reprocessarSyncCliente);
  const [reprocessando, setReprocessando] = useState<string | null>(null);

  const reprocessarCliente = async (c: ClienteRow) => {
    setReprocessando(c.id);
    try {
      const res = await reprocessarSync({ data: { cliente_id: c.id } });
      if (res.ok) {
        toast.success("Sincronização concluída!", {
          description: `A cobrança de ${c.nome ?? "cliente"} foi atualizada no Asaas.`,
        });
      } else if (res.motivo === "sem_assinatura") {
        toast.warning("Cliente sem assinatura ativa no Asaas.");
      } else {
        toast.info("Nova tentativa criada na fila.", {
          description:
            "Não foi possível sincronizar agora. A tentativa ficou agendada e será reprocessada automaticamente.",
        });
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reprocessar a sincronização.");
    } finally {
      setReprocessando(null);
    }
  };

  const [editing, setEditing] = useState<ClienteRow | null>(null);
  const [aExcluir, setAExcluir] = useState<ClienteRow | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [planoFiltro, setPlanoFiltro] = useState<string>("todos");

  const planosOpcoes = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => {
      if (c.planos?.nome) set.add(c.planos.nome);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [clientes]);

  const statusOpcoes = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => {
      if (c.status) set.add(c.status);
    });
    return Array.from(set);
  }, [clientes]);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoNum = termo.replace(/\D/g, "");
    return clientes.filter((c) => {
      if (statusFiltro !== "todos" && c.status !== statusFiltro) return false;
      if (vendedorFiltro !== "todos") {
        if (vendedorFiltro === "sem" ? !!c.vendedor_id : c.vendedor_id !== vendedorFiltro)
          return false;
      }
      if (planoFiltro !== "todos" && c.planos?.nome !== planoFiltro) return false;
      if (!termo) return true;
      const nome = (c.nome ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      const cpfNum = (c.cpf_cnpj ?? "").replace(/\D/g, "");
      const telNum = (c.telefone ?? "").replace(/\D/g, "");
      if (nome.includes(termo) || email.includes(termo)) return true;
      if (termoNum && (cpfNum.includes(termoNum) || telNum.includes(termoNum))) return true;
      return false;
    });
  }, [clientes, busca, statusFiltro, vendedorFiltro, planoFiltro]);

  const filtrosAtivos =
    !!busca || statusFiltro !== "todos" || vendedorFiltro !== "todos" || planoFiltro !== "todos";

  function limparFiltros() {
    setBusca("");
    setStatusFiltro("todos");
    setVendedorFiltro("todos");
    setPlanoFiltro("todos");
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await excluir({ data: { cliente_id: aExcluir.id } });
      toast.success("Cliente excluído.");
      setAExcluir(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir cliente.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card data-tour="clientes-filtros" className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail, CPF/CNPJ ou telefone…"
              className="pl-8"
            />
          </div>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statusOpcoes.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              <SelectItem value="sem">Sem vendedor</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome || v.codigo_indicacao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={planoFiltro} onValueChange={setPlanoFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os planos</SelectItem>
              {planosOpcoes.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Mostrando {clientesFiltrados.length} de {clientes.length} cliente
            {clientes.length === 1 ? "" : "s"}
          </span>
          {filtrosAtivos && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-7 gap-1 px-2">
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      <Card data-tour="clientes-lista" className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientesFiltrados.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    {c.nome ?? "—"}
                    <WhatsAppIndicator telefone={c.telefone} size="sm" />
                  </div>
                  <div className="text-xs text-muted-foreground">{c.email ?? ""}</div>
                </TableCell>
                <TableCell>{c.vendedor_id ? (vmap.get(c.vendedor_id) ?? "—") : "—"}</TableCell>
                <TableCell>{c.planos?.nome ?? "—"}</TableCell>
                <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.asaas_subscription_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={reprocessando === c.id}
                        onClick={() => reprocessarCliente(c)}
                        aria-label="Reprocessar sincronização com o Asaas"
                        title="Reprocessar sincronização com o Asaas"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${reprocessando === c.id ? "animate-spin" : ""}`}
                        />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                      Editar
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setAExcluir(c)}
                      aria-label="Excluir cliente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clientesFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  {clientes.length === 0
                    ? "Nenhum cliente cadastrado."
                    : "Nenhum cliente encontrado com esses filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ClienteFormDialog
          mode="editar"
          escopo="admin"
          cliente={editing}
          planos={planos.map((p) => ({ id: p.id, nome: p.nome, valor: p.valor }))}
          onOpenChange={(v) => !v && setEditing(null)}
          onSaved={onChanged}
        />
        <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                O acesso e todos os pagamentos de{" "}
                <strong>{aExcluir?.nome || "este cliente"}</strong> serão removidos permanentemente.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarExclusao}
                disabled={excluindo}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {excluindo ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}
