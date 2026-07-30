import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { criarConversaEquipe, listarContatosEquipe, type ContatoEquipe } from "@/lib/chat.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NovaConversaDialog({
  aberto,
  onOpenChange,
  aoCriar,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  aoCriar: (conversaId: string) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [contatos, setContatos] = useState<ContatoEquipe[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const buscarContatos = useServerFn(listarContatosEquipe);
  const criar = useServerFn(criarConversaEquipe);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    void buscarContatos({ data: undefined } as never)
      .then(setContatos)
      .catch((e) =>
        toast.error("Não foi possível carregar a equipe", {
          description: e instanceof Error ? e.message : undefined,
        }),
      )
      .finally(() => setCarregando(false));
  }, [aberto, buscarContatos]);

  async function salvar() {
    setSalvando(true);
    try {
      const { conversa_id } = await criar({
        data: { titulo: titulo.trim(), participantes: selecionados },
      });
      toast.success("Conversa criada.");
      setTitulo("");
      setSelecionados([]);
      onOpenChange(false);
      aoCriar(conversa_id);
    } catch (e) {
      toast.error("Não foi possível criar a conversa", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa da equipe</DialogTitle>
          <DialogDescription>
            Escolha um assunto e quem participa. Somente administradores e vendedores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chat-titulo">
              Assunto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="chat-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Renovações de novembro"
              maxLength={140}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Participantes</Label>
            {carregando ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : contatos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum outro membro da equipe disponível.
              </p>
            ) : (
              <ScrollArea className="h-48 rounded-md border p-2">
                <div className="space-y-1">
                  {contatos.map((c) => (
                    <label
                      key={c.user_id}
                      className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={selecionados.includes(c.user_id)}
                        onCheckedChange={(v) =>
                          setSelecionados((s) =>
                            v === true ? [...s, c.user_id] : s.filter((id) => id !== c.user_id),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{c.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.email}
                        </span>
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.papel === "admin" ? "Admin" : "Vendedor"}
                      </Badge>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || titulo.trim().length < 3}>
            {salvando ? "Criando..." : "Criar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
