"use client";

import * as React from "react";
import Image from "next/image";
import { AlertCircle, Check, Clapperboard, Download, LoaderCircle, Plus, RefreshCw, Search, Sparkles, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sceneListSchema, type ProductionScene } from "@/lib/production/models";
import { AUDIO_MIX_DEFAULTS, PRODUCTION_STYLES } from "@/lib/production/catalog";
import { audioBufferToMono16k, decodeAudioFile, sliceAudioBuffer } from "@/lib/audioUtils";
import { transcribeSamplesWithTimestamps } from "@/lib/whisper-browser";
import { agruparPalavras, segmentosParaSRT } from "@/lib/roteiro/sync";

type ProjectListItem = { id: string; title: string; language: string; status: string; stage: string; updatedAt: string; lastError: string | null };
type StoredAudioTrack = { path?: string; title?: string; license?: string; attribution?: string; startSeconds?: number };
type Project = ProjectListItem & { brief: string; script: string; provider: string; aspectRatio: string; style: string; scenes: ProductionScene[]; narration: { path?: string; provider?: string; voice?: string } | null; subtitles: string | null; music: StoredAudioTrack | null; effects: StoredAudioTrack[] | null; renderSettings: { audioMix?: { narrationVolume: number; musicVolume: number; effectsVolume: number; ducking: number } } | null; jobs: { id: string; status: string; progress: number; error: string | null }[] };

const statusName: Record<string, string> = { waiting: "Aguardando worker", processing: "Processando", completed: "Concluído", error: "Falhou", cancelled: "Cancelado" };
const exampleBrief = "Create an engaging wildlife documentary explaining how famous shark species got their names. Opening: dramatic underwater footage in a deep blue ocean. Featured sharks: Great White Shark, Hammerhead Shark, Tiger Shark, Bull Shark, Whale Shark, Goblin Shark, Mako Shark, Thresher Shark, Nurse Shark, Cookiecutter Shark. For each, include cinematic underwater footage, its name, an explanation of the origin and meaning, and one interesting fact. Mark claims without sources for editorial review.";

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha na solicitação (${response.status}).`);
  return data as T;
}

export function ProductionStudio() {
  const [projects, setProjects] = React.useState<ProjectListItem[]>([]);
  const [project, setProject] = React.useState<Project | null>(null);
  const [title, setTitle] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [script, setScript] = React.useState("");
  const [language, setLanguage] = React.useState("portuguese");
  const [provider, setProvider] = React.useState("openai");
  const [duration, setDuration] = React.useState("600");
  const [resolution, setResolution] = React.useState("1080");
  const [aspect, setAspect] = React.useState("16:9");
  const [style, setStyle] = React.useState("dossie");
  const [voice, setVoice] = React.useState("alloy");
  const [license, setLicense] = React.useState("");
  const [attribution, setAttribution] = React.useState("");
  const [effectStart, setEffectStart] = React.useState("0");
  const [voiceAvailable, setVoiceAvailable] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [planning, setPlanning] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [modelProgress, setModelProgress] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [searching, setSearching] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refreshList = React.useCallback(async () => {
    const data = await readJson<ProjectListItem[]>(await fetch("/api/production/projects", { cache: "no-store" }));
    setProjects(data);
  }, []);
  const openProject = React.useCallback(async (id: string) => {
    setLoading(true); setError("");
    try {
      const data = await readJson<Project>(await fetch(`/api/production/projects/${id}`, { cache: "no-store" }));
      const scenes = sceneListSchema.parse(data.scenes);
      setProject({ ...data, scenes }); setTitle(data.title); setScript(data.script); setBrief(data.brief); setLanguage(data.language);
      setProvider(data.provider);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao abrir projeto."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => {
    refreshList().catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar projetos."));
    fetch("/api/production/voice-status").then((r) => r.ok ? r.json() : null).then((d) => setVoiceAvailable(Boolean(d?.available))).catch(() => undefined);
  }, [refreshList]);

  async function createProject(event: React.FormEvent) {
    event.preventDefault(); setCreating(true); setError(""); setNotice("");
    try {
      const created = await readJson<{ id: string }>(await fetch("/api/production/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, brief: brief || undefined, script: script || undefined, language, provider, targetSeconds: Number(duration), aspectRatio: aspect, resolution, style }) }));
      await refreshList(); await openProject(created.id); setNotice("Projeto salvo. As cenas estão prontas para buscar mídia.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao criar projeto."); }
    finally { setCreating(false); }
  }

  async function searchScene(scene: ProductionScene) {
    setSearching(scene.id); setError(""); setNotice("");
    try {
      const result = await readJson<{ sceneId: string; candidates: ProductionScene["candidates"] }>(await fetch(`/api/production/projects/${project!.id}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sceneId: scene.id, query: scene.searchQueries[0]?.query }) }));
      setProject((current) => current ? { ...current, scenes: current.scenes.map((item) => item.id === result.sceneId ? { ...item, candidates: result.candidates, status: result.candidates.length ? "ready" : "waiting" } : item) } : current);
      setNotice(`${result.candidates.length} opções encontradas. Confira cada prévia antes de usar.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na busca de mídia."); }
    finally { setSearching(null); }
  }

  async function planScenes() {
    if (!project || provider === "fake") return;
    setPlanning(true); setError("");
    try {
      const result = await readJson<{ scenes: ProductionScene[] }>(await fetch(`/api/production/projects/${project.id}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) }));
      const scenes = sceneListSchema.parse(result.scenes);
      setProject((current) => current ? { ...current, scenes, provider, status: "waiting" } : current);
      setNotice("Plano de cenas atualizado. A chamada ao provider foi cobrada conforme sua conta.");
      await refreshList();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao planejar cenas."); }
    finally { setPlanning(false); }
  }

  async function saveProject(override: { subtitles?: string } = {}) {
    if (!project) return false;
    setSaving(true); setError("");
    try {
      const editedScript = project.scenes.map((scene) => scene.scriptText).join("\n\n");
      const saved = await readJson<Project>(await fetch(`/api/production/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, script: editedScript, scenes: project.scenes, subtitles: override.subtitles ?? project.subtitles, renderSettings: project.renderSettings }) }));
      setProject((current) => current ? { ...current, ...saved, scenes: project.scenes } : current);
      setScript(editedScript); await refreshList(); setNotice("Alterações salvas."); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar."); return false; }
    finally { setSaving(false); }
  }

  function patchScene(sceneId: string, patch: Partial<ProductionScene>) {
    setProject((current) => current ? { ...current, scenes: current.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...patch } : scene) } : current);
  }

  async function generateVoice() {
    if (!project) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const text = project.scenes.map((scene) => scene.scriptText).join("\n\n");
      if (!(await saveProject())) return;
      const result = await readJson<{ bytes: number; provider: string }>(await fetch(`/api/production/projects/${project.id}/narration/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) }));
      setProject((current) => current ? { ...current, narration: { path: "ready", provider: result.provider, voice } } : current);
      setNotice(`Narração gerada pelo VoiceStudio (${Math.round(result.bytes / 1024)} KB).`);
      await refreshList();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao gerar narração."); }
    finally { setLoading(false); }
  }

  async function uploadAudio(file: File | undefined) {
    if (!project || !file) return;
    setLoading(true); setError("");
    try {
      await readJson(await fetch(`/api/production/projects/${project.id}/narration`, { method: "POST", headers: { "Content-Type": file.type || "audio/mpeg" }, body: file }));
      setProject((current) => current ? { ...current, narration: { path: "ready", provider: "arquivo enviado" } } : current);
      setNotice("Áudio associado ao projeto."); await refreshList();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao enviar áudio."); }
    finally { setLoading(false); }
  }

  async function uploadTrack(kind: "music" | "effect", file: File | undefined) {
    if (!project || !file) return;
    setLoading(true); setError("");
    try {
      await readJson(await fetch(`/api/production/projects/${project.id}/audio-track`, { method: "POST", headers: { "Content-Type": file.type || "audio/mpeg", "x-audio-kind": kind, "x-audio-title": file.name, "x-audio-license": license || "Informada pelo usuário", "x-audio-attribution": attribution, "x-start-seconds": kind === "effect" ? effectStart : "0" }, body: file }));
      const latest = await readJson<Project>(await fetch(`/api/production/projects/${project.id}`, { cache: "no-store" }));
      setProject({ ...latest, scenes: sceneListSchema.parse(latest.scenes) });
      setNotice(kind === "music" ? "Música associada à timeline." : "Efeito associado à timeline.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao enviar faixa."); }
    finally { setLoading(false); }
  }

  async function synchronizeCaptions() {
    if (!project?.narration) return;
    setTranscribing(true); setModelProgress(0); setError(""); setNotice("Carregando o modelo Whisper no navegador…");
    let context: AudioContext | null = null;
    try {
      const audioResponse = await fetch(`/api/production/projects/${project.id}/narration`, { cache: "no-store" });
      if (!audioResponse.ok) throw new Error((await audioResponse.json().catch(() => null))?.error || "Não foi possível abrir a narração.");
      const blob = await audioResponse.blob();
      context = new AudioContext();
      const file = new File([blob], "narration.mp3", { type: blob.type || "audio/mpeg" });
      const buffer = await decodeAudioFile(file, context);
      const chunks = sliceAudioBuffer(buffer, 30, context);
      const words = [];
      for (const chunk of chunks) {
        const samples = await audioBufferToMono16k(chunk.buffer);
        const result = await transcribeSamplesWithTimestamps(samples, {
          language: project.language,
          duracaoSegundos: chunk.end - chunk.start,
          onModelProgress: setModelProgress,
        });
        words.push(...result.palavras.map((word) => ({ ...word, inicio: word.inicio + chunk.start, fim: word.fim + chunk.start })));
      }
      const srt = segmentosParaSRT(agruparPalavras(words));
      if (!srt.trim()) throw new Error("O Whisper não encontrou fala para legendar neste áudio.");
      if (!(await saveProject({ subtitles: srt }))) return;
      setNotice("Legendas sincronizadas pela transcrição do áudio. Revise antes de exportar.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao sincronizar legendas."); }
    finally { context?.close().catch(() => {}); setTranscribing(false); }
  }

  function setAudioMix(key: "narrationVolume" | "musicVolume" | "effectsVolume" | "ducking", value: number) {
    if (!project) return;
    const settings = project.renderSettings || { audioMix: AUDIO_MIX_DEFAULTS };
    setProject({ ...project, renderSettings: { ...settings, audioMix: { ...AUDIO_MIX_DEFAULTS, ...settings.audioMix, [key]: value } } });
  }

  async function exportProject() {
    if (!project) return;
    setLoading(true); setError(""); setNotice("");
    try {
      if (!(await saveProject())) return;
      const queued = await readJson<{ jobId: string; message: string }>(await fetch(`/api/production/projects/${project.id}/export`, { method: "POST" }));
      setNotice(queued.message);
      for (let attempt = 0; attempt < 180; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const latest = await readJson<Project>(await fetch(`/api/production/projects/${project.id}`, { cache: "no-store" }));
        setProject({ ...latest, scenes: sceneListSchema.parse(latest.scenes) });
        if (latest.status === "completed") { setNotice("Exportação pronta para baixar."); await refreshList(); break; }
        if (latest.status === "error") { setError(latest.lastError || "A renderização falhou."); await refreshList(); break; }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao exportar."); }
    finally { setLoading(false); }
  }

  async function retryJob(jobId: string) {
    try { await readJson(await fetch(`/api/production/jobs/${jobId}/retry`, { method: "POST" })); setError(""); setNotice("Job devolvido à fila."); await openProject(project!.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao repetir job."); }
  }

  async function cancelJob(jobId: string) {
    try { await readJson(await fetch(`/api/production/jobs/${jobId}/cancel`, { method: "POST" })); setNotice("Exportação cancelada."); await openProject(project!.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao cancelar exportação."); }
  }

  const audioMix = project?.renderSettings?.audioMix || AUDIO_MIX_DEFAULTS;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Clapperboard className="size-4" /> Scriptly Studio</div><h1 className="text-3xl font-semibold tracking-tight">Produção documental</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Do roteiro à montagem, com fontes de mídia rastreáveis e revisão de cada cena.</p></div>
        {project && <Button variant="outline" onClick={() => { setProject(null); setError(""); setNotice(""); }}><Plus className="mr-2 size-4" />Novo projeto</Button>}
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{notice}</div>}

      {!project ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-border/70 shadow-sm"><CardHeader><CardTitle>Novo documentário</CardTitle><CardDescription>Crie cartões de cena a partir do briefing ou de um roteiro pronto.</CardDescription></CardHeader><CardContent><form className="space-y-5" onSubmit={createProject}>
          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="prod-title">Título</Label><Input id="prod-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A história dos tubarões" /></div><div className="space-y-2"><Label>Idioma de saída</Label><Select value={language} onValueChange={(v) => v && setLanguage(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="portuguese">Português (Brasil)</SelectItem><SelectItem value="english">English</SelectItem><SelectItem value="spanish">Español</SelectItem></SelectContent></Select></div></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="prod-brief">Briefing <span className="font-normal text-muted-foreground">(ou use somente o roteiro abaixo)</span></Label><Button type="button" variant="ghost" size="sm" onClick={() => { setTitle("How sharks got their names"); setBrief(exampleBrief); setLanguage("english"); }}>Usar exemplo de tubarões</Button></div><Textarea id="prod-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="Público, tema, tom e o que o documentário deve explicar…" /></div>
          <div className="space-y-2"><Label htmlFor="prod-script">Roteiro pronto <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id="prod-script" value={script} onChange={(e) => setScript(e.target.value)} rows={5} placeholder="Cole o texto da narração. Sem roteiro, a IA escolhida cria um rascunho…" /></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="space-y-2"><Label>Roteiro IA</Label><Select value={provider} onValueChange={(v) => v && setProvider(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI · chave em Configurações</SelectItem><SelectItem value="gemini">Gemini · chave em Configurações</SelectItem><SelectItem value="fake">Sem IA · requer roteiro pronto</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Duração alvo (segundos)</Label><Input type="number" min={30} max={7200} value={duration} onChange={(e) => setDuration(e.target.value)} /></div><div className="space-y-2"><Label>Proporção</Label><Select value={aspect} onValueChange={(v) => v && setAspect(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="16:9">16:9 · Documentário</SelectItem><SelectItem value="9:16">9:16 · Vertical</SelectItem><SelectItem value="1:1">1:1 · Quadrado</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Resolução</Label><Select value={resolution} onValueChange={(v) => v && setResolution(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1080">1080p · padrão</SelectItem><SelectItem value="720">720p</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Estilo editorial</Label><Select value={style} onValueChange={(v) => v && setStyle(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRODUCTION_STYLES).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select></div></div>
          <Button type="submit" disabled={creating || !title.trim() || (!brief.trim() && !script.trim())}><Sparkles className="mr-2 size-4" />{creating ? "Preparando cenas…" : "Criar projeto e plano de cenas"}</Button>
        </form></CardContent></Card>
        <aside className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Projetos recentes</CardTitle><CardDescription>Continue de onde parou.</CardDescription></CardHeader><CardContent className="space-y-2">{projects.length ? projects.map((item) => <button key={item.id} type="button" onClick={() => openProject(item.id)} className="w-full rounded-lg border px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"><span className="block truncate text-sm font-medium">{item.title}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{new Date(item.updatedAt).toLocaleDateString()}</span><span>{statusName[item.status] || item.stage}</span></span></button>) : <p className="text-sm text-muted-foreground">{loading ? "Carregando…" : "Seus projetos aparecem aqui."}</p>}</CardContent></Card><Card className="bg-muted/30"><CardContent className="pt-5"><p className="text-sm font-medium">Fontes com rastreabilidade</p><p className="mt-1 text-sm text-muted-foreground">Busca de vídeo Pexels requer <code>PEXELS_API_KEY</code>. Cada sugestão exibe licença, crédito e confiança; revise o quadro antes de confirmar uma espécie ou ação.</p><a className="mt-3 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline" href="https://www.pexels.com/" target="_blank" rel="noreferrer">Pexels · licença e API</a></CardContent></Card></aside>
      </div> : <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-muted-foreground">Projeto em edição</p><Input className="mt-1 h-9 max-w-xl border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0" value={title} onChange={(e) => setTitle(e.target.value)} /></div><div className="flex flex-wrap items-center gap-2"><Badge variant={project.status === "error" ? "destructive" : "secondary"}>{statusName[project.status] || project.stage}</Badge><Button variant="outline" onClick={() => saveProject()} disabled={saving || loading}>{saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}Salvar</Button><Button onClick={exportProject} disabled={loading || !project.narration}><Clapperboard className="mr-2 size-4" />{loading ? "Trabalhando…" : "Exportar MP4"}</Button>{project.status === "completed" && <Button variant="outline" asChild><a href={`/api/production/projects/${project.id}/download`}><Download className="mr-2 size-4" />Baixar</a></Button>}</div></div>
        {project.status === "completed" && <Card><CardHeader><CardTitle>Prévia da exportação</CardTitle><CardDescription>Confira o vídeo final antes de baixar.</CardDescription></CardHeader><CardContent><video controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-black" src={`/api/production/projects/${project.id}/download?preview=1`} /></CardContent></Card>}
        {project.lastError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{project.lastError}</div>}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
          <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-semibold">Storyboard <span className="text-muted-foreground">· {project.scenes.length} cenas</span></h2><p className="text-sm text-muted-foreground">Pesquise opções, compare prévias e ajuste os cortes.</p></div><div className="flex flex-wrap items-center gap-2"><Select value={provider} onValueChange={(v) => v && setProvider(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI</SelectItem><SelectItem value="gemini">Gemini</SelectItem><SelectItem value="fake">Sem IA</SelectItem></SelectContent></Select><Button variant="outline" size="sm" onClick={planScenes} disabled={planning || provider === "fake"}><Sparkles className="mr-2 size-4" />{planning ? "Planejando…" : "Planejar cenas com IA"}</Button><Button variant="outline" size="sm" onClick={() => saveProject()} disabled={saving}><Check className="mr-2 size-4" />Salvar storyboard</Button></div></div>
            {project.scenes.map((scene) => <Card key={scene.id} className="overflow-hidden border-border/70"><div className="grid md:grid-cols-[190px_minmax(0,1fr)]"><div className="relative min-h-36 bg-slate-950">{scene.candidates.find((candidate) => candidate.id === scene.selectedCandidateId)?.previewUrl ? <Image unoptimized fill sizes="190px" className="object-cover opacity-80" src={scene.candidates.find((candidate) => candidate.id === scene.selectedCandidateId)?.previewUrl ?? ""} alt="Prévia do clipe selecionado" /> : <div className="absolute inset-0 grid place-items-center text-slate-500"><Clapperboard className="size-9" /></div>}<span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Cena {String(scene.order).padStart(2, "0")}</span><span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">{scene.durationSeconds}s</span></div><div className="min-w-0 p-4"><Textarea aria-label={`Narração da cena ${scene.order}`} className="min-h-16 text-sm leading-6" value={scene.scriptText} onChange={(e) => patchScene(scene.id, { scriptText: e.target.value })} /><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant={scene.exactSubject ? "outline" : "secondary"}>{scene.exactSubject ? "Sujeito específico" : "Imagem ilustrativa"}</Badge><span className="text-xs text-muted-foreground">Busca: {scene.searchQueries[0]?.query}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Texto de tela</Label><Input value={scene.titleText} onChange={(e) => patchScene(scene.id, { titleText: e.target.value })} placeholder="Título nesta cena" /></div><div className="space-y-1"><Label className="text-xs">Sujeito · ação · ambiente</Label><p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">{scene.subject} · {scene.action} · {scene.environment}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><div className="space-y-1"><Label className="text-xs">Início do clipe (s)</Label><Input type="number" min="0" step="0.1" value={scene.trimInSeconds} onChange={(e) => patchScene(scene.id, { trimInSeconds: Math.max(0, Number(e.target.value) || 0) })} /></div><div className="space-y-1"><Label className="text-xs">Fim do clipe (s)</Label><Input type="number" min="0.1" step="0.1" value={scene.trimOutSeconds ?? scene.durationSeconds} onChange={(e) => patchScene(scene.id, { trimOutSeconds: Math.max(0.1, Number(e.target.value) || 0.1) })} /></div><div className="flex items-end"><Button variant="outline" onClick={() => searchScene(scene)} disabled={searching === scene.id}><Search className="mr-2 size-4" />{searching === scene.id ? "Buscando…" : scene.candidates.length ? "Buscar outras" : "Buscar vídeos"}</Button></div></div></div></div>
              {scene.candidates.length > 0 && <CardContent className="border-t bg-muted/20 p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{scene.candidates.map((candidate) => <div key={candidate.id} className={`overflow-hidden rounded-lg border bg-card ${candidate.id === scene.selectedCandidateId ? "border-primary ring-1 ring-primary/30" : ""}`}><div className="relative aspect-video bg-slate-950">{candidate.previewUrl && <video src={candidate.downloadUrl} poster={candidate.previewUrl || undefined} controls preload="none" playsInline className="size-full object-cover" aria-label={`Prévia do clipe por ${candidate.creator}`} />}{candidate.id === scene.selectedCandidateId && <Badge className="absolute left-2 top-2">Selecionado</Badge>}</div><div className="space-y-2 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{candidate.creator}</span><Badge variant={candidate.confidence === "high" ? "default" : "outline"}>Confiança {candidate.confidence === "high" ? "alta" : candidate.confidence === "medium" ? "média" : "baixa"}</Badge></div><p className="text-xs leading-5 text-muted-foreground">{candidate.justification}</p><p className="text-[11px] text-muted-foreground">{candidate.width}×{candidate.height} · {candidate.durationSeconds}s</p><div className="flex items-center justify-between gap-2"><a href={candidate.licenseUrl || candidate.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">Licença e origem</a><Button size="sm" variant={candidate.id === scene.selectedCandidateId ? "secondary" : "default"} onClick={() => patchScene(scene.id, { selectedCandidateId: candidate.id, status: "selected", titleText: scene.titleText || candidate.title })}>{candidate.id === scene.selectedCandidateId ? "Escolhido" : "Usar clipe"}</Button></div><p className="text-[10px] text-muted-foreground">Crédito: {candidate.attribution}</p></div></div>)}</div></CardContent>}
            </Card>)}
          </section>

          <aside className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Narração</CardTitle><CardDescription>Gere com VoiceStudio configurado ou associe um arquivo de áudio.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Voz / VoiceStudio voice ID</Label><Input value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="alloy" /></div><Button className="w-full" onClick={generateVoice} disabled={loading || !voiceAvailable}><WandSparkles className="mr-2 size-4" />Gerar narração</Button><p className="text-xs text-muted-foreground">{voiceAvailable ? "VoiceStudio acessível ao servidor." : "VoiceStudio não configurado. Defina VOICESTUDIO_BASE_URL no servidor."}</p><div className="relative"><Input type="file" accept="audio/*" disabled={loading} onChange={(e) => uploadAudio(e.target.files?.[0])} aria-label="Enviar arquivo de narração" /></div>{project.narration && <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">Áudio associado · {project.narration.provider || "arquivo"}{project.narration.voice ? ` · ${project.narration.voice}` : ""}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Áudio, música e efeitos</CardTitle><CardDescription>Use faixas próprias ou licenciadas e registre os créditos.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Licença / termos de uso</Label><Input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="Ex.: CC BY 4.0 ou licença própria" /></div><div className="space-y-2"><Label>Atribuição</Label><Input value={attribution} onChange={(e) => setAttribution(e.target.value)} placeholder="Autor, URL ou crédito exigido" /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Música de fundo</Label><Input type="file" accept="audio/*" disabled={loading} onChange={(e) => uploadTrack("music", e.target.files?.[0])} aria-label="Enviar música de fundo" />{project.music && <p className="text-xs text-muted-foreground">{project.music.title} · {project.music.license}</p>}</div><div className="space-y-2"><Label>Efeito sonoro</Label><Input type="file" accept="audio/*" disabled={loading} onChange={(e) => uploadTrack("effect", e.target.files?.[0])} aria-label="Enviar efeito sonoro" /><Input aria-label="Início do efeito sonoro em segundos" type="number" min="0" value={effectStart} onChange={(e) => setEffectStart(e.target.value)} placeholder="Início (segundos)" />{project.effects?.[0] && <p className="text-xs text-muted-foreground">{project.effects[0].title} · {project.effects[0].license}</p>}</div></div><MixSlider label="Volume da narração" value={audioMix.narrationVolume} max={2} onChange={(value) => setAudioMix("narrationVolume", value)} /><MixSlider label="Volume da música" value={audioMix.musicVolume} max={2} onChange={(value) => setAudioMix("musicVolume", value)} /><MixSlider label="Volume dos efeitos" value={audioMix.effectsVolume} max={2} onChange={(value) => setAudioMix("effectsVolume", value)} /><MixSlider label="Ducking da música durante a fala" value={audioMix.ducking} max={1} onChange={(value) => setAudioMix("ducking", value)} /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Preview e textos</CardTitle><CardDescription>Revise os nomes de tela e as legendas antes da exportação.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="max-h-52 overflow-auto rounded bg-slate-950 p-3 font-mono text-xs text-slate-100">{project.scenes.map((scene) => <div key={scene.id} className="mb-2"><span className="text-sky-300">[{scene.startSeconds}s]</span> {scene.titleText || `Cena ${scene.order}`}</div>)}</div><div className="flex items-center justify-between gap-2"><Label htmlFor="prod-subtitles">Legendas SRT</Label><Button variant="outline" size="sm" onClick={synchronizeCaptions} disabled={transcribing || !project.narration}><Sparkles className="mr-2 size-3" />{transcribing ? `Transcrevendo ${modelProgress}%` : "Sincronizar com Whisper"}</Button></div><Textarea id="prod-subtitles" rows={6} value={project.subtitles || ""} onChange={(e) => setProject({ ...project, subtitles: e.target.value })} placeholder="00:00:00,000 --> 00:00:03,000…" /><p className="text-xs text-muted-foreground">Legendas e títulos são compostos na imagem; sobreposições seguem as prioridades configuradas.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Timeline</CardTitle><CardDescription>Clipes em sequência · narração alinhada ao roteiro</CardDescription></CardHeader><CardContent className="space-y-3"><TimelineRow label="VÍDEO" color="bg-sky-500" count={project.scenes.length} items={project.scenes.map((scene) => scene.titleText || `Cena ${scene.order}`)} /><TimelineRow label="NARRAÇÃO" color={project.narration ? "bg-violet-500" : "bg-muted-foreground/40"} count={project.narration ? 1 : 0} items={project.narration ? [project.narration.voice || "Áudio associado"] : ["Aguardando áudio"]} /><TimelineRow label="TÍTULOS / SRT" color="bg-amber-500" count={project.scenes.filter((scene) => scene.titleText).length} items={project.scenes.filter((scene) => scene.titleText).map((scene) => scene.titleText)} /><TimelineRow label="MÚSICA" color="bg-emerald-600" count={project.music ? 1 : 0} items={project.music ? [project.music.title || "Música"] : ["Aguardando faixa"]} /><TimelineRow label="EFEITOS" color="bg-rose-500" count={project.effects?.length || 0} items={project.effects?.map((effect) => effect.title || "Efeito") || ["Aguardando faixa"]} />{project.jobs?.slice(0, 2).map((job) => <div key={job.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"><span>Render · {statusName[job.status] || job.status} · {job.progress}%</span>{job.status === "error" && <Button variant="ghost" size="sm" onClick={() => retryJob(job.id)}><RefreshCw className="mr-1 size-3" />Repetir</Button>}{(job.status === "waiting" || job.status === "processing") && <Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)}>Cancelar</Button>}</div>)}</CardContent></Card>
          </aside>
        </div>
      </div>}
      {loading && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2 text-sm shadow-lg"><LoaderCircle className="size-4 animate-spin" />Processando…</div>}
    </div>
  );
}

function TimelineRow({ label, color, count, items }: { label: string; color: string; count: number; items: string[] }) {
  return <div><div className="mb-1 flex justify-between text-[10px] font-semibold tracking-wider text-muted-foreground"><span>{label}</span><span>{count} clipes</span></div><div className="flex min-h-8 gap-1 overflow-hidden rounded bg-muted/60 p-1">{items.slice(0, 7).map((item, index) => <div key={`${item}-${index}`} title={item} className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-[10px] text-white ${color}`}>{item}</div>)}</div></div>;
}

function MixSlider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>{label}</span><span className="tabular-nums text-muted-foreground">{Math.round(value * 100)}%</span></span><input aria-label={label} className="w-full accent-primary" type="range" min="0" max={max} step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
