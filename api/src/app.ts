import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { createPoll, getPoll, vote } from './store';

export function createServer() {
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';

  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: corsOrigin } });

  // O cliente entra na "sala" da enquete para receber as atualizações dela
  io.on('connection', (socket) => {
    socket.on('poll:join', (data: { pollId: string }, ack?: () => void) => {
      if (typeof data?.pollId !== 'string') return;
      socket.join(data.pollId);
      ack?.();
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/polls', async (req, res) => {
    const { question, options } = req.body ?? {};
    const valid =
      typeof question === 'string' &&
      question.trim() !== '' &&
      Array.isArray(options) &&
      options.length >= 2 &&
      options.every((o: unknown) => typeof o === 'string' && o.trim() !== '');

    if (!valid) {
      res.status(400).json({ error: 'Envie "question" e pelo menos 2 "options".' });
      return;
    }

    const poll = await createPoll(question.trim(), options.map((o: string) => o.trim()));
    res.status(201).json(poll);
  });

  app.get('/api/polls/:id', async (req, res) => {
    const poll = await getPoll(req.params.id);
    if (!poll) {
      res.status(404).json({ error: 'Enquete não encontrada.' });
      return;
    }
    res.json(poll);
  });

  app.post('/api/polls/:id/vote', async (req, res) => {
    const optionId = req.body?.optionId;
    const poll = typeof optionId === 'string' ? await vote(req.params.id, optionId) : undefined;
    if (!poll) {
      res.status(404).json({ error: 'Enquete ou opção não encontrada.' });
      return;
    }
    io.to(poll.id).emit('votes:update', { pollId: poll.id, options: poll.options });
    res.status(204).end();
  });

  // O Express 5 encaminha para cá qualquer erro lançado nas rotas async (ex.: falha no banco)
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Erros do próprio cliente (ex.: JSON malformado) já vêm com status 4xx
    const status = (err as { status?: number }).status;
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ error: 'Requisição inválida.' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return { app, httpServer, io };
}
