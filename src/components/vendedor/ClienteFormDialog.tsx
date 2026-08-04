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
import { WhatsAppIndicator } from "@/components/WhatsAppIndicator";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoComAjuda } from "@/components/onboarding/CampoComAjuda";
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
  const [erros, setErros] = useState<Record<string, string>>({});
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
      setErros({});
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
    setValues((v) => {
      const next = { ...v, [key]: value };

      // Se mudar para teste de 7 dias, calcula o vencimento automático (8 dias: 7 teste + 1 ativação)
      if (key === "isTeste" && value === true) {
        const d = new Date();
        d.setDate(d.getDate() + 8);
        next.vencimento = d.toISOString().slice(0, 10);
      } else if (key === "isTeste" && value === false) {
        // Se desmarcar o teste, volta para o vencimento padrão (30 dias)
        next.vencimento = defaultVencimento();
      }

      return next;
    });

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
        const criado = await criar({
          data: {
            ...comum,
            data_vencimento: v.vencimento || defaultVencimento(),
            mensagem_vendedor: v.mensagem || null,
            cupom: cupomAplicado ? cupomAplicado.codigo : null,
          },
        });
        const { error: resetErr } = await enviarLinkDefinicaoSenha(v.email);
        const senhaMsg = resetErr
          ? `Peça para ${v.email} usar "Esqueci minha senha" no login para definir a senha.`
          : `Enviamos um e-mail para ${v.email} definir a senha de acesso.`;
        if (criado?.cupom_invalido) {
          toast.warning("Cliente cadastrado, mas o cupom NÃO foi aplicado", {
            description: `${criado.cupom_invalido} O cliente será cobrado o valor cheio. ${senhaMsg}`,
          });
        } else {
          toast.success("Cliente cadastrado!", { description: senhaMsg });
        }
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

  /** Mensagem de erro do campo (padroniza espaçamento e cor). */
  const Erro = ({ campo }: { campo: string }) =>
    erros[campo] ? (
      <p className="text-xs font-medium text-destructive" role="alert">
        {erros[campo]}
      </p>
    ) : null;

  const invalido = (campo: string) => (erros[campo] ? true : undefined);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar dados do cliente" : "Cadastrar cliente"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Atualize nome, e-mail, senha, plano e serviço extra do cliente."
              : "Campos com * são obrigatórios. O cliente recebe um e-mail para definir a própria senha."}
          </DialogDescription>
        </DialogHeader>

        {!editando && (
          <details className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Como cadastrar um cliente (passo a passo)
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                Preencha nome, e-mail e CPF/CNPJ — o CPF/CNPJ é exigido pela plataforma de
                pagamento.
              </li>
              <li>
                Escolha o plano; se houver, descreva o serviço extra e o valor, que soma à
                mensalidade.
              </li>
              <li>Aplique o cupom de desconto, se tiver um.</li>
              <li>Defina o primeiro vencimento (não pode ser uma data passada).</li>
              <li>
                Ao salvar, o cliente é criado na plataforma de pagamento e recebe o e-mail para
                definir a senha.
              </li>
            </ol>
          </details>
        )}

        <div className="grid gap-5">
          <fieldset className="grid gap-4">
            <legend className="text-sm font-semibold text-foreground">Dados do cliente</legend>

            <div className="grid gap-2">
              <Label htmlFor={`${p}nome`}>Nome completo *</Label>
              <Input
                id={`${p}nome`}
                value={values.nome}
                aria-invalid={invalido("nome")}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex: Maria Souza"
              />
              <Erro campo="nome" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${p}email`}>E-mail de acesso *</Label>
              <Input
                id={`${p}email`}
                type="email"
                value={values.email}
                aria-invalid={invalido("email")}
                onChange={(e) => set("email", e.target.value)}
                placeholder="cliente@email.com"
              />
              <p className="text-xs text-muted-foreground">
                É o login do cliente e o destino do e-mail de senha.
              </p>
              <Erro campo="email" />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-2">
                <CampoComAjuda ajuda="cliente.cpf_cnpj" htmlFor={`${p}cpf`}>
                  CPF ou CNPJ *
                </CampoComAjuda>
                <Input
                  id={`${p}cpf`}
                  inputMode="numeric"
                  value={values.cpfCnpj}
                  aria-invalid={invalido("cpfCnpj")}
                  onChange={(e) => set("cpfCnpj", e.target.value)}
                  placeholder="Somente números"
                />
                <Erro campo="cpfCnpj" />
              </div>
              <div className="grid gap-2">
                <CampoComAjuda ajuda="cliente.telefone" htmlFor={`${p}tel`}>
                  Telefone *
                </CampoComAjuda>
                <div className="flex items-center gap-2">
                  <Input
                    id={`${p}tel`}
                    inputMode="tel"
                    value={values.telefone}
                    aria-invalid={invalido("telefone")}
                    onChange={(e) => set("telefone", e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                  <WhatsAppIndicator telefone={values.telefone} />
                </div>
                <Erro campo="telefone" />
              </div>
            </div>

            {editando && (
              <div className="grid gap-2">
                <Label htmlFor={`${p}senha`}>Nova senha (opcional)</Label>
                <PasswordInput
                  id={`${p}senha`}
                  value={values.senha}
                  aria-invalid={invalido("senha")}
                  onChange={(e) => set("senha", e.target.value)}
                  placeholder="Deixe em branco para manter"
                />
                <Erro campo="senha" />
              </div>
            )}
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="text-sm font-semibold text-foreground">Plano e cobrança</legend>

            <div className="grid gap-2">
              <Label>Plano *</Label>
              <Select value={values.planoId} onValueChange={(v) => set("planoId", v)}>
                <SelectTrigger aria-invalid={invalido("planoId")}>
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
              <Erro campo="planoId" />
            </div>

            <div className="grid gap-2 rounded-md border border-border p-3">
              <CampoComAjuda ajuda="cliente.servico_extra" htmlFor={`${p}serv`}>
                Serviço extra (opcional)
              </CampoComAjuda>
              <Input
                id={`${p}serv`}
                value={values.servicoExtra}
                aria-invalid={invalido("servicoExtra")}
                onChange={(e) => set("servicoExtra", e.target.value)}
                placeholder="Ex: Instalação, suporte premium..."
              />
              <Erro campo="servicoExtra" />
              <Label htmlFor={`${p}servval`} className="mt-1">
                Valor do serviço (R$)
              </Label>
              <Input
                id={`${p}servval`}
                type="text"
                inputMode="decimal"
                value={values.servicoValor}
                aria-invalid={invalido("servicoValor")}
                onChange={(e) => set("servicoValor", e.target.value)}
                placeholder="0,00"
              />
              <Erro campo="servicoValor" />
              <p className="text-xs text-muted-foreground">
                Esse valor soma ao valor do plano. Mensalidade atual:{" "}
                <strong>{formatCurrency(mensalidade)}</strong>.
              </p>
            </div>
            <div className="grid gap-4 rounded-md border border-border p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${p}teste`}
                  checked={values.isTeste}
                  onCheckedChange={(checked) => set("isTeste", checked === true)}
                />
                <Label
                  htmlFor={`${p}teste`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Teste de 7 dias
                </Label>
              </div>

              {values.isTeste && (
                <p className="text-xs text-muted-foreground">
                  O vencimento foi ajustado para daqui a 8 dias (7 dias de teste + 1 dia de ativação).
                </p>
              )}

              <div className="grid gap-2">
                <Label htmlFor={`${p}venc`}>Primeiro vencimento *</Label>
                <Input
                  id={`${p}venc`}
                  type="date"
                  value={values.vencimento}
                  aria-invalid={invalido("vencimento")}
                  onChange={(e) => set("vencimento", e.target.value)}
                />
                <Erro campo="vencimento" />
              </div>
            </div>
          </fieldset>

          {!editando && (
            <>
              <div className="grid gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <CampoComAjuda ajuda="cliente.cupom" htmlFor={`${p}cupom`}>
                  Cupom de desconto (opcional)
                </CampoComAjuda>
                {destaque && !cupomAplicado && (
                  <button
                    type="button"
                    onClick={() => aplicarCupom(destaque.codigo)}
                    className="rounded-md border border-dashed border-primary/50 px-3 py-2 text-left text-xs text-primary hover:bg-primary/10"
                  >
                    <span className="font-semibold">{destaque.codigo}</span> —{" "}
                    {destaque.descricao ?? `${formatCurrency(destaque.valor_desconto)} de desconto`}
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
                <CampoComAjuda ajuda="cliente.primeiro_vencimento" htmlFor={`${p}venc`}>
                  Primeiro vencimento *
                </CampoComAjuda>
                <Input
                  id={`${p}venc`}
                  type="date"
                  value={values.vencimento}
                  aria-invalid={invalido("vencimento")}
                  onChange={(e) => set("vencimento", e.target.value)}
                />
                <Erro campo="vencimento" />
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
            <CampoComAjuda ajuda="cliente.anotacoes" htmlFor={`${p}anot`}>
              Anotações sobre o cliente (opcional)
            </CampoComAjuda>
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
