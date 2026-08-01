import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useProgressoEquipe, BadgeOnboarding } from "@/components/onboarding/ProgressoEquipe";
import {
  criarVendedor,
  atualizarVendedor,
  excluirVendedor,
  alternarVendedorAtivo,
} from "@/lib/admin.functions";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { VendedorRow } from "@/lib/admin-tipos";
import { SelecaoMultipla, type OpcaoMultipla } from "@/components/ui/selecao-multipla";
import { opcoesEscopo } from "@/lib/banco-leads.functions";
import type { OpcoesEscopo } from "@/lib/banco-leads.functions";
import { ESTADOS_BR } from "@/lib/banco-leads";
import { resumoEscopo, SEM_RESTRICAO } from "@/lib/escopo";
import { formatarCnae } from "@/lib/cnaes";
import { Separator } from "@/components/ui/separator";

export function VendedoresTab({
  vendedores,
  onChanged,
}: {
  vendedores: VendedorRow[];
  onChanged: () => void;
}) {
  const { concluidos, carregado: progressoCarregado } = useProgressoEquipe();
  const criar = useServerFn(criarVendedor);
  const atualizar = useServerFn(atualizarVendedor);
  const excluir = useServerFn(excluirVendedor);
  const alternarAtivo = useServerFn(alternarVendedorAtivo);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VendedorRow | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [comissao, setComissao] = useState("10");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [aExcluir, setAExcluir] = useState<VendedorRow | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [cnaes, setCnaes] = useState<string[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesEscopo>({ segmentos: [], cnaes: [] });
  const buscarOpcoes = useServerFn(opcoesEscopo);

  // Opções reais de segmento e CNAE: sem elas o escopo (e a reserva) fica vazio.
  useEffect(() => {
    void (async () => {
      try {
        setOpcoes(await buscarOpcoes({}));
      } catch {
        setOpcoes({ segmentos: [], cnaes: [] });
      }
    })();
  }, [buscarOpcoes]);

  const opcoesSegmentos: OpcaoMultipla[] = useMemo(
    () => opcoes.segmentos.map((s) => ({ valor: s, rotulo: s })),
    [opcoes.segmentos],
  );
  const opcoesEstados: OpcaoMultipla[] = useMemo(
    () => ESTADOS_BR.map((uf) => ({ valor: uf, rotulo: uf })),
    [],
  );
  const opcoesCnaes: OpcaoMultipla[] = useMemo(
    () =>
      opcoes.cnaes.map((c) => ({
        valor: c.codigo,
        rotulo: `${formatarCnae(c.codigo)}${c.descricao ? ` — ${c.descricao}` : ""}`,
      })),
    [opcoes.cnaes],
  );

  function openNew() {
    setEditing(null);
    setNome("");
    setEmail("");
    setCodigo("");
    setComissao("10");
    setSenha("");
    setSegmentos([]);
    setEstados([]);
    setCnaes([]);
    setOpen(true);
  }

  function openEdit(v: VendedorRow) {
    setEditing(v);
    setNome(v.nome ?? "");
    setEmail(v.email ?? "");
    setCodigo(v.codigo_indicacao);
    setComissao(String(v.percentual_comissao));
    setSenha("");
    setSegmentos(v.segmentos ?? []);
    setEstados(v.estados ?? []);
    setCnaes(v.cnaes ?? []);
    setOpen(true);
  }

  async function submit() {
    if (nome.trim().length < 2 || !email.trim() || codigo.trim().length < 2) {
      toast.error("Preencha nome, e-mail e código de indicação.");
      return;
    }
    if (senha && senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await atualizar({
          data: {
            vendedor_id: editing.id,
            nome: nome.trim(),
            email: email.trim(),
            codigo_indicacao: codigo.trim().toUpperCase(),
            percentual_comissao: Number(comissao) || 0,
            senha: senha || "",
            segmentos,
            estados,
            cnaes,
          },
        });
        toast.success("Vendedor atualizado!");
      } else {
        const res = await criar({
          data: {
            nome: nome.trim(),
            email: email.trim(),
            codigo_indicacao: codigo.trim().toUpperCase(),
            percentual_comissao: Number(comissao) || 0,
            senha: senha || "",
            segmentos,
            estados,
            cnaes,
          },
        });
        if (res.senha_definida) {
          toast.success("Vendedor cadastrado!", {
            description: "Ele pode entrar com o e-mail e a senha que você definiu.",
          });
        } else {
          const emailVend = email.trim();
          const { error: resetErr } = await enviarLinkDefinicaoSenha(emailVend);
          toast.success("Vendedor cadastrado!", {
            description: resetErr
              ? `Peça para ${emailVend} usar "Esqueci minha senha" no login para definir a senha.`
              : `Enviamos um e-mail para ${emailVend} definir a senha de acesso.`,
          });
        }
      }
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar vendedor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(v: VendedorRow) {
    try {
      await alternarAtivo({ data: { vendedor_id: v.id, ativo: !v.ativo } });
      toast.success(v.ativo ? "Vendedor desativado." : "Vendedor ativado.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await excluir({ data: { vendedor_id: aExcluir.id } });
      toast.success("Vendedor excluído.");
      setAExcluir(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir vendedor.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo vendedor
        </Button>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <Table className="min-w-full sm:min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="hidden md:table-cell">Código</TableHead>
              <TableHead className="hidden md:table-cell">Comissão</TableHead>
              <TableHead className="hidden lg:table-cell">Clientes</TableHead>
              <TableHead className="hidden lg:table-cell">Escopo</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedores.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{v.nome ?? "—"}</div>
                  <div className="break-all text-xs text-muted-foreground">{v.email ?? ""}</div>
                  <div className="mt-1 text-xs text-muted-foreground md:hidden">
                    {v.codigo_indicacao} · {v.percentual_comissao}% · {v.clientes_count ?? 0}{" "}
                    cliente
                    {(v.clientes_count ?? 0) === 1 ? "" : "s"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground lg:hidden">
                    Escopo: {resumoEscopo(v)}
                  </div>
                  {progressoCarregado && (
                    <div className="mt-1">
                      <BadgeOnboarding concluido={concluidos.has(v.user_id)} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden font-mono text-sm md:table-cell">
                  {v.codigo_indicacao}
                </TableCell>
                <TableCell className="hidden md:table-cell">{v.percentual_comissao}%</TableCell>
                <TableCell className="hidden lg:table-cell">{v.clientes_count ?? 0}</TableCell>
                <TableCell className="hidden max-w-[16rem] lg:table-cell">
                  <span className="text-xs text-muted-foreground">{resumoEscopo(v)}</span>
                </TableCell>
                <TableCell>
                  <Switch checked={v.ativo} onCheckedChange={() => toggleAtivo(v)} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(v)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setAExcluir(v)}
                      aria-label="Excluir vendedor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {vendedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Nenhum vendedor cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize os dados do vendedor. Deixe a senha em branco para mantê-la."
                : "Defina os dados do vendedor. Você pode escolher a senha de acesso."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vnome">Nome</Label>
              <Input id="vnome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vemail">E-mail</Label>
              <Input
                id="vemail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vcod">Código de indicação</Label>
              <Input
                id="vcod"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: JOAO2026"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vcom">Comissão (%)</Label>
              <Input
                id="vcom"
                type="number"
                min={0}
                max={100}
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vsenha">
                {editing ? "Nova senha (opcional)" : "Senha de acesso"}
              </Label>
              <PasswordInput
                id="vsenha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={editing ? "Deixe em branco para manter" : "Mín. 6 caracteres"}
              />
            </div>

            <Separator />

            <div className="grid gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Escopo de atuação</h3>
                <p className="text-xs text-muted-foreground">
                  Define quais leads reservados este vendedor pode ver no Banco de leads. Deixe
                  vazio para não restringir ({SEM_RESTRICAO.toLowerCase()}).
                </p>
              </div>
              <SelecaoMultipla
                label="Segmentos"
                placeholder="Todos os segmentos"
                opcoes={opcoesSegmentos}
                selecionados={segmentos}
                onChange={setSegmentos}
                ajuda="Vazio = vê leads de qualquer segmento."
                semOpcoesTexto="Nenhum segmento no banco ainda. Importe leads ou cadastre CNAEs."
              />
              <SelecaoMultipla
                label="Estados"
                placeholder="Todos os estados"
                opcoes={opcoesEstados}
                selecionados={estados}
                onChange={setEstados}
                ajuda="Vazio = vê leads de qualquer estado."
              />
              <SelecaoMultipla
                label="CNAEs"
                placeholder="Todos os CNAEs"
                opcoes={opcoesCnaes}
                selecionados={cnaes}
                onChange={setCnaes}
                ajuda="Vazio = vê leads de qualquer CNAE."
                semOpcoesTexto="Nenhum CNAE ativo no catálogo. Cadastre em Configurações › CNAEs."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso de <strong>{aExcluir?.nome || "este vendedor"}</strong> será removido
              permanentemente. Se ele tiver clientes vinculados, a exclusão será bloqueada —
              reatribua ou exclua os clientes antes.
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
    </div>
  );
}
