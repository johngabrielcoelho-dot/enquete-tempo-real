# Passagem de bastão

Cada etapa escreve aqui, ao terminar: **o que foi feito e como rodar**, **o que ficou faltando ou é provisório** e **o que a próxima pessoa precisa saber**.

> **Quem recebe o bastão:** antes de começar, rode o projeto seguindo o [README](README.md). Se algo não funcionar, avise na hora.

---

## Etapa 1: API (Pessoa 1) ✅

### O que foi feito
- API em **Node + Express 5 + TypeScript** (`api/`), com as rotas:
  - `POST /api/polls` cria uma enquete
  - `GET /api/polls/:id` busca uma enquete
  - `POST /api/polls/:id/vote` registra um voto
  - `GET /health` serve para *healthcheck*
- **Socket.IO**: o cliente entra na sala com `poll:join` e, a cada voto, a API envia `votes:update` para a sala.
- Middleware de erro que devolve JSON: `400` para JSON malformado e `500` para erros inesperados, como uma falha no banco.
- **13 testes** (`api/test/app.test.ts`) cobrindo rotas, validações e o evento em tempo real.
- Rotas documentadas no README, com exemplos de JSON.

### Como rodar
```bash
cd api
npm install
npm run dev     # http://localhost:3000
npm test        # 13 testes devem passar
npm run lint
```

### Provisório ou faltando
- **Os dados ficam em memória** (`api/src/store.ts`) e somem ao reiniciar. A Etapa 3 resolve isso.
- **Não há controle de voto duplicado no servidor.** Quem chamar a rota várias vezes vota várias vezes. O front só impede o voto duplo no mesmo navegador.
- **O repositório no GitHub ainda não foi criado** e as regras de branch não foram configuradas (veja "Pendências do GitHub" no fim deste arquivo).

---

## Etapa 2: Front-end (Pessoa 2) ✅

### O que foi feito
- Front em **HTML + CSS + TypeScript**, com build do **Vite** (`web/`):
  - `index.html`: **criar** a enquete, com 2 a 10 opções. Depois de criar, mostra o link de votação com botão de copiar.
  - `vote.html?id=...`: **votar**. Depois do voto, redireciona para o resultado.
  - `result.html?id=...`: **resultado** com gráfico de barras do **Chart.js**, que se atualiza ao vivo pelo Socket.IO. Mostra porcentagens, total de votos e um indicador "Ao vivo" ou "Reconectando…".
- Ao (re)conectar, a tela de resultado entra na sala e busca a enquete de novo. Assim não perde votos dados durante uma queda de conexão.
- Layout responsivo (a turma vai votar pelo celular) e modo escuro automático.
- Telas de "enquete não encontrada" e "você já votou".
- Testes das funções auxiliares (`web/test/util.test.ts`).
- **Teste de aceite feito:** com duas abas abertas, votar em uma fez o gráfico mudar na outra, sem recarregar. ✔

### Como rodar
```bash
# com a API rodando em outro terminal
cd web
npm install
npm run dev     # http://localhost:5173
npm test
npm run lint
npm run build   # gera web/dist/ (HTML/CSS/JS estáticos)
```

### Provisório ou faltando
- A marca de "já votei" fica no `localStorage`. Isso evita voto duplo por engano, mas não impede fraude (aba anônima, outro navegador ou chamada direta à API).
- As cores do gráfico são lidas do CSS quando a página carrega. Se o sistema trocar entre claro e escuro com a página aberta, o gráfico só se ajusta ao recarregar.

---

## O que a Pessoa 3 (Postgres + Docker) precisa saber

### 1. Trocar a memória pelo Postgres: só `api/src/store.ts` muda
As três funções do store **já são `async`** e as rotas já usam `await`. Basta reimplementar o arquivo mantendo as mesmas assinaturas:

```ts
createPoll(question: string, optionTexts: string[]): Promise<Poll>
getPoll(id: string): Promise<Poll | undefined>          // undefined → a rota responde 404
vote(pollId: string, optionId: string): Promise<Poll | undefined>  // undefined → 404; devolve a enquete com os votos JÁ atualizados
```

- O formato de `Poll` não pode mudar, porque o front depende dele: `{ id, question, options: [{ id, text, votes }] }`.
- **A ordem das opções importa.** Guarde uma coluna `position` e use `ORDER BY position`.
- `vote()` precisa devolver a contagem atualizada, porque é ela que vai no `votes:update`.
- Os IDs hoje são UUIDs. Mantenha UUIDs ou garanta que sejam strings, porque o front trata IDs como texto.
- Se o banco falhar, basta deixar a exceção subir: o Express 5 leva o erro ao middleware, que responde `500` em JSON.

Uma sugestão de tabelas:

```sql
CREATE TABLE polls (
  id         UUID PRIMARY KEY,
  question   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE options (
  id       UUID PRIMARY KEY,
  poll_id  UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  position INT  NOT NULL
);

CREATE TABLE votes (
  id         BIGSERIAL PRIMARY KEY,
  option_id  UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON votes(option_id);
```

Para contar os votos: `SELECT o.id, o.text, COUNT(v.id)::int AS votes FROM options o LEFT JOIN votes v ON v.option_id = o.id WHERE o.poll_id = $1 GROUP BY o.id ORDER BY o.position`. O `::int` é necessário porque `COUNT` volta como string no driver `pg`.

- Crie a enquete e as opções **numa transação**.
- **Testes:** hoje eles usam o store em memória e não precisam de banco. Uma sugestão é escolher a implementação pela variável `DATABASE_URL`: se ela existir, usa Postgres; se não, usa memória. Assim `npm test` continua rodando sem banco e a Pessoa 4 decide se o CI sobe um Postgres. Se preferir que os testes usem o banco, combine com a Pessoa 4.

### 2. Docker da API
- Build com `npm ci && npm run build`, execução com `node dist/server.js` (o mesmo que `npm start`).
- Porta **3000** (variável `PORT`).
- `GET /health` serve para o `healthcheck` do compose.
- Em produção, `CORS_ORIGIN` pode ficar no padrão, porque front e API vão estar na mesma origem atrás do Nginx.

### 3. Docker do front (Nginx)
- `npm ci && npm run build` gera `web/dist/` com **3 HTMLs estáticos** (`index.html`, `vote.html`, `result.html`) e a pasta `assets/`. Não é SPA, então **não precisa** de fallback para `index.html`.
- **O front sempre chama caminhos relativos** (`/api/...` e `/socket.io/...`). O Nginx precisa repassar esses dois caminhos para a API, **com upgrade de WebSocket** no `/socket.io`. Um esboço:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://api:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /socket.io/ {
    proxy_pass http://api:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

  (`api` é o nome do serviço no `docker-compose.yml`.)
- Não precisa definir `VITE_API_URL`. Ele só serve se a API ficar em outro domínio.

### 4. Para conferir que tudo continua funcionando
Depois do `docker compose up`, abra o front, crie uma enquete, abra o resultado em uma aba e vote em outra. O gráfico tem que mudar sozinho. Reinicie os containers e confira se a enquete e os votos continuam lá.

---

## Pendências do GitHub (fazer antes ou junto com a Etapa 3)

Ainda não existe repositório remoto, só o repositório git local com o primeiro commit na `main`.

1. Criar o repositório vazio no GitHub, sem README nem .gitignore, porque eles já existem aqui.
2. Conectar e enviar:
   ```bash
   git remote add origin https://github.com/<usuario>/enquete-tempo-real.git
   git push -u origin main
   ```
3. Em **Settings → Branches → Add rule** (ou *Rulesets*) para a `main`: exigir Pull Request com pelo menos 1 aprovação e bloquear *force push*. A regra "CI precisa passar" entra na Etapa 4.
