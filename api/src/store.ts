import { randomUUID } from 'node:crypto';

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

// Armazenamento PROVISÓRIO em memória: tudo se perde ao reiniciar.
// As funções já são assíncronas para que a troca pelo Postgres
// não precise mudar as rotas em app.ts — basta reimplementar este arquivo.
const polls = new Map<string, Poll>();

export async function createPoll(question: string, optionTexts: string[]): Promise<Poll> {
  const poll: Poll = {
    id: randomUUID(),
    question,
    options: optionTexts.map((text) => ({ id: randomUUID(), text, votes: 0 })),
  };
  polls.set(poll.id, poll);
  return poll;
}

export async function getPoll(id: string): Promise<Poll | undefined> {
  return polls.get(id);
}

export async function vote(pollId: string, optionId: string): Promise<Poll | undefined> {
  const poll = polls.get(pollId);
  const option = poll?.options.find((o) => o.id === optionId);
  if (!poll || !option) return undefined;
  option.votes += 1;
  return poll;
}
