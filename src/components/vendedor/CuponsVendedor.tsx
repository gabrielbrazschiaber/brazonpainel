import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Ticket } from "lucide-react";
import {
  criarCupomVendedor,
  listarMeusCupons,
  alternarMeuCupom,
  VALOR_CUPOM_VENDEDOR,
} from "@/lib/cupons.vendedor.functions";
import { formatCurrency } from "@/lib/format";

interface CupomRow {
  id: string;
  codigo: string;
  valor_desconto: number;
  ativo: boolean;
  usos: number;
  clientes: number;
}

export function CuponsVendedor() {
  const listar = useServerFn(listarMeusCupons);
  const criar = useServerFn(criarCupomVendedor);
  const alternar = useServerFn(alternarMeuCupom);

  const [cupons, setCupons] = useState<CupomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listar();
      setCupons(res as CupomRow[]);
    } catch {
      setCupons([]);
    } finally {
      setLoading(false);
    }
  }, [listar]);

  useEffect(() => {
    void load();
  }, [load]);

  async function salvar() {
    setSalvando(true);
    try {
      await criar({ data: { codigo } });
      toast.success("Cupom criado!");
      setOpen(false);
      setCodigo("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o cupom.");
    } finally {
      setSalvando(false);
    }
  }

  async function trocarStatus(c: CupomRow) {
    try {
      await alternar({ data: { cupom_id: c.id, ativo: !c.ativo } });
      await load();
    } catch {
      toast.error("Não foi possível atualizar o cupom.");
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Meus cupons</h2>
          <p className="text-sm text-muted-foreground">
            Cada cupom dá {formatCurrency(VALOR_CUPOM_VENDEDOR)} de desconto na primeira
            mensalidade.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Ticket className="mr-2 h-4 w-4" />
          Criar cupom
        </Button>
      </div>

      <Card className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead className="text-right">Clientes que usaram</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!loading && cupons.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  Você ainda não criou nenhum cupom.
                </TableCell>
              </TableRow>
            )}
            {cupons.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(c.codigo);
                      toast.success("Código copiado!");
                    }}
                    className="inline-flex items-center gap-1.5 font-mono font-semibold text-primary"
                  >
                    {c.codigo}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(c.valor_desconto)} na primeira mensalidade
                    {!c.ativo && " • inativo"}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">{c.clientes}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => trocarStatus(c)}>
                    {c.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar um novo cupom</DialogTitle>
            <DialogDescription>
              Digite o código que seus clientes usarão para ganhar{" "}
              {formatCurrency(VALOR_CUPOM_VENDEDOR)} de desconto na primeira mensalidade.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Apenas letras e números"
            maxLength={20}
            className="font-mono"
          />
          <DialogFooter>
            <Button onClick={salvar} disabled={salvando || codigo.trim().length < 3}>
              {salvando ? "Criando..." : "Criar cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
