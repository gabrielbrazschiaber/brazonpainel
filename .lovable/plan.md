# Plano de Implementação: Melhorias no Sistema de Mensagens Rápidas

Implementar a substituição automática do parâmetro `[nome]` pelo primeiro nome do lead nas mensagens rápidas e garantir que a cópia da mensagem não feche o popover ou altere o estado da listagem, mantendo o lead visível até uma ação explícita de "Respondeu" ou "Não respondeu".

## Alterações

### Frontend

- **Ações de Follow-up (`src/components/comercial/AcoesFollowUpLead.tsx`)**
    - Criar função auxiliar para extrair o primeiro nome do lead (removendo números se houver).
    - Modificar `copiarMensagem` para realizar a substituição de `[nome]` no texto antes de copiar.
    - Alterar o comportamento do Popover de mensagens para permanecer aberto após a cópia, permitindo que o usuário veja a confirmação sem que o lead "suma" do contexto visual imediato (embora a listagem já seja paginada, o usuário quer continuidade).
    - Garantir que `onAtualizado()` seja chamado para registrar o envio, mas sem disparar um recarregamento que mova o scroll ou altere drasticamente a visão do vendedor até ele clicar nos botões de status.

### Backend (Database)

- Não são necessárias alterações no schema ou migrações, pois usaremos a lógica de substituição em tempo de execução no cliente.

## Detalhes Técnicos

- A regex para o primeiro nome deve capturar a primeira sequência de letras, ignorando números iniciais que podem vir de integrações ou erros de digitação.
- Utilizar `navigator.clipboard.writeText` com o texto processado.
- Manter o registro de `mensagens_enviadas` via `registrarEnvioMensagem`.

## Validação

- Testar com leads que tenham nomes simples ("João"), compostos ("Maria Aparecida") e com números ("123 Pedro").
- Verificar se o Popover se comporta conforme esperado (não fechar ao copiar).
- Confirmar que a listagem de leads na Gestão Comercial permanece estável após a cópia.
