import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listarMensagensRapidasAdmin,
  salvarMensagemRapida,
  excluirMensagemRapida,
} from "@/lib/configuracoes.functions";

export function MensagensRapidasTab() {
  const carregar = useServerFn(listarMensagensRapidasAdmin);
  const salvar = useServerFn(salvarMensagemRapida);
  const excluir = useServerFn(excluirMensagemRapida);

  const [mensagens, setMensagens] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  const atualizar = async () => {
    setCarregando(true);
    try {
      const data = await carregar();
      setMensagens(data);
    } catch (err) {
      toast.error("Erro ao carregar mensagens");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void atualizar();
  }, []);

  const handleAdd = () => {
    setMensagens([...mensagens, { texto: "", ordem: mensagens.length + 1 }]);
  };

  const handleSave = async (msg: any, index: number) => {
    if (!msg.texto.trim()) {
      toast.error("O texto da mensagem não pode estar vazio");
      return;
    }
    setSalvando(msg.id || `new-${index}`);
    try {
      await salvar({ data: { ...msg, ordem: index + 1 } });
      toast.success("Mensagem salva");
      await atualizar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(null);
    }
  };

  const handleRemove = async (id?: string, index?: number) => {
    if (!id) {
      setMensagens(mensagens.filter((_, i) => i !== index));
      return;
    }
    if (!confirm("Tem certeza que deseja excluir esta mensagem?")) return;
    try {
      await excluir({ data: { id } });
      toast.success("Mensagem excluída");
      await atualizar();
    } catch (err) {
      toast.error("Erro ao excluir");
    }
  };

  if (carregando && mensagens.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Mensagens Rápidas</h3>
        <p className="text-sm text-muted-foreground">
          Configure as mensagens que os vendedores podem copiar rapidamente na gestão comercial.
          Use <strong>[nome]</strong> para inserir o primeiro nome do lead automaticamente.
        </p>
      </div>

      <div className="space-y-3">
        {mensagens.map((msg, index) => (
          <Card key={msg.id || index} className="flex items-center gap-3 p-3">
            <GripVertical className="h-5 w-5 text-muted-foreground/30 cursor-grab" />
            <div className="flex-1">
              <Input
                value={msg.texto}
                onChange={(e) => {
                  const newMsgs = [...mensagens];
                  newMsgs[index].texto = e.target.value;
                  setMensagens(newMsgs);
                }}
                placeholder="Digite o texto da mensagem..."
                className="border-none bg-transparent focus-visible:ring-0 px-0 h-auto py-1 text-sm sm:text-base"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSave(msg, index)}
                disabled={salvando === (msg.id || `new-${index}`)}
              >
                {salvando === (msg.id || `new-${index}`) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(msg.id, index)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}

        {mensagens.length === 0 && (
          <EmptyState
            titulo="Nenhuma mensagem configurada"
            descricao="Adicione modelos de mensagens para facilitar o trabalho dos vendedores."
          />
        )}
      </div>

      <Button onClick={handleAdd} className="w-full sm:w-auto">
        <Plus className="mr-2 h-4 w-4" /> Adicionar mensagem
      </Button>
    </div>
  );
}
