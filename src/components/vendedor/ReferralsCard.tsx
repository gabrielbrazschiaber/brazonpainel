import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { meusReferrals, meusLeadsReferral } from "@/lib/referrals.functions";
import { formatDate } from "@/lib/format";

interface Metrics {
  visitantes: number;
  leads: number;
  pendentes: number;
  conversoes: number;
}

interface Lead {
  clienteId: string;
  nome: string;
  email: string;
  cadastradoEm: string;
  primeiroPagamentoEm: string | null;
  status: "visita" | "cadastro" | "pago";
}

type Filtro = "todos" | "pendentes" | "pagos";

const PERIODOS = [
  { valor: "7", label: "Últimos 7 dias" },
  { valor: "30", label: "Últimos 30 dias" },
  { valor: "90", label: "Últimos 90 dias" },
  { valor: "0", label: "Todo o período" },
];

const VAZIO: Metrics = { visitantes: 0, leads: 0, pendentes: 0, conversoes: 0 };

/** Desempenho do link de indicação: visitantes, leads pendentes e pagos. */
export function ReferralsCard() {
  const carregar = useServerFn(meusReferrals);
  const carregarLeads = useServerFn(meusLeadsReferral);
  const [periodo, setPeriodo] = useState("30");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [m, setM] = useState<Metrics | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    const dias = Number(periodo);
    setM(null);
    setLeads(null);
    carregar({ data: { dias } })
      .then((r) => setM(r as Metrics))
      .catch(() => setM(VAZIO));
    carregarLeads({ data: { dias } })
      .then((r) => setLeads(r as Lead[]))
      .catch(() => setLeads([]));
  }, [carregar, carregarLeads, periodo]);

  const aplicaFiltro = useCallback(
    (l: Lead) =>
      filtro === "todos" || (filtro === "pagos" ? l.status === "pago" : l.status !== "pago"),
    [filtro],
  );

  const visiveis = leads?.filter(aplicaFiltro) ?? null;

  const cards: { chave: Filtro | "visitantes"; label: string; valor?: number; hint: string }[] = [
    {
      chave: "visitantes",
      label: "Visitantes",
      valor: m?.visitantes,
      hint: "Cliques únicos no link",
    },
    { chave: "todos", label: "Leads", valor: m?.leads, hint: "Cadastros pelo link" },
    { chave: "pendentes", label: "Pendentes", valor: m?.pendentes, hint: "Ainda sem pagamento" },
    { chave: "pagos", label: "Pagos", valor: m?.conversoes, hint: "Primeira cobrança paga" },
  ];

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Indicações</h2>
          <p className="text-sm text-muted-foreground">
            Desempenho do seu link por status e período.
          </p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.valor} value={p.valor}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const clicavel = c.chave !== "visitantes";
          const ativo = clicavel && filtro === c.chave;
          return (
            <Card
              key={c.label}
              onClick={clicavel ? () => setFiltro(c.chave as Filtro) : undefined}
              className={[
                "p-4 transition-colors",
                clicavel ? "cursor-pointer hover:border-primary/50" : "",
                ativo ? "border-primary ring-1 ring-primary/30" : "",
              ].join(" ")}
            >
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{m ? c.valor : "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
            </Card>
          );
        })}
      </div>

      <h3 className="mt-6 text-base font-semibold text-foreground">Jornada dos leads</h3>
      <p className="text-sm text-muted-foreground">
        {filtro === "todos"
          ? "Todos os leads do período."
          : filtro === "pagos"
            ? "Leads que já pagaram a primeira cobrança."
            : "Leads que ainda não pagaram."}
      </p>

      <Card className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>1ª cobrança paga</TableHead>
              <TableHead className="text-right">Etapa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis === null && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {visiveis?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Nenhum lead neste período/filtro.
                </TableCell>
              </TableRow>
            )}
            {visiveis?.map((l) => (
              <TableRow key={l.clienteId}>
                <TableCell>
                  <div className="font-medium text-foreground">{l.nome}</div>
                  <div className="text-xs text-muted-foreground">{l.email}</div>
                </TableCell>
                <TableCell>{formatDate(l.cadastradoEm)}</TableCell>
                <TableCell>
                  {l.primeiroPagamentoEm ? formatDate(l.primeiroPagamentoEm) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {l.status === "pago" ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      Pago
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
