import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto usado como fallback de Suspense nos painéis autenticados.
 * Mostrar a estrutura da tela (em vez de um spinner) reduz a sensação de
 * carregamento e evita o "salto" de layout quando os dados chegam.
 */
export function PainelEsqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="w-full max-w-xs space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-full" />
            </Card>
          ))}
        </div>

        <Card className="space-y-3 p-5">
          {Array.from({ length: linhas }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Card>
      </div>
    </div>
  );
}
