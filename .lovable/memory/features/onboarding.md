---
name: Onboarding interativo
description: Tutorial guiado em 3 camadas (boas-vindas, tour contextual por tela, ajuda permanente) com catálogo único em src/lib/onboarding.ts
type: feature
---
Sistema de onboarding próprio (sem bibliotecas externas de tour).

- Catálogo único: `src/lib/onboarding.ts` (TUTORIAIS, RESUMOS_TELA, AJUDA_CAMPOS). Todo texto novo de tutorial entra aqui.
- Progresso: tabela `public.onboarding_progresso` (RLS: dono; admin lê a equipe). Server fns em `src/lib/onboarding.functions.ts`.
- Camada 1: `DialogBoasVindas` no primeiro acesso, por papel (admin/vendedor/cliente).
- Camada 2: `useTourDaTela("tela:<chave>", pronto)` dispara o tour na primeira visita de cada tela (admin dashboard/clientes/configurações, vendedor, cliente, comercial, tarefas, solicitações).
- Camada 3: `AjudaDaTela` (ícone ?) no cabeçalho + `CampoComAjuda` nos campos que confundem + `ReverTutoriais` em Configurações > Geral.
- Alvos do tour usam atributos `data-tour="..."` no DOM; ao mexer nesses elementos, preserve o atributo. Passos com alvo ausente são pulados automaticamente.
- Provider: `OnboardingProvider` dentro de `TermosGate` (em `RequireRole` e nas rotas /comercial, /tarefas, /solicitacoes).
- Admin vê em Configurações > Vendedores um selo indicando quem já fez o tutorial.
