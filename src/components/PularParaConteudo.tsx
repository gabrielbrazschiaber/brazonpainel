/** Link "pular para o conteúdo": primeiro tabulável da página, visível ao focar. */
export function PularParaConteudo({ alvo = "#conteudo" }: { alvo?: string }) {
  return (
    <a href={alvo} className="skip-link">
      Pular para o conteúdo
    </a>
  );
}
