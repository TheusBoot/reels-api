require("dotenv").config();
const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const { enqueueJob, getJob, queue } = require("./queue");
const { INPUTS_DIR } = require("./render");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// O Remotion renderiza a imagem via file:// direto no Chromium (funciona),
// mas pra colar o áudio da narração no MP4 final ele baixa o arquivo via
// HTTP — file:// não é aceito nesse passo. Servimos os inputs aqui, restrito
// a loopback, só pra esse uso interno (o Chromium roda no mesmo container).
app.use(
  "/internal/inputs",
  (req, res, next) => {
    const ip = req.socket.remoteAddress || "";
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) {
      return res.status(403).end();
    }
    next();
  },
  express.static(INPUTS_DIR)
);

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";
// No Railway, o domínio público fica em RAILWAY_PUBLIC_DOMAIN (sem
// protocolo). Se você não definir PUBLIC_BASE_URL manualmente, usamos essa
// variável automaticamente — assim o video_url devolvido pela API já sai
// certo sem precisar configurar nada extra no Railway.
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`);

function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // sem key configurada = modo dev, sem auth
  const provided = req.header("X-API-KEY") || req.query.token;
  if (provided !== API_KEY) return res.status(401).json({ error: "unauthorized" });
  next();
}

// --- contrato da API: só o essencial. Voz/velocidade/tema/etc já vêm
// pré-configurados no servidor (ver .env e MANUAL.md) ---
const createVideoSchema = z.object({
  job_id: z.string().optional(),
  headline: z.string().min(1).max(220),
  description: z.string().max(1000).optional(),
  source_name: z.string().max(60).optional(),
  image_base64: z.string().min(10),
  image_mime: z.string().default("image/png"),
});

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

app.get("/health", (req, res) => {
  res.json({ ok: true, queue_size: queue.size, active: queue.pending });
});

app.post("/v1/videos", requireApiKey, async (req, res) => {
  const parsed = createVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  const body = parsed.data;
  const jobId = body.job_id || uuidv4();

  try {
    await fs.mkdir(INPUTS_DIR, { recursive: true });
    const imgExt = EXT_BY_MIME[body.image_mime] || "png";
    const imagePath = path.join(INPUTS_DIR, `${jobId}.${imgExt}`);
    await fs.writeFile(imagePath, Buffer.from(body.image_base64, "base64"));

    enqueueJob(
      {
        jobId,
        headline: body.headline,
        description: body.description,
        sourceName: body.source_name,
        imagePath,
        imageExt: imgExt,
      },
      PUBLIC_BASE_URL
    );

    res.status(202).json({ job_id: jobId, status: "queued", check_url: `/v1/videos/${jobId}` });
  } catch (err) {
    console.error("Erro ao aceitar job:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

app.get("/v1/videos/:jobId", requireApiKey, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "not_found" });
  res.json(job);
});

app.get("/files/:name", requireApiKey, (req, res) => {
  if (!/^[a-zA-Z0-9._-]+\.mp4$/.test(req.params.name)) {
    return res.status(400).json({ error: "invalid_filename" });
  }
  const filePath = path.resolve(__dirname, "../data/outputs", req.params.name);
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: "not_found" });
  });
});

app.listen(PORT, () => {
  console.log(`Reels API ouvindo na porta ${PORT}`);
  console.log(`PUBLIC_BASE_URL=${PUBLIC_BASE_URL}`);
  if (!API_KEY) console.warn("AVISO: API_KEY não definida — API sem autenticação.");
});
