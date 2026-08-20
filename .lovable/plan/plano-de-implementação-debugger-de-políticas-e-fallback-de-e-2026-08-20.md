# Plano de Implementação: Debugger de Políticas e Fallback de Erro

Este plano visa implementar uma ferramenta de diagnóstico de segurança (RLS/Policies) para o Admin e melhorar a experiência do usuário quando ocorrerem falhas críticas no sistema.

## Alterações

### Banco de Dados (Supabase)
1. **Função de Debug de Políticas**: Criar a função `public.debug_policies()` (security definer) que retorna uma matriz de permissões (SELECT, INSERT, UPDATE, DELETE) para as tabelas do schema `public` comparando os papéis do sistema (`admin`, `vendedor`, `cliente`).
2. **Grants**: Garantir acesso de execução à nova função para o papel `authenticated`.

### Backend (TanStack Server Functions)
1. **Nova Função no Servidor**: Criar `obterDiagnosticoSeguranca` em `src/lib/admin.functions.ts` para chamar o RPC do banco e retornar os dados formatados.

### Frontend (React / Admin)
1. **Nova Aba de Configuração**: Adicionar a seção "Segurança" em `src/lib/admin-nav.ts`.
2. **Componente de Visualização**: Criar `src/components/admin/SegurancaTab.tsx` que renderiza uma tabela comparativa com:
    - Nome da tabela.
    - Status do RLS (Enabled/Disabled).
    - Status de acesso (SELECT, INSERT, etc.) por role.
    - Avisos sobre tabelas sem RLS ou sem permissões básicas.
3. **Integração no Admin**: Mapear a nova seção em `src/routes/admin.tsx`.

### Experiência de Erro (Fallback)
1. **Padronização do Root Error**: Atualizar `src/routes/__root.tsx` para incluir uma mensagem mais amigável, um botão de recarregar página e um botão de voltar para o início, garantindo que o usuário nunca fique preso em uma tela branca.

## Detalhes Técnicos
- O diagnóstico usará as tabelas de sistema `information_schema` e `pg_policies`.
- O fallback de erro usará `router.invalidate()` e `window.location.reload()`.
- O RLS da tabela `public.user_roles` continuará protegido, sendo visível apenas o diagnóstico de acesso.
