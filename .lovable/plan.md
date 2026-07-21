## Objetivo

Deixar a sidebar do `/admin` mais clara, integrada ao fundo do painel, e trocar o logo por apenas o símbolo Z da marca — mais discreto e elegante.

## Mudanças

### 1. Tokens da sidebar (`src/styles.css`)

Reescrever as variáveis `--sidebar-*` (hoje em roxo escuro) para o esquema claro:

- `--sidebar`: mesmo valor de `--background` (cinza-claro do painel) — funde com o conteúdo, sem "bloco" roxo.
- `--sidebar-foreground`: `--foreground` (texto escuro padrão).
- `--sidebar-accent`: hover/ativo em lavanda bem sutil (ex.: `oklch(0.955 0.02 287)`).
- `--sidebar-accent-foreground`: `--primary` (roxo da marca) — item ativo ganha texto roxo + fundo lavanda claro.
- `--sidebar-border`: `--border` (mesma borda do resto).
- `--sidebar-ring`: `--ring`.

Fazer o mesmo ajuste no bloco `.dark` para manter coerência quando o tema escuro entrar em uso.

### 2. Logo no topo da sidebar (`src/routes/admin.tsx`)

No `SidebarHeader`, substituir o `<BrazonLogo />` por apenas `<BrazonSymbol />`:

- Estado expandido: símbolo Z centralizado, ~32px, com pequeno padding vertical.
- Estado colapsado (`collapsible="icon"`): mesmo símbolo, centralizado, sem quebrar layout.
- Remover o wordmark "BRAZON" do header da sidebar (aparece no login e outros locais, aqui fica só o símbolo).

### 3. Ajustes de contraste

Como o fundo da sidebar agora é igual ao do painel, adicionar uma borda direita sutil (`border-r`) para separar visualmente a sidebar do conteúdo — o componente `Sidebar` do shadcn já faz isso via `--sidebar-border`, então basta garantir que o token esteja definido.

Manter o item ativo bem visível com combinação **fundo lavanda + texto/ícone roxo primário + peso semibold**, para não perder legibilidade agora que sumiu o contraste forte do fundo escuro.

### Densidade

Mantida como está (confortável) — nenhuma mudança nos espaçamentos dos itens.

## Fora de escopo

- Não altera navegação, itens do menu, comportamento de collapse/drawer mobile.
- Não altera o logo em outras telas (login, headers dos painéis cliente/vendedor).
- Não muda tipografia nem cores gerais do painel.

## Detalhes técnicos

- Arquivos tocados: `src/styles.css` (tokens `--sidebar-*` em `:root` e `.dark`), `src/routes/admin.tsx` (import e uso de `BrazonSymbol` no `SidebarHeader`).
- `BrazonSymbol` já existe em `src/components/BrazonLogo.tsx` — reuso direto.
- Nenhuma migração de banco, nenhum server fn afetado.
