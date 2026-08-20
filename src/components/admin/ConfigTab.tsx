import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ReverTutoriais } from "@/components/onboarding/ReverTutoriais";
import { DoisFatoresEquipeCard } from "@/components/admin/DoisFatoresEquipeCard";
import { testarChaveAsaas } from "@/lib/asaas.functions";
import { salvarConfiguracoes, obterWebhookToken } from "@/lib/config.functions";
import { obterConfigIa, salvarConfigIa, testarConexaoIa } from "@/lib/configuracoes.functions";
import { gerarLembretesAgora, ultimaExecucaoLembretes } from "@/lib/lembretes.functions";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Copy, Check, KeyRound, Brain, Sparkles, Activity } from "lucide-react";
import type { Config } from "@/lib/admin-tipos";
import { formatDateTime } from "@/lib/format";

export function ConfigTab({ config, onSaved }: { config: Config | null; onSaved: () => void }) {
  const [form, setForm] = useState<Config>(
    config ?? {
      nome_app: "",
      dominio: "",
      dias_aviso_vencimento: 5,
      dias_devolver_lead: 7,
      horas_reserva_lote: 48,
      percentual_comissao_padrao: 10,
      asaas_webhook_url: "",
      asaas_ambiente: "sandbox",
      asaas_api_key_mascara: "",
      asaas_api_key_definida: false,
      changelog_ativo: true,
      changelog_versao_atual: "1.0.0",
    },
  );
  const [novaChave, setNovaChave] = useState("");
  const [iaConfig, setIaConfig] = useState<{
    provedor: "openrouter" | "deepseek" | "groq" | "google" | "anthropic";
    modelo: string;
    temChave: boolean;
    ultimos4: string | null;
    testadaEm: string | null;
    testeOk: boolean | null;
  } | null>(null);
  const [novaIaKey, setNovaIaKey] = useState("");
  const [testandoIa, setTestandoIa] = useState(false);
  
  const getIa = useServerFn(obterConfigIa);
  const setIa = useServerFn(salvarConfigIa);
  const testIa = useServerFn(testarConexaoIa);

  useEffect(() => {
    getIa({}).then(setIaConfig).catch(console.error);
  }, [getIa]);
  const [saving, setSaving] = useState(false);
  const [gerandoLembretes, setGerandoLembretes] = useState(false);
  const gerarLembretes = useServerFn(gerarLembretesAgora);
  const buscarUltimaExecucao = useServerFn(ultimaExecucaoLembretes);
  const [ultimoLembrete, setUltimoLembrete] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarUltimaExecucao({})
      .then((r) => {
        if (ativo) setUltimoLembrete(r.ultimo);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [buscarUltimaExecucao]);

  const [testando, setTestando] = useState(false);
  const [tokenMascara, setTokenMascara] = useState("");
  const [tokenRevelado, setTokenRevelado] = useState<string | null>(null);
  const [tokenDefinido, setTokenDefinido] = useState(false);
  const [carregandoToken, setCarregandoToken] = useState(false);
  const [copiado, setCopiado] = useState<"token" | "url" | null>(null);
  const testar = useServerFn(testarChaveAsaas);
  const salvar = useServerFn(salvarConfiguracoes);
  const carregarToken = useServerFn(obterWebhookToken);

  useEffect(() => {
    carregarToken({ data: {} })
      .then((r) => {
        setTokenMascara(r.mascara);
        setTokenDefinido(r.definido);
      })
      .catch(() => {
        setTokenMascara("");
        setTokenDefinido(false);
      });
  }, [carregarToken]);

  /** Busca o token completo sob demanda (não fica na página por padrão). */
  async function obterTokenCompleto(): Promise<string | null> {
    if (tokenRevelado) return tokenRevelado;
    setCarregandoToken(true);
    try {
      const r = await carregarToken({ data: { revelar: true } });
      if (!r.token) {
        toast.error("Nenhum token configurado no servidor.");
        return null;
      }
      setTokenRevelado(r.token);
      return r.token;
    } catch {
      toast.error("Não foi possível ler o token.");
      return null;
    } finally {
      setCarregandoToken(false);
    }
  }

  async function copiar(texto: string, qual: "token" | "url") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      toast.success("Copiado!");
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  }

  async function copiarToken() {
    const t = await obterTokenCompleto();
    if (t) await copiar(t, "token");
  }

  async function testarChave() {
    setTestando(true);
    try {
      const r = await testar({});
      toast.success(
        `Chave válida! Conta: ${r.nomeConta} — ambiente ${r.ambiente === "producao" ? "produção" : "sandbox"}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao testar a chave.");
    } finally {
      setTestando(false);
    }
  }

  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await salvar({
        data: {
          nome_app: form.nome_app ?? "",
          dominio: form.dominio ?? "",
          dias_aviso_vencimento: Number(form.dias_aviso_vencimento) || 0,
          dias_devolver_lead: Math.min(30, Math.max(3, Number(form.dias_devolver_lead) || 7)),
          horas_reserva_lote: Math.min(720, Math.max(1, Number(form.horas_reserva_lote) || 48)),
          percentual_comissao_padrao: Number(form.percentual_comissao_padrao) || 0,
          asaas_webhook_url: form.asaas_webhook_url ?? "",
          asaas_ambiente: form.asaas_ambiente ?? "sandbox",
          asaas_api_key: novaChave.trim() || null,
        },
      });
      setNovaChave("");
      toast.success("Configurações salvas.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function saveIa() {
    if (!iaConfig) return;
    setSaving(true);
    try {
      await setIa({
        data: {
          provedor: iaConfig.provedor,
          modelo: iaConfig.modelo,
          api_key: novaIaKey.trim() || undefined,
        },
      });
      setNovaIaKey("");
      const updated = await getIa({});
      setIaConfig(updated);
      toast.success("Configuração de IA salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar IA.");
    } finally {
      setSaving(false);
    }
  }

  async function testarIa() {
    setTestandoIa(true);
    try {
      const r = await testIa({});
      if (r.ok) {
        toast.success(`IA conectada! Latência: ${r.latenciaMs}ms`);
      } else {
        toast.error(`Falha na IA: ${r.mensagem}`);
      }
      const updated = await getIa({});
      setIaConfig(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no teste de IA.");
    } finally {
      setTestandoIa(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-6">
        <p className="section-title">Tutoriais do sistema</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Reinicie os tutoriais guiados para revê-los desde o começo.
        </p>
        <div className="mt-3">
          <ReverTutoriais />
        </div>
      </Card>
      <DoisFatoresEquipeCard />
      <Card className="p-6">
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div className="grid gap-0.5">
                <Label htmlFor="cactive" className="text-sm font-semibold">Changelog Automático</Label>
                <p className="text-xs text-muted-foreground">Publica notas de atualização via IA após cada deploy.</p>
              </div>
            </div>
            <Switch
              id="cactive"
              checked={form.changelog_ativo ?? true}
              onCheckedChange={(v) => set("changelog_ativo", v)}
            />
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="capp">Nome do app</Label>
              <Input
                id="capp"
                value={form.nome_app ?? ""}
                onChange={(e) => set("nome_app", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cdom">Domínio</Label>
              <Input
                id="cdom"
                value={form.dominio ?? ""}
                onChange={(e) => set("dominio", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cdias">Dias de aviso de vencimento</Label>
              <Input
                id="cdias"
                type="number"
                min={0}
                value={form.dias_aviso_vencimento ?? 0}
                onChange={(e) => set("dias_aviso_vencimento", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Clientes ativos recebem um lembrete automático no painel quando o vencimento estiver
                dentro desse prazo. A rotina roda todos os dias às 6h (horário de Brasília).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={gerandoLembretes}
                  onClick={async () => {
                    setGerandoLembretes(true);
                    try {
                      const r = await gerarLembretes({});
                      toast.success(
                        `Lembretes gerados: ${r.criados} novo(s) em ${r.avaliados} cliente(s).`,
                      );
                      const u = await buscarUltimaExecucao({});
                      setUltimoLembrete(u.ultimo);
                    } catch {
                      toast.error("Não foi possível gerar os lembretes agora.");
                    } finally {
                      setGerandoLembretes(false);
                    }
                  }}
                >
                  {gerandoLembretes ? "Gerando..." : "Gerar lembretes agora"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {ultimoLembrete
                    ? `Último lembrete criado em ${formatDateTime(ultimoLembrete)}`
                    : "Nenhum lembrete gerado ainda."}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cdevolver">Dias até devolver lead</Label>
              <Input
                id="cdevolver"
                type="number"
                min={3}
                max={30}
                value={form.dias_devolver_lead ?? 7}
                onChange={(e) => set("dias_devolver_lead", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Leads puxados do Banco de Leads e não trabalhados voltam ao banco depois desse prazo
                (entre 3 e 30 dias). O vendedor é avisado um dia antes. A rotina roda todos os dias
                às 8h (horário de Brasília).
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="creserva">Horas de reserva do lote</Label>
              <Input
                id="creserva"
                type="number"
                min={1}
                max={720}
                value={form.horas_reserva_lote ?? 48}
                onChange={(e) => set("horas_reserva_lote", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Quando um lote é importado com reserva de segmento, estado ou CNAE, só vendedores
                com esse escopo veem os leads durante esse período (entre 1 e 720 horas). Depois
                disso, o lote fica livre para todo o time.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ccom">Comissão padrão (%)</Label>
              <Input
                id="ccom"
                type="number"
                min={0}
                max={100}
                value={form.percentual_comissao_padrao ?? 0}
                onChange={(e) => set("percentual_comissao_padrao", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="mt-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Integração Asaas</h3>
            <p className="text-xs text-muted-foreground">
              Cobranças via PIX, boleto e cartão. Preencha quando tiver a chave da Asaas.
            </p>
            <div className="mt-3 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ckey">Chave de API Asaas</Label>
                <PasswordInput
                  id="ckey"
                  value={novaChave}
                  onChange={(e) => setNovaChave(e.target.value)}
                  placeholder={
                    form.asaas_api_key_definida
                      ? `Chave salva (${form.asaas_api_key_mascara}) — digite para substituir`
                      : "$aact_..."
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {form.asaas_api_key_definida
                    ? "Deixe em branco para manter a chave atual. A chave nunca é exibida por segurança."
                    : "Cole a chave da API do Asaas. Ela fica guardada apenas no servidor."}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cwh">Webhook URL</Label>
                <Input
                  id="cwh"
                  value={form.asaas_webhook_url ?? ""}
                  onChange={(e) => set("asaas_webhook_url", e.target.value)}
                />
              </div>

              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <Label htmlFor="ctoken" className="font-semibold">
                    Token de autenticação do webhook
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este token protege seu webhook: o painel só aceita notificações do Asaas que
                  enviem exatamente este valor. Por segurança ele fica oculto — use "Copiar" para
                  colar direto no Asaas, ou "Revelar" se precisar conferir.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="ctoken"
                    readOnly
                    value={
                      tokenRevelado ?? (tokenDefinido ? tokenMascara : "Nenhum token configurado")
                    }
                    className="min-w-0 flex-1 font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!tokenDefinido || carregandoToken}
                    onClick={copiarToken}
                    aria-label="Copiar token"
                  >
                    {copiado === "token" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!tokenDefinido || carregandoToken}
                    onClick={() =>
                      tokenRevelado ? setTokenRevelado(null) : void obterTokenCompleto()
                    }
                  >
                    {tokenRevelado ? "Ocultar" : "Revelar"}
                  </Button>
                </div>

                <div className="mt-1 rounded-md bg-background p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Como configurar no Asaas:</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>
                      No painel do Asaas, acesse <strong>Integrações → Webhooks</strong> (ou
                      Configurações → Integrações).
                    </li>
                    <li>
                      Em <strong>URL</strong>, cole o endereço do webhook (campo acima).
                    </li>
                    <li>
                      No campo <strong>Token de autenticação</strong>, cole o token acima.
                    </li>
                    <li>
                      Ative os eventos de cobrança (PAYMENT_RECEIVED, PAYMENT_OVERDUE etc.) e salve.
                    </li>
                  </ol>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="cprod"
                  checked={form.asaas_ambiente === "producao"}
                  onCheckedChange={(v) => set("asaas_ambiente", v ? "producao" : "sandbox")}
                />
                <Label htmlFor="cprod">
                  Ambiente de produção {form.asaas_ambiente !== "producao" && "(sandbox)"}
                </Label>
              </div>
              <div>
                <Button type="button" variant="outline" onClick={testarChave} disabled={testando}>
                  {testando ? "Testando..." : "Testar chave Asaas"}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Salve a chave antes de testar. O ambiente correto é detectado automaticamente.
                </p>
            </div>
          </div>

          <div className="mt-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Inteligência Artificial</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure a IA para gerar notas de atualização automáticas. O changelog usará o modo simples sem uma chave configurada.
            </p>

            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Provedor</Label>
                  <Select
                    value={iaConfig?.provedor ?? "openrouter"}
                    onValueChange={(v: any) => iaConfig && setIaConfig({ ...iaConfig, provedor: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openrouter">OpenRouter (Grátis/Pago)</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="groq">Groq (Rápido)</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {iaConfig?.provedor === "openrouter" && "OpenRouter — diversos modelos e opções gratuitas."}
                    {iaConfig?.provedor === "deepseek" && "DeepSeek — excelente custo-benefício."}
                    {iaConfig?.provedor === "groq" && "Groq — inferência extremamente veloz."}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="iamodelo">Modelo</Label>
                  <Input
                    id="iamodelo"
                    value={iaConfig?.modelo ?? ""}
                    onChange={(e) => iaConfig && setIaConfig({ ...iaConfig, modelo: e.target.value })}
                    placeholder="ex: deepseek/deepseek-chat:free"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="iakey">Chave de API</Label>
                <PasswordInput
                  id="iakey"
                  value={novaIaKey}
                  onChange={(e) => setNovaIaKey(e.target.value)}
                  placeholder={
                    iaConfig?.temChave
                      ? `•••• ${iaConfig.ultimos4} (Deixe em branco para manter)`
                      : "Sua chave de API"
                  }
                />
                <div className="flex items-center gap-2">
                  <Badge variant={iaConfig?.temChave ? "success" : "secondary"}>
                    {iaConfig?.temChave ? "Chave configurada" : "Sem chave"}
                  </Badge>
                  {iaConfig?.testadaEm && (
                    <span className="text-[10px] text-muted-foreground">
                      Testado em {formatDateTime(iaConfig.testadaEm)}:{" "}
                      {iaConfig.testeOk ? (
                        <span className="text-success">OK</span>
                      ) : (
                        <span className="text-destructive">Falhou</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={saveIa} disabled={saving}>
                  <Save className="mr-2 h-3 w-3" /> Salvar IA
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testarIa}
                  disabled={testandoIa || !iaConfig?.temChave && !novaIaKey}
                >
                  <Activity className="mr-2 h-3 w-3" />
                  {testandoIa ? "Testando..." : "Testar conexão"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar configurações"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
