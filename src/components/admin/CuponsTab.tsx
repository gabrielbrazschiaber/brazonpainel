import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { TicketPercent, Plus, RotateCcw, Users } from "lucide-react";
import {
  listarCupons,
  salvarCupom,
  alternarCupomAtivo,
  detalharCupom,
  liberarReservaCupom,
  estornarUsoCupom,
  type CupomAdmin,
  type UsoCupomAdmin,
  type ReservaCupomAdmin,
} from "@/lib/cupons.admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

function vazio(): FormCupom {
  return {
    codigo: "",
    descricao: "",
    valor_desconto: "",
    apenas_primeira_mensalidade: true,
    ativo: true,
    validade: "",
    max_usos: "",
  };
}

interface FormCupom {
  id?: string;
  codigo: string;
  descricao: string;
  valor_desconto: string;
  apenas_primeira_mensalidade: boolean;
  ativo: boolean;
  validade: string;
  max_usos: string;
}

function statusCupom(c: CupomAdmin): { texto: string; classe: string } {
  if (!c.ativo) return { texto: "Bloqueado", classe: "bg-destructive/10 text-destructive" };
  if (c.validade && new Date(c.validade).getTime() <= Date.now())
    return { texto: "Expirado", classe: "bg-warning/10 text-warning" };
  if (c.max_usos !== null && c.usos >= c.max_usos)
    return { texto: "Esgotado", classe: "bg-warning/10 text-warning" };
  return { texto: "Ativo", classe: "bg-success/10 text-success" };
}

export function CuponsTab() {
  const carregar = useServerFn(listarCupons);
  const salvar = useServerFn(salvarCupom);
  const alternar = useServerFn(alternarCupomAtivo);

  const [cupons, setCupons] = useState<CupomAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormCupom | null>(null);
  const [saving, setSaving] = useState(false);
  const [detalhe, setDetalhe] = useState<CupomAdmin | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await carregar({});
      setCupons(res.cupons);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os cupons.");
    } finally {
      setLoading(false);
    }
  }, [carregar]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!form) return;
    const valor = Number(form.valor_desconto.replace(",", "."));
    if (form.codigo.trim().length < 2 || !Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe um código válido e um valor de desconto maior que zero.");
      return;
    }
    setSaving(true);
    try {
      await salvar({
        data: {
          id: form.id,
          codigo: form.codigo.trim().toUpperCase(),
          descricao: form.descricao.trim() || null,
          valor_desconto: valor,
          apenas_primeira_mensalidade: form.apenas_primeira_mensalidade,
          ativo: form.ativo,
          validade: form.validade ? form.validade : null,
          max_usos: form.max_usos ? Number(form.max_usos) : null,
        },
      });
      toast.success(form.id ? "Cupom atualizado." : "Cupom criado.");
      setForm(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o cupom.");
    } finally {
      setSaving(false);
    }
  }

  async function alternarAtivo(c: CupomAdmin) {
    try {
      await alternar({ data: { cupom_id: c.id, ativo: !c.ativo } });
      toast.success(!c.ativo ? `Cupom ${c.codigo} liberado.` : `Cupom ${c.codigo} bloqueado.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o cupom.");
    }
  }

  if (loading) {
    return <Card className="p-6 text-sm text-muted-foreground">Carregando cupons...</Card>;
  }

  if (erro) {
    return <Card className="p-6 text-sm text-destructive">{erro}</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Cupons de desconto</h2>
          <p className="text-sm text-muted-foreground">
            Crie cupons, defina limites e acompanhe quem já usou ou tem cupom reservado.
          </p>
        </div>
        <Button onClick={() => setForm(vazio())}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cupom
        </Button>
      </div>

      {cupons.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Nenhum cupom cadastrado ainda.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead className="hidden sm:table-cell">Regra</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead className="hidden md:table-cell">Reservados</TableHead>
                <TableHead className="hidden md:table-cell">Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupons.map((c) => {
                const st = statusCupom(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <TicketPercent className="h-4 w-4 text-primary" />
                        {c.codigo}
                      </span>
                      {c.descricao && (
                        <p className="text-xs text-muted-foreground">{c.descricao}</p>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(c.valor_desconto)}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {c.apenas_primeira_mensalidade ? "1ª mensalidade" : "Qualquer mensalidade"}
                    </TableCell>
                    <TableCell>
                      {c.usos}
                      {c.max_usos !== null && (
                        <span className="text-muted-foreground"> / {c.max_usos}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{c.reservados}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.validade ? formatDate(c.validade) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.classe}`}>
                        {st.texto}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetalhe(c)}>
                          <Users className="mr-1 h-3.5 w-3.5" />
                          Usos
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setForm({
                              id: c.id,
                              codigo: c.codigo,
                              descricao: c.descricao ?? "",
                              valor_desconto: String(c.valor_desconto),
                              apenas_primeira_mensalidade: c.apenas_primeira_mensalidade,
                              ativo: c.ativo,
                              validade: c.validade ? c.validade.slice(0, 10) : "",
                              max_usos: c.max_usos === null ? "" : String(c.max_usos),
                            })
                          }
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant={c.ativo ? "outline" : "default"}
                          onClick={() => alternarAtivo(c)}
                        >
                          {c.ativo ? "Bloquear" : "Liberar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Criar / editar */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar cupom" : "Novo cupom"}</DialogTitle>
            <DialogDescription>
              O desconto é sempre validado no servidor antes de entrar na cobrança.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="c-codigo">Código</Label>
                <Input
                  id="c-codigo"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                  placeholder="100OFF"
                  className="uppercase"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-desc">Descrição (opcional)</Label>
                <Textarea
                  id="c-desc"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="c-valor">Valor do desconto (R$)</Label>
                  <Input
                    id="c-valor"
                    inputMode="decimal"
                    value={form.valor_desconto}
                    onChange={(e) => setForm({ ...form, valor_desconto: e.target.value })}
                    placeholder="100,00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-max">Limite de usos (vazio = ilimitado)</Label>
                  <Input
                    id="c-max"
                    inputMode="numeric"
                    value={form.max_usos}
                    onChange={(e) =>
                      setForm({ ...form, max_usos: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="Ex.: 100"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-validade">Validade (opcional)</Label>
                <Input
                  id="c-validade"
                  type="date"
                  value={form.validade}
                  onChange={(e) => setForm({ ...form, validade: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Só na primeira mensalidade</p>
                  <p className="text-xs text-muted-foreground">
                    Bloqueia o uso em cobranças seguintes.
                  </p>
                </div>
                <Switch
                  checked={form.apenas_primeira_mensalidade}
                  onCheckedChange={(v) => setForm({ ...form, apenas_primeira_mensalidade: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Cupom ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Desligue para bloquear novos usos imediatamente.
                  </p>
                </div>
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetalheCupomDialog cupom={detalhe} onClose={() => setDetalhe(null)} onChanged={load} />
    </div>
  );
}

/* ---------------- Histórico por cliente ---------------- */
function DetalheCupomDialog({
  cupom,
  onClose,
  onChanged,
}: {
  cupom: CupomAdmin | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detalhar = useServerFn(detalharCupom);
  const liberar = useServerFn(liberarReservaCupom);
  const estornar = useServerFn(estornarUsoCupom);

  const [usos, setUsos] = useState<UsoCupomAdmin[]>([]);
  const [reservas, setReservas] = useState<ReservaCupomAdmin[]>([]);
  const [carregando, setCarregando] = useState(false);

  const load = useCallback(async () => {
    if (!cupom) return;
    setCarregando(true);
    try {
      const res = await detalhar({ data: { cupom_id: cupom.id } });
      setUsos(res.usos);
      setReservas(res.reservas);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
    } finally {
      setCarregando(false);
    }
  }, [cupom, detalhar]);

  useEffect(() => {
    load();
  }, [load]);

  async function liberarReserva(clienteId: string) {
    try {
      await liberar({ data: { cliente_id: clienteId } });
      toast.success("Reserva liberada. O cliente pode usar outro cupom.");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível liberar a reserva.");
    }
  }

  async function estornarUso(usoId: string) {
    try {
      await estornar({ data: { uso_id: usoId } });
      toast.success("Uso estornado.");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível estornar o uso.");
    }
  }

  return (
    <Dialog open={cupom !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cupom {cupom?.codigo}</DialogTitle>
          <DialogDescription>
            Usos confirmados e cupons reservados aguardando a primeira cobrança.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando histórico...</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-foreground">
                Usos confirmados ({usos.length})
              </h3>
              {usos.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Nenhum uso registrado.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Desconto</TableHead>
                        <TableHead className="hidden sm:table-cell">Data</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usos.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{u.cliente_nome}</p>
                            <p className="text-xs text-muted-foreground">{u.cliente_email}</p>
                          </TableCell>
                          <TableCell>{formatCurrency(u.valor_desconto)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatDate(u.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => estornarUso(u.id)}>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              Estornar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground">
                Reservados / aguardando cobrança ({reservas.length})
              </h3>
              {reservas.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Nenhuma reserva pendente.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden sm:table-cell">Desde</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservas.map((r) => (
                        <TableRow key={r.cliente_id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{r.cliente_nome}</p>
                            <p className="text-xs text-muted-foreground">{r.cliente_email}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatDate(r.desde)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => liberarReserva(r.cliente_id)}
                            >
                              Liberar reserva
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
