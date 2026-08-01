import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Tema = "claro" | "escuro";

const CHAVE = "brazon-tema";

/** Script inline: aplica o tema salvo antes da hidratação, evitando "flash" branco. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${CHAVE}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'escuro':'claro';}document.documentElement.classList.toggle('dark',t==='escuro');document.documentElement.style.colorScheme=t==='escuro'?'dark':'light';}catch(e){}})();`;

interface TemaContexto {
  tema: Tema;
  alternarTema: () => void;
  definirTema: (t: Tema) => void;
}

const Ctx = createContext<TemaContexto>({
  tema: "claro",
  alternarTema: () => {},
  definirTema: () => {},
});

function aplicar(tema: Tema) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", tema === "escuro");
  document.documentElement.style.colorScheme = tema === "escuro" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("claro");

  // Lê o tema já aplicado pelo script inline (evita divergência na hidratação).
  useEffect(() => {
    const atual: Tema = document.documentElement.classList.contains("dark") ? "escuro" : "claro";
    setTema(atual);
  }, []);

  const definirTema = useCallback((t: Tema) => {
    setTema(t);
    aplicar(t);
    try {
      localStorage.setItem(CHAVE, t);
    } catch {
      /* modo privado: mantém apenas na sessão atual */
    }
  }, []);

  const alternarTema = useCallback(() => {
    definirTema(document.documentElement.classList.contains("dark") ? "claro" : "escuro");
  }, [definirTema]);

  return <Ctx.Provider value={{ tema, alternarTema, definirTema }}>{children}</Ctx.Provider>;
}

export function useTema() {
  return useContext(Ctx);
}
