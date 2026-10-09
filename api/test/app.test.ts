import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { createServer } from '../src/app';

const { app, httpServer, io } = createServer();
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await io.close();
});

async function newPoll() {
  const res = await request(app)
    .post('/api/polls')
    .send({ question: 'Qual linguagem?', options: ['TypeScript', 'Go'] });
  return res.body;
}

describe('GET /health', () => {
  it('responde ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/polls', () => {
  it('cria uma enquete com as opções zeradas', async () => {
    const res = await request(app)
      .post('/api/polls')
      .send({ question: '  Qual linguagem?  ', options: [' TypeScript ', 'Go'] });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.question).toBe('Qual linguagem?');
    expect(res.body.options).toEqual([
      { id: expect.any(String), text: 'TypeScript', votes: 0 },
      { id: expect.any(String), text: 'Go', votes: 0 },
    ]);
  });

  it.each([
    ['sem corpo', undefined],
    ['pergunta vazia', { question: ' ', options: ['a', 'b'] }],
    ['só uma opção', { question: 'P?', options: ['a'] }],
    ['opção vazia', { question: 'P?', options: ['a', ''] }],
    ['opção não-texto', { question: 'P?', options: ['a', 2] }],
  ])('retorna 400 com %s', async (_caso, body) => {
    const res = await request(app).post('/api/polls').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('retorna 400 em JSON quando o corpo é JSON malformado', async () => {
    const res = await request(app)
      .post('/api/polls')
      .set('Content-Type', 'application/json')
      .send('{ "question": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});

describe('GET /api/polls/:id', () => {
  it('retorna a enquete', async () => {
    const poll = await newPoll();
    const res = await request(app).get(`/api/polls/${poll.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(poll);
  });

  it('retorna 404 para id inexistente', async () => {
    const res = await request(app).get('/api/polls/nao-existe');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/polls/:id/vote', () => {
  it('soma um voto na opção escolhida', async () => {
    const poll = await newPoll();
    const optionId = poll.options[1].id;

    const res = await request(app).post(`/api/polls/${poll.id}/vote`).send({ optionId });
    expect(res.status).toBe(204);

    const after = await request(app).get(`/api/polls/${poll.id}`);
    expect(after.body.options[0].votes).toBe(0);
    expect(after.body.options[1].votes).toBe(1);
  });

  it('retorna 404 para enquete ou opção inexistente', async () => {
    const poll = await newPoll();
    const semEnquete = await request(app)
      .post('/api/polls/nao-existe/vote')
      .send({ optionId: poll.options[0].id });
    const semOpcao = await request(app)
      .post(`/api/polls/${poll.id}/vote`)
      .send({ optionId: 'nao-existe' });
    const semCorpo = await request(app).post(`/api/polls/${poll.id}/vote`);

    expect(semEnquete.status).toBe(404);
    expect(semOpcao.status).toBe(404);
    expect(semCorpo.status).toBe(404);
  });
});

describe('Socket.IO', () => {
  it('envia votes:update para quem entrou na sala da enquete', async () => {
    const poll = await newPoll();
    const outra = await newPoll();
    const client: Socket = connect(baseUrl, { transports: ['websocket'] });
    const intruso: Socket = connect(baseUrl, { transports: ['websocket'] });

    try {
      await client.emitWithAck('poll:join', { pollId: poll.id });
      await intruso.emitWithAck('poll:join', { pollId: outra.id });

      let intrusoRecebeu = false;
      intruso.on('votes:update', () => (intrusoRecebeu = true));

      const update = new Promise<{ pollId: string; options: { votes: number }[] }>((resolve) =>
        client.once('votes:update', resolve),
      );
      await request(app)
        .post(`/api/polls/${poll.id}/vote`)
        .send({ optionId: poll.options[0].id });

      const payload = await update;
      expect(payload.pollId).toBe(poll.id);
      expect(payload.options.map((o) => o.votes)).toEqual([1, 0]);
      expect(intrusoRecebeu).toBe(false);
    } finally {
      client.disconnect();
      intruso.disconnect();
    }
  });
});
