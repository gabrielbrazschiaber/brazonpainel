import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

/** Desempenho do link de indicação: visitantes, leads e conversões. */
export function ReferralsCard() {
  const carregar = useServerFn(meusReferrals);
  const carregarLeads = useServerFn(meusLeadsReferral);
  const [m, setM] = useState<Metrics | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    carregar()
      .then((r) => setM(r as Metrics))
      .catch(() => setM({ visitantes: 0, leads: 0, conversoes: 0 }));
    carregarLeads()
      .then((r) => setLeads(r as Lead[]))
      .catch(() => setLeads([]));
  }, [carregar, carregarLeads]);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-foreground">Indicações</h2>
      <p className="text-sm text-muted-foreground">
        Desempenho do seu link: quem visitou, quem se cadastrou e quem já pagou.
      </p>

      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Visitantes</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-center">Conversões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-center text-lg font-bold">
                {m ? m.visitantes : "—"}
              </TableCell>
              <TableCell className="text-center text-lg font-bold">
                {m ? m.leads : "—"}
              </TableCell>
              <TableCell className="text-center text-lg font-bold">
                {m ? m.conversoes : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <h3 className="mt-6 text-base font-semibold text-foreground">
        Jornada dos leads
      </h3>
      <p className="text-sm text-muted-foreground">
        Cada pessoa que chegou pelo seu link, do cadastro até a primeira
        cobrança paga.
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
            {leads === null && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {leads?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Nenhum lead pelo seu link ainda. Compartilhe para começar.
                </TableCell>
              </TableRow>
            )}
            {leads?.map((l) => (
              <TableRow key={l.clienteId}>
                <TableCell>
                  <div className="font-medium text-foreground">{l.nome}</div>
                  <div className="text-xs text-muted-foreground">{l.email}</div>
                </TableCell>
                <TableCell>{formatDate(l.cadastradoEm)}</TableCell>
                <TableCell>
                  {l.primeiroPagamentoEm
                    ? formatDate(l.primeiroPagamentoEm)
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {l.status === "pago" ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      Convertido
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Cadastrado</Badge>
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
