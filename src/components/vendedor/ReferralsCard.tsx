import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { meusReferrals } from "@/lib/referrals.functions";

interface Metrics {
  visitantes: number;
  leads: number;
  conversoes: number;
}

/** Desempenho do link de indicação: visitantes, leads e conversões. */
export function ReferralsCard() {
  const carregar = useServerFn(meusReferrals);
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    carregar()
      .then((r) => setM(r as Metrics))
      .catch(() => setM({ visitantes: 0, leads: 0, conversoes: 0 }));
  }, [carregar]);

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
    </section>
  );
}
