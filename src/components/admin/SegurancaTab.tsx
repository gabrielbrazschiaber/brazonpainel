import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Lock, Unlock, AlertCircle, CheckCircle2 } from "lucide-react";
import { obterDiagnosticoSeguranca } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";

export function SegurancaTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "diagnostico-seguranca"],
    queryFn: () => obterDiagnosticoSeguranca(),
  });

  if (isLoading) return <LoadingState text="Analisando políticas de segurança..." />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar diagnóstico</AlertTitle>
        <AlertDescription>
          Não foi possível ler as políticas do banco de dados. Certifique-se de que a função de debug está instalada.
        </AlertDescription>
      </Alert>
    );
  }

  const tabelasSemRLS = data?.filter((t) => !t.rls_ativo) || [];

  return (
    <div className="space-y-6">
      {tabelasSemRLS.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Atenção: Tabelas sem RLS detectadas</AlertTitle>
          <AlertDescription>
            {tabelasSemRLS.length} tabela(s) estão com o Row Level Security desativado. 
            Isso significa que elas podem estar expostas a acessos não autorizados se os GRANTS permitirem.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Diagnóstico de Políticas RLS</CardTitle>
              <CardDescription>
                Visão geral da segurança e permissões das tabelas no schema public.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabela</TableHead>
                <TableHead className="text-center">RLS</TableHead>
                <TableHead>Permissões (Authenticated)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((t) => (
                <TableRow key={t.tabela}>
                  <TableCell className="font-mono text-sm">{t.tabela}</TableCell>
                  <TableCell className="text-center">
                    {t.rls_ativo ? (
                      <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                        <Lock className="mr-1 h-3 w-3" /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <Unlock className="mr-1 h-3 w-3" /> Desativado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.perm_admin.map((p) => (
                        <Badge key={p} variant="secondary" className="text-[10px] uppercase">
                          {p}
                        </Badge>
                      ))}
                      {t.perm_admin.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Nenhuma</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.rls_ativo && t.perm_admin.length > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Protegida
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" /> Verificar
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Legenda RLS</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Ativo:</strong> A tabela possui Row Level Security habilitado. O acesso é restrito por políticas SQL.</p>
            <p><strong>Desativado:</strong> A tabela está "aberta". Qualquer usuário com GRANT pode ver/editar todos os dados.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Permissões de Tabela (GRANTS)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Lista as operações permitidas para o papel <code>authenticated</code> no nível da tabela. Isso precede o RLS.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
