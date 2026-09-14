# Manual — Reels API

API única: você manda **imagem + manchete + descrição**, ela devolve um **vídeo MP4 pronto** (1080×1920, formato Reels/Stories/Shorts) — com narração, abertura estilo jornalístico e música de fundo, tudo já configurado no servidor. Feita pra ser chamada direto do n8n via HTTP.

```
n8n ──POST /v1/videos──▶  Reels API
                              │  (gera narração com Piper, monta o vídeo com Remotion)
n8n ◀──GET /v1/videos/:id── (polling até status = "done")
                              │
                         video_url pronto pra publicar
```

---

## 1. O que você precisa antes de começar

- Uma conta no [Railway](https://railway.com) (recomendado) **ou** um servidor Linux (VPS) com Docker.
- Uma conta no GitHub (pra hospedar o repositório que o Railway vai buildar).
- Opcional: uma música de fundo livre de direitos (`.mp3`), se quiser trilha sonora nos vídeos.

**Você NÃO precisa baixar a voz manualmente** — o `Dockerfile` já baixa uma voz padrão em português (pt-BR, masculina) sozinho, durante o build. Só mexa nisso se quiser trocar de voz (veja o passo 2).

---

## 2. (Opcional) Escolha outra voz do Piper

Por padrão, o projeto já vem configurado com a voz `pt_BR-faber-medium`. Se quiser trocar:

1. Escolha outra voz no catálogo: `huggingface.co/rhasspy/piper-voices` (tem vozes femininas, outros sotaques, etc.)
2. Abra o `Dockerfile` e troque as duas URLs no topo:
   ```dockerfile
   ARG PIPER_VOICE_URL="https://huggingface.co/.../sua-voz.onnx"
   ARG PIPER_VOICE_CONFIG_URL="https://huggingface.co/.../sua-voz.onnx.json"
   ```
3. Pronto — no próximo deploy (`git push` ou `docker compose build`), a nova voz é baixada automaticamente.

> **Dica:** pra ouvir a voz antes de decidir, essas páginas do Hugging Face têm um player de amostra de cada voz.

---

## 3. Organize os arquivos do projeto

Estrutura que você vai commitar no Git:

```
reels-api/
├── .env.example
├── .gitignore
├── .dockerignore
├── docker-compose.yml     ← só usado se você rodar numa VPS própria (seção 5, Opção B)
├── Dockerfile
├── package.json
├── src/            (server.js, render.js, queue.js, narration.js, piper_cli_helper.py)
├── remotion/       (Reel.jsx, Root.jsx, index.jsx, schema.js, components/)
├── voices/         ← fica vazia no Git (a voz é baixada no build — ver .gitignore)
├── public/music/
│   └── bg.mp3      ← opcional: sua música de fundo (essa, sim, precisa ir pro Git)
└── (o resto do projeto, já vem pronto)
```

```bash
git clone https://github.com/seu-usuario/reels-api.git
cd reels-api
cp .env.example .env
# (opcional) copie sua música pra public/music/bg.mp3 e faça o commit dela
```

A pasta `voices/` fica vazia no repositório — o `.gitignore` exclui os arquivos `.onnx` de propósito (são pesados, e o `Dockerfile` já baixa a voz sozinho a cada build, como visto no passo 2).

---

## 4. Configure o `.env`

Abra o `.env` e ajuste:

```bash
API_KEY=escolha-uma-chave-forte-aqui
```

`PUBLIC_BASE_URL` você só precisa definir se for rodar numa VPS própria (Opção B da seção 5) — no Railway ele é detectado sozinho, não precisa colocar no `.env`.

O resto (`PIPER_RATE`, `DEFAULT_MIN_DURATION_SECONDS`, `SHOW_INTRO`, `DEFAULT_FIT_MODE`, `DEFAULT_THEME`) já vem com valores padrão sensatos — só mexa se quiser mudar o estilo global de todos os vídeos. **Nenhuma dessas configurações é exposta na API**; quem chama só manda imagem, manchete e descrição.

| Variável | O que controla | Padrão |
|---|---|---|
| `PIPER_RATE` | Velocidade da narração (1.0 = normal) | `1.0` |
| `DEFAULT_MIN_DURATION_SECONDS` | Duração mínima do vídeo se não houver narração | `10` |
| `SHOW_INTRO` | Se a abertura estilo jornalístico aparece | `true` |
| `INTRO_DURATION_SECONDS` | Duração da abertura | `1.2` |
| `DEFAULT_FIT_MODE` | `contain` (mostra tudo, sem cortar) ou `cover` (preenche, corta bordas) | `contain` |
| `DEFAULT_THEME` | `dark` ou `light` (cor do texto/gradiente) | `dark` |

---

## 5. Suba o servidor

### Opção A — Railway (produção, recomendado)

1. **Suba o projeto pro GitHub** (sem a pasta `voices/*.onnx` — o `.gitignore` já exclui isso, a voz é baixada automaticamente durante o build do Docker, veja o `Dockerfile`).
2. No [railway.com](https://railway.com), crie um projeto novo → **Deploy from GitHub repo** → escolha o repositório.
3. O Railway detecta o `Dockerfile` sozinho e já builda com ele — não precisa configurar nada de build.
4. Vá em **Settings → Variables** e adicione as mesmas variáveis do `.env.example`:
   - `API_KEY` (obrigatório — escolha uma chave forte)
   - `PIPER_RATE`, `DEFAULT_MIN_DURATION_SECONDS`, `SHOW_INTRO`, `INTRO_DURATION_SECONDS`, `DEFAULT_FIT_MODE`, `DEFAULT_THEME` (opcionais, já têm padrão)
   - **Não precisa definir `PUBLIC_BASE_URL`** — a API detecta sozinha o domínio que o Railway gerar (via `RAILWAY_PUBLIC_DOMAIN`, que o Railway já injeta automaticamente).
   - **Não precisa definir `PORT`** — o Railway injeta essa variável sozinho.
5. Vá em **Settings → Networking** e clique em **Generate Domain** pra ter uma URL pública (`https://algo.up.railway.app`).
6. (Opcional, mas recomendado) Em **Settings → Deploy**, defina o **Healthcheck Path** como `/health` — assim o Railway só considera o deploy saudável depois que a API realmente respondeu, evitando trocar de versão no meio de um render em andamento.
7. Espere o build terminar (a primeira vez demora mais — baixa Chromium, Python e a voz). Teste com:
   ```bash
   curl https://algo.up.railway.app/health
   ```

**Sobre a voz:** ela é baixada durante o build do Docker (não fica no seu repositório Git, que ficaria pesado demais). Pra trocar de voz, edite as duas URLs no topo do `Dockerfile` (`PIPER_VOICE_URL` e `PIPER_VOICE_CONFIG_URL` — veja outras opções em `huggingface.co/rhasspy/piper-voices`) e faça um novo deploy.

**Sobre a música de fundo:** como o Railway não tem como montar uma pasta local sua (ele só builda o que está no Git), se você quiser música de fundo, **commite o arquivo `public/music/bg.mp3` no repositório** junto com o resto do código.

**Sobre o armazenamento:** os vídeos gerados ficam em `data/outputs/` dentro do container. Isso é temporário — some se o serviço reiniciar ou fizer um novo deploy. Como os vídeos são consumidos logo em seguida pelo n8n (que baixa o `video_url` na hora), isso normalmente não é problema. Se quiser guardar os vídeos por mais tempo, adicione um **Volume** no Railway apontando pra `/app/data` (Settings → Volumes), ou baixe o vídeo pro seu storage (S3, Google Drive, etc.) logo depois que o n8n receber o `video_url`.

### Opção B — Servidor próprio (VPS) com Docker Compose

Pra rodar numa VPS sua em vez do Railway:

```bash
unzip reels-api.zip   # ou clone do git
cd reels-api
cp .env.example .env
# edite o .env: API_KEY e PUBLIC_BASE_URL (aqui sim precisa definir, ex: https://reels-api.seudominio.com)
docker compose up -d --build
curl http://localhost:3000/health
```

Diferença importante: aqui o `docker-compose.yml` é usado (o Railway ignora esse arquivo por completo — ele só builda o `Dockerfile`). A voz continua sendo baixada no build da mesma forma.

---

## 6. Teste direto com curl

```bash
IMG_B64=$(base64 -w0 sua_imagem.png)   # no Mac: base64 -i sua_imagem.png

curl -X POST http://localhost:3000/v1/videos \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: sua-chave-do-.env" \
  -d "{
    \"headline\": \"Carlos Alberto Parreira recebe alta depois de 80 dias internado\",
    \"description\": \"O ex-técnico da seleção recebeu alta hospitalar nesta terça, após 80 dias internado por uma grave inflamação pulmonar.\",
    \"source_name\": \"Manual da Fofoca\",
    \"image_base64\": \"$IMG_B64\",
    \"image_mime\": \"image/png\"
  }"
```

Resposta: `{"job_id":"...","status":"queued","check_url":"/v1/videos/..."}`

Consulte o andamento:

```bash
curl -H "X-API-KEY: sua-chave-do-.env" http://localhost:3000/v1/videos/SEU_JOB_ID
```

Quando `"status":"done"`, o campo `video_url` traz o link direto do MP4.

---

## 7. Referência da API

### `POST /v1/videos`
Header: `X-API-KEY: <sua chave>`

| Campo | Obrigatório | Descrição |
|---|---|---|
| `headline` | sim | A manchete — texto grande que aparece no vídeo. |
| `description` | não | Texto mais completo, usado pela narração (se não vier, a narração lê a própria `headline`). |
| `source_name` | não | Nome da página/fonte, aparece como selo no canto. |
| `image_base64` | sim | A imagem, em base64. |
| `image_mime` | não | `image/png` (padrão), `image/jpeg` ou `image/webp`. |
| `job_id` | não | Deixe a API gerar sozinha, a menos que você já tenha um id seu. |

Resposta (`202`): `{ "job_id": "...", "status": "queued", "check_url": "..." }`

### `GET /v1/videos/:job_id`
```json
{
  "job_id": "...",
  "status": "queued | rendering | done | error",
  "video_url": "https://.../files/....mp4",
  "duration_seconds": 12.4,
  "narration_used": true,
  "render_ms": 41230,
  "error": null
}
```

### `GET /files/:nome.mp4`
Serve o vídeo pronto (mesma autenticação `X-API-KEY`, ou `?token=` na query).

### `GET /health`
Checagem rápida, sem autenticação.

---

## 8. Como chamar do n8n

Fluxo mínimo com 3 nodes:

1. **HTTP Request (POST)** → `{{PUBLIC_BASE_URL}}/v1/videos`, header `X-API-KEY`, body JSON com `headline`, `description`, `image_base64` (em base64 da sua imagem), `source_name`.
2. **Wait** (15s) → **HTTP Request (GET)** → `{{PUBLIC_BASE_URL}}/v1/videos/{{ $json.job_id }}` — repita esse par em loop até `status` virar `done` (num Switch/IF, voltando pro Wait enquanto `status` for `queued` ou `rendering`).
3. Quando `done`, pegue `video_url` e publique (Blotato, Instagram Graph API, etc.).

Isso é exatamente o padrão dos workflows `workflow_reels.json`/`workflow_reels_v2.json` que já te entreguei antes — os nodes "Submit Render" → "Wait" → "Check Job" apontam para esses mesmos dois endpoints, só que agora o body do POST ficou mais simples (não precisa mais chamar Claude Vision antes, nem montar `audio_base64` manualmente — a API cuida da narração sozinha).

---

## 9. Solução de problemas

| Sintoma | Causa provável |
|---|---|
| `status: error`, mensagem sobre `voice.onnx não encontrado` | Os arquivos da voz não estão em `voices/` dentro do container — confira o volume no `docker-compose.yml`. |
| Vídeo sai sem narração, sem erro | O Piper falhou silenciosamente (ver logs com `docker compose logs -f`) — o vídeo ainda é gerado, só sem áudio, de propósito, pra não travar o pipeline inteiro por causa da voz. |
| `401 unauthorized` | Faltou o header `X-API-KEY` na chamada, ou a chave não bate com o `.env`. |
| Build do Docker muito lento na primeira vez | Normal — baixa Chromium e todas as dependências. Builds seguintes são rápidos (cache). |
| Quero trocar a voz depois | Troque os arquivos em `voices/`, reinicie o container (`docker compose restart`). |
