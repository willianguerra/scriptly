import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { AUDIO_CUES, PRODUCTION_STYLES } from "../src/lib/production/catalog.ts";
import { resolveOverlappingVisuals } from "../src/lib/production/models.ts";
import { parseSrt, serializeSrt } from "../src/lib/production/subtitles.ts";
import { buildRenderPlan } from "../src/lib/production/render-plan.ts";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const ffprobe = require("ffprobe-static").path;
const prisma = new PrismaClient();
const root = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), "storage", "media"));
const maxClipBytes = 300 * 1024 * 1024;

function run(binary, args, timeoutMs = 20 * 60 * 1000, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk) => { err += chunk.toString(); });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Tempo limite da operação de mídia excedido.")); }, timeoutMs);
    const abort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", abort, { once: true });
    child.on("error", (error) => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer); signal?.removeEventListener("abort", abort);
      if (signal?.aborted) reject(new Error("Exportação cancelada."));
      else if (code === 0) resolve({ out, err });
      else reject(new Error(err.slice(-3000) || `Processo de mídia terminou com código ${code}.`));
    });
  });
}

async function downloadSelectedClip(candidate, destination, signal) {
  const url = new URL(candidate.downloadUrl);
  if (url.protocol !== "https:" || url.hostname !== "videos.pexels.com") throw new Error("Origem de vídeo não autorizada pelo provedor.");
  const response = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(90_000), signal]), redirect: "error" });
  if (!response.ok) throw new Error(`Download do clipe falhou (HTTP ${response.status}).`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxClipBytes) throw new Error("O clipe excede o limite de 300 MB.");
  if (!response.body) throw new Error("Pexels retornou um arquivo de vídeo vazio.");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxClipBytes) { await reader.cancel().catch(() => {}); throw new Error("O clipe excede o limite de 300 MB."); }
    chunks.push(Buffer.from(value));
  }
  if (!length) throw new Error("O clipe está vazio.");
  const bytes = Buffer.concat(chunks, length);
  await writeFile(destination, bytes, { mode: 0o600 });
  return bytes.length;
}

async function processRender(job, signal) {
  const project = await prisma.productionProject.findFirst({ where: { id: job.projectId, userId: job.userId } });
  if (!project) throw new Error("Projeto do job não existe ou não pertence ao usuário.");
  const plan = buildRenderPlan(project);
  const scenes = plan.scenes;
  const narration = plan.narrationPath;
  const workDir = path.resolve(root, "projects", project.id, "render", job.id);
  if (!workDir.startsWith(`${root}${path.sep}`)) throw new Error("Diretório de trabalho inválido.");
  await mkdir(workDir, { recursive: true });
  if (scenes.length > 120) throw new Error("O limite por exportação é 120 cenas.");
  const clips = [];
  let totalDownloaded = 0;
  let timelineStart = 0;
  const visualElements = [];
  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    const candidate = scene.candidates?.find((entry) => entry.id === scene.selectedCandidateId);
    if (!candidate) throw new Error(`A cena ${scene.order} perdeu o clipe selecionado.`);
    const clipPath = path.join(workDir, `clip-${index + 1}.mp4`);
    const bytes = await downloadSelectedClip(candidate, clipPath, signal);
    totalDownloaded += bytes;
    if (totalDownloaded > 2 * 1024 * 1024 * 1024) throw new Error("A mídia desta exportação excede o limite total de 2 GB.");
    const trimIn = Number(scene.trimInSeconds || 0);
    const trimOut = scene.trimOutSeconds == null ? Number(scene.durationSeconds) : Number(scene.trimOutSeconds);
    if (!Number.isFinite(trimIn) || !Number.isFinite(trimOut) || trimOut <= trimIn) throw new Error(`Recorte inválido na cena ${scene.order}.`);
    const clipProbe = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", clipPath], 60_000, signal);
    const clipInfo = JSON.parse(clipProbe.out);
    const sourceDuration = Number(clipInfo.format?.duration);
    if (!clipInfo.streams?.some((stream) => stream.codec_type === "video") || !Number.isFinite(sourceDuration)) throw new Error(`O clipe da cena ${scene.order} não tem uma faixa de vídeo legível.`);
    if (trimIn >= sourceDuration || trimOut > sourceDuration + 0.05) throw new Error(`O clipe da cena ${scene.order} dura ${sourceDuration.toFixed(1)}s; ajuste o recorte para dentro dessa duração.`);
    const duration = trimOut - trimIn;
    clips.push({ clipPath, trimIn, duration });
    if (scene.titleText) visualElements.push({ id: `title-${scene.id}`, type: "title", start: timelineStart, end: Math.min(timelineStart + AUDIO_CUES.titleDurationSeconds, timelineStart + duration), text: scene.titleText });
    timelineStart += duration;
  }
  const narrationCues = project.subtitles ? parseSrt(project.subtitles) : scenes.map((scene, index) => {
    const start = clips.slice(0, index).reduce((sum, clip) => sum + clip.duration, 0);
    return { start, end: start + clips[index].duration, text: scene.scriptText };
  });
  narrationCues.forEach((cue, index) => visualElements.push({ id: `subtitle-${index}`, type: "subtitle", ...cue }));
  const resolvedVisuals = resolveOverlappingVisuals(visualElements);
  const subtitlesPath = path.join(workDir, "captions.srt");
  await writeFile(subtitlesPath, serializeSrt(resolvedVisuals), { mode: 0o600 });
  const narrationPath = path.resolve(root, narration);
  if (!narrationPath.startsWith(`${root}${path.sep}`)) throw new Error("Caminho da narração fora do diretório de mídia.");
  await readFile(narrationPath);
  const resolveTrack = async (track) => {
    if (!track || typeof track.path !== "string") return null;
    const fullPath = path.resolve(root, track.path);
    if (!fullPath.startsWith(`${root}${path.sep}`)) throw new Error("Caminho de faixa fora do diretório de mídia.");
    await readFile(fullPath);
    return { ...track, fullPath };
  };
  const music = await resolveTrack(project.music);
  const effects = await Promise.all((Array.isArray(project.effects) ? project.effects : []).map(resolveTrack));
  const { narrationVolume, musicVolume, effectsVolume, ducking } = plan.audioMix;
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  if (totalDuration > 7200) throw new Error("A duração editada excede o limite de 2 horas.");
  const { width, height } = plan;
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const clip of clips) args.push("-ss", String(clip.trimIn), "-i", clip.clipPath);
  args.push("-i", narrationPath);
  if (music) args.push("-stream_loop", "-1", "-i", music.fullPath);
  const effectInputs = [];
  for (const effect of effects) {
    if (!effect) continue;
    effectInputs.push({ index: clips.length + 1 + (music ? 1 : 0) + effectInputs.length, effect });
    args.push("-i", effect.fullPath);
  }
  const filters = [];
  clips.forEach((clip, index) => {
    filters.push(`[${index}:v]trim=duration=${clip.duration},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[v${index}]`);
  });
  filters.push(`${clips.map((_, index) => `[v${index}]`).join("")}concat=n=${clips.length}:v=1:a=0[vcat]`);
  const audioParts = [];
  filters.push(`[${clips.length}:a]volume=${narrationVolume},aresample=48000[narr]`);
  if (music) {
    const musicInputIndex = clips.length + 1;
    const fadeIn = Math.min(AUDIO_CUES.musicFadeInSeconds, totalDuration);
    const fadeOut = Math.min(AUDIO_CUES.musicFadeOutSeconds, totalDuration);
    const musicFilter = `[${musicInputIndex}:a]volume=${musicVolume},aresample=48000,atrim=duration=${totalDuration},afade=t=in:d=${fadeIn},afade=t=out:st=${Math.max(0, totalDuration - fadeOut)}:d=${fadeOut}[music]`;
    if (ducking > 0) filters.push(`${musicFilter};[music][narr]sidechaincompress=threshold=${AUDIO_CUES.duckThreshold}:ratio=${1 + AUDIO_CUES.duckRatioMultiplier * ducking}:attack=${AUDIO_CUES.duckAttackMs}:release=${AUDIO_CUES.duckReleaseMs}[mixmusic]`);
    else filters.push(musicFilter.replace("[music]", "[mixmusic]"));
    audioParts.push("[narr]", "[mixmusic]");
  } else audioParts.push("[narr]");
  effectInputs.forEach(({ index, effect }, effectIndex) => {
    const delay = Math.round(Math.max(0, Math.min(totalDuration, Number(effect.startSeconds || 0))) * 1000);
    filters.push(`[${index}:a]volume=${effectsVolume},aresample=48000,adelay=${delay}|${delay},atrim=duration=${totalDuration}[effect${effectIndex}]`);
    audioParts.push(`[effect${effectIndex}]`);
  });
  filters.push(`${audioParts.join("")}amix=inputs=${audioParts.length}:duration=first:normalize=0,alimiter=limit=${AUDIO_CUES.limiter}[aout]`);
  const style = PRODUCTION_STYLES[project.style] || PRODUCTION_STYLES.dossie;
  const filterPath = subtitlesPath.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
  filters.push(`[vcat]subtitles='${filterPath}':force_style='FontName=Arial,FontSize=${style.fontSize},PrimaryColour=${style.primaryColour},BackColour=${style.backColour},Outline=2,MarginV=${style.marginV},Alignment=${style.alignment}'[vout]`);
  args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]", "-threads", "4", "-fs", "2147483648", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart");
  const outputPath = path.join(workDir, "final.mp4");
  args.push(outputPath);
  await run(ffmpeg, args, 20 * 60 * 1000, signal);
  const outputInfo = await stat(outputPath);
  if (outputInfo.size >= 2 * 1024 * 1024 * 1024) throw new Error("A exportação alcançou o limite de 2 GB; reduza a resolução ou o conteúdo.");
  const probe = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", outputPath], 60_000, signal);
  const metadata = JSON.parse(probe.out);
  if (!metadata.streams?.some((stream) => stream.codec_type === "video") || !metadata.streams?.some((stream) => stream.codec_type === "audio") || !(Number(metadata.format?.duration) > 0)) throw new Error("A exportação não contém vídeo e áudio válidos.");
  return { outputPath: path.relative(root, outputPath), bytes: outputInfo.size };
}

async function claimJob() {
  const job = await prisma.productionJob.findFirst({ where: { status: "waiting", kind: "render" }, orderBy: { createdAt: "asc" } });
  if (!job) return null;
  const claim = await prisma.productionJob.updateMany({ where: { id: job.id, status: "waiting" }, data: { status: "processing", progress: 1, attempts: { increment: 1 }, startedAt: new Date(), error: null } });
  return claim.count ? job : null;
}

async function loop() {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000);
  const stale = await prisma.productionJob.updateMany({ where: { status: "processing", attempts: { lt: 3 }, updatedAt: { lt: cutoff } }, data: { status: "waiting", progress: 0, error: "Worker reiniciado; job devolvido à fila." } });
  await prisma.productionJob.updateMany({ where: { status: "processing", attempts: { gte: 3 }, updatedAt: { lt: cutoff } }, data: { status: "error", error: "Worker foi reiniciado repetidamente; tente novamente manualmente.", finishedAt: new Date() } });
  if (stale.count) console.log(`${stale.count} job(s) retomados após reinício do worker.`);
  console.log("Scriptly production worker ativo; aguardando jobs.");
  while (true) {
    const job = await claimJob();
    if (!job) { await new Promise((resolve) => setTimeout(resolve, 2500)); continue; }
    const abortController = new AbortController();
    const heartbeat = setInterval(async () => {
      const active = await prisma.productionJob.findUnique({ where: { id: job.id }, select: { status: true } }).catch(() => null);
      if (active?.status === "cancelled") abortController.abort();
      else await prisma.productionJob.updateMany({ where: { id: job.id, status: "processing" }, data: { progress: 50 } }).catch(console.error);
    }, 15_000);
    try {
      const rendered = await processRender(job, abortController.signal);
      await prisma.$transaction(async (tx) => {
        const completed = await tx.productionJob.updateMany({ where: { id: job.id, status: "processing" }, data: { status: "completed", progress: 100, outputPath: rendered.outputPath, finishedAt: new Date() } });
        if (completed.count) await tx.productionProject.updateMany({ where: { id: job.projectId, userId: job.userId }, data: { status: "completed", stage: "export", outputPath: rendered.outputPath, lastError: null } });
      });
      console.log(`Job ${job.id} concluído: ${rendered.outputPath} (${rendered.bytes} bytes)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida de renderização.";
      await prisma.$transaction(async (tx) => {
        const failed = await tx.productionJob.updateMany({ where: { id: job.id, status: "processing" }, data: { status: "error", error: message.slice(0, 4000), finishedAt: new Date() } });
        if (failed.count && !abortController.signal.aborted) await tx.productionProject.updateMany({ where: { id: job.projectId, userId: job.userId }, data: { status: "error", stage: "render", lastError: message.slice(0, 4000) } });
      });
      if (!abortController.signal.aborted) console.error(`Job ${job.id} falhou: ${message}`);
    } finally { clearInterval(heartbeat); }
  }
}

process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
loop().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
