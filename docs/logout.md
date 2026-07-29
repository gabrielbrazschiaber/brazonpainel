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

## Comportamento mobile
- Botões de sair têm alvo de toque de 40px no mobile (`h-10`) e 36px no desktop.
- Cabeçalhos respeitam `env(safe-area-inset-top)` (notch/landscape) e o botão de sair
  fica sempre fixo à direita, com `shrink-0` para não ser cortado.
- Admin: a sidebar vira drawer no mobile (`AdminSidebar`); navegar, abrir "Minha conta"
  ou sair fecham o drawer automaticamente. O `SidebarTrigger` fica no header e há
  também um botão de sair no header, garantindo acesso mesmo com o drawer fechado.
- Vendedor: no modo paisagem/estreito os botões "Cadastrar" e "Minha conta" ficam
  apenas com ícone para preservar espaço do botão de sair.
