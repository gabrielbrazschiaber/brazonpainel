/**
 * Seleção múltipla com busca (Popover + Command), no padrão visual do sistema.
 * Usada no "Escopo de atuação" do vendedor: segmentos, estados e CNAEs.
 */
import { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface OpcaoMultipla {
  valor: string;
  rotulo: string;
}

export function SelecaoMultipla({
  label,
  ajuda,
  opcoes,
  selecionados,
  onChange,
  placeholder = "Selecionar",
  vazioTexto = "Nada encontrado.",
  semOpcoesTexto = "Nenhuma opção disponível ainda.",
  maxChips = 12,
}: {
  label: string;
  ajuda?: string;
  opcoes: OpcaoMultipla[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
  vazioTexto?: string;
  semOpcoesTexto?: string;
  maxChips?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();

  const rotulos = useMemo(() => {
    const mapa = new Map(opcoes.map((o) => [o.valor, o.rotulo]));
    return (valor: string) => mapa.get(valor) ?? valor;
  }, [opcoes]);

  function alternar(valor: string) {
    onChange(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor],
    );
  }

  const visiveis = selecionados.slice(0, maxChips);
  const extras = selecionados.length - visiveis.length;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={aberto}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", selecionados.length === 0 && "text-muted-foreground")}>
              {selecionados.length === 0
                ? placeholder
                : `${selecionados.length} selecionado${selecionados.length === 1 ? "" : "s"}`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(24rem,calc(100vw-3rem))] p-0" align="start">
          {opcoes.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{semOpcoesTexto}</p>
          ) : (
            <Command>
              <CommandInput placeholder="Buscar..." />
              <CommandList className="max-h-64">
                <CommandEmpty>{vazioTexto}</CommandEmpty>
                <CommandGroup>
                  {opcoes.map((o) => {
                    const marcado = selecionados.includes(o.valor);
                    return (
                      <CommandItem
                        key={o.valor}
                        value={`${o.valor} ${o.rotulo}`}
                        onSelect={() => alternar(o.valor)}
                      >
                        <Check
                          className={cn("mr-2 h-4 w-4", marcado ? "opacity-100" : "opacity-0")}
                        />
                        <span className="truncate">{o.rotulo}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {selecionados.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {visiveis.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              <span className="max-w-[14rem] truncate">{rotulos(v)}</span>
              <button
                type="button"
                onClick={() => alternar(v)}
                aria-label={`Remover ${rotulos(v)}`}
                className="rounded-sm opacity-70 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {extras > 0 ? <span className="text-xs text-muted-foreground">+{extras}</span> : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange([])}
          >
            Limpar
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{ajuda ?? "Vazio = sem restrição."}</p>
      )}
    </div>
  );
}
