export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
}

export interface VotesUpdate {
  pollId: string;
  options: PollOption[];
}

export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    let message = 'Não foi possível falar com o servidor.';
    try {
      message = (await res.json()).error ?? message;
    } catch {
      
    }
    throw new ApiError(res.status, message);
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function createPoll(question: string, options: string[]): Promise<Poll> {
  return request<Poll>('/api/polls', {
    method: 'POST',
    body: JSON.stringify({ question, options }),
  });
}

export function getPoll(id: string): Promise<Poll> {
  return request<Poll>(`/api/polls/${encodeURIComponent(id)}`);
}

export function vote(pollId: string, optionId: string): Promise<void> {
  return request<void>(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ optionId }),
  });
}
