/**
 * Buffer durável de retentativa para exportação de telemetria.
 *
 * Quando o envio para o destino externo falha (rede fora do ar, endpoint
 * indisponível, etc.), o lote é persistido em `localStorage` e reenviado com
 * backoff exponencial — assim um incidente de rede não derruba a telemetria
 * do incidente que estamos tentando diagnosticar.
 *
 * Contrato: nunca lança, nunca quebra a aplicação, SSR-safe.
 */
import type { EventoExportado } from "@/lib/telemetry-export";

const CHAVE = "brazon:telemetria-fila";
const CAP_MAX = 200;
const ATRASOS_MS = [1000, 2000, 4000, 8000, 30000];

let tentativa = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushando = false;
let enviarAtual: ((eventos: EventoExportado[]) => Promise<void>) | null = null;

function storageDisponivel(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function ler(): EventoExportado[] {
  if (!storageDisponivel()) return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const lista = JSON.parse(bruto) as unknown;
    return Array.isArray(lista) ? (lista as EventoExportado[]) : [];
  } catch {
    return [];
  }
}

function salvar(eventos: EventoExportado[]): void {
  if (!storageDisponivel()) return;
  try {
    const cortado = eventos.length > CAP_MAX ? eventos.slice(eventos.length - CAP_MAX) : eventos;
    window.localStorage.setItem(CHAVE, JSON.stringify(cortado));
  } catch {
    /* silencioso por design: storage cheio/bloqueado não deve quebrar nada */
  }
}

/** Quantidade de eventos pendentes de reenvio. */
export function tamanho(): number {
  return ler().length;
}

/** Adiciona eventos à fila persistida (cortando os mais antigos além do cap). */
export function enfileirar(eventos: EventoExportado[]): void {
  if (!storageDisponivel() || eventos.length === 0) return;
  try {
    const atual = ler();
    salvar([...atual, ...eventos]);
    // Toda nova adição tenta descarregar, respeitando o backoff em curso.
    if (enviarAtual) agendar(enviarAtual);
  } catch {
    /* silencioso por design */
  }
}

/**
 * Registra quem envia os lotes e agenda a próxima tentativa com backoff, SEM
 * tentar enviar agora. Usado logo após uma falha de envio: tentar de novo no
 * mesmo instante só repetiria o erro.
 */
export function registrarEnviador(enviar: (eventos: EventoExportado[]) => Promise<void>): void {
  enviarAtual = enviar;
  if (tamanho() > 0) agendar(enviar);
}

function limpar(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  tentativa = 0;
}

function agendar(enviar: (eventos: EventoExportado[]) => Promise<void>): void {
  enviarAtual = enviar;
  if (timer) return; // já há uma tentativa agendada — não duplica (evita spin)
  const atraso = ATRASOS_MS[Math.min(tentativa, ATRASOS_MS.length - 1)];
  timer = setTimeout(() => {
    timer = null;
    void executarFlush(enviar);
  }, atraso);
}

async function executarFlush(enviar: (eventos: EventoExportado[]) => Promise<void>): Promise<void> {
  if (flushando) return;
  const pendentes = ler();
  if (pendentes.length === 0) {
    limpar();
    return;
  }
  flushando = true;
  try {
    await enviar(pendentes);
    // Sucesso: esvazia a fila e reseta o backoff.
    salvar([]);
    limpar();
  } catch {
    tentativa = Math.min(tentativa + 1, ATRASOS_MS.length - 1);
    agendar(enviar);
  } finally {
    flushando = false;
  }
}

/**
 * Tenta descarregar a fila usando `enviar`. Nunca lança: se `enviar` rejeitar,
 * reagenda com backoff exponencial automaticamente.
 *
 * Por padrão respeita a retentativa já agendada (não gira em loop). Use
 * `forcar` quando algo mudou de verdade — a rede voltou, a aba voltou ao foco
 * — e vale antecipar o envio em vez de esperar o backoff.
 */
export async function flush(
  enviar: (eventos: EventoExportado[]) => Promise<void>,
  forcar = false,
): Promise<void> {
  enviarAtual = enviar;
  if (flushando) return; // já há um envio em voo: não duplica
  if (timer) {
    if (!forcar) return;
    clearTimeout(timer);
    timer = null;
  }
  try {
    await executarFlush(enviar);
  } catch {
    /* silencioso por design */
  }
}

/** Usado em testes para isolar execuções. */
export function _resetBufferParaTestes(): void {
  limpar();
  flushando = false;
  enviarAtual = null;
  if (storageDisponivel()) {
    try {
      window.localStorage.removeItem(CHAVE);
    } catch {
      /* ignorado */
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (enviarAtual) void flush(enviarAtual, true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && enviarAtual) void flush(enviarAtual, true);
  });
}
