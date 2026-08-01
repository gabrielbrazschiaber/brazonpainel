import { cn } from "@/lib/utils";

/** Símbolo "Z" da marca Brazon. */
export function BrazonSymbol({ className, mono = false }: { className?: string; mono?: boolean }) {
  const stroke = mono ? "currentColor" : "url(#bz-grad)";
  const dot = (c: string) => (mono ? "currentColor" : c);
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Brazon">
      {!mono && (
        <defs>
          <linearGradient id="bz-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5B34F2" />
            <stop offset=".55" stopColor="#7B5BFF" />
            <stop offset="1" stopColor="#FF6A4D" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M52 60 H148 L52 140 H148"
        fill="none"
        stroke={stroke}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="52" cy="60" r="13" fill={dot("#5B34F2")} />
      <circle cx="148" cy="60" r="11" fill={dot("#7B5BFF")} />
      <circle cx="52" cy="140" r="11" fill={dot("#B07BE6")} />
      <circle cx="148" cy="140" r="16" fill={dot("#FF6A4D")} />
    </svg>
  );
}

/** Logo completo (símbolo + nome BRAZON). */
export function BrazonLogo({
  className,
  symbolClassName,
  textClassName,
}: {
  className?: string;
  symbolClassName?: string;
  textClassName?: string;
}) {
  return (
    // `leading-none` + `shrink-0` mantêm símbolo e texto na mesma linha de base
    // mesmo quando o cabeçalho define uma altura menor que o símbolo.
    <div className={cn("flex shrink-0 items-center gap-2.5", className)}>
      <BrazonSymbol className={cn("h-8 w-8 shrink-0", symbolClassName)} />
      <span
        className={cn(
          "text-xl font-bold leading-none tracking-tight text-foreground",
          textClassName,
        )}
      >
        BRA<span className="text-primary">Z</span>ON
      </span>
    </div>
  );
}
