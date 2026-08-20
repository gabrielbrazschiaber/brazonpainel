# Plano de Implementação: Mensagens de Copiar e Rastreamento de Leads

Implementar um sistema de mensagens rápidas na Gestão Comercial, permitindo copiar textos predefinidos e rastrear quais mensagens foram enviadas para cada lead. As mensagens serão configuráveis no painel administrativo.

## Mudanças

### Banco de Dados (Supabase)
- Criar tabela `mensagens_rapidas` para armazenar os modelos de mensagens (id, texto, ordem).
- Adicionar coluna `mensagens_enviadas` (tipo `text[]` ou `jsonb`) na tabela `leads` para rastrear o histórico de envios.
- Configurar RLS e Grants para ambas.

### Backend (Server Functions)
- Criar funções para CRUD de mensagens rápidas em `src/lib/configuracoes.functions.ts`.
- Adicionar função para registrar o envio de uma mensagem no lead em `src/lib/leads-crud.functions.ts`.

### Painel Administrativo
- Adicionar nova aba "Mensagens Rápidas" em Configurações (`src/routes/admin.tsx`).
- Implementar interface para adicionar, editar, excluir e ordenar as mensagens.

### Gestão Comercial
- Atualizar `AcoesFollowUpLead.tsx` para incluir um botão "Copiar Mensagem".
- Ao clicar, abrir um menu (Dropdown ou Popover) com as opções de mensagens configuradas.
- Ao selecionar uma mensagem, copiar o texto para a área de transferência e chamar a função de registro de envio.
- Exibir visualmente quais mensagens já foram enviadas para o lead.

## Detalhes Técnicos
- Utilizar a API `navigator.clipboard.writeText` para a funcionalidade de cópia.
- Garantir que o estado do lead seja atualizado via Realtime ou revalidação de query após o registro do envio.
- Manter o design system (shadcn/ui + Tailwind) consistente com o restante do projeto.

## Verificação
- Testar a criação de 3 mensagens no admin.
- Testar a cópia de cada mensagem na gestão comercial.
- Verificar se o lead é marcado corretamente após o envio.
- Validar se a interface mobile permanece responsiva.
