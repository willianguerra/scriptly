import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScenesFromScript,
  rankCandidate,
  transitionJob,
  productionProjectWhere,
  resolveOverlappingVisuals,
  sceneSchema,
} from "./models.ts";
import { parseSrt, serializeSrt } from "./subtitles.ts";
import { parseStructuredScenePlan } from "./planner.ts";
import { isAuthorizedPexelsDownload, searchPexelsVideos } from "./pexels-adapter.ts";
import { requestVoiceAudio } from "./voice-adapter.ts";
import { buildRenderPlan } from "./render-plan.ts";
import { audioExtensionForMime, readBodyAtMost } from "./body-limit.ts";

test("turns a script into ordered, timed scene cards with bilingual queries", () => {
  const scenes = buildScenesFromScript(
    "A hammerhead shark swims over a reef. Its wide head helps it find prey.",
    60
  );
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].order, 1);
  assert.equal(scenes[0].startSeconds, 0);
  assert.ok(scenes[1].startSeconds > scenes[0].startSeconds);
  assert.ok(scenes[0].searchQueries.some((query) => query.language === "en"));
  assert.ok(sceneSchema.safeParse(scenes[0]).success);
});

test("ranks direct visual evidence above vague title overlap and flags low confidence", () => {
  const strong = rankCandidate({
    scene: { subject: "hammerhead shark", action: "swimming", environment: "ocean", exactSubject: true },
    candidate: { title: "Hammerhead shark swimming", tags: ["hammerhead", "shark", "underwater"], description: "Hammerhead shark swims underwater" },
  });
  const weak = rankCandidate({
    scene: { subject: "hammerhead shark", action: "swimming", environment: "ocean", exactSubject: true },
    candidate: { title: "Ocean life", tags: ["ocean"], description: "Blue water" },
  });
  assert.ok(strong.score > weak.score);
  assert.equal(strong.confidence, "high");
  assert.equal(weak.confidence, "low");
  assert.equal(weak.exactSubjectVerified, false);
});

test("retries failed production jobs and rejects invalid state transitions", () => {
  assert.deepEqual(transitionJob("error", "waiting"), { status: "waiting", progress: 0 });
  assert.deepEqual(transitionJob("processing", "cancelled"), { status: "cancelled", progress: 0 });
  assert.throws(() => transitionJob("completed", "processing"));
  assert.deepEqual(transitionJob("processing", "completed"), { status: "completed", progress: 100 });
});

test("production resource lookup always includes the owner", () => {
  assert.deepEqual(productionProjectWhere("p1", "u1"), { id: "p1", userId: "u1" });
});

test("deterministically resolves overlapping titles and captions by configured priority", () => {
  const resolved = resolveOverlappingVisuals([
    { id: "caption", type: "caption", start: 1, end: 4, text: "line" },
    { id: "title", type: "title", start: 1, end: 3, text: "Hammerhead" },
    { id: "callout", type: "callout", start: 2, end: 5, text: "wide head" },
  ]);
  assert.deepEqual(resolved.map((item) => [item.id, item.start, item.end]), [["title", 1, 3], ["callout", 3, 5]]);
  assert.equal(resolved[0].priority, 400);
  const captionWinsWhenConfiguredAboveTitle = resolveOverlappingVisuals([
    { id: "title", type: "title", start: 0, end: 2, text: "title" },
    { id: "caption", type: "caption", start: 0, end: 2, text: "caption" },
  ], { title: 10, callout: 30, caption: 40, subtitle: 20 });
  assert.equal(captionWinsWhenConfiguredAboveTitle[0].id, "caption");
});

test("parses and serializes caption timestamps without losing text", () => {
  const parsed = parseSrt("1\n00:00:01,250 --> 00:00:02,750\nThe shark swims.\n");
  assert.deepEqual(parsed, [{ start: 1.25, end: 2.75, text: "The shark swims." }]);
  assert.match(serializeSrt(parsed), /00:00:01,250 --> 00:00:02,750/);
});

test("validates and converts a structured scene plan from script output", () => {
  const plan = parseStructuredScenePlan(JSON.stringify({ scenes: [{ scriptText: "A shark swims.", durationSeconds: 8, subject: "hammerhead shark", action: "swimming", environment: "reef", visualIntent: "wide head close-up", exactSubject: true, searchQueries: [{ language: "en", query: "hammerhead shark reef" }, { language: "pt-BR", query: "tubarão-martelo recife" }], avoidTerms: ["animation"], titleText: "Hammerhead" }] }));
  assert.equal(plan[0].id, "scene-1");
  assert.equal(plan[0].endSeconds, 8);
  assert.equal(plan[0].exactSubject, true);
  assert.equal(plan[0].candidates.length, 0);
  assert.throws(() => parseStructuredScenePlan("No valid scene data."));
});

test("Pexels media adapter filters unsafe sources and records license with low visual confidence", async () => {
  const apiPayload = { videos: [
    { id: 9, url: "https://www.pexels.com/video/shark-9/", image: "https://videos.pexels.com/thumb.jpg", duration: 8, user: { name: "Creator", url: "https://www.pexels.com/@creator" }, video_files: [{ width: 1920, height: 1080, file_type: "video/mp4", link: "https://videos.pexels.com/video-files/9/clip.mp4" }] },
    { id: 10, url: "https://www.pexels.com/video/unsafe-10/", image: "https://videos.pexels.com/thumb.jpg", duration: 4, user: { name: "Creator", url: "https://www.pexels.com/@creator" }, video_files: [{ width: 1920, height: 1080, file_type: "video/mp4", link: "https://evil.invalid/video-files/clip.mp4" }] },
  ] };
  let requestedUrl = "";
  const found = await searchPexelsVideos("hammerhead shark", "test-key", async (url, init) => {
    requestedUrl = url.toString();
    assert.equal(new Headers(init.headers).get("authorization"), "test-key");
    return new Response(JSON.stringify(apiPayload), { headers: { "Content-Type": "application/json" } });
  });
  assert.match(requestedUrl, /v1\/videos\/search/);
  assert.equal(found.length, 1);
  assert.equal(found[0].confidence, "low");
  assert.equal(found[0].exactSubjectVerified, false);
  assert.match(found[0].licenseUrl!, /pexels.com\/license/);
  assert.equal(isAuthorizedPexelsDownload("https://videos.pexels.com/video-files/9/clip.mp4"), true);
  assert.equal(isAuthorizedPexelsDownload("http://videos.pexels.com/video-files/9/clip.mp4"), false);
  assert.equal(isAuthorizedPexelsDownload("https://evil.invalid/video-files/clip.mp4"), false);
});

test("VoiceStudio adapter calls the configured OpenAI-compatible endpoint and returns real audio bytes", async () => {
  let endpoint = "";
  let requestBody: Record<string, string> = {};
  const result = await requestVoiceAudio({ baseUrl: "https://voice.example.internal", apiKey: "secret", model: "studio-voice" }, { text: "Hello", voice: "narrator", language: "en" }, async (url, init) => {
    endpoint = url.toString();
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer secret");
    requestBody = JSON.parse(String(init.body));
    return new Response(Buffer.from([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  });
  assert.equal(endpoint, "https://voice.example.internal/v1/audio/speech");
  assert.equal(requestBody.model, "studio-voice");
  assert.deepEqual([...result.audio], [1, 2, 3]);
  await assert.rejects(() => requestVoiceAudio({ baseUrl: "" }, { text: "Hello", voice: "x", language: "en" }), /VOICESTUDIO_BASE_URL/);
  await assert.rejects(() => requestVoiceAudio({ baseUrl: "https://voice.example.internal" }, { text: "Hello", voice: "x", language: "en" }, async () => new Response("bad", { headers: { "Content-Type": "text/plain" } })), /recognized|reconhecido/i);
});

test("render adapter validates ownership-safe selected sources, trims, resolution, and audio levels", () => {
  const scene = buildScenesFromScript("A hammerhead shark swims over the reef.")[0];
  const candidate = {
    id: "pexels-1", provider: "pexels", sourceUrl: "https://www.pexels.com/video/shark/", previewUrl: "https://videos.pexels.com/thumb.jpg",
    downloadUrl: "https://videos.pexels.com/video-files/1/clip.mp4", title: "Shark", creator: "Creator", creatorUrl: "https://www.pexels.com/@creator",
    license: "Pexels License", licenseUrl: "https://www.pexels.com/license/", attribution: "Video by Creator via Pexels", durationSeconds: 20,
    width: 1920, height: 1080, tags: [], score: 0.1, confidence: "low", justification: "Review clip", exactSubjectVerified: false,
  };
  const selected = { ...scene, candidates: [candidate], selectedCandidateId: candidate.id, trimInSeconds: 2, trimOutSeconds: 7 };
  const plan = buildRenderPlan({ scenes: [selected], narration: { path: "projects/p1/narration.mp3" }, aspectRatio: "16:9", renderSettings: { width: 1280, height: 720, audioMix: { narrationVolume: 1.2, musicVolume: 0.4, effectsVolume: 1, ducking: 0.7 } } });
  assert.equal(plan.durationSeconds, 5);
  assert.equal(plan.width, 1280);
  assert.equal(plan.height, 720);
  assert.equal(plan.audioMix.musicVolume, 0.4);
  assert.throws(() => buildRenderPlan({ scenes: [{ ...selected, candidates: [] }], narration: { path: "n.mp3" }, aspectRatio: "16:9", renderSettings: {} }), /não tem um clipe/);
  assert.throws(() => buildRenderPlan({ scenes: [{ ...selected, trimOutSeconds: 25 }], narration: { path: "n.mp3" }, aspectRatio: "16:9", renderSettings: {} }), /excede a duração/);
});

test("bounded upload reader accepts in-limit bodies and rejects declared or streamed oversized bodies", async () => {
  const accepted = await readBodyAtMost(new Request("https://scriptly.test", { method: "POST", body: "audio" }), 5);
  assert.equal(accepted.toString(), "audio");
  await assert.rejects(() => readBodyAtMost(new Request("https://scriptly.test", { method: "POST", headers: { "content-length": "6" }, body: "audio!" }), 5), /BODY_TOO_LARGE/);
  const streamed = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.enqueue(new Uint8Array([4, 5, 6])); controller.close(); } });
  await assert.rejects(() => readBodyAtMost(new Request("https://scriptly.test", { method: "POST", body: streamed, duplex: "half" } as RequestInit), 5), /BODY_TOO_LARGE/);
});

test("audio upload extensions follow supported MIME types", () => {
  assert.equal(audioExtensionForMime("audio/wav"), "wav");
  assert.equal(audioExtensionForMime("audio/mp4"), "m4a");
  assert.equal(audioExtensionForMime("audio/webm"), "webm");
  assert.equal(audioExtensionForMime("audio/mpeg"), "mp3");
});
