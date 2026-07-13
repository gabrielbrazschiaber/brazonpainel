import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "muted" | "primary";

const toneClasses: Record<Tone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/30",
};

const dotClasses: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
  primary: "bg-primary",
};

const statusMap: Record<string, { label: string; tone: Tone }> = {
  ativo: { label: "Ativo", tone: "success" },
  pago: { label: "Pago", tone: "success" },
  vencendo: { label: "Vencendo", tone: "warning" },
  pendente: { label: "Pendente", tone: "warning" },
  vencido: { label: "Vencido", tone: "danger" },
  inadimplente: { label: "Inadimplente", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "muted" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const cfg = statusMap[status] ?? { label: status, tone: "muted" as Tone };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        toneClasses[cfg.tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[cfg.tone])} />
      {cfg.label}
    </span>
  );
}
