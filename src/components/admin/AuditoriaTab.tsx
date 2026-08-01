import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarAuditoria } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
interface AuditoriaRow {
  id: string;
  actor_email: string | null;
  actor_role: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

export function AuditoriaTab() {
  const carregarAuditoria = useServerFn(listarAuditoria);
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { registros } = await carregarAuditoria({});
      setRows(registros as unknown as AuditoriaRow[]);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [carregarAuditoria]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Auditoria de alterações</h2>
          <p className="text-sm text-muted-foreground">
            Registro das ações realizadas por vendedores e administradores.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Atualizar"}
        </Button>
      </div>
      <Table className="min-w-full sm:min-w-[600px]">
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead className="hidden md:table-cell">Perfil</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead className="hidden md:table-cell">Entidade</TableHead>
            <TableHead className="hidden lg:table-cell">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
              <TableCell className="break-all">
                {r.actor_email ?? "—"}
                <span className="block text-xs text-muted-foreground md:hidden">
                  {[r.actor_role, r.entidade].filter(Boolean).join(" · ") || "—"}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">{r.actor_role ?? "—"}</TableCell>
              <TableCell>{r.acao}</TableCell>
              <TableCell className="hidden md:table-cell">{r.entidade ?? "—"}</TableCell>
              <TableCell className="hidden lg:table-cell">
                <code className="text-xs text-muted-foreground">
                  {r.detalhes ? JSON.stringify(r.detalhes) : "—"}
                </code>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Nenhum registro de auditoria ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
