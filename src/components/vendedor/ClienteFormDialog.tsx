import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { criarCliente, atualizarCliente } from "@/lib/vendedor.functions";
import { atualizarClienteAdmin } from "@/lib/admin.functions";
import { enviarLinkDefinicaoSenha } from "@/lib/password-reset";
import {
  clienteFormSchema,
  clienteFormVazio,
  clientePayloadComum,
  defaultVencimento,
  type ClienteFormValues,
} from "@/lib/cliente-form";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  useEffect(() => {
    if (aberto) setValues(valoresDoCliente(cliente));
  }, [aberto, cliente]);

  function set<K extends keyof ClienteFormValues>(key: K, value: ClienteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit() {
    const parsed = clienteFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }
    const v = parsed.data;
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
          },
        });
        const { error: resetErr } = await enviarLinkDefinicaoSenha(v.email);
        toast.success("Cliente cadastrado!", {
          description: resetErr
            ? `Peça para ${v.email} usar "Esqueci minha senha" no login para definir a senha.`
            : `Enviamos um e-mail para ${v.email} definir a senha de acesso.`,
        });
        setValues(valoresDoCliente(undefined));
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
              <Input
                id={`${p}senha`}
                type="password"
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
