# Plano: Sistema de Changelog Automático com IA (Brazon)

Implementação de um sistema de changelog automático que processa deploys via webhook, utiliza IA para gerar notas de atualização humanizadas para diferentes públicos (cliente, vendedor, admin) e permite a configuração da IA via painel administrativo.

## PARTE 1 — Banco de Dados e Segurança

- Criar tabela `deploys` para rastrear atualizações e garantir idempotência.
- Adicionar colunas de configuração de IA e Changelog na tabela `configuracoes`.
- Implementar trigger para mascarar chaves de API e gerenciar estado de teste.
- Criar view `configuracoes_publica` para proteger credenciais sensíveis (`ia_api_key`, `asaas_api_key`, `changelog_token`).
- Atualizar permissões RLS para garantir que apenas admins gerenciem estas configurações.

## PARTE 2 — Configuração da IA no Admin

- **Server Functions**:
    - `obterConfigIa`: Retorna metadados da configuração (sem a chave).
    - `salvarConfigIa`: Salva provedor, modelo e chave (opcional). Registra auditoria.
    - `testarConexaoIa`: Realiza chamada de teste ao provedor escolhido.
- **Interface**:
    - Adicionar card "Inteligência Artificial" em `ConfigTab.tsx`.
    - Campos para Provedor (Select), Modelo (Input com sugestões) e API Key (PasswordInput mascarado).
    - Badge de status e botão de teste com feedback de latência.

## PARTE 3 — Lógica do Changelog e IA

- **Filtros e Versão** (`src/lib/changelog.ts`):
    - Regex para ignorar commits irrelevantes (chore, ci, fix pequeno).
    - Lista de arquivos ignorados (configurações de projeto, testes).
    - Lógica de cálculo semver automático baseado nas mensagens de commit.
- **Integração com IA** (`src/lib/changelog.server.ts`):
    - Suporte a múltiplos provedores: OpenRouter, DeepSeek, Groq, Google, Anthropic.
    - Prompt de sistema especializado para o Brazon (segmentação por público).
    - Fallback determinístico caso a IA falhe ou não haja chave configurada.
    - Filtro de segurança pós-IA para evitar vazamento de termos técnicos/internos para clientes.

## PARTE 4 — Webhook e Automação

- **Webhook** (`src/routes/api/public/hooks/registrar-deploy.ts`):
    - Endpoint POST protegido por token.
    - Processamento assíncrono do deploy (geração de notas -> publicação).
    - Lógica de agrupamento (janela de 30 minutos) para evitar múltiplos avisos em deploys seguidos.
- **GitHub Action**:
    - Workflow para disparar o webhook após sucesso no CI da main.
    - Envio de payload com commits e arquivos alterados.

## PARTE 5 — Gestão no Admin

- **Painel de Deploys**:
    - Nova seção em `NovidadesTab.tsx`.
    - Tabela com histórico de deploys, status e links para as novidades.
    - Ações de "Reprocessar" (em caso de erro) e "Despublicar" (segurança).

## Detalhes Técnicos

- **Tecnologias**: TanStack Start (server functions + routes), Supabase (DB + RLS), OpenAI-compatible APIs, Zod para validação.
- **Segurança**: As chaves nunca saem do servidor. Webhooks validados com timing-safe comparison. View SQL isola segredos do frontend.
- **Internacionalização**: Todos os textos e logs em Português do Brasil.
