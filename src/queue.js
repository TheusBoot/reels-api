const fs = require("fs/promises");
const fssync = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const PQueue = require("p-queue").default;
const { renderReelJob, INPUTS_DIR, OUTPUTS_DIR } = require("./render");

const DATA_DIR = path.resolve(__dirname, "../data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

const queue = new PQueue({ concurrency: Number(process.env.JOB_CONCURRENCY || 1) });

let jobs = {};

function loadJobs() {
  try {
    if (fssync.existsSync(JOBS_FILE)) jobs = JSON.parse(fssync.readFileSync(JOBS_FILE, "utf-8"));
  } catch (e) {
    console.error("Falha ao carregar jobs.json, começando do zero:", e.message);
    jobs = {};
  }
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdir(DATA_DIR, { recursive: true })
      .then(() => fs.writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2)))
      .catch((e) => console.error("Falha ao gravar jobs.json:", e.message));
  }, 200);
}

function getJob(jobId) {
  return jobs[jobId] || null;
}

function enqueueJob({ jobId, headline, description, sourceName, imagePath, imageExt }, publicBaseUrl) {
  const id = jobId || uuidv4();

  jobs[id] = {
    job_id: id,
    status: "queued",
    video_url: null,
    error: null,
    render_ms: null,
    duration_seconds: null,
    narration_used: null,
    created_at: new Date().toISOString(),
  };
  persist();

  queue.add(async () => {
    jobs[id].status = "rendering";
    persist();
    try {
      const result = await renderReelJob(id, { headline, description, sourceName, imagePath, imageExt });
      jobs[id].status = "done";
      jobs[id].render_ms = result.renderMs;
      jobs[id].duration_seconds = Math.round(result.durationSeconds * 10) / 10;
      jobs[id].narration_used = result.narrationUsed;
      jobs[id].video_url = `${publicBaseUrl}/files/${path.basename(result.outputLocation)}`;
    } catch (err) {
      console.error(`[job ${id}] erro no render:`, err);
      jobs[id].status = "error";
      jobs[id].error = err.message || String(err);
    } finally {
      persist();
      cleanupFile(imagePath);
    }
  });

  return id;
}

function cleanupFile(p) {
  if (!p) return;
  fs.unlink(p).catch(() => {});
}

async function cleanupOld() {
  const now = Date.now();
  for (const [id, job] of Object.entries(jobs)) {
    const age = now - new Date(job.created_at).getTime();
    if (age > MAX_AGE_MS) {
      delete jobs[id];
      cleanupFile(path.join(OUTPUTS_DIR, `${id}.mp4`));
      cleanupFile(path.join(INPUTS_DIR, `${id}-narracao.wav`));
    }
  }
  persist();
}

loadJobs();
setInterval(cleanupOld, 60 * 60 * 1000);

module.exports = { enqueueJob, getJob, queue };
