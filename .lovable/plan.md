## Objetivo

Adicionar permissões granulares **por papel** (cliente, vendedor, admin) sobre a base de papéis já existente, sem abrir caminho de escalonamento de privilégio. Nada de permissões individuais por usuário nesta fase.

## Modelo de dados

Duas estruturas novas, ambas no banco:

- **`app_permission`** — lista fixa de permissões (enum), no formato `recurso.acao`:
  - `clientes.ler`, `clientes.criar`, `clientes.editar`, `clientes.excluir`
  - `vendedores.ler`, `vendedores.criar`, `vendedores.editar`, `vendedores.excluir`
  - `planos.gerenciar`
  - `pagamentos.ler`, `pagamentos.editar_status`
  - `configuracoes.gerenciar`, `asaas.sincronizar`
  - `novidades.gerenciar`, `auditoria.ler`
- **`role_permissions`** — cada linha liga um papel a uma permissão. Somente administradores podem alterar; todos os usuários autenticados podem ler (é a lista que o próprio app usa para desenhar a interface).

Carga inicial reproduz exatamente o comportamento atual: admin recebe todas; vendedor recebe leitura/criação/edição de clientes, leitura de pagamentos e sincronização Asaas; cliente não recebe nenhuma (o acesso dele continua sendo por dono do registro).

## Função de verificação

`has_permission(_user_id, _permission)` — mesma receita já usada em `has_role`: `SECURITY DEFINER`, `STABLE`, `search_path` fixo. Faz a junção `user_roles` → `role_permissions`. Isso evita recursão nas regras de acesso e permite usá-la tanto nas políticas do banco quanto nas funções de servidor.

As políticas de acesso das tabelas passam a usar `has_permission(...)` no lugar de `has_role(auth.uid(), 'admin')` onde a permissão for mais específica. As políticas de dono (cliente vê o próprio cadastro, vendedor vê os clientes dele) continuam como estão.

## Camada de servidor

- Novo helper `ensurePermission(supabase, userId, permissao)` em `src/lib/permissions.server.ts`, usando o cliente do usuário (com RLS ativa) — nunca o cliente privilegiado para decidir a autorização.
- Substituir os `ensureAdmin` de `admin.functions.ts`, `config.functions.ts`, `novidades.functions.ts`, `vendedor.functions.ts` e `asaas.functions.ts` pela permissão correspondente.
- O cliente privilegiado (`client.server`) só é carregado **depois** da verificação passar.
- Toda concessão ou revogação de permissão grava em `auditoria` com ator, papel afetado e permissão.

## Camada de interface

- `src/lib/auth.tsx` passa a carregar também o conjunto de permissões do usuário e expor `can(permissao)`.
- Novo `<Can permissao="...">` para esconder botões e abas; o `RequireRole` continua existindo para as rotas.
- Nova aba **Permissões** no painel admin: matriz papel × permissão com interruptores, salvando em lote e mostrando aviso ao remover permissões críticas de admin.
- Regra de segurança na interface e no servidor: não é possível remover `configuracoes.gerenciar` do papel admin (evita travar o sistema fora de qualquer administração).

## Invalidação

Ao alterar permissões, invalidar as consultas em cache e recarregar o contexto de auth. O servidor revalida em toda chamada, então um cache desatualizado nunca concede acesso real — apenas mostra um botão que falharia.

## Testes de segurança

Novo arquivo de testes cobrindo os cenários de **negativa**:

- vendedor chamando função exclusiva de admin → recusado
- cliente chamando função de vendedor → recusado
- usuário não-admin tentando escrever em `role_permissions` → recusado
- vendedor lendo cliente de outro vendedor → vazio
- permissão revogada deixa de valer na chamada seguinte
- interface esconde o controle, mas o servidor recusa mesmo se a chamada for forjada

## Detalhes técnicos

- Migração única com: `CREATE TYPE app_permission`, `CREATE TABLE public.role_permissions` + `GRANT SELECT TO authenticated` / `GRANT ALL TO service_role` (sem `anon`), `ENABLE ROW LEVEL SECURITY`, políticas (leitura para autenticados, escrita só via `has_role(auth.uid(),'admin')`), a função `has_permission` e os `INSERT` da carga inicial.
- Arquivos afetados: `src/lib/permissions.server.ts` (novo), `src/lib/permissions.functions.ts` (novo), `src/lib/auth.tsx`, `src/components/Can.tsx` (novo), `src/components/admin/PermissoesTab.tsx` (novo), `src/components/admin/AdminSidebar.tsx`, `src/routes/admin.tsx`, e os `*.functions.ts` que hoje usam `ensureAdmin`.
- Nenhuma permissão é lida de metadados do usuário nem do perfil — apenas de `user_roles` + `role_permissions`.
