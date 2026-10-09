import { createServer } from './app';

const PORT = Number(process.env.PORT ?? 3000);
const { httpServer } = createServer();

httpServer.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});