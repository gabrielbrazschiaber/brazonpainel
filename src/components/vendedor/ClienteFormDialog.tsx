import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { criarCliente, atualizarCliente } from "@/lib/vendedor.functions";
import { validarCupomPublico, cupomEmDestaque } from "@/lib/cupons.functions";
import { atualizarClienteAdmin } from "@/lib/admin.functions";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import {
  clienteFormSchema,
  clienteFormVazio,
  clientePayloadComum,
  defaultVencimento,
  errosPorCampo,
  parseValorBR,
  validarCadastro,
  type ClienteFormValues,
} from "@/lib/cliente-form";

import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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

export interface PlanoOpcao {
  id: string;
  nome: string;
  valor: number;
}

interface CupomAplicado {
  codigo: string;
  descricao: string | null;
  valor_desconto: number;
  apenas_primeira_mensalidade: boolean;
}

export interface ClienteEditavel {
  id: string;
  plano_id: string | null;
  servico_extra: string | null;
  servico_extra_valor: number | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  anotacoes: string | null;
  nome?: string;
  email?: string;
}

type Props = {
  planos: PlanoOpcao[];
  /** "admin" usa a server fn administrativa (edita qualquer cliente). */
  escopo?: "vendedor" | "admin";
  onSaved: () => void;
  onOpenChange: (v: boolean) => void;
} & (
  | { mode: "criar"; open: boolean; cliente?: undefined }
  | { mode: "editar"; open?: undefined; cliente: ClienteEditavel | null }
);

function valoresDoCliente(cliente: ClienteEditavel | null | undefined): ClienteFormValues {
  return {
    ...clienteFormVazio,
    vencimento: defaultVencimento(),
    nome: cliente?.nome ?? "",
    email: cliente?.email ?? "",
    cpfCnpj: cliente?.cpf_cnpj ?? "",
    telefone: cliente?.telefone ?? "",
    planoId: cliente?.plano_id ?? "",
    servicoExtra: cliente?.servico_extra ?? "",
    servicoValor: cliente?.servico_extra_valor
      ? String(cliente.servico_extra_valor).replace(".", ",")
      : "",
    anotacoes: cliente?.anotacoes ?? "",
  };
}

/**
 * Diálogo único de cliente: usado para criar e para editar,
 * compartilhando o mesmo schema zod e a mesma validação.
 */
export function ClienteFormDialog({
  mode,
  open,
  cliente,
  planos,
  escopo = "vendedor",
  onOpenChange,
  onSaved,
}: Props) {
  const criar = useServerFn(criarCliente);
  const salvar = useServerFn(atualizarCliente);
  const salvarAdmin = useServerFn(atualizarClienteAdmin);
  const editando = mode === "editar";
  const aberto = editando ? !!cliente : !!open;

  const [values, setValues] = useState<ClienteFormValues>(() => valoresDoCliente(cliente));
  const [saving, setSaving] = useState(false);

  const validarCupom = useServerFn(validarCupomPublico);
  const buscarDestaque = useServerFn(cupomEmDestaque);
  const [destaque, setDestaque] = useState<CupomAplicado | null>(null);
  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null);
  const [checandoCupom, setChecandoCupom] = useState(false);

  useEffect(() => {
    if (aberto) {
      setValues(valoresDoCliente(cliente));
      setCupomAplicado(null);
    }
  }, [aberto, cliente]);

  useEffect(() => {
    if (!aberto || editando) return;
    let vivo = true;
    buscarDestaque({})
      .then((c) => {
        if (vivo && c) setDestaque(c);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [aberto, editando, buscarDestaque]);

  async function aplicarCupom(codigo?: string) {
    const cod = (codigo ?? values.cupom).trim();
    if (!cod) {
      toast.error("Informe o código do cupom.");
      return;
    }
    setChecandoCupom(true);
    try {
      const res = await validarCupom({ data: { codigo: cod } });
      if (!res.valido) {
        setCupomAplicado(null);
        toast.error(res.mensagem);
        return;
      }
      setValues((v) => ({ ...v, cupom: res.codigo }));
      setCupomAplicado({
        codigo: res.codigo,
        descricao: res.descricao,
        valor_desconto: res.valor_desconto,
        apenas_primeira_mensalidade: res.apenas_primeira_mensalidade,
      });
      toast.success(`Cupom ${res.codigo} aplicado!`);
    } catch {
      toast.error("Não foi possível validar o cupom agora.");
    } finally {
      setChecandoCupom(false);
    }
  }

  function removerCupom() {
    setCupomAplicado(null);
    setValues((v) => ({ ...v, cupom: "" }));
  }

  const valorPlano = planos.find((pl) => pl.id === values.planoId)?.valor ?? 0;
  const valorExtra = parseValorBR(values.servicoValor) || 0;
  const mensalidade = valorPlano + valorExtra;
  const desconto = cupomAplicado ? Math.min(cupomAplicado.valor_desconto, mensalidade) : 0;
  const primeiraMensalidade = Math.max(mensalidade - desconto, 0);

  function set<K extends keyof ClienteFormValues>(key: K, value: ClienteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErros((e) => {
      if (!e[key as string]) return e;
      const { [key as string]: _, ...resto } = e;
      return resto;
    });
  }

  async function submit() {
    const parsed = clienteFormSchema.safeParse(values);
    const mapa = parsed.success ? {} : errosPorCampo(parsed.error.issues);
    const extras = editando ? {} : validarCadastro(values);
    const todos = { ...mapa, ...extras };
    if (Object.keys(todos).length) {
      setErros(todos);
      toast.error("Revise os campos destacados", {
        description: Object.values(todos)[0],
      });
      return;
    }
    setErros({});
    const v = (parsed as { data: ClienteFormValues }).data;
    const comum = clientePayloadComum(v);


    setSaving(true);
    try {
      if (editando) {
        if (!cliente) return;
        const payload = { cliente_id: cliente.id, senha: v.senha || "", ...comum };
        if (escopo === "admin") {
          const res = await salvarAdmin({ data: payload });
          const sync = res?.asaas;
          if (sync?.sincronizado) {
            toast.success("Dados atualizados!", {
              description: "A cobrança recorrente no Asaas foi ajustada para o novo valor.",
            });
          } else if (sync && sync.enfileirado) {
            toast.info("Dados atualizados. Sincronização do Asaas agendada.", {
              description:
                "O Asaas está indisponível no momento. A cobrança será ajustada automaticamente em instantes (novas tentativas com intervalo crescente).",
            });
          } else if (sync && !sync.sincronizado) {
            toast.warning("Dados atualizados, mas a cobrança não foi sincronizada.", {
              description:
                sync.motivo === "assinatura_inativa" || sync.motivo === "assinatura_invalida"
                  ? "A assinatura no Asaas não está ativa. Gere uma nova cobrança."
                  : "Verifique a integração do Asaas nas Configurações.",
            });
          } else {
            toast.success("Dados do cliente atualizados!");
          }
        } else {
          await salvar({ data: payload });
          toast.success("Dados do cliente atualizados!");
        }
      } else {
        await criar({
          data: {
            ...comum,
            data_vencimento: v.vencimento || defaultVencimento(),
            mensagem_vendedor: v.mensagem || null,
            cupom: cupomAplicado ? cupomAplicado.codigo : null,
          },
        });
        const { error: resetErr } = await enviarLinkDefinicaoSenha(v.email);
        toast.success("Cliente cadastrado!", {
          description: resetErr
            ? `Peça para ${v.email} usar "Esqueci minha senha" no login para definir a senha.`
            : `Enviamos um e-mail para ${v.email} definir a senha de acesso.`,
        });
        setValues(valoresDoCliente(undefined));
        setCupomAplicado(null);
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : editando
            ? "Erro ao atualizar o cliente."
            : "Erro ao cadastrar cliente.",
      );
    } finally {
      setSaving(false);
    }
  }

  const p = editando ? "ec" : "nc";

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar dados do cliente" : "Cadastrar cliente"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Atualize nome, e-mail, senha, plano e serviço extra do cliente."
              : "O cliente recebe um e-mail para definir a própria senha de acesso."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${p}nome`}>Nome</Label>
            <Input
              id={`${p}nome`}
              value={values.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${p}email`}>E-mail</Label>
            <Input
              id={`${p}email`}
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${p}cpf`}>CPF ou CNPJ</Label>
            <Input
              id={`${p}cpf`}
              value={values.cpfCnpj}
              onChange={(e) => set("cpfCnpj", e.target.value)}
              placeholder="Somente números"
            />
            <p className="text-xs text-muted-foreground">
              Obrigatório para gerar cobranças no Asaas.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${p}tel`}>Telefone (opcional)</Label>
            <Input
              id={`${p}tel`}
              value={values.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          {editando && (
            <div className="grid gap-2">
              <Label htmlFor={`${p}senha`}>Nova senha (opcional)</Label>
              <PasswordInput
                id={`${p}senha`}
                value={values.senha}
                onChange={(e) => set("senha", e.target.value)}
                placeholder="Deixe em branco para manter"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>Plano</Label>
            <Select value={values.planoId} onValueChange={(v) => set("planoId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {planos.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id}>
                    {pl.nome} — {formatCurrency(pl.valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 rounded-md border border-border p-3">
            <Label htmlFor={`${p}serv`}>Serviço extra (opcional)</Label>
            <Input
              id={`${p}serv`}
              value={values.servicoExtra}
              onChange={(e) => set("servicoExtra", e.target.value)}
              placeholder="Ex: Instalação, suporte premium..."
            />
            <Label htmlFor={`${p}servval`} className="mt-1">
              Valor do serviço (R$)
            </Label>
            <Input
              id={`${p}servval`}
              type="text"
              inputMode="decimal"
              value={values.servicoValor}
              onChange={(e) => set("servicoValor", e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">Esse valor soma ao valor do plano.</p>
          </div>

          {!editando && (
            <>
              <div className="grid gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <Label htmlFor={`${p}cupom`}>Cupom de desconto (opcional)</Label>
                {destaque && !cupomAplicado && (
                  <button
                    type="button"
                    onClick={() => aplicarCupom(destaque.codigo)}
                    className="rounded-md border border-dashed border-primary/50 px-3 py-2 text-left text-xs text-primary hover:bg-primary/10"
                  >
                    <span className="font-semibold">{destaque.codigo}</span> —{" "}
                    {destaque.descricao ??
                      `${formatCurrency(destaque.valor_desconto)} de desconto`}
                    {destaque.apenas_primeira_mensalidade && " (1ª mensalidade)"}. Toque para
                    aplicar.
                  </button>
                )}
                <div className="flex gap-2">
                  <Input
                    id={`${p}cupom`}
                    value={values.cupom}
                    onChange={(e) => set("cupom", e.target.value.toUpperCase())}
                    placeholder="Ex: 100OFF"
                    disabled={!!cupomAplicado}
                  />
                  {cupomAplicado ? (
                    <Button type="button" variant="outline" onClick={removerCupom}>
                      Remover
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => aplicarCupom()}
                      disabled={checandoCupom}
                    >
                      {checandoCupom ? "..." : "Aplicar"}
                    </Button>
                  )}
                </div>
                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Mensalidade</span>
                    <span>{formatCurrency(mensalidade)}</span>
                  </div>
                  {cupomAplicado && (
                    <>
                      <div className="flex justify-between text-primary">
                        <span>Desconto ({cupomAplicado.codigo})</span>
                        <span>-{formatCurrency(desconto)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-foreground">
                        <span>Total da 1ª mensalidade</span>
                        <span>{formatCurrency(primeiraMensalidade)}</span>
                      </div>
                      {cupomAplicado.apenas_primeira_mensalidade && (
                        <p>A partir do 2º mês: {formatCurrency(mensalidade)}.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${p}venc`}>Vencimento</Label>
                <Input
                  id={`${p}venc`}
                  type="date"
                  value={values.vencimento}
                  onChange={(e) => set("vencimento", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${p}msg`}>Mensagem ao cliente (opcional)</Label>
                <Textarea
                  id={`${p}msg`}
                  value={values.mensagem}
                  onChange={(e) => set("mensagem", e.target.value)}
                  placeholder="Ex: Bem-vindo! Qualquer dúvida me chame."
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${p}anot`}>Anotações sobre o cliente (opcional)</Label>
            <Textarea
              id={`${p}anot`}
              value={values.anotacoes}
              onChange={(e) => set("anotacoes", e.target.value)}
              placeholder="Observações internas. O cliente não vê este campo."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Visível apenas para você e a administração.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
