import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, FileSpreadsheet, Info, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  explicacaoCnpj,
  formatarCnpj,
  lerArquivo,

  normalizarChave,
  normalizarCnpj,
  normalizarDataBr,
  normalizarEmail,
  normalizarNome,
  normalizarTelefone,
  telefoneValido,
  type ArquivoLido,
} from "@/lib/leads-import";
import {
  BLOCO_IMPORT_BANCO,
  ESTADOS_BR,
  MAX_BYTES_BANCO,
  MAX_LINHAS_BANCO,
} from "@/lib/banco-leads";
import { formatarCnae, normalizarCnae, rotuloCnae, sugerirSegmentoPorCnae } from "@/lib/cnaes";
import type { Cnae } from "@/lib/cnaes";
import { opcoesUnicas } from "@/lib/escopo";
import { LEAD_ORIGENS, ORIGEM_LABEL, type LeadOrigem } from "@/lib/leads";
import {
  criarLoteBanco,
  finalizarLoteBanco,
  importarBlocoBanco,
} from "@/lib/banco-leads.functions";

/** Campos aceitos na importação do banco, no formato real das planilhas de CNPJ. */
const CAMPOS = [
  { campo: "nome_contato", label: "Nome do contato", obrigatorio: false },
  { campo: "telefone", label: "Telefone", obrigatorio: true },
  { campo: "cnpj", label: "CNPJ", obrigatorio: false },
  { campo: "razao_social", label: "Razão social", obrigatorio: false },
  { campo: "nome_fantasia", label: "Nome fantasia", obrigatorio: false },
  { campo: "socios", label: "Sócios", obrigatorio: false },
  { campo: "cnae_codigo", label: "CNAE (código)", obrigatorio: false },
  { campo: "cnae_descricao", label: "CNAE (descrição)", obrigatorio: false },
  { campo: "data_abertura", label: "Data de abertura", obrigatorio: false },
  { campo: "porte", label: "Porte", obrigatorio: false },
  { campo: "cargo", label: "Cargo", obrigatorio: false },
  { campo: "email", label: "E-mail", obrigatorio: false },
  { campo: "segmento", label: "Segmento", obrigatorio: false },
  { campo: "cidade", label: "Cidade", obrigatorio: false },
  { campo: "estado", label: "Estado (UF)", obrigatorio: false },
  { campo: "observacoes", label: "Observações", obrigatorio: false },
] as const;

type Campo = (typeof CAMPOS)[number]["campo"];
type Destino = Campo | "";

/** Nomes reais vistos nas planilhas da Receita/mailings. */
const SINONIMOS: Record<Campo, string[]> = {
  nome_contato: ["nomecontato", "contato", "responsavel", "nomedocontato"],
  telefone: [
    "telefone",
    "telefone1",
    "telefones",
    "tel",
    "celular",
    "whatsapp",
    "fone",
    "ddd",
    "numero",
  ],
  cnpj: ["cnpj", "cnpjbasico", "documento", "cnpjcpf"],
  razao_social: ["razaosocial", "razao", "empresa", "nomeempresarial"],
  nome_fantasia: ["nomefantasia", "fantasia", "nomecomercial"],
  socios: ["socio", "socios", "quadrosocietario", "qsa", "representante"],
  cnae_codigo: ["cnae", "cnaefiscal", "cnaeprincipal", "codigocnae", "cnaecodigo"],
  cnae_descricao: ["cnaedescricao", "descricaocnae", "atividadeprincipal", "atividade"],
  data_abertura: ["dataabertura", "abertura", "datainicioatividade", "inicioatividade"],
  porte: ["porte", "portempresa", "portedaempresa"],
  cargo: ["cargo", "funcao", "posicao", "qualificacao"],
  email: ["email", "mail", "correio"],
  segmento: ["segmento", "ramo", "nicho", "categoria", "setor"],
  cidade: ["cidade", "municipio", "localidade"],
  estado: ["estado", "uf", "sigla"],
  observacoes: ["observacao", "observacoes", "obs", "anotacoes", "notas"],
};

function sugerir(cabecalhos: string[]): Destino[] {
  const usados = new Set<Campo>();
  return cabecalhos.map((h) => {
    const chave = normalizarChave(h);
    if (!chave) return "";
    for (const { campo } of CAMPOS) {
      if (usados.has(campo)) continue;
      if (SINONIMOS[campo].some((s) => chave === s || chave.startsWith(s))) {
        usados.add(campo);
        return campo;
      }
    }
    return "";
  });
}

interface LinhaPreparada {
  linha: number;
  nome_contato: string;
  telefone: string;
  empresa: string | null;
  cargo: string | null;
  email: string | null;
  segmento: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  socios: string | null;
  data_abertura: string | null;
  porte: string | null;
  cnae_codigo: string | null;
  cnae_descricao: string | null;
  erro: string | null;
  avisos: string[];
  /** Zeros à esquerda acrescentados (Excel os havia removido). */
  cnpjCompletado: boolean;
  /** Célula veio em notação científica: dígitos perdidos, sem recuperação. */
  cnpjCientifico: boolean;
  /** Explicação da regra de CNPJ aplicada nesta linha (tooltip). */
  cnpjExplicacao: string | null;
}


function texto(valor: string | undefined, max = 120): string | null {
  const t = (valor ?? "").trim();
  return t === "" ? null : t.slice(0, max);
}

/** Planilhas trazem "11999998888 / 1133334444": pegamos o primeiro válido. */
function primeiroTelefone(valor: string | undefined): string {
  const partes = (valor ?? "").split(/[;/|\n]+/);
  for (const parte of partes) {
    const d = normalizarTelefone(parte);
    if (telefoneValido(d)) return d;
  }
  return normalizarTelefone(valor);
}

/** Primeiro nome da lista de sócios ("JOAO DA SILVA; MARIA..." → "Joao Da Silva"). */
function primeiroSocio(valor: string | undefined): string {
  const bruto = (valor ?? "").split(/[;/|\n]+/)[0] ?? "";
  return normalizarNome(bruto.replace(/\(.*?\)/g, ""));
}

function prepararLinhas(
  arquivo: ArquivoLido,
  mapa: Destino[],
  catalogo: Cnae[],
  /** CNPJs corrigidos à mão na revisão, por número de linha. */
  edicoes: Record<number, string> = {},
): LinhaPreparada[] {
  const porCodigo = new Map(catalogo.map((c) => [c.codigo, c]));
  const vistos = new Set<string>();

  return arquivo.matriz.map((celulas, i) => {
    const pega = (campo: Campo) => {
      const idx = mapa.indexOf(campo);
      return idx >= 0 ? celulas[idx] : undefined;
    };

    const avisos: string[] = [];
    const razao = texto(pega("razao_social"), 200);
    const fantasia = texto(pega("nome_fantasia"), 200);
    const socios = texto(pega("socios"), 1000);

    // Precedência do nome do contato: coluna própria → sócio → fantasia → razão.
    const nome =
      normalizarNome(pega("nome_contato")) ||
      primeiroSocio(socios ?? undefined) ||
      normalizarNome(fantasia ?? "") ||
      normalizarNome(razao ?? "");

    const tel = primeiroTelefone(pega("telefone"));
    const email = normalizarEmail(pega("email"));
    const uf = (pega("estado") ?? "").trim().toUpperCase().slice(0, 2);

    const bruto = pega("cnpj");
    const editado = edicoes[i + 1];
    const { cnpj, aviso, cientifico, completado } = normalizarCnpj(
      editado !== undefined ? editado : bruto,
    );
    if (aviso) avisos.push(aviso);

    const cnae = normalizarCnae(pega("cnae_codigo"));
    const cnaeDesc = texto(pega("cnae_descricao"), 300);
    const doCatalogo = cnae ? porCodigo.get(cnae) : undefined;
    const segmento =
      texto(pega("segmento")) ??
      doCatalogo?.segmento_sugerido ??
      (sugerirSegmentoPorCnae(cnaeDesc ?? doCatalogo?.descricao ?? "") || null);

    let erro: string | null = null;
    if (nome.length < 2) erro = "Sem nome de contato, sócio, fantasia ou razão social";
    else if (!telefoneValido(tel)) erro = "Telefone inválido";
    else if (vistos.has(tel)) erro = "Telefone repetido na planilha";
    if (!erro) vistos.add(tel);
    if (!cnae) avisos.push("Sem CNAE");

    return {
      linha: i + 1,
      nome_contato: nome,
      telefone: tel,
      empresa: razao ?? fantasia,
      cargo: texto(pega("cargo")),
      email: email && email.includes("@") ? email : null,
      segmento,
      cidade: texto(pega("cidade")),
      estado: uf.length === 2 ? uf : null,
      observacoes: (pega("observacoes") ?? "").trim().slice(0, 4000) || null,
      cnpj: cnpj || null,
      razao_social: razao,
      nome_fantasia: fantasia,
      socios,
      data_abertura: normalizarDataBr(pega("data_abertura")),
      porte: texto(pega("porte"), 60),
      cnae_codigo: cnae || null,
      cnae_descricao: cnaeDesc ?? doCatalogo?.descricao ?? null,
      erro,
      avisos,
      cnpjCompletado: completado,
      cnpjCientifico: cientifico,
    };
  });
}

const SEM_RESERVA = "__sem__";

/** Importa uma planilha para o Banco de Leads (só admin). */
export function ImportarBancoDialog({
  aberto,
  onOpenChange,
  segmentos,
  cnaes,
  horasReservaPadrao,
  onConcluido,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  segmentos: string[];
  /** Catálogo de CNAEs já conhecido, para reserva e sugestão de segmento. */
  cnaes: Cnae[];
  horasReservaPadrao: number;
  onConcluido: () => void;
}) {
  const criarLote = useServerFn(criarLoteBanco);
  const enviarBloco = useServerFn(importarBlocoBanco);
  const finalizar = useServerFn(finalizarLoteBanco);
  const inputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [mapa, setMapa] = useState<Destino[]>([]);
  const [fonte, setFonte] = useState("");
  const [origem, setOrigem] = useState<LeadOrigem>("prospeccao_ativa");
  const [reservaSegmento, setReservaSegmento] = useState<string>(SEM_RESERVA);
  const [reservaEstado, setReservaEstado] = useState<string>(SEM_RESERVA);
  const [reservaCnae, setReservaCnae] = useState<string>(SEM_RESERVA);
  const [horasReserva, setHorasReserva] = useState<number>(horasReservaPadrao);
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [cnpjEditado, setCnpjEditado] = useState<Record<number, string>>({});

  const linhas = useMemo(
    () => (arquivo ? prepararLinhas(arquivo, mapa, cnaes, cnpjEditado) : []),
    [arquivo, mapa, cnaes, cnpjEditado],
  );
  const validas = useMemo(() => linhas.filter((l) => !l.erro), [linhas]);
  const comErro = linhas.length - validas.length;
  const faltamObrigatorios = CAMPOS.filter((c) => c.obrigatorio && !mapa.includes(c.campo));
  const semNome = !mapa.includes("nome_contato") && !mapa.includes("socios");

  /** CNAEs da planilha que ainda não existem no catálogo. */
  const cnaesNovos = useMemo(() => {
    const conhecidos = new Set(cnaes.map((c) => c.codigo));
    const mapaNovos = new Map<string, { codigo: string; descricao: string; segmento: string }>();
    for (const l of validas) {
      if (!l.cnae_codigo || conhecidos.has(l.cnae_codigo) || mapaNovos.has(l.cnae_codigo)) continue;
      mapaNovos.set(l.cnae_codigo, {
        codigo: l.cnae_codigo,
        descricao: l.cnae_descricao ?? "",
        segmento: l.segmento ?? "",
      });
    }
    return Array.from(mapaNovos.values());
  }, [validas, cnaes]);

  const semCnpj = validas.filter((l) => !l.cnpj).length;
  const cnpjCompletados = validas.filter((l) => l.cnpjCompletado).length;
  const cnpjCientificos = linhas.filter((l) => l.cnpjCientifico).length;

  function limpar() {
    setArquivo(null);
    setMapa([]);
    setCnpjEditado({});
    setFonte("");
    setReservaSegmento(SEM_RESERVA);
    setReservaEstado(SEM_RESERVA);
    setReservaCnae(SEM_RESERVA);
    setHorasReserva(horasReservaPadrao);
    setProgresso(0);
    setEtapa("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function aoEscolher(file: File | undefined) {
    if (!file) return;
    setLendo(true);
    setProgresso(0);
    try {
      const lido = await lerArquivo(file, {
        maxLinhas: MAX_LINHAS_BANCO,
        maxBytes: MAX_BYTES_BANCO,
        usarWorker: true,
        onProgresso: (pct, etapaAtual) => {
          setProgresso(pct);
          setEtapa(etapaAtual);
        },
      });
      setArquivo(lido);
      setMapa(sugerir(lido.cabecalhos));
      if (!fonte) setFonte(file.name.replace(/\.[^.]+$/, "").slice(0, 160));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLendo(false);
      setEtapa("");
    }
  }

  async function importar() {
    if (!arquivo) return;
    if (fonte.trim().length < 2) {
      toast.error("Informe a fonte da lista para medir a qualidade do lote.");
      return;
    }
    if (validas.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }

    setSalvando(true);
    setProgresso(0);
    try {
      const { lote_id } = await criarLote({
        data: {
          arquivo_nome: arquivo.nome,
          fonte: fonte.trim(),
          origem,
          reservado_segmento: reservaSegmento === SEM_RESERVA ? null : reservaSegmento,
          reservado_estado: reservaEstado === SEM_RESERVA ? null : reservaEstado,
          reservado_cnae: reservaCnae === SEM_RESERVA ? null : reservaCnae,
          horas_reserva: horasReserva,
          total_linhas: validas.length,
        },
      });

      const blocos: LinhaPreparada[][] = [];
      for (let i = 0; i < validas.length; i += BLOCO_IMPORT_BANCO) {
        blocos.push(validas.slice(i, i + BLOCO_IMPORT_BANCO));
      }

      let enviados = 0;
      for (const [indice, bloco] of blocos.entries()) {
        setEtapa(`Gravando bloco ${indice + 1} de ${blocos.length}`);
        await enviarBloco({
          data: {
            lote_id,
            origem,
            linhas: bloco.map(
              ({
                erro: _e,
                avisos: _a,
                empresa: _emp,
                cnpjCompletado: _cc,
                cnpjCientifico: _ci,
                ...campos
              }) => campos,
            ),
          },
        });
        enviados += bloco.length;
        setProgresso(Math.round((enviados / validas.length) * 100));
      }

      setEtapa("Fechando o lote");
      const r = await finalizar({ data: { lote_id } });
      toast.success(
        `${r.importados} lead(s) no banco.` +
          (r.ignorados > 0 ? ` ${r.ignorados} ignorado(s) (duplicados ou inválidos).` : ""),
      );
      limpar();
      onOpenChange(false);
      onConcluido();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setSalvando(false);
      setEtapa("");
    }
  }

  // Segmentos/CNAEs válidos para reserva: sem vazios e sem duplicados
  // (o valor vazio duplicava a linha "Sem reserva" no select).
  const opcoesSegmentos = useMemo(
    () => opcoesUnicas(segmentos).filter((sg) => sg !== SEM_RESERVA),
    [segmentos],
  );
  const opcoesCnaes = useMemo(() => {
    const vistos = new Set<string>();
    return cnaes.filter((c) => {
      const cod = (c.codigo ?? "").trim();
      if (!cod || cod === SEM_RESERVA || vistos.has(cod)) return false;
      vistos.add(cod);
      return true;
    });
  }, [cnaes]);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) limpar();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar leads para o banco</DialogTitle>
          <DialogDescription>
            Planilha .xlsx, .xls ou .csv de até 35 MB e {MAX_LINHAS_BANCO.toLocaleString("pt-BR")}{" "}
            linhas. Nada é gravado antes desta revisão: só as linhas conferidas aqui sobem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="banco-arquivo">Arquivo</Label>
            <Input
              id="banco-arquivo"
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={lendo || salvando}
              onChange={(e) => void aoEscolher(e.target.files?.[0])}
            />
            {lendo || salvando ? (
              <div className="space-y-1.5">
                <Progress value={progresso} />
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {etapa || "Processando"} · {progresso}%
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="banco-fonte">Fonte da lista</Label>
              <Input
                id="banco-fonte"
                value={fonte}
                onChange={(e) => setFonte(e.target.value)}
                placeholder="Ex.: Base Receita — Padarias SP"
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Origem dos leads</Label>
              <Select value={origem} onValueChange={(v) => setOrigem(v as LeadOrigem)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_ORIGENS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {ORIGEM_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reservar para o segmento</Label>
              <Select value={reservaSegmento} onValueChange={setReservaSegmento}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem reserva" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_RESERVA}>Sem reserva</SelectItem>
                  {opcoesSegmentos.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhum segmento cadastrado ainda.
                    </div>
                  ) : null}
                  {opcoesSegmentos.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reservar para o estado</Label>
              <Select value={reservaEstado} onValueChange={setReservaEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem reserva" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_RESERVA}>Sem reserva</SelectItem>
                  {ESTADOS_BR.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reservar para o CNAE</Label>
              <Select value={reservaCnae} onValueChange={setReservaCnae}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem reserva" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={SEM_RESERVA}>Sem reserva</SelectItem>
                  {opcoesCnaes.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhum CNAE ativo no catálogo.
                    </div>
                  ) : null}
                  {opcoesCnaes.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {rotuloCnae(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banco-horas">Horas de reserva</Label>
              <Input
                id="banco-horas"
                type="number"
                min={1}
                max={720}
                value={horasReserva}
                onChange={(e) =>
                  setHorasReserva(Math.min(720, Math.max(1, Number(e.target.value) || 1)))
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Com reserva, só vendedores com esse segmento, estado ou CNAE no escopo conseguem puxar
            estes leads durante as primeiras {horasReserva} hora(s).
          </p>

          {arquivo ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{arquivo.nome}</span>
                <Badge variant="secondary">{linhas.length} linha(s)</Badge>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {validas.length} pronta(s)
                </Badge>
                {comErro > 0 ? <Badge variant="destructive">{comErro} com erro</Badge> : null}
                {semCnpj > 0 ? <Badge variant="outline">{semCnpj} sem CNPJ</Badge> : null}
                {cnpjCompletados > 0 ? (
                  <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    {cnpjCompletados} CNPJ completado(s)
                  </Badge>
                ) : null}
              </div>

              {faltamObrigatorios.length > 0 ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Indique a coluna de {faltamObrigatorios.map((c) => c.label).join(" e ")}.
                </p>
              ) : null}
              {semNome ? (
                <p className="text-xs text-muted-foreground">
                  Sem coluna de contato: o nome sai do primeiro sócio, do nome fantasia ou da razão
                  social, nesta ordem.
                </p>
              ) : null}

              {cnpjCientificos > 0 ? (
                <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="mb-1 font-medium text-foreground">
                    {cnpjCientificos} linha(s) com CNPJ corrompido pelo Excel (notação científica)
                  </p>
                  <p className="text-muted-foreground">
                    Este caso é diferente do CNPJ sem zeros à esquerda: aqui o Excel apagou os
                    dígitos e não há como recuperar — completar com zeros criaria um CNPJ falso.
                    Estas linhas importam sem CNPJ; para trazê-lo, reexporte a planilha com a coluna
                    formatada como texto ou corrija o valor na prévia.
                  </p>
                </div>
              ) : null}

              {cnaesNovos.length > 0 ? (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                  <p className="mb-1 font-medium text-foreground">
                    {cnaesNovos.length} CNAE(s) novo(s) serão cadastrados automaticamente
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {cnaesNovos.slice(0, 6).map((c) => (
                      <li key={c.codigo}>
                        {formatarCnae(c.codigo)} — {c.descricao || "sem descrição"}
                        {c.segmento ? ` · segmento sugerido: ${c.segmento}` : ""}
                      </li>
                    ))}
                    {cnaesNovos.length > 6 ? <li>e mais {cnaesNovos.length - 6}…</li> : null}
                  </ul>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coluna da planilha</TableHead>
                      <TableHead>Vai para</TableHead>
                      <TableHead>Exemplo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arquivo.cabecalhos.map((h, i) => (
                      <TableRow key={`${h}-${i}`}>
                        <TableCell className="font-medium">{h}</TableCell>
                        <TableCell>
                          <Select
                            value={mapa[i] ?? ""}
                            onValueChange={(v) =>
                              setMapa((atual) => {
                                const novo = [...atual];
                                novo[i] = v === "" ? "" : (v as Campo);
                                return novo;
                              })
                            }
                          >
                            <SelectTrigger className="h-9 w-full sm:min-w-[170px]">
                              <SelectValue placeholder="Ignorar coluna" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              <SelectItem value="">Ignorar coluna</SelectItem>
                              {CAMPOS.map((c) => (
                                <SelectItem key={c.campo} value={c.campo}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-muted-foreground">
                          {arquivo.matriz[0]?.[i] ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                      <TableHead className="hidden md:table-cell">CNAE</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.slice(0, 15).map((l) => (
                      <TableRow key={l.linha}>
                        <TableCell>
                          <p className="font-medium">{l.nome_contato || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.razao_social ?? l.nome_fantasia ?? "—"}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{l.telefone || "—"}</TableCell>
                        <TableCell className="hidden whitespace-nowrap md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Input
                              aria-label={`CNPJ da linha ${l.linha}`}
                              className="h-8 w-[10.5rem] font-mono text-xs"
                              value={
                                cnpjEditado[l.linha] ??
                                (l.cnpj ? formatarCnpj(l.cnpj) : "")
                              }
                              placeholder="Sem CNPJ"
                              onChange={(e) =>
                                setCnpjEditado((atual) => ({
                                  ...atual,
                                  [l.linha]: e.target.value,
                                }))
                              }
                            />
                            {l.cnpjCompletado ? (
                              <TooltipProvider>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info
                                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                    aria-label="Completado com zeros à esquerda"
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Completado com zeros à esquerda (o Excel os havia removido)
                                </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap md:table-cell">
                          {l.cnae_codigo ? formatarCnae(l.cnae_codigo) : "—"}
                        </TableCell>
                        <TableCell>
                          {l.erro ? (
                            <Badge variant="destructive">{l.erro}</Badge>
                          ) : l.avisos.length ? (
                            <Badge variant="outline">{l.avisos[0]}</Badge>
                          ) : (
                            <Badge variant="secondary">Pronta</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {linhas.length > 15 ? (
                <p className="text-xs text-muted-foreground">
                  Mostrando as 15 primeiras linhas de {linhas.length}.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={() => void importar()}
            disabled={salvando || !arquivo || validas.length === 0 || faltamObrigatorios.length > 0}
          >
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Importar {validas.length > 0 ? `${validas.length} lead(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
