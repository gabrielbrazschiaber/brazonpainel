import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { traceId } from "@/lib/telemetry-trace";

interface Props {
  children: ReactNode;
}

interface State {
  erro: Error | null;
  trace: string | null;
}

/**
 * Limite de erro do PAINEL ADMIN.
 *
 * O admin concentra abas pesadas (dashboard, telemetria, auditoria). Quando uma
 * delas quebra em runtime — por exemplo o erro React #310, ordem de hooks —, sem
 * este limite a exceção sobe até a rota raiz e o usuário só vê "Esta página não
 * carregou", sem nada rastreável. Aqui a falha fica contida, o Trace ID da aba
 * aparece na tela (o mesmo gravado em `auth_telemetria` e usado nos artefatos do
 * E2E) e o admin consegue copiar o código e mandar para o suporte.
 */
export class AdminErroLimite extends Component<Props, State> {
  override state: State = { erro: null, trace: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro, trace: traceId() };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("[admin] erro capturado pelo limite do painel:", erro);
    reportLovableError(erro, {
      boundary: "admin_erro_limite",
      area: "painel-admin",
      trace_id: traceId(),
      componentStack: info.componentStack,
    });
  }

  private readonly tentarDeNovo = () => this.setState({ erro: null, trace: null });

  private readonly copiar = () => {
    const { erro, trace } = this.state;
    const texto = `Trace ID: ${trace}\nErro: ${erro?.message || erro?.name}`;
    void navigator.clipboard?.writeText(texto).catch(() => {});
  };

  override render() {
    const { erro, trace } = this.state;
    if (!erro) return this.props.children;

    return (
      <div
        className="flex min-h-[60vh] items-center justify-center p-4"
        data-admin-erro="1"
        data-trace-id={trace ?? ""}
      >
        <Card className="w-full max-w-lg p-6">
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
            <div className="min-w-0 space-y-3">
              <div>
                <h1 className="text-base font-semibold text-foreground">
                  O painel administrativo falhou ao carregar
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  O menu e o restante do sistema continuam funcionando. Tente carregar novamente —
                  se o erro persistir, envie o código de rastreio abaixo para o suporte.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Código de rastreio (Trace ID)
                </p>
                <code className="block break-all rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {trace}
                </code>
                <code className="block break-all rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {erro.message || erro.name}
                </code>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={this.tentarDeNovo}>
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
                <Button size="sm" variant="outline" onClick={this.copiar}>
                  <Copy className="h-4 w-4" />
                  Copiar código
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }
}
