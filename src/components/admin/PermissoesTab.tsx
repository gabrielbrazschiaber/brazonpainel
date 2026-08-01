import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listarPermissoesPapeis, definirPermissoesPapel } from "@/lib/permissions.functions";
import {
  CATALOGO_PERMISSOES,
  PAPEIS_EDITAVEIS,
  PERMISSOES_BLOQUEADAS,
  ROTULO_PAPEL,
  type AppPermission,
  type AppRole,
} from "@/lib/permissions";
import { useAuth } from "@/lib/auth";

export function PermissoesTab() {
  const listar = useServerFn(listarPermissoesPapeis);
  const definir = useServerFn(definirPermissoesPapel);
  const { refresh } = useAuth();

  const [matriz, setMatriz] = useState<Record<string, AppPermission[]>>({});
  const [papel, setPapel] = useState<AppRole>("vendedor");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await listar();
      setMatriz(res.matriz);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar as permissões.");
    } finally {
      setCarregando(false);
    }
  }, [listar]);

  useEffect(() => {
    void load();
  }, [load]);

  const atuais = matriz[papel] ?? [];
  const bloqueadas = PERMISSOES_BLOQUEADAS[papel] ?? [];

  function alternar(permissao: AppPermission, ativo: boolean) {
    if (!ativo && bloqueadas.includes(permissao)) {
      toast.error("Esta permissão não pode ser removida deste papel.");
      return;
    }
    setMatriz((m) => {
      const lista = new Set(m[papel] ?? []);
      if (ativo) lista.add(permissao);
      else lista.delete(permissao);
      return { ...m, [papel]: Array.from(lista) };
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const res = await definir({ data: { role: papel, permissoes: atuais } });
      const total = res.concedidas.length + res.revogadas.length;
      toast.success(
        total === 0
          ? "Nenhuma alteração a salvar."
          : `Permissões atualizadas (${res.concedidas.length} concedida(s), ${res.revogadas.length} revogada(s)).`,
      );
      await load();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar as permissões.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Permissões por papel</h2>
        <p className="text-sm text-muted-foreground">
          Defina o que cada papel pode fazer. As regras valem para todos os usuários daquele papel e
          são revalidadas no servidor a cada ação.
        </p>
      </div>

      <Tabs value={papel} onValueChange={(v) => setPapel(v as AppRole)}>
        <TabsList>
          {PAPEIS_EDITAVEIS.map((p) => (
            <TabsTrigger key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </TabsTrigger>
          ))}
        </TabsList>

        {PAPEIS_EDITAVEIS.map((p) => (
          <TabsContent key={p} value={p} className="mt-4 space-y-4">
            {carregando ? (
              <Card className="p-6 text-sm text-muted-foreground">Carregando permissões...</Card>
            ) : (
              CATALOGO_PERMISSOES.map((grupo) => (
                <Card key={grupo.grupo} className="p-4 sm:p-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">{grupo.grupo}</h3>
                  <div className="space-y-3">
                    {grupo.itens.map((item) => {
                      const travada = bloqueadas.includes(item.permissao);
                      const ativa = atuais.includes(item.permissao);
                      return (
                        <div
                          key={item.permissao}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                        >
                          <div className="min-w-0">
                            <Label
                              htmlFor={`perm-${p}-${item.permissao}`}
                              className="flex flex-wrap items-center gap-2 text-sm font-medium"
                            >
                              {item.label}
                              {travada && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Obrigatória
                                </Badge>
                              )}
                            </Label>
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.descricao}</p>
                          </div>
                          <Switch
                            id={`perm-${p}-${item.permissao}`}
                            checked={ativa}
                            disabled={travada || salvando}
                            onCheckedChange={(v) => alternar(item.permissao, v)}
                            aria-label={item.label}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))
            )}

            <div className="flex justify-end">
              <Button onClick={() => void salvar()} disabled={salvando || carregando}>
                {salvando ? "Salvando..." : "Salvar permissões"}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
