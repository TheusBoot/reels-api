FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-inter \
    fonts-noto-color-emoji \
    libnss3 libatk-bridge2.0-0 libgbm1 libasound2 libxss1 libgtk-3-0 \
    ffmpeg ca-certificates curl \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium
RUN pip install --no-cache-dir --break-system-packages piper-tts

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p data/inputs data/outputs voices public/music

# --- Voz do Piper: baixada durante o build, não versionada no git ---
# Isso é o que torna o deploy no Railway "git push e pronto": não precisa
# subir um arquivo binário de 60+MB pro repositório. Pra trocar de voz,
# troque essas duas URLs (veja o catálogo completo em
# huggingface.co/rhasspy/piper-voices) e faça um novo deploy.
ARG PIPER_VOICE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"
ARG PIPER_VOICE_CONFIG_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"
RUN curl -fL -o voices/voice.onnx "$PIPER_VOICE_URL" \
    && curl -fL -o voices/voice.onnx.json "$PIPER_VOICE_CONFIG_URL"

EXPOSE 3000
CMD ["node", "src/server.js"]
