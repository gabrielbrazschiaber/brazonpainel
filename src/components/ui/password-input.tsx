import * as React from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Tempo (ms) que a senha fica visível antes de voltar a ficar oculta. */
export const TEMPO_REVELACAO_MS = 8000;

export interface RegraSenha {
  label: string;
  ok: boolean;
}

/** Regras mínimas de senha usadas na criação/redefinição. */
export function validarSenha(senha: string): { regras: RegraSenha[]; valida: boolean } {
  const regras: RegraSenha[] = [
    { label: "Mínimo de 8 caracteres", ok: senha.length >= 8 },
    { label: "Uma letra", ok: /[a-zA-Z]/.test(senha) },
    { label: "Um número", ok: /\d/.test(senha) },
  ];
  return { regras, valida: regras.every((r) => r.ok) };
}

export interface PasswordInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  /** Mostra a lista de regras de senha abaixo do campo (para senhas novas). */
  mostrarRegras?: boolean;
  /** Milissegundos até ocultar novamente. 0 desativa o auto-ocultar. */
  tempoRevelacao?: number;
  containerClassName?: string;
}

/**
 * Campo de senha com botão de olho para revelar temporariamente o conteúdo.
 * A senha volta a ficar oculta sozinha após `tempoRevelacao` (padrão 8s),
 * ao perder o foco do campo e ao desmontar — evitando deixá-la exposta na tela.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      containerClassName,
      mostrarRegras = false,
      tempoRevelacao = TEMPO_REVELACAO_MS,
      value,
      onBlur,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [visivel, setVisivel] = React.useState(false);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const senha = typeof value === "string" ? value : "";

    const ocultar = React.useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setVisivel(false);
    }, []);

    React.useEffect(() => ocultar, [ocultar]);

    function alternar() {
      if (visivel) {
        ocultar();
        return;
      }
      setVisivel(true);
      if (tempoRevelacao > 0) {
        timer.current = setTimeout(() => setVisivel(false), tempoRevelacao);
      }
    }

    const { regras } = validarSenha(senha);

    return (
      <div className={cn("space-y-2", containerClassName)}>
        <div className="relative">
          <Input
            {...props}
            ref={ref}
            value={value}
            disabled={disabled}
            type={visivel ? "text" : "password"}
            className={cn("pr-10", className)}
            onBlur={(e) => {
              ocultar();
              onBlur?.(e);
            }}
          />
          <button
            type="button"
            onClick={alternar}
            disabled={disabled}
            aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visivel}
            title={visivel ? "Ocultar senha" : "Mostrar senha"}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {mostrarRegras && senha.length > 0 && (
          <ul className="space-y-1 text-xs">
            {regras.map((r) => (
              <li
                key={r.label}
                className={cn(
                  "flex items-center gap-1.5",
                  r.ok ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground",
                )}
              >
                {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
