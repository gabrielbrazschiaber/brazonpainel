import { z } from "zod";

export interface Commit {
  sha: string;
  mensagem: string;
  autor: string;
}

export const COMMITS_IGNORADOS = /^(chore|ci|build|test|docs|style|refactor)(\(.+\))?:|^Merge |^Revert |^bump |.{0,9}$/i;

export const ARQUIVOS_IGNORADOS = [
  ".github/**",
  "tests/**",
  "*.test.ts",
  "*.test.tsx",
  "bun.lock",
  "package.json",
  ".prettier*",
  "eslint.config.js",
  "AGENTS.md",
  ".lovable/**",
  "scripts/**",
];

/**
 * Calcula a próxima versão semver baseada nos commits.
 */
export function calcularVersao(versaoAtual: string, commits: Commit[]): string {
  if (commits.length === 0) return versaoAtual;

  let major = 0;
  let minor = 0;
  let patch = 0;

  const [vMajor, vMinor, vPatch] = versaoAtual.replace(/^v/, "").split(".").map(Number);
  
  let targetMajor = vMajor || 0;
  let targetMinor = vMinor || 0;
  let targetPatch = vPatch || 0;

  let isMajor = false;
  let isMinor = false;

  for (const commit of commits) {
    const msg = commit.mensagem;
    // Breaking change: ! antes do : ou BREAKING CHANGE no corpo
    if (msg.includes("BREAKING CHANGE") || /^[a-z]+(\(.+\))?!:/.test(msg)) {
      isMajor = true;
      break;
    }
    if (msg.startsWith("feat:") || msg.startsWith("feature:")) {
      isMinor = true;
    }
  }

  if (isMajor) {
    targetMajor++;
    targetMinor = 0;
    targetPatch = 0;
  } else if (isMinor) {
    targetMinor++;
    targetPatch = 0;
  } else {
    targetPatch++;
  }

  return `${targetMajor}.${targetMinor}.${targetPatch}`;
}

export const changelogAiResponseSchema = z.object({
  titulo: z.string().max(60),
  relevante: z.boolean(),
  publicos: z.object({
    cliente: z.object({
      incluir: z.boolean(),
      itens: z.array(z.object({
        tipo: z.enum(["novidade", "melhoria", "correcao"]),
        texto: z.string()
      }))
    }),
    vendedor: z.object({
      incluir: z.boolean(),
      itens: z.array(z.object({
        tipo: z.enum(["novidade", "melhoria", "correcao"]),
        texto: z.string()
      }))
    }),
    admin: z.object({
      incluir: z.boolean(),
      itens: z.array(z.object({
        tipo: z.enum(["novidade", "melhoria", "correcao"]),
        texto: z.string()
      }))
    })
  }),
  resumo_ia: z.object({
    erro_original: z.string().optional()
  }).optional().nullable()
});

export type ChangelogAiResponse = z.infer<typeof changelogAiResponseSchema>;

const TERMOS_PROIBIDOS_CLIENTE = [
  "lead", "comissão", "vendedor", "prospec", "funil", "crm", "permissão", "auditoria", "admin"
];

/**
 * Filtra itens para o público cliente que contenham termos proibidos.
 */
export function filtrarItensCliente(itens: { tipo: string; texto: string }[]) {
  const descartados: string[] = [];
  const filtrados = itens.filter(item => {
    const texto = item.texto.toLowerCase();
    const proibido = TERMOS_PROIBIDOS_CLIENTE.some(termo => texto.includes(termo));
    if (proibido) {
      descartados.push(item.texto);
      return false;
    }
    return true;
  });
  return { filtrados, descartados };
}
