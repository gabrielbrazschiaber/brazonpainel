
## Objetivo

Adicionar busca global e filtros na aba **Clientes** do painel admin (`/admin`), para localizar clientes rapidamente por nome/e-mail/CPF/telefone e refinar por status, vendedor e plano.

## O que muda (só front-end)

Arquivo: `src/routes/admin.tsx`, seção da aba **Clientes**.

1. **Campo de busca** no topo da aba
   - Input com ícone de lupa, placeholder "Buscar por nome, e-mail, CPF/CNPJ ou telefone…".
   - Filtra em memória a lista já carregada (case-insensitive, ignora máscara em CPF/telefone).

2. **Três selects de filtro** ao lado da busca
   - **Status**: Todos / Ativo / Vencendo (≤7 dias) / Vencido / Inadimplente.
   - **Vendedor**: Todos + lista de vendedores existentes.
   - **Plano**: Todos + lista de planos existentes.

3. **Botão "Limpar filtros"** aparece quando algum filtro está ativo.

4. **Contador de resultados** — "Mostrando X de Y clientes".

5. **Estado vazio** — mensagem "Nenhum cliente encontrado com esses filtros" quando o resultado é vazio.

6. **Responsivo** — no mobile os filtros ficam empilhados (grid 1 col < 640px, 2 col < 1024px, 4 col ≥ 1024px), mantendo o padrão já usado no admin.

## Fora de escopo

- Sem alterações no banco, RLS ou server functions (dados já vêm carregados).
- Sem paginação nova nem persistência dos filtros na URL.
- Não mexe em outras abas do admin.

## Detalhes técnicos

- Filtragem client-side com `useMemo` sobre a lista de clientes já carregada.
- Status derivado da mesma lógica de badge já existente (dias até vencimento, `status_pagamento`).
- Normalização: `.toLowerCase()` para texto e `.replace(/\D/g, "")` para comparar CPF/CNPJ e telefone.
- Componentes: `Input` + `Select` do shadcn e `Search`/`X` do `lucide-react` (já usados no projeto).
