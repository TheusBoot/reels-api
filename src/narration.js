const path = require("path");
const fs = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

// --- Tudo aqui é fixo no servidor. A API não recebe voz nem velocidade do
// cliente — de propósito, conforme pedido: "vai tá tudo configurado".
const PIPER_MODEL = process.env.PIPER_MODEL_PATH || path.resolve(__dirname, "../voices/voice.onnx");
const PIPER_CONFIG = process.env.PIPER_CONFIG_PATH || (PIPER_MODEL + ".json");
const PIPER_RATE = Number(process.env.PIPER_RATE || 1.0); // 1.0 = velocidade normal
const PIPER_LENGTH_SCALE = 1 / Math.max(0.5, Math.min(2.0, PIPER_RATE));

/**
 * Gera um WAV de narração a partir de um texto, usando a voz e velocidade
 * fixas do servidor. Devolve o caminho do arquivo gerado, ou null se o
 * texto vier vazio (nesse caso o vídeo simplesmente sai sem narração).
 */
async function synthesizeNarration(text, outputPath) {
  const clean = (text || "").trim();
  if (!clean) return null;

  await fs.access(PIPER_MODEL).catch(() => {
    throw new Error(
      `Modelo de voz do Piper não encontrado em ${PIPER_MODEL}. Baixe uma voz e configure PIPER_MODEL_PATH (veja o MANUAL.md).`
    );
  });

  // Usamos o pacote piper-tts (Python) via um pequeno script utilitário,
  // em vez de depender do binário `piper` do PATH — assim funciona igual
  // em qualquer sistema onde `pip install piper-tts` tenha rodado.
  const helperScript = path.resolve(__dirname, "piper_cli_helper.py");
  await execFileAsync("python3", [
    helperScript,
    "--model", PIPER_MODEL,
    "--config", PIPER_CONFIG,
    "--length-scale", String(PIPER_LENGTH_SCALE),
    "--output", outputPath,
    "--text", clean,
  ], { maxBuffer: 1024 * 1024 * 20 });

  return outputPath;
}

module.exports = { synthesizeNarration, PIPER_MODEL, PIPER_CONFIG, PIPER_RATE };
