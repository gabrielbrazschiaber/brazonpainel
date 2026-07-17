## Causa
Nas listas "Últimos pagamentos" e "Logs de webhook Asaas" (AdminDashboard.tsx ~L583 e ~L625), cada item usa `flex` com o bloco direito em `shrink-0` mantendo **valor + badge lado a lado**. No mobile (~390px) esse bloco fica com ~170px fixos, espremendo o nome à esquerda e criando a aparência desproporcional.

## Correção (só apresentação, só esses dois cards)

1. **Item de "Últimos pagamentos"** — mudar o container direito para empilhar no mobile:
   `flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2`
   → valor em cima, `StatusBadge` embaixo, ambos alinhados à direita.

2. **Item de "Logs de webhook Asaas"** — mesmo padrão no botão: badge de `processing_result` abaixo do evento no mobile, inline no desktop.

3. Adicionar `tabular-nums` no valor monetário para alinhamento visual quando empilhado.

## Fora do escopo
Nenhuma mudança em dados, lógica, RLS, ou em outras seções do dashboard.

## Verificação
Playwright em 390×844 na aba Dashboard do `/admin`: screenshot dos dois cards e conferir que os nomes aparecem sem corte agressivo e sem overflow horizontal.