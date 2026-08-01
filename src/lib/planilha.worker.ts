/**
 * Web Worker de leitura de planilha.
 *
 * Arquivos grandes (até 35 MB / 20.000 linhas) travariam a interface se fossem
 * lidos na thread principal. O worker faz o parsing pesado e devolve só a
 * matriz de texto já normalizada, reportando progresso pelo caminho.
 */
import { lerMatriz } from "@/lib/leads-planilha";

interface Pedido {
  file: File;
  ext: string;
}

self.onmessage = async (evento: MessageEvent<Pedido>) => {
  const { file, ext } = evento.data;
  try {
    self.postMessage({ tipo: "progresso", pct: 20, etapa: "Lendo a planilha" });
    const matriz = await lerMatriz(file, ext);
    self.postMessage({ tipo: "progresso", pct: 70, etapa: "Organizando as linhas" });
    self.postMessage({ tipo: "pronto", matriz });
  } catch (e) {
    self.postMessage({
      tipo: "erro",
      mensagem: e instanceof Error ? e.message : "Não foi possível ler o arquivo.",
    });
  }
};
