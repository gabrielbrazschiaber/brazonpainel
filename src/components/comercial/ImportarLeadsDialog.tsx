import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Undo2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import {
  CAMPOS_IMPORT,
  baixarModelo,
  lerArquivo,
  montarLinhas,
  normalizarTelefone,
  paraEnvio,
  reclassificar,
  resumir,
  sugerirMapa,
  type AcaoLinha,
  type ArquivoLido,
  type DestinoColuna,
  type LeadExistente,
  type LinhaImport,
  type StatusLinha,
} from "@/lib/leads-import";
import {
  desfazerImportacao,
  importarLeads,
  verificarDuplicados,
  type ResultadoImportacao,
} from "@/lib/leads-import.functions";

type Etapa = "envio" | "revisao" | "resultado";
type Filtro = "todas" | "ok" | "erro" | "duplicados";

const STATUS_LABEL: Record<StatusLinha, string> = {
  ok: "Pronto",
  erro: "Com erro",
  duplicado_arquivo: "Duplicado na planilha",
  duplicado_base: "Já existe na base",
};

const STATUS_CLASSE: Record<StatusLinha, string> = {
  ok: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  erro: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  duplicado_arquivo:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  duplicado_base:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
};

const CAMPOS_EDITAVEIS = [
  { campo: "nome_contato" as const, label: "Nome", largura: "min-w-[160px]" },
  { campo: "telefone" as const, label: "Telefone", largura: "min-w-[140px]" },
  { campo: "empresa" as const, label: "Empresa", largura: "min-w-[140px]" },
  { campo: "cargo" as const, label: "Cargo", largura: "min-w-[120px]" },
  { campo: "email" as const, label: "E-mail", largura: "min-w-[160px]" },
  { campo: "segmento" as const, label: "Segmento", largura: "min-w-[130px]" },
];

/** Janela simples de renderização para planilhas grandes (sem dependência nova). */
const JANELA = 100;
const ALTURA_LINHA = 52;

export function ImportarLeadsDialog({
  aberto,
  onOpenChange,
  isAdmin,
  vendedores,
  segmentos,
  onConcluido,
  onVerLote,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
  vendedores: { id: string; nome: string }[];
  segmentos: string[];
  onConcluido: () => void;
  onVerLote: (importacaoId: string) => void;
}) {
  const checarDuplicados = useServerFn(verificarDuplicados);
  const gravar = useServerFn(importarLeads);
  const desfazer = useServerFn(desfazerImportacao);

  const [etapa, setEtapa] = useState<Etapa>("envio");
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [mapa, setMapa] = useState<DestinoColuna[]>([]);
  const [linhas, setLinhas] = useState<LinhaImport[]>([]);
  const [base, setBase] = useState<Map<string, LeadExistente>>(new Map());
  const [destino, setDestino] = useState<string>("");
  const [lendo, setLendo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [criadoEm, setCriadoEm] = useState<number>(0);
  const [confirmarDesfazer, setConfirmarDesfazer] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [segmentoMassa, setSegmentoMassa] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [inicioJanela, setInicioJanela] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const resetar = useCallback(() => {
    setEtapa("envio");
    setArquivo(null);
    setMapa([]);
    setLinhas([]);
    setBase(new Map());
    setErroArquivo(null);
    setResultado(null);
    setProgresso(0);
    setFiltro("todas");
    setSegmentoMassa("");
    setInicioJanela(0);
  }, []);

  useEffect(() => {
    if (!aberto) resetar();
  }, [aberto, resetar]);

  const resumo = useMemo(() => resumir(linhas), [linhas]);
  const nomeDestino = useMemo(
    () => vendedores.find((v) => v.id === destino)?.nome ?? "",
    [vendedores, destino],
  );

  const nomeMapeado = mapa.includes("nome_contato");
  const telMapeado = mapa.includes("telefone");
  const mapeamentoOk = nomeMapeado && telMapeado;

  /** Lê o arquivo, sugere mapeamento e consulta duplicados da base. */
  const processarArquivo = useCallback(
    async (file: File) => {
      setLendo(true);
      setErroArquivo(null);
      try {
        const lido = await lerArquivo(file);
        const sugestao = sugerirMapa(lido.temCabecalho ? lido.cabecalhos : []);
        const mapaInicial: DestinoColuna[] = lido.cabecalhos.map((_, i) => sugestao[i] ?? "");
        const cruas = montarLinhas(lido, mapaInicial, segmentos);

        let mapaBase = new Map<string, LeadExistente>();
        try {
          const telefones = cruas
            .map((l) => normalizarTelefone(l.telefone))
            .filter((d) => d.length >= 10);
          if (telefones.length > 0) {
            const achados = await checarDuplicados({
              data: {
                telefones,
                ...(isAdmin && destino ? { destino_vendedor_id: destino } : {}),
              },
            });
            mapaBase = new Map(achados.map((a) => [a.telefone, a]));
          }
        } catch {
          toast.warning("Não foi possível checar duplicados na base agora.");
        }

        setArquivo(lido);
        setMapa(mapaInicial);
        setBase(mapaBase);
        setLinhas(reclassificar(cruas, mapaBase));
        setEtapa("revisao");
      } catch (err) {
        setErroArquivo(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
      } finally {
        setLendo(false);
      }
    },
    [checarDuplicados, destino, isAdmin, segmentos],
  );

  /** Remapeia colunas: refaz as linhas mantendo as classificações. */
  function trocarColuna(indice: number, valor: DestinoColuna) {
    if (!arquivo) return;
    const novo = mapa.map((m, i) => (i === indice ? valor : m === valor && valor ? "" : m));
    setMapa(novo);
    setLinhas(reclassificar(montarLinhas(arquivo, novo, segmentos), base));
  }

  function editarCelula(id: string, campo: keyof LinhaImport, valor: string) {
    setLinhas((atuais) =>
      reclassificar(
        atuais.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)),
        base,
      ),
    );
  }

  function trocarAcao(id: string, acao: AcaoLinha) {
    setLinhas((atuais) => atuais.map((l) => (l.id === id ? { ...l, acao, acaoManual: true } : l)));
  }

  function ignorarComErro() {
    setLinhas((atuais) =>
      atuais.map((l) => (l.status === "erro" ? { ...l, acao: "ignorar", acaoManual: true } : l)),
    );
    toast.success("Linhas com erro marcadas para ignorar.");
  }

  function atualizarDuplicados() {
    setLinhas((atuais) =>
      atuais.map((l) =>
        l.status === "duplicado_base" ? { ...l, acao: "atualizar", acaoManual: true } : l,
      ),
    );
    toast.success("Duplicados marcados para atualizar campos vazios.");
  }

  function aplicarSegmento() {
    const s = segmentoMassa.trim();
    if (!s) return;
    setLinhas((atuais) =>
      reclassificar(
        atuais.map((l) => (l.segmento.trim() ? l : { ...l, segmento: s })),
        base,
      ),
    );
    toast.success(`Segmento "${s}" aplicado às linhas sem segmento.`);
  }

  const visiveis = useMemo(() => {
    if (filtro === "ok") return linhas.filter((l) => l.status === "ok");
    if (filtro === "erro") return linhas.filter((l) => l.status === "erro");
    if (filtro === "duplicados")
      return linhas.filter(
        (l) => l.status === "duplicado_arquivo" || l.status === "duplicado_base",
      );
    return linhas;
  }, [linhas, filtro]);

  const virtual = visiveis.length > 200;
  const fatia = virtual ? visiveis.slice(inicioJanela, inicioJanela + JANELA) : visiveis;

  function aoRolar() {
    const el = scrollRef.current;
    if (!el || !virtual) return;
    const primeiro = Math.max(0, Math.floor(el.scrollTop / ALTURA_LINHA) - 10);
    setInicioJanela(Math.min(primeiro, Math.max(0, visiveis.length - JANELA)));
  }

  const totalGravar = resumo.aImportar + resumo.aAtualizar;

  async function importar() {
    const payload = paraEnvio(linhas);
    if (payload.length === 0) return;
    setGravando(true);
    setProgresso(5);
    const timer = setInterval(() => setProgresso((p) => (p < 90 ? p + 5 : p)), 300);
    try {
      const r = await gravar({
        data: {
          arquivo_nome: arquivo?.nome ?? "planilha",
          total_linhas: linhas.length,
          ...(isAdmin && destino ? { destino_vendedor_id: destino } : {}),
          linhas: payload,
        },
      });
      setProgresso(100);
      setResultado(r);
      setCriadoEm(Date.now());
      setEtapa("resultado");
      onConcluido();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível importar a planilha.");
    } finally {
      clearInterval(timer);
      setGravando(false);
    }
  }

  async function confirmarDesfazerImportacao() {
    if (!resultado) return;
    setDesfazendo(true);
    try {
      const r = await desfazer({ data: { importacao_id: resultado.importacao_id } });
      toast.success(
        r.preservados > 0
          ? `${r.removidos} lead(s) removido(s). ${r.preservados} preservado(s) por já ter histórico, dados preenchidos ou mudança de estágio.`
          : `${r.removidos} lead(s) removido(s).`,
      );
      setConfirmarDesfazer(false);
      onConcluido();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível desfazer a importação.");
    } finally {
      setDesfazendo(false);
    }
  }

  const dentroDe24h = criadoEm > 0 && Date.now() - criadoEm < 24 * 3600 * 1000;

  return (
    <>
      <Dialog
        open={aberto}
        onOpenChange={(v) => {
          if (gravando) return;
          onOpenChange(v);
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar leads por planilha
            </DialogTitle>
            <DialogDescription>
              {etapa === "envio" && "Envie o arquivo — nada é gravado antes da sua revisão."}
              {etapa === "revisao" &&
                "Confira o mapeamento e corrija o que precisar antes de gravar."}
              {etapa === "resultado" && "Resumo da importação."}
            </DialogDescription>
          </DialogHeader>

          {/* ETAPA 1 — ENVIO */}
          {etapa === "envio" && (
            <div className="space-y-4 overflow-y-auto">
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label>Importar para qual vendedor?</Label>
                  <Select value={destino} onValueChange={setDestino}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o vendedor de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendedores.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void processarArquivo(f);
                }}
                className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                  arrastando ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <Upload className="h-7 w-7 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Arraste a planilha aqui</p>
                  <p className="text-xs text-muted-foreground">
                    Aceita .xlsx, .xls e .csv — até 2000 linhas e 5 MB
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void processarArquivo(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  disabled={lendo || (isAdmin && !destino)}
                  onClick={() => inputRef.current?.click()}
                >
                  {lendo ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo arquivo...
                    </>
                  ) : (
                    "Escolher arquivo"
                  )}
                </Button>
                {isAdmin && !destino && (
                  <p className="text-xs text-muted-foreground">
                    Escolha o vendedor de destino para liberar o envio.
                  </p>
                )}
              </div>

              <Card className="space-y-2 p-4 text-sm">
                <p className="font-medium">Obrigatórios: nome e telefone.</p>
                <p className="text-muted-foreground">
                  Os demais campos podem ficar em branco — você preenche depois, conforme entrar em
                  contato.
                </p>
                <Button variant="link" className="h-auto px-0" onClick={() => baixarModelo()}>
                  <Download className="mr-2 h-4 w-4" /> Baixar modelo de planilha
                </Button>
              </Card>

              {erroArquivo && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{erroArquivo}</span>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2 — REVISÃO */}
          {etapa === "revisao" && arquivo && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {/* a) Mapeamento */}
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Mapeamento das colunas</p>
                  <p className="text-xs text-muted-foreground">
                    {arquivo.nome} · {linhas.length} linha{linhas.length === 1 ? "" : "s"}
                    {isAdmin && nomeDestino ? ` · destino: ${nomeDestino}` : ""}
                  </p>
                </div>

                {!mapeamentoOk && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Mapeie {!nomeMapeado ? "o nome do contato" : ""}
                      {!nomeMapeado && !telMapeado ? " e " : ""}
                      {!telMapeado ? "o telefone" : ""} para continuar.
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {arquivo.cabecalhos.map((h, i) => {
                    const amostras = arquivo.matriz
                      .slice(0, 3)
                      .map((l) => (l[i] ?? "").toString().trim())
                      .filter(Boolean);
                    return (
                      <div
                        key={`${h}-${i}`}
                        className="grid items-center gap-2 rounded-lg border border-border/60 p-2 sm:grid-cols-[1fr_200px_1fr]"
                      >
                        <p className="truncate text-sm font-medium">{h}</p>
                        <Select
                          value={mapa[i] || "ignorar"}
                          onValueChange={(v) =>
                            trocarColuna(i, v === "ignorar" ? "" : (v as DestinoColuna))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignorar">Ignorar esta coluna</SelectItem>
                            {CAMPOS_IMPORT.map((c) => (
                              <SelectItem key={c.campo} value={c.campo}>
                                {c.label}
                                {c.obrigatorio ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="truncate text-xs text-muted-foreground">
                          {amostras.length ? amostras.join(" · ") : "sem amostras"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* b) Resumo */}
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                  {
                    label: "Prontos",
                    valor: resumo.ok,
                    classe: "text-emerald-600 dark:text-emerald-400",
                  },
                  { label: "Com erro", valor: resumo.erro, classe: "text-destructive" },
                  {
                    label: "Duplicados na planilha",
                    valor: resumo.duplicado_arquivo,
                    classe: "text-amber-600 dark:text-amber-400",
                  },
                  {
                    label: "Já existem na base",
                    valor: resumo.duplicado_base,
                    classe: "text-amber-600 dark:text-amber-400",
                  },
                ].map((c) => (
                  <Card key={c.label} className="p-3">
                    <p className="eyebrow">{c.label}</p>
                    <p className={`text-xl font-semibold ${c.classe}`}>{c.valor}</p>
                  </Card>
                ))}
              </div>

              {/* Ações em massa + filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                  <TabsList>
                    <TabsTrigger value="todas">Todas</TabsTrigger>
                    <TabsTrigger value="ok">Prontos</TabsTrigger>
                    <TabsTrigger value="erro">Com erro</TabsTrigger>
                    <TabsTrigger value="duplicados">Duplicados</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button size="sm" variant="outline" onClick={ignorarComErro}>
                  Ignorar todas com erro
                </Button>
                <Button size="sm" variant="outline" onClick={atualizarDuplicados}>
                  Atualizar todos os duplicados
                </Button>
                <div className="flex items-center gap-1.5">
                  <Input
                    className="h-9 w-36"
                    placeholder="Segmento"
                    value={segmentoMassa}
                    onChange={(e) => setSegmentoMassa(e.target.value)}
                    list="segmentos-import"
                  />
                  <datalist id="segmentos-import">
                    {segmentos.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <Button size="sm" variant="outline" onClick={aplicarSegmento}>
                    Aplicar a quem não tem
                  </Button>
                </div>
              </div>

              {/* c) Prévia editável */}
              <div
                ref={scrollRef}
                onScroll={aoRolar}
                className="max-h-[46vh] overflow-auto rounded-lg border border-border/60"
              >
                {virtual && <div style={{ height: inicioJanela * ALTURA_LINHA }} />}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">#</TableHead>
                      <TableHead className="w-40">Status</TableHead>
                      {CAMPOS_EDITAVEIS.map((c) => (
                        <TableHead key={c.campo}>{c.label}</TableHead>
                      ))}
                      <TableHead className="w-32">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fatia.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs text-muted-foreground">{l.linha}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_CLASSE[l.status]}>
                            {STATUS_LABEL[l.status]}
                          </Badge>
                          {l.existente && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              já cadastrado: {l.existente.nome_contato}
                            </p>
                          )}
                          {l.erros.length > 0 && (
                            <p className="mt-1 text-xs text-destructive">{l.erros.join(" · ")}</p>
                          )}
                          {l.avisos.length > 0 && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                              {l.avisos.join(" · ")}
                            </p>
                          )}
                        </TableCell>
                        {CAMPOS_EDITAVEIS.map((c) => (
                          <TableCell key={c.campo} className={c.largura}>
                            <Input
                              className="h-8 border-transparent bg-transparent px-1.5 focus-visible:border-input"
                              placeholder="—"
                              aria-label={`${c.label} da linha ${l.linha}`}
                              value={l[c.campo]}
                              onChange={(e) => editarCelula(l.id, c.campo, e.target.value)}
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Select
                            value={l.acao}
                            onValueChange={(v) => trocarAcao(l.id, v as AcaoLinha)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="criar" disabled={l.status === "erro"}>
                                Criar
                              </SelectItem>
                              <SelectItem
                                value="atualizar"
                                disabled={l.status !== "duplicado_base"}
                              >
                                Atualizar
                              </SelectItem>
                              <SelectItem value="ignorar">Ignorar</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {virtual && (
                  <div
                    style={{
                      height: Math.max(0, (visiveis.length - inicioJanela - JANELA) * ALTURA_LINHA),
                    }}
                  />
                )}
              </div>

              {gravando && (
                <div className="space-y-1.5" aria-live="polite">
                  <Progress value={progresso} />
                  <p className="text-xs text-muted-foreground">
                    Importando {Math.min(totalGravar, Math.round((progresso / 100) * totalGravar))}{" "}
                    de {totalGravar}...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3 — RESULTADO */}
          {etapa === "resultado" && resultado && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>Importação concluída.</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Card className="p-3">
                  <p className="eyebrow">Criados</p>
                  <p className="text-xl font-semibold">{resultado.importados}</p>
                </Card>
                <Card className="p-3">
                  <p className="eyebrow">Atualizados</p>
                  <p className="text-xl font-semibold">{resultado.atualizados}</p>
                </Card>
                <Card className="p-3">
                  <p className="eyebrow">Ignorados</p>
                  <p className="text-xl font-semibold">{resultado.ignorados}</p>
                </Card>
              </div>

              {resultado.erros.length > 0 && (
                <Card className="space-y-2 p-4">
                  <p className="text-sm font-medium text-destructive">
                    {resultado.erros.length} linha(s) não foram importadas
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
                    {resultado.erros.map((e, i) => (
                      <li key={`${e.linha}-${i}`}>
                        Linha {e.linha}: {e.motivo}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-between">
            {etapa === "revisao" ? (
              <>
                <Button variant="ghost" disabled={gravando} onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={gravando || totalGravar === 0 || !mapeamentoOk}
                  onClick={() => void importar()}
                >
                  {gravando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
                    </>
                  ) : (
                    `Importar ${totalGravar} lead${totalGravar === 1 ? "" : "s"}`
                  )}
                </Button>
              </>
            ) : etapa === "resultado" && resultado ? (
              <>
                {dentroDe24h && resultado.importados > 0 && (
                  <Button variant="outline" onClick={() => setConfirmarDesfazer(true)}>
                    <Undo2 className="mr-2 h-4 w-4" /> Desfazer importação
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                  <Button
                    onClick={() => {
                      onVerLote(resultado.importacao_id);
                      onOpenChange(false);
                    }}
                  >
                    Ver leads importados
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarDesfazer} onOpenChange={setConfirmarDesfazer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer esta importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Só são removidos os leads intocados: ainda em "Contatado", sem nenhum campo extra
              preenchido, sem reunião e sem histórico além da nota de importação. Qualquer lead em
              que a equipe já trabalhou será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desfazendo}>Manter</AlertDialogCancel>
            <AlertDialogAction
              disabled={desfazendo}
              onClick={() => void confirmarDesfazerImportacao()}
            >
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
