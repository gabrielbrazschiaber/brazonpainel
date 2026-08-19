# Gestão comercial simplificada

Objetivo: uma única lista de leads onde o vendedor resolve tudo. Nenhuma função é removida — o que hoje está espalhado em dois blocos (fila de follow-up + lista de leads) passa a viver na mesma listagem.

## Como a tela fica

```text
Gestão comercial                    [Importar] [Completar] [Novo lead]
[ A contatar hoje (12) ] [ Atrasados (5) ] [ Todos ]   [Buscar...]  [Mais filtros ▾] [Ver desempenho ▾]

▸ Maria Silva · Padaria Central            Interessado   hoje
  (11) 98888-7777  ·  2ª tentativa · há 4 dias
  [WhatsApp]  [Respondeu ▾]  [Não respondeu]  [⋯]
```

- **Três abas simples no topo**: "A contatar hoje", "Atrasados" e "Todos" — filtram a mesma lista, sem painel separado.
- **Duas ações grandes por lead**: "Respondeu" e "Não respondeu".
  - "Não respondeu" registra a tentativa e reagenda o próximo contato automaticamente (comportamento atual, 1 clique).
  - "Respondeu" abre um mini-menu de 1 toque com Interessado / Em negociação / Não interessado / Ganho / Perdido, com campo de nota opcional.
- **Menu "⋯"** guarda o resto sem poluir: Adiar (+3/+7/+15/+30 dias), Reativar cadência, Editar, Excluir, Ver detalhes.
- **"Iniciar follow-up do dia"** continua existindo, como botão ao lado das abas — abre o mesmo modo sequencial de hoje.
- **Filtros avançados** (estágio, segmento, origem, período, só WhatsApp ativo, só incompletos, ordenação, filtro de lote, vendedor no admin) vão para um painel recolhível "Mais filtros", fechado por padrão.
- **Indicadores/funil/gráficos** saem do topo e ficam atrás de "Ver desempenho" (recolhido por padrão), com os atalhos atuais ("ver incompletos", "ver follow-ups") preservados.
- Linhas de lead mostram badge de atraso e "cadência encerrada" como hoje; o resumo de cadência ("2ª tentativa · último contato há 4 dias") aparece direto na linha.

## Funções mantidas (checklist)

Registrar sem resposta · registrar resposta com novo estágio e nota · adiar · reativar cadência · modo sequencial do dia · contadores atrasados/hoje/próximos · importar planilha · completar leads · novo/editar/excluir lead · detalhe do lead com reuniões e atividades · WhatsApp e indicador de número ativo · dashboard e funil · filtro por vendedor (admin) · scroll infinito e virtualização · tour de onboarding.

## Detalhes técnicos

- Mudança **só de frontend/apresentação**: nenhum server function, schema, RLS ou regra de cadência é alterado.
- `src/routes/comercial.tsx`: abas de fila usando o filtro já existente `apenas_follow_up` mais um novo filtro local de atrasados; painéis recolhíveis (Collapsible do shadcn) para filtros e desempenho.
- Novo componente `src/components/comercial/AcoesFollowUpLead.tsx`: extrai o "Respondeu" (popover com estágios + nota), "Não respondeu" e o menu "⋯", reutilizando `registrarFollowUp` / `reativarCadencia` de `src/lib/leads.functions.ts` e os helpers de `src/lib/follow-up.ts`.
- `FollowUpsPanel.tsx` deixa de ser um bloco separado na página: seus contadores alimentam as abas e o botão "Iniciar follow-up do dia"; a lógica vira um hook enxuto (`usePainelFollowUps`) e `FollowUpSequencialDialog` continua igual.
- Lista precisa de campos de cadência (`follow_ups_feitos`, `ultimo_contato_em`, `cadencia_encerrada`, `proximo_contato`) — já retornados por `listarLeads`.
- Tour/onboarding: os `data-tour` atuais (`comercial-followups`, `comercial-importar`, `comercial-novo-lead`) são mantidos nos novos alvos.
- Verificação antes de entregar: lint + testes unitários, e um roteiro Playwright na tela `/comercial` conferindo abas, contadores e as ações "Respondeu"/"Não respondeu" sem erro de console.
