# Enquete em tempo real

Crie uma enquete, compartilhe o link e veja o gráfico de resultados mudar **ao vivo** a cada voto.

- **API** (`api/`): Node, Express 5, TypeScript e Socket.IO
- **Front-end** (`web/`): HTML, CSS, TypeScript, Vite e Chart.js

```
enquete-tempo-real/
├── api/                 # API REST + Socket.IO (porta 3000)
│   ├── src/app.ts       # rotas e eventos em tempo real
│   ├── src/store.ts     # armazenamento (hoje em memória)
│   ├── src/server.ts    # ponto de entrada
│   └── test/            # testes (Vitest + Supertest + socket.io-client)
├── web/                 # front-end (porta 5173 em dev)
│   ├── index.html       # tela 1: criar enquete
│   ├── vote.html        # tela 2: votar (?id=...)
│   ├── result.html      # tela 3: resultado ao vivo (?id=...)
│   ├── src/             # TypeScript e CSS das telas
│   └── test/
├── HANDOFF.md           # passagem de bastão entre as etapas
└── README.md
```

## Como rodar

Pré-requisito: **Node 20 ou mais novo** (desenvolvido com o Node 24).

```bash
# Terminal 1: API em http://localhost:3000
cd api
npm install
npm run dev

# Terminal 2: front em http://localhost:5173
cd web
npm install
npm run dev
```

Abra **http://localhost:5173**, crie uma enquete, abra o link de resultado em uma aba e o de votação em outra. Ao votar, o gráfico muda sozinho na outra aba.

> Em desenvolvimento, o Vite repassa `/api` e `/socket.io` para a API (veja `web/vite.config.ts`). Por isso o front só usa caminhos relativos e não há problema de CORS.

### Scripts

| Pasta | Comando         | O que faz                                    |
| ----- | --------------- | -------------------------------------------- |
| api   | `npm run dev`   | API com recarga automática (tsx watch)       |
| api   | `npm test`      | Testes das rotas e do Socket.IO              |
| api   | `npm run lint`  | ESLint                                       |
| api   | `npm run build` | Compila para `api/dist/`                     |
| api   | `npm start`     | Roda a versão compilada (`dist/server.js`)   |
| web   | `npm run dev`   | Servidor de desenvolvimento do Vite          |
| web   | `npm test`      | Testes das funções auxiliares                |
| web   | `npm run lint`  | ESLint                                       |
| web   | `npm run build` | Checa os tipos e gera os estáticos em `web/dist/` |

### Variáveis de ambiente

| Variável           | Onde          | Padrão                  | Para quê |
| ------------------ | ------------- | ----------------------- | -------- |
| `PORT`             | api           | `3000`                  | Porta da API |
| `CORS_ORIGIN`      | api           | `*`                     | Origem permitida no CORS (HTTP e Socket.IO) |
| `API_PROXY_TARGET` | web (dev)     | `http://localhost:3000` | Para onde o Vite repassa `/api` e `/socket.io` |
| `VITE_API_URL`     | web (build)   | vazio (mesma origem)    | Só se a API ficar em **outro domínio**. Ex.: `https://api.exemplo.com` |

## API

Todas as respostas são JSON. Erros vêm no formato `{ "error": "mensagem" }`.

### `GET /health`

Verifica se a API está no ar.

```json
{ "status": "ok" }
```

### `POST /api/polls`: criar enquete

Exige uma pergunta e pelo menos 2 opções, todas como texto não vazio. Os espaços nas pontas são removidos.

Requisição:

```json
{
  "question": "Qual linguagem a turma prefere?",
  "options": ["TypeScript", "Python", "Go"]
}
```

Resposta **201 Created**:

```json
{
  "id": "6b85309c-7d76-4ce4-ac8e-6831f9cadf58",
  "question": "Qual linguagem a turma prefere?",
  "options": [
    { "id": "b293d8f9-a873-4e37-a033-3dd799d9bcf0", "text": "TypeScript", "votes": 0 },
    { "id": "c7396b57-fabf-4db3-9c6a-b53f86246819", "text": "Python", "votes": 0 },
    { "id": "73a11c52-8f18-40e9-96f4-9518ef1e4521", "text": "Go", "votes": 0 }
  ]
}
```

Resposta **400 Bad Request** (dados inválidos ou JSON malformado):

```json
{ "error": "Envie \"question\" e pelo menos 2 \"options\"." }
```

### `GET /api/polls/:id`: buscar enquete

Resposta **200 OK**: a enquete no mesmo formato acima, com os votos atuais.

Resposta **404 Not Found**:

```json
{ "error": "Enquete não encontrada." }
```

### `POST /api/polls/:id/vote`: votar

Requisição:

```json
{ "optionId": "c7396b57-fabf-4db3-9c6a-b53f86246819" }
```

Resposta **204 No Content** (sem corpo). A atualização chega pelo Socket.IO.

Resposta **404 Not Found** (enquete ou opção inexistente):

```json
{ "error": "Enquete ou opção não encontrada." }
```

### Exemplos com curl

```bash
curl -X POST http://localhost:3000/api/polls -H "Content-Type: application/json" -d "{\"question\":\"Café ou chá?\",\"options\":[\"Café\",\"Chá\"]}"
```

```bash
curl http://localhost:3000/api/polls/<id>
```

```bash
curl -X POST http://localhost:3000/api/polls/<id>/vote -H "Content-Type: application/json" -d "{\"optionId\":\"<optionId>\"}"
```

## Tempo real (Socket.IO)

O Socket.IO usa o caminho padrão `/socket.io`.

| Direção            | Evento         | Dados                                           |
| ------------------ | -------------- | ----------------------------------------------- |
| cliente → servidor | `poll:join`    | `{ "pollId": "..." }`. Responde com um *ack* vazio quando o cliente já está na sala |
| servidor → cliente | `votes:update` | `{ "pollId": "...", "options": [ { "id", "text", "votes" } ] }` |

O cliente entra na "sala" da enquete com `poll:join`. A cada voto, todos os clientes dessa sala recebem `votes:update` com a contagem completa.

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
socket.on('connect', async () => {
  await socket.emitWithAck('poll:join', { pollId });
});
socket.on('votes:update', ({ options }) => console.log(options));
```

## Status do projeto

O projeto é feito em etapas, como num revezamento. Veja o **[HANDOFF.md](HANDOFF.md)** para saber o que já foi feito e o que vem a seguir.

| Etapa | Responsável | Status |
| ----- | ----------- | ------ |
| 1. API | Pessoa 1 | ✅ pronto |
| 2. Front-end | Pessoa 2 | ✅ pronto |
| 3. Postgres e Docker | Pessoa 3 | ⏳ próxima |
| 4. CI (GitHub Actions) | Pessoa 4 | ⏳ |
| 5. Terraform e CD | Pessoa 5 | ⏳ |
