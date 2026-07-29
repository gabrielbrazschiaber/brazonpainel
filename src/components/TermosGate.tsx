import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { registrarAceiteTermos, statusAceiteTermos } from "@/lib/termos.functions";
import {
  TERMOS_ATUALIZADO_EM,
  TERMOS_RODAPE,
  TERMOS_SECOES,
  TERMOS_VERSAO,
} from "@/lib/termos";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Bloqueia o uso do painel quando o usuário ainda não aceitou a versão vigente
 * do Termo de Uso (por exemplo, após uma atualização de versão).
 */
export function TermosGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const verificar = useServerFn(statusAceiteTermos);
  const aceitar = useServerFn(registrarAceiteTermos);

  const [pendente, setPendente] = useState(false);
  const [marcado, setMarcado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    if (!session) {
      setPendente(false);
      return;
    }
    verificar({})
      .then((r) => {
        if (ativo) setPendente(!r.aceito);
      })
      .catch(() => {
        // Falha de rede não deve travar o painel.
        if (ativo) setPendente(false);
      });
    return () => {
      ativo = false;
    };
  }, [session, verificar]);

  async function confirmar() {
    setSalvando(true);
    try {
      await aceitar({});
      setPendente(false);
      toast.success("Termo de Uso aceito. Obrigado!");
    } catch {
      toast.error("Não foi possível registrar seu aceite. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {children}
      <Dialog open={pendente}>
        <DialogContent
          className="max-h-[90vh] max-w-2xl gap-4 overflow-hidden p-0 [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="border-b border-border px-6 pt-6 pb-4 text-left">
            <DialogTitle>Atualizamos nossos Termos de Uso</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Para continuar usando a plataforma, leia e aceite a versão {TERMOS_VERSAO}{" "}
              (atualizada em {TERMOS_ATUALIZADO_EM}).
            </p>
          </DialogHeader>

          <ScrollArea className="max-h-[45vh] px-6">
            <div className="space-y-5 pb-2 text-sm text-foreground">
              {TERMOS_SECOES.map((secao) => (
                <section key={secao.titulo} className="space-y-2">
                  <h3 className="font-semibold">{secao.titulo}</h3>
                  {secao.paragrafo ? (
                    <p className="text-muted-foreground">{secao.paragrafo}</p>
                  ) : null}
                  {secao.lista ? (
                    <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                      {secao.lista.map((item) => (
                        <li key={item.texto}>
                          {item.titulo ? (
                            <strong className="text-foreground">{item.titulo}:</strong>
                          ) : null}{" "}
                          {item.texto}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
              <p className="text-xs text-muted-foreground">{TERMOS_RODAPE}</p>
            </div>
          </ScrollArea>

          <div className="space-y-3 border-t border-border px-6 pt-4 pb-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="aceite-revalidacao"
                checked={marcado}
                onCheckedChange={(v) => setMarcado(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="aceite-revalidacao"
                className="text-sm font-normal leading-relaxed text-muted-foreground"
              >
                Li e aceito a versão {TERMOS_VERSAO} dos Termos de Uso. O aceite será
                registrado com data e hora.
              </Label>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => signOut()} disabled={salvando}>
                Sair da conta
              </Button>
              <Button onClick={confirmar} disabled={!marcado || salvando}>
                {salvando ? "Registrando..." : "Aceitar e continuar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
