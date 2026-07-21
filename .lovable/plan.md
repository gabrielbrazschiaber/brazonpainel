# Exclusões e gestão de status de pagamento

## 1. Exclusão de registros (somente admin)

Novas server functions em `src/lib/admin.functions.ts`, todas protegidas por `ensureAdmin` e com `registrarAuditoria`:

- `excluirVendedor({ vendedorId })` — apaga linha em `vendedores`, remove role `vendedor` de `user_roles` e deleta o `auth.user`. Bloqueia se o vendedor tiver clientes vinculados (mostra mensagem pedindo para reatribuir/excluir os clientes antes).
- `excluirAdmin({ userId })` — remove role `admin` e deleta o `auth.user`. Bloqueia auto-exclusão (`userId === context.userId`) e exclusão do último admin restante.
- `excluirCliente({ clienteId })` — apaga o cliente. Pagamentos são removidos em cascata (já existe FK) — se não houver, adicionar `ON DELETE CASCADE` via migration. Também deleta o `auth.user` associado.

Na UI (`src/routes/admin.tsx`), adicionar botão de lixeira em cada linha das tabelas de Vendedores, Admins e Clientes, abrindo `AlertDialog` de confirmação (digitação de "EXCLUIR" para admins/vendedores com clientes, confirmação simples para cliente). Feedback via `toast` e refresh da lista.

## 2. Status de pagamento com modo "Simulação"

### Banco
Migration para ampliar o enum/valores aceitos em `pagamentos.status`:
- Valores válidos passam a ser: `pendente`, `pago`, `vencido`, `simulacao`.
- Ajustar CHECK constraint (ou enum) para incluir `simulacao`.
- Adicionar índice parcial `WHERE status <> 'simulacao'` opcional para consultas de dashboard.

### Server function
`atualizarStatusPagamento({ pagamentoId, novoStatus })` em `src/lib/admin.functions.ts`:
- Aceita `pago | pendente | simulacao`.
- Quando muda para `pago`, preenche `data_pagamento = now()`; quando volta para `pendente`/`simulacao`, limpa `data_pagamento`.
- Registra auditoria com valores antigo/novo.

### UI Admin
Em `AdminDashboard.tsx` (lista "Últimos pagamentos") e numa nova aba/seção "Pagamentos" com filtro por status:
- Cada item ganha um `DropdownMenu` com opções: **Marcar como pago**, **Marcar como pendente**, **Marcar como simulação**.
- Badge visual para `simulacao` (cinza tracejado com rótulo "Simulação").

### Exclusão de simulações dos indicadores financeiros
Em `AdminDashboard.tsx` filtrar `pagamentos.filter(p => p.status !== 'simulacao')` antes de calcular:
- MRR / Receita do mês / Receita mês passado
- Ranking de vendedores (comissão)
- Gráfico de evolução MRR
- Contadores de inadimplência

Pagamentos em simulação continuam aparecendo na listagem "Últimos pagamentos" (com badge distinto) para o admin acompanhar, mas nunca entram em somatórios financeiros. Também são ignorados no painel do cliente (`/cliente`) e nas comissões do vendedor.

## Detalhes técnicos
- Todas as ações críticas passam por `registrarAuditoria` (tabela `auditoria`).
- Confirmações usam `AlertDialog` do shadcn.
- Após cada ação, recarregar dados via `router.invalidate()` ou refetch local existente.
- Tipagem: atualizar tipos derivados (`PagamentoRow`) para incluir `"simulacao"`.
