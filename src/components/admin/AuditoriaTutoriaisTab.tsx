import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { progressoEquipe } from "@/lib/onboarding.functions";
import { CHAVE_BOAS_VINDAS, TUTORIAIS } from "@/lib/onboarding";
import { formatDateTime } from "@/lib/format";

type Situacao = "concluido" | "pulado" | "em_andamento" | "nao_iniciado";

interface ItemLinha {
  userId: string;
  nome: string | null;
  email: string | null;
  papel: string;
  vendedorId: string | null;
  vendedorNome: string | null;
  tutorialChave: string;
  tutorialLabel: string;
  situacao: Situacao;
  em: string | null;
}

const ROTULO_PAPEL_AUDITORIA: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

function rotuloTutorial(chave: string): string {
  if (chave === CHAVE_BOAS_VINDAS) return "Boas-vindas";
  const t = TUTORIAIS.find((tt) => tt.chave === chave);
  return t?.titulo ?? chave;
}

function SituacaoBadge({ situacao }: { situacao: Situacao }) {
  if (situacao === "concluido") {
    return (
      <Badge variant="outline" className="border-success/40 text-success">
        Concluído
      </Badge>
    );
  }
  if (situacao === "pulado") {
    return (
      <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
        Pulado
      </Badge>
    );
  }
  if (situacao === "em_andamento") {
    return (
      <Badge variant="outline" className="border-warning/40 text-warning-foreground">
        Em andamento
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-destructive/40 text-destructive">
      Não iniciado
    </Badge>
  );
}

/**
 * Auditoria dos tutoriais de onboarding: quem viu o quê, quando e em que
 * situação, com filtros por vendedor, tutorial e situação.
 */
export function AuditoriaTutoriaisTab() {
  const carregar = useServerFn(progressoEquipe);

  const [linhas, setLinhas] = useState<ItemLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [filtroTutorial, setFiltroTutorial] = useState<string>("todos");
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const load = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await carregar({});
      const catalogoChaves = Array.from(new Set(TUTORIAIS.map((t) => t.chave)));

      const proximas: ItemLinha[] = [];
      res.usuarios.forEach((u) => {
        const papel = (u as { papel?: string }).papel ?? "cliente";
        const vendedorId = (u as { vendedor_id?: string | null }).vendedor_id ?? null;
        const vendedorNome = (u as { vendedor_nome?: string | null }).vendedor_nome ?? null;
        const itens =
          (u as { itens?: { chave: string; status: string; em: string }[] }).itens ?? [];

        // Tutoriais relevantes para o papel do usuário, mesmo sem registro ainda.
        const chavesRelevantes = new Set(catalogoChaves);
        itens.forEach((i) => chavesRelevantes.add(i.chave));

        chavesRelevantes.forEach((chave) => {
          const item = itens.find((i) => i.chave === chave);
          const situacao: Situacao = item ? (item.status as Situacao) : "nao_iniciado";
          proximas.push({
            userId: u.user_id,
            nome: u.nome,
            email: u.email,
            papel,
            vendedorId,
            vendedorNome,
            tutorialChave: chave,
            tutorialLabel: rotuloTutorial(chave),
            situacao,
            em: item?.em ?? null,
          });
        });
      });

      setLinhas(proximas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a auditoria.");
    } finally {
      setCarregando(false);
    }
  }, [carregar]);

  useEffect(() => {
    void load();
  }, [load]);

  const vendedoresDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>();
    linhas.forEach((l) => {
      if (l.vendedorId && l.vendedorNome) mapa.set(l.vendedorId, l.vendedorNome);
    });
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }));
  }, [linhas]);

  const tutoriaisDisponiveis = useMemo(() => {
    const mapa = new Map<string, string>();
    linhas.forEach((l) => mapa.set(l.tutorialChave, l.tutorialLabel));
    return Array.from(mapa.entries()).map(([chave, label]) => ({ chave, label }));
  }, [linhas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtroVendedor !== "todos" && l.vendedorId !== filtroVendedor) return false;
      if (filtroTutorial !== "todos" && l.tutorialChave !== filtroTutorial) return false;
      if (filtroSituacao !== "todos" && l.situacao !== filtroSituacao) return false;
      if (termo) {
        const alvo = `${l.nome ?? ""} ${l.email ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [linhas, filtroVendedor, filtroTutorial, filtroSituacao, busca]);

  const kpis = useMemo(() => {
    let concluidos = 0;
    let pulados = 0;
    let pendentes = 0;
    filtradas.forEach((l) => {
      if (l.situacao === "concluido") concluidos += 1;
      else if (l.situacao === "pulado") pulados += 1;
      else pendentes += 1;
    });
    return { concluidos, pulados, pendentes };
  }, [filtradas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Auditoria de tutoriais</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe quem concluiu, pulou ou deixou pelo meio cada tutorial do onboarding.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={carregando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Concluídos</p>
          <p className="text-2xl font-semibold text-success">{kpis.concluidos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pulados</p>
          <p className="text-2xl font-semibold text-muted-foreground">{kpis.pulados}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-semibold text-warning-foreground">{kpis.pendentes}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
              aria-label="Buscar por nome ou e-mail"
            />
          </div>

          <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
            <SelectTrigger aria-label="Filtrar por vendedor">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedoresDisponiveis.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroTutorial} onValueChange={setFiltroTutorial}>
            <SelectTrigger aria-label="Filtrar por tutorial">
              <SelectValue placeholder="Tutorial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tutoriais</SelectItem>
              {tutoriaisDisponiveis.map((t) => (
                <SelectItem key={t.chave} value={t.chave}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
            <SelectTrigger aria-label="Filtrar por situação">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="pulado">Pulado</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {carregando ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando auditoria...</Card>
      ) : erro ? (
        <Card className="p-6 text-sm text-destructive">{erro}</Card>
      ) : filtradas.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum registro encontrado com os filtros atuais.
        </Card>
      ) : (
        <>
          {/* Mobile: cartões */}
          <div className="space-y-3 sm:hidden">
            {filtradas.map((l, idx) => (
              <Card key={`${l.userId}-${l.tutorialChave}-${idx}`} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {l.nome ?? "Sem nome"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{l.email}</p>
                  </div>
                  <SituacaoBadge situacao={l.situacao} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Papel: {ROTULO_PAPEL_AUDITORIA[l.papel] ?? l.papel}</span>
                  <span>Vendedor: {l.vendedorNome ?? "—"}</span>
                  <span className="col-span-2">Tutorial: {l.tutorialLabel}</span>
                  <span className="col-span-2">Data: {formatDateTime(l.em)}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: tabela */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Vendedor responsável</TableHead>
                  <TableHead>Tutorial</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l, idx) => (
                  <TableRow key={`${l.userId}-${l.tutorialChave}-${idx}`}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {l.nome ?? "Sem nome"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{l.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{ROTULO_PAPEL_AUDITORIA[l.papel] ?? l.papel}</TableCell>
                    <TableCell>{l.vendedorNome ?? "—"}</TableCell>
                    <TableCell>{l.tutorialLabel}</TableCell>
                    <TableCell>
                      <SituacaoBadge situacao={l.situacao} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(l.em)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
