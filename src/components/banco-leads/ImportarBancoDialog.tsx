import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  lerArquivo,
  normalizarChave,
  normalizarEmail,
  normalizarNome,
  normalizarTelefone,
  telefoneValido,
  type ArquivoLido,
} from "@/lib/leads-import";
import { ESTADOS_BR } from "@/lib/banco-leads";
import { LEAD_ORIGENS, ORIGEM_LABEL, type LeadOrigem } from "@/lib/leads";
import { importarBancoLeads } from "@/lib/banco-leads.functions";

/** Campos aceitos na importação do banco (inclui cidade/estado). */
const CAMPOS = [
  { campo: "nome_contato", label: "Nome do contato", obrigatorio: true },
  { campo: "telefone", label: "Telefone", obrigatorio: true },
  { campo: "empresa", label: "Empresa", obrigatorio: false },
  { campo: "cargo", label: "Cargo", obrigatorio: false },
  { campo: "email", label: "E-mail", obrigatorio: false },
  { campo: "segmento", label: "Segmento", obrigatorio: false },
  { campo: "cidade", label: "Cidade", obrigatorio: false },
  { campo: "estado", label: "Estado (UF)", obrigatorio: false },
  { campo: "observacoes", label: "Observações", obrigatorio: false },
] as const;

type Campo = (typeof CAMPOS)[number]["campo"];
type Destino = Campo | "";

const SINONIMOS: Record<Campo, string[]> = {
  nome_contato: ["nome", "contato", "responsavel", "nomedocontato", "lead", "cliente"],
  telefone: ["telefone", "tel", "celular", "whatsapp", "fone", "numero"],
  empresa: ["empresa", "razaosocial", "negocio", "fantasia", "loja"],
  cargo: ["cargo", "funcao", "posicao"],
  email: ["email", "mail", "correio"],
  segmento: ["segmento", "ramo", "nicho", "categoria", "setor", "area"],
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
  erro: string | null;
}

function texto(valor: string | undefined): string | null {
  const t = (valor ?? "").trim();
  return t === "" ? null : t.slice(0, 120);
}

function prepararLinhas(arquivo: ArquivoLido, mapa: Destino[]): LinhaPreparada[] {
  const indice = (campo: Campo) => mapa.indexOf(campo);
  const iNome = indice("nome_contato");
  const iTel = indice("telefone");
  const vistos = new Set<string>();

  return arquivo.matriz.map((celulas, i) => {
    const pega = (campo: Campo) => {
      const idx = indice(campo);
      return idx >= 0 ? celulas[idx] : undefined;
    };
    const nome = normalizarNome(iNome >= 0 ? celulas[iNome] : "");
    const tel = normalizarTelefone(iTel >= 0 ? celulas[iTel] : "");
    const email = normalizarEmail(pega("email"));
    const uf = (pega("estado") ?? "").trim().toUpperCase().slice(0, 2);

    let erro: string | null = null;
    if (nome.length < 2) erro = "Nome do contato ausente";
    else if (!telefoneValido(tel)) erro = "Telefone inválido";
    else if (vistos.has(tel)) erro = "Telefone repetido na planilha";
    if (!erro) vistos.add(tel);

    return {
      linha: i + 1,
      nome_contato: nome,
      telefone: tel,
      empresa: texto(pega("empresa")),
      cargo: texto(pega("cargo")),
      email: email && email.includes("@") ? email : null,
      segmento: texto(pega("segmento")),
      cidade: texto(pega("cidade")),
      estado: uf.length === 2 ? uf : null,
      observacoes: (pega("observacoes") ?? "").trim().slice(0, 4000) || null,
      erro,
    };
  });
}

const SEM_RESERVA = "__sem__";

/** Importa uma planilha para o Banco de Leads (só admin). */
export function ImportarBancoDialog({
  aberto,
  onOpenChange,
  segmentos,
  onConcluido,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  segmentos: string[];
  onConcluido: () => void;
}) {
  const enviar = useServerFn(importarBancoLeads);
  const inputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [mapa, setMapa] = useState<Destino[]>([]);
  const [fonte, setFonte] = useState("");
  const [origem, setOrigem] = useState<LeadOrigem>("prospeccao_ativa");
  const [reservaSegmento, setReservaSegmento] = useState<string>(SEM_RESERVA);
  const [reservaEstado, setReservaEstado] = useState<string>(SEM_RESERVA);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const linhas = useMemo(() => (arquivo ? prepararLinhas(arquivo, mapa) : []), [arquivo, mapa]);
  const validas = useMemo(() => linhas.filter((l) => !l.erro), [linhas]);
  const comErro = linhas.length - validas.length;
  const faltamObrigatorios = CAMPOS.filter((c) => c.obrigatorio && !mapa.includes(c.campo));

  function limpar() {
    setArquivo(null);
    setMapa([]);
    setFonte("");
    setReservaSegmento(SEM_RESERVA);
    setReservaEstado(SEM_RESERVA);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function aoEscolher(file: File | undefined) {
    if (!file) return;
    setLendo(true);
    try {
      const lido = await lerArquivo(file);
      setArquivo(lido);
      setMapa(sugerir(lido.cabecalhos));
      if (!fonte) setFonte(file.name.replace(/\.[^.]+$/, "").slice(0, 160));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLendo(false);
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
    try {
      const r = await enviar({
        data: {
          arquivo_nome: arquivo.nome,
          fonte: fonte.trim(),
          origem,
          reservado_segmento: reservaSegmento === SEM_RESERVA ? null : reservaSegmento,
          reservado_estado: reservaEstado === SEM_RESERVA ? null : reservaEstado,
          total_linhas: linhas.length,
          linhas: validas.map(({ erro: _e, ...campos }) => campos),
        },
      });
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
    }
  }

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
            Planilha .xlsx, .xls ou .csv com até 2.000 linhas. Nenhum arquivo é enviado: só as
            linhas já conferidas aqui.
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
            {lendo ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo planilha…
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="banco-fonte">Fonte da lista</Label>
              <Input
                id="banco-fonte"
                value={fonte}
                onChange={(e) => setFonte(e.target.value)}
                placeholder="Ex.: Feira do Varejo 2026"
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
                  {segmentos.map((s) => (
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
          </div>
          <p className="text-xs text-muted-foreground">
            Com reserva, só vendedores com esse segmento/estado no escopo conseguem puxar estes
            leads nas primeiras 48 horas.
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
              </div>

              {faltamObrigatorios.length > 0 ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Indique a coluna de {faltamObrigatorios.map((c) => c.label).join(" e ")}.
                </p>
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
                            <SelectContent>
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

              {comErro > 0 ? (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Linhas que serão ignoradas</p>
                  <ul className="space-y-0.5">
                    {linhas
                      .filter((l) => l.erro)
                      .slice(0, 8)
                      .map((l) => (
                        <li key={l.linha}>
                          Linha {l.linha}: {l.erro}
                        </li>
                      ))}
                  </ul>
                </div>
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
