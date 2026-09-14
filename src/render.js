const path = require("path");
const fs = require("fs/promises");
const fssync = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");
const { reelSchema } = require("../remotion/schema");
const { synthesizeNarration } = require("./narration");

const FPS = 30;
const ENTRY_POINT = path.resolve(__dirname, "../remotion/index.jsx");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const INPUTS_DIR = path.resolve(__dirname, "../data/inputs");
const OUTPUTS_DIR = path.resolve(__dirname, "../data/outputs");

// --- Defaults do servidor (nada disso é exposto na API) ---
const DEFAULT_MIN_DURATION_SECONDS = Number(process.env.DEFAULT_MIN_DURATION_SECONDS || 10);
const INTRO_DURATION_SECONDS = Number(process.env.INTRO_DURATION_SECONDS || 1.2);
const SHOW_INTRO_DEFAULT = process.env.SHOW_INTRO !== "false"; // true por padrão
const DEFAULT_FIT_MODE = process.env.DEFAULT_FIT_MODE === "cover" ? "cover" : "contain";
const DEFAULT_THEME = process.env.DEFAULT_THEME === "light" ? "light" : "dark";
const MAX_AUDIO_DRIVEN_SECONDS = 120; // teto de segurança
const INTRO_PHRASES = [
  "OLHA SÓ O QUE ESTÁ BOMBANDO",
  "VEJA O QUE ESTÁ EM ALTA",
  "ISSO ESTÁ REPERCUTINDO NAS REDES",
  "ATENÇÃO: TODO MUNDO ESTÁ COMENTANDO ISSO",
];

let bundleLocationPromise = null;
function getBundle() {
  if (!bundleLocationPromise) {
    bundleLocationPromise = bundle({ entryPoint: ENTRY_POINT, publicDir: PUBLIC_DIR, onProgress: () => {} });
  }
  return bundleLocationPromise;
}

function pickIntroPhrase() {
  return INTRO_PHRASES[Math.floor(Math.random() * INTRO_PHRASES.length)];
}

function hasBackgroundMusic() {
  return fssync.existsSync(path.join(PUBLIC_DIR, "music", "bg.mp3"));
}

/**
 * @remotion/media-utils' getAudioDurationInSeconds só funciona dentro do
 * navegador (usa um elemento <audio> internamente) — não roda no processo
 * Node do servidor. Usamos o ffprobe (já vem com o ffmpeg instalado no
 * container) pra medir a duração de qualquer áudio de forma confiável.
 */
async function getAudioDurationSeconds(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const seconds = parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe não conseguiu determinar a duração de ${filePath}`);
  }
  return seconds;
}

/**
 * Ponto de entrada principal: recebe o payload já validado pelo server.js
 * (imagem + manchete + descrição opcional), gera a narração com o Piper
 * (voz/velocidade fixas do servidor), calcula a duração, e renderiza com
 * o Remotion. Tudo com defaults de estilo já configurados.
 */
async function renderReelJob(jobId, { headline, description, sourceName, imagePath, imageExt }) {
  await fs.mkdir(OUTPUTS_DIR, { recursive: true });

  // A narração lê a "descrição" se ela vier (texto mais natural pra falar);
  // se não vier, lê a própria manchete.
  const narrationText = (description && description.trim()) || headline;
  const narrationPath = path.join(INPUTS_DIR, `${jobId}-narracao.wav`);
  let audioPath = null;
  try {
    audioPath = await synthesizeNarration(narrationText, narrationPath);
  } catch (err) {
    console.error(`[job ${jobId}] Falha ao gerar narração, seguindo sem áudio:`, err.message);
    audioPath = null;
  }

  let narrationSeconds = 0;
  if (audioPath) {
    narrationSeconds = Math.min(await getAudioDurationSeconds(audioPath), MAX_AUDIO_DRIVEN_SECONDS);
  }

  const mainSeconds = Math.max(DEFAULT_MIN_DURATION_SECONDS, narrationSeconds);
  const introSeconds = SHOW_INTRO_DEFAULT ? INTRO_DURATION_SECONDS : 0;
  const totalSeconds = introSeconds + mainSeconds;

  const durationInFrames = Math.round(totalSeconds * FPS);
  const introDurationInFrames = Math.round(introSeconds * FPS);

  const musicPath = hasBackgroundMusic() ? path.join(PUBLIC_DIR, "music", "bg.mp3") : null;

  const inputProps = reelSchema.parse({
    headline,
    sourceName: sourceName || "",
    imageSrc: fileUrl(imagePath),
    audioSrc: audioPath ? fileUrl(audioPath) : null,
    musicSrc: musicPath ? "music/bg.mp3" : null, // staticFile() resolve relativo ao publicDir
    introText: pickIntroPhrase(),
    showIntro: SHOW_INTRO_DEFAULT,
    fitMode: DEFAULT_FIT_MODE,
    theme: DEFAULT_THEME,
    durationInFrames,
    introDurationInFrames,
  });

  const serveUrl = await getBundle();
  const browserExecutable = process.env.REMOTION_CHROME_EXECUTABLE || undefined;

  const chromiumOptions = { gl: "swangle", enableMultiProcessOnLinux: true };
  const composition = await selectComposition({ serveUrl, id: "Reel", inputProps, browserExecutable, chromiumOptions });

  const outputLocation = path.join(OUTPUTS_DIR, `${jobId}.mp4`);
  const start = Date.now();

  await renderMedia({
    composition: { ...composition, durationInFrames },
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    inputProps,
    outputLocation,
    browserExecutable,
    // Railway (e outros PaaS sem GPU) rodam CPU compartilhada — "swangle"
    // (renderização por software) é mais estável aqui do que "angle", que
    // espera aceleração de GPU. enableMultiProcessOnLinux é a recomendação
    // oficial do Remotion para Docker (senão o Chromium roda em modo
    // --single-process, mais lento e mais propenso a travar).
    concurrency: Number(process.env.RENDER_CONCURRENCY || 2),
    crf: 20,
    x264Preset: "veryfast",
    chromiumOptions,
  });

  return {
    outputLocation,
    renderMs: Date.now() - start,
    durationSeconds: totalSeconds,
    narrationUsed: !!audioPath,
  };
}

function fileUrl(absPath) {
  return `file://${absPath}`;
}

module.exports = { renderReelJob, INPUTS_DIR, OUTPUTS_DIR, FPS };
