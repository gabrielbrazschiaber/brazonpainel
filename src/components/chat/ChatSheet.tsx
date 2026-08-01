import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listarConversas,
  obterOuCriarAtendimento,
  type ConversaResumo,
} from "@/lib/chat.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatLista } from "./ChatLista";
import { ChatThread } from "./ChatThread";
import { NovaConversaDialog } from "./NovaConversaDialog";

function tituloDe(c: ConversaResumo) {
  return c.tipo === "atendimento"
    ? `Atendimento — ${c.cliente_nome ?? "cliente"}`
    : (c.titulo ?? "Conversa da equipe");
}

export function ChatSheet({
  aberto,
  onOpenChange,
  aoMudarNaoLidas,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  aoMudarNaoLidas?: () => void;
}) {
  const { role } = useAuth();
  const ehCliente = role === "cliente";

  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [tituloAberta, setTituloAberta] = useState("");
  const [busca, setBusca] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);

  const buscarConversas = useServerFn(listarConversas);
  const abrirAtendimento = useServerFn(obterOuCriarAtendimento);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await buscarConversas({ data: {} });
      setConversas(lista);
      return lista;
    } catch (e) {
      toast.error("Não foi possível carregar as conversas", {
        description: e instanceof Error ? e.message : undefined,
      });
      return [];
    } finally {
      setCarregando(false);
    }
  }, [buscarConversas]);

  // Cliente: abre direto a própria thread de atendimento.
  useEffect(() => {
    if (!aberto) {
      setAbertaId(null);
      setBusca("");
      return;
    }
    let cancelado = false;
    void (async () => {
      if (ehCliente) {
        setCarregando(true);
        try {
          const { conversa_id } = await abrirAtendimento({ data: {} });
          const lista = await buscarConversas({ data: { tipo: "atendimento" } });
          if (cancelado) return;
          const minha = lista.find((c) => c.id === conversa_id);
          setConversas(lista);
          setAbertaId(conversa_id);
          setTituloAberta(minha?.titulo?.trim() ? minha.titulo : "Atendimento — equipe Brazon");
        } catch (e) {
          if (!cancelado) {
            toast.error("Não foi possível abrir o atendimento", {
              description: e instanceof Error ? e.message : undefined,
            });
          }
        } finally {
          if (!cancelado) setCarregando(false);
        }
      } else {
        await carregar();
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, ehCliente]);

  const equipe = useMemo(() => conversas.filter((c) => c.tipo === "equipe"), [conversas]);
  const atendimentos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = conversas.filter((c) => c.tipo === "atendimento");
    if (!termo) return lista;
    return lista.filter((c) => (c.cliente_nome ?? "").toLowerCase().includes(termo));
  }, [conversas, busca]);

  function abrir(c: ConversaResumo) {
    setAbertaId(c.id);
    setTituloAberta(tituloDe(c));
  }

  function voltar() {
    setAbertaId(null);
    void carregar();
    aoMudarNaoLidas?.();
  }

  return (
    <>
      <Sheet open={aberto} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader className="space-y-0 pb-3">
            <div className="flex items-center gap-2">
              {abertaId && !ehCliente && (
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={voltar}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <SheetTitle className="flex-1 text-base">Chat com a equipe</SheetTitle>
              {!abertaId && !ehCliente && (
                <Button size="sm" onClick={() => setNovaAberta(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Nova
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1">
            {carregando && !abertaId ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : abertaId ? (
              <ChatThread
                conversaId={abertaId}
                titulo={tituloAberta}
                ativo={aberto}
                aoAtualizar={aoMudarNaoLidas}
              />
            ) : (
              <Tabs defaultValue="equipe" className="flex h-full min-h-0 flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="equipe">Equipe</TabsTrigger>
                  <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
                </TabsList>

                <TabsContent value="equipe" className="mt-3 min-h-0 flex-1 overflow-y-auto">
                  <ChatLista
                    conversas={equipe}
                    onAbrir={abrir}
                    vazio="Nenhuma conversa de equipe ainda. Crie a primeira em “Nova”."
                  />
                </TabsContent>

                <TabsContent value="atendimentos" className="mt-3 min-h-0 flex-1 overflow-y-auto">
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por cliente"
                      className="pl-8"
                    />
                  </div>
                  <ChatLista
                    conversas={atendimentos}
                    onAbrir={abrir}
                    vazio="Nenhum atendimento em andamento."
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NovaConversaDialog
        aberto={novaAberta}
        onOpenChange={setNovaAberta}
        aoCriar={async (id) => {
          const lista = await carregar();
          const nova = lista.find((c) => c.id === id);
          setAbertaId(id);
          setTituloAberta(nova ? tituloDe(nova) : "Conversa da equipe");
        }}
      />
    </>
  );
}
