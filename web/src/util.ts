import type { PollOption } from './api';

export function totalVotes(options: PollOption[]): number {
  return options.reduce((sum, o) => sum + o.votes, 0);
}

/** Porcentagem inteira de cada opção (0 quando ainda não há votos). */
export function percentages(options: PollOption[]): number[] {
  const total = totalVotes(options);
  return options.map((o) => (total === 0 ? 0 : Math.round((o.votes / total) * 100)));
}

export function pluralVotes(n: number): string {
  return n === 1 ? '1 voto' : `${n} votos`;
}

export function pollIdFromUrl(search: string = window.location.search): string | null {
  const id = new URLSearchParams(search).get('id');
  return id && id.trim() !== '' ? id : null;
}

export function pageUrl(page: 'vote.html' | 'result.html', pollId: string): string {
  return new URL(`${page}?id=${encodeURIComponent(pollId)}`, window.location.href).href;
}

/** Busca um elemento que a página garante existir. */
export function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Elemento não encontrado: ${selector}`);
  return el;
}

export async function copyToClipboard(text: string, button: HTMLButtonElement): Promise<void> {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copiado!';
  } catch {
    button.textContent = 'Não deu para copiar';
  }
  setTimeout(() => (button.textContent = original), 1500);
}

// Marca local de "já votei" — só evita voto duplo por engano no mesmo navegador.
// O controle de verdade precisa ser feito no servidor (ver HANDOFF.md).
const votedKey = (pollId: string) => `enquete:votou:${pollId}`;

export function hasVoted(pollId: string): boolean {
  try {
    return localStorage.getItem(votedKey(pollId)) !== null;
  } catch {
    return false;
  }
}

export function markVoted(pollId: string): void {
  try {
    localStorage.setItem(votedKey(pollId), new Date().toISOString());
  } catch {
    // armazenamento bloqueado: segue sem a marca
  }
}
