import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePermissoes } from "@/lib/use-permissoes";
import type { AppPermission, AppRole } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SecaoConfiguracao {
  value: string;
  label: string;
  descricao: string;
  icon: LucideIcon;
  /** Permissão exigida para ver a seção (a checagem real é no servidor). */
  permissao: AppPermission;
  /** Quando presente, só estes papéis enxergam a seção. */
  roles?: readonly AppRole[];
  render: () => ReactNode;
}

/**
 * Página única de Configurações.
 *
 * Reúne Cupons, Planos, Admins, Vendedores e Permissões em um só lugar,
 * mostrando somente uma seção por vez para não sobrecarregar a tela.
 * No mobile a navegação vira um seletor; no desktop, uma lista lateral.
 */
export function ConfiguracoesPage({
  secoes,
  secaoInicial,
}: {
  secoes: SecaoConfiguracao[];
  /** Seção pedida pela URL (?secao=...). */
  secaoInicial?: string;
}) {
  const { pode, carregando } = usePermissoes();
  const { role } = useAuth();

  const visiveis = useMemo(
    () =>
      carregando
        ? []
        : secoes.filter(
            (s) => pode(s.permissao) && (!s.roles || (role !== null && s.roles.includes(role))),
          ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [secoes, carregando, pode, role],
  );

  const [ativa, setAtiva] = useState<string>(secaoInicial ?? secoes[0]?.value ?? "");
  const [negada, setNegada] = useState<string | null>(null);

  useEffect(() => {
    if (carregando) return;
    if (visiveis.some((s) => s.value === ativa)) {
      setNegada(null);
      return;
    }
    // Seção existe no catálogo mas não é permitida para este usuário.
    const existe = secoes.some((s) => s.value === ativa);
    if (existe) {
      setNegada(ativa);
      return;
    }
    setNegada(null);
    if (visiveis.length) setAtiva(visiveis[0].value);
  }, [visiveis, ativa, carregando, secoes]);

  function voltar() {
    setNegada(null);
    if (visiveis.length) setAtiva(visiveis[0].value);
    if (typeof window !== "undefined" && window.location.search.includes("secao=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (negada) {
    const rotulo = secoes.find((s) => s.value === negada)?.label ?? "esta seção";
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <ShieldAlert className="h-7 w-7 text-destructive" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Acesso negado</p>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para abrir “{rotulo}”. Fale com um administrador se precisar
            desse acesso.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={voltar}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar às configurações
        </Button>
      </Card>
    );
  }

  if (visiveis.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Sem acesso às configurações</p>
        <p className="text-sm text-muted-foreground">
          Peça a um administrador para liberar as permissões necessárias.
        </p>
      </Card>
    );
  }


  const secaoAtual = visiveis.find((s) => s.value === ativa) ?? visiveis[0];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Configurações</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie cupons, planos, acessos internos e permissões em um só lugar.
        </p>
      </div>

      {/* Navegação mobile */}
      <div className="lg:hidden">
        <Select value={secaoAtual.value} onValueChange={setAtiva}>
          <SelectTrigger aria-label="Seção de configurações">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visiveis.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        {/* Navegação desktop */}
        <Card className="hidden h-fit p-2 lg:block">
          <nav className="flex flex-col gap-1">
            {visiveis.map((s) => {
              const ativo = s.value === secaoAtual.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setAtiva(s.value)}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    ativo
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.descricao}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </Card>

        <div className="min-w-0">{secaoAtual.render()}</div>
      </div>
    </div>
  );
}
