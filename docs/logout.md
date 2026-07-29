# Sair / Logout

## Como funciona
- `src/lib/use-sair.ts` (`useSair`): hook único de logout.
  1. cancela queries em andamento; 2. limpa o cache do React Query;
  3. `supabase.auth.signOut()` via `AuthProvider`; 4. `navigate({ to: "/login", replace: true })`.
  Não recarrega a página e não deixa a tela protegida no histórico (botão Voltar).
- `src/components/SairButton.tsx`: botão padrão com confirmação (AlertDialog).
  Variantes: `icone` (cabeçalhos compactos/mobile), `texto` (ícone + rótulo),
  `menu` (item de largura total para menus laterais).

## Onde está aplicado
| Tela | Local |
| --- | --- |
| /cliente | canto superior direito do header |
| /vendedor | canto superior direito do header |
| /admin | rodapé da sidebar + ícone no header (funciona no drawer mobile) |
| /meus-aceites | topo à direita |
| /termos-de-uso | topo à direita (apenas se logado) |
| TermosGate (bloqueio de novo termo) | botão "Sair da conta" |

## Manutenção
Novas telas autenticadas devem usar `<SairButton />` (nunca chamar `signOut()` direto),
para manter comportamento, acessibilidade (`aria-label="Sair da conta"`) e visual consistentes.
