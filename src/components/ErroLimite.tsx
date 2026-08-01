import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { traceId } from "@/lib/telemetry-trace";
import { explicacaoErroSelect } from "@/lib/select-import";

interface Props {
  /** Nome da área protegida — aparece no relatório de erro. */
  area: string;
  children: ReactNode;
}

interface State {
  erro: Error | null;
}

/**
 * Limite de erro LOCAL.
 *
 * Sem ele, qualquer exceção de um painel sobe até o `errorComponent` da rota
 * raiz e a tela inteira vira "Esta página não carregou" — o usuário perde menu,
 * cabeçalho e contexto. Aqui o restante do painel continua utilizável, a falha
 * fica contida no bloco que quebrou e o erro é reportado com o Trace ID para
 * cruzar com a telemetria de acesso.
 */
export class ErroLimite extends Component<Props, State> {
  override state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error(erro);
    reportLovableError(erro, {
      boundary: "erro_limite",
      area: this.props.area,
      trace_id: traceId(),
      componentStack: info.componentStack,
    });
  }

  private readonly tentarDeNovo = () => this.setState({ erro: null });

  override render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Não foi possível carregar esta parte da tela
            </h2>
            {explicacaoErroSelect(erro) ? (
              <p className="text-sm text-foreground">{explicacaoErroSelect(erro)}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              O restante do painel continua funcionando. Tente de novo — se persistir, envie o
              código abaixo para o suporte.
            </p>
            <code className="block break-all rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {this.props.area} · {traceId()} · {erro.message || erro.name}
            </code>
            <Button size="sm" variant="outline" onClick={this.tentarDeNovo}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}
