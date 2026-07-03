"use client";

import * as React from "react";
import {
  AlertCircle,
  AudioLines,
  Copy,
  Check,
  CheckCircle2,
  Download,
  FileJson,
  Play,
  RotateCcw,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AudioUploader } from "@/components/divisor-audio/audio-uploader";
import {
  MAX_SEGMENT_SECONDS,
  MIN_SEGMENT_SECONDS,
  SEGMENT_SECONDS,
  audioBufferToMono16k,
  buildJsonExport,
  buildPromptTextExport,
  decodeAudioFile,
  formatTime,
  sliceAudioBuffer,
  validateAudioFile,
} from "@/lib/audioUtils";
import { transcribeSamples } from "@/lib/whisper-browser";
import type { AudioSegment } from "@/types/audio";

type Stage = "idle" | "splitting" | "transcribing" | "done";

// Idiomas que o usuário pode informar. O valor é o nome em inglês esperado pelo
// Whisper; "auto" deixa o modelo detectar o idioma falado automaticamente.
const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Detectar automaticamente" },
  { value: "afrikaans", label: "Africâner" },
  { value: "albanian", label: "Albanês" },
  { value: "german", label: "Alemão" },
  { value: "amharic", label: "Amárico" },
  { value: "arabic", label: "Árabe" },
  { value: "armenian", label: "Armênio" },
  { value: "assamese", label: "Assamês" },
  { value: "azerbaijani", label: "Azerbaijano" },
  { value: "basque", label: "Basco" },
  { value: "bashkir", label: "Bashkir" },
  { value: "bengali", label: "Bengali" },
  { value: "belarusian", label: "Bielorrusso" },
  { value: "myanmar", label: "Birmanês" },
  { value: "bosnian", label: "Bósnio" },
  { value: "breton", label: "Bretão" },
  { value: "bulgarian", label: "Búlgaro" },
  { value: "kannada", label: "Canará" },
  { value: "cantonese", label: "Cantonês" },
  { value: "catalan", label: "Catalão" },
  { value: "kazakh", label: "Cazaque" },
  { value: "chinese", label: "Chinês" },
  { value: "sinhala", label: "Cingalês" },
  { value: "korean", label: "Coreano" },
  { value: "haitian creole", label: "Crioulo haitiano" },
  { value: "croatian", label: "Croata" },
  { value: "danish", label: "Dinamarquês" },
  { value: "slovak", label: "Eslovaco" },
  { value: "slovenian", label: "Esloveno" },
  { value: "spanish", label: "Espanhol" },
  { value: "estonian", label: "Estoniano" },
  { value: "faroese", label: "Feroês" },
  { value: "finnish", label: "Finlandês" },
  { value: "french", label: "Francês" },
  { value: "galician", label: "Galego" },
  { value: "welsh", label: "Galês" },
  { value: "georgian", label: "Georgiano" },
  { value: "greek", label: "Grego" },
  { value: "gujarati", label: "Guzerate" },
  { value: "hausa", label: "Hauçá" },
  { value: "hawaiian", label: "Havaiano" },
  { value: "hebrew", label: "Hebraico" },
  { value: "hindi", label: "Híndi" },
  { value: "dutch", label: "Holandês" },
  { value: "hungarian", label: "Húngaro" },
  { value: "yiddish", label: "Iídiche" },
  { value: "indonesian", label: "Indonésio" },
  { value: "english", label: "Inglês" },
  { value: "yoruba", label: "Iorubá" },
  { value: "icelandic", label: "Islandês" },
  { value: "italian", label: "Italiano" },
  { value: "japanese", label: "Japonês" },
  { value: "javanese", label: "Javanês" },
  { value: "khmer", label: "Khmer" },
  { value: "lao", label: "Laociano" },
  { value: "latin", label: "Latim" },
  { value: "latvian", label: "Letão" },
  { value: "lingala", label: "Lingala" },
  { value: "lithuanian", label: "Lituano" },
  { value: "luxembourgish", label: "Luxemburguês" },
  { value: "macedonian", label: "Macedônio" },
  { value: "malayalam", label: "Malaiala" },
  { value: "malay", label: "Malaio" },
  { value: "malagasy", label: "Malgaxe" },
  { value: "maltese", label: "Maltês" },
  { value: "maori", label: "Maori" },
  { value: "marathi", label: "Marata" },
  { value: "mongolian", label: "Mongol" },
  { value: "nepali", label: "Nepalês" },
  { value: "norwegian", label: "Norueguês" },
  { value: "nynorsk", label: "Nynorsk" },
  { value: "occitan", label: "Occitano" },
  { value: "pashto", label: "Pashto" },
  { value: "persian", label: "Persa" },
  { value: "polish", label: "Polonês" },
  { value: "portuguese", label: "Português" },
  { value: "punjabi", label: "Punjabi" },
  { value: "romanian", label: "Romeno" },
  { value: "russian", label: "Russo" },
  { value: "sanskrit", label: "Sânscrito" },
  { value: "serbian", label: "Sérvio" },
  { value: "sindhi", label: "Sindi" },
  { value: "somali", label: "Somali" },
  { value: "swahili", label: "Suaíli" },
  { value: "swedish", label: "Sueco" },
  { value: "sundanese", label: "Sundanês" },
  { value: "tajik", label: "Tadjique" },
  { value: "tagalog", label: "Tagalo" },
  { value: "thai", label: "Tailandês" },
  { value: "tamil", label: "Tâmil" },
  { value: "tatar", label: "Tártaro" },
  { value: "czech", label: "Tcheco" },
  { value: "telugu", label: "Télugo" },
  { value: "tibetan", label: "Tibetano" },
  { value: "turkmen", label: "Turcomeno" },
  { value: "turkish", label: "Turco" },
  { value: "ukrainian", label: "Ucraniano" },
  { value: "urdu", label: "Urdu" },
  { value: "uzbek", label: "Usbeque" },
  { value: "vietnamese", label: "Vietnamita" },
  { value: "shona", label: "Xona" },
];

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AudioSplitter() {
  const [file, setFile] = React.useState<File | null>(null);
  const [segments, setSegments] = React.useState<AudioSegment[]>([]);
  const [duration, setDuration] = React.useState<number | null>(null);
  const [segmentSeconds, setSegmentSeconds] = React.useState(SEGMENT_SECONDS);
  const [language, setLanguage] = React.useState("auto");
  const [stage, setStage] = React.useState<Stage>("idle");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [modelPct, setModelPct] = React.useState(0);
  const [modelReady, setModelReady] = React.useState(false);

  // Mantém os buffers decodificados de cada trecho para reamostrar na transcrição.
  const buffersRef = React.useRef<Map<number, AudioBuffer>>(new Map());

  const isProcessing = stage === "splitting" || stage === "transcribing";

  function handleFileSelected(selected: File) {
    const validationError = validateAudioFile(selected);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setNotice(null);
    setFile(selected);
    // limpa resultado anterior ao trocar de arquivo
    buffersRef.current.clear();
    setSegments([]);
    setDuration(null);
    setStage("idle");
    setProgress(0);
  }

  function handleSecondsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = Number(event.target.value);
    if (!Number.isFinite(raw)) return;
    setSegmentSeconds(raw);
  }

  function normalizeSeconds(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return SEGMENT_SECONDS;
    return Math.min(MAX_SEGMENT_SECONDS, Math.max(MIN_SEGMENT_SECONDS, Math.round(value)));
  }

  function handleSecondsBlur() {
    setSegmentSeconds((prev) => normalizeSeconds(prev));
  }

  async function handleProcess() {
    if (!file) {
      setError("Selecione um arquivo de áudio antes de processar.");
      return;
    }

    const validationError = validateAudioFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const seconds = normalizeSeconds(segmentSeconds);
    setSegmentSeconds(seconds);

    setError(null);
    setNotice(null);
    setStage("splitting");
    setProgress(0);
    buffersRef.current.clear();
    setSegments([]);

    let audioContext: AudioContext;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioContext = new AudioCtx();
    } catch {
      setError("Seu navegador não suporta a Web Audio API necessária para dividir o áudio.");
      setStage("idle");
      return;
    }

    try {
      const decoded = await decodeAudioFile(file, audioContext);
      setDuration(decoded.duration);

      const rawSegments = sliceAudioBuffer(decoded, seconds, audioContext);
      if (rawSegments.length === 0) {
        throw new Error("Não foi possível identificar nenhum trecho no áudio.");
      }

      const created: AudioSegment[] = rawSegments.map((raw) => {
        buffersRef.current.set(raw.index, raw.buffer);
        return {
          index: raw.index,
          start: raw.start,
          end: raw.end,
          transcript: "",
          status: "pending",
        };
      });

      setSegments(created);
      setStage("transcribing");

      // Transcreve cada trecho sequencialmente (Whisper no navegador),
      // atualizando a barra de progresso.
      let completed = 0;

      for (const segment of created) {
        setSegments((prev) =>
          prev.map((item) =>
            item.index === segment.index ? { ...item, status: "transcribing" } : item
          )
        );

        try {
          const buffer = buffersRef.current.get(segment.index);
          if (!buffer) throw new Error("Trecho de áudio indisponível.");

          const samples = await audioBufferToMono16k(buffer);
          const text = await transcribeSamples(samples, {
            language,
            onModelProgress: (pct) => {
              setModelPct(pct);
              if (pct >= 100) setModelReady(true);
            },
          });
          setModelReady(true);

          setSegments((prev) =>
            prev.map((item) =>
              item.index === segment.index
                ? { ...item, transcript: text, status: "done", error: undefined }
                : item
            )
          );
        } catch (transcribeError) {
          setSegments((prev) =>
            prev.map((item) =>
              item.index === segment.index
                ? {
                    ...item,
                    status: "error",
                    error:
                      transcribeError instanceof Error
                        ? transcribeError.message
                        : "Falha ao transcrever este trecho.",
                  }
                : item
            )
          );
        }

        completed += 1;
        setProgress(Math.round((completed / created.length) * 100));
      }

      setStage("done");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado ao processar o áudio."
      );
      setStage("idle");
    } finally {
      audioContext.close().catch(() => {});
    }
  }

  function handleReset() {
    buffersRef.current.clear();
    setFile(null);
    setSegments([]);
    setDuration(null);
    setStage("idle");
    setProgress(0);
    setError(null);
    setNotice(null);
    setCopied(false);
  }

  function exportInfo() {
    return {
      fileName: file?.name ?? "audio",
      duration: duration ?? 0,
      segmentSeconds,
    };
  }

  async function handleCopyAll() {
    const text = buildPromptTextExport(segments, exportInfo());
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  }

  function handleDownloadTxt() {
    downloadFile(
      "sincronizacao-audio.txt",
      buildPromptTextExport(segments, exportInfo()),
      "text/plain"
    );
  }

  function handleDownloadJson() {
    const json = JSON.stringify(buildJsonExport(segments), null, 2);
    downloadFile("sincronizacao-audio.json", json, "application/json");
  }

  const hasResult = segments.length > 0;
  const doneCount = segments.filter((segment) => segment.status === "done").length;
  const errorCount = segments.filter((segment) => segment.status === "error").length;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={AudioLines}
        title="Divisor de Áudio"
        description="Envie ou grave um áudio para dividi-lo automaticamente em blocos com a transcrição de cada trecho."
      />

      <Card>
        <CardHeader>
          <CardTitle>Enviar áudio</CardTitle>
          <CardDescription>
            Faça upload de um arquivo (MP3, WAV, M4A ou OGG) ou grave pelo microfone.
            O áudio é dividido em blocos do tamanho escolhido (padrão {SEGMENT_SECONDS}{" "}
            segundos) e transcrito com Whisper direto no navegador (gratuito, sem chave).
            O modelo é baixado uma única vez na primeira utilização.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AudioUploader onFileSelected={handleFileSelected} disabled={isProcessing} />

          {file && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Arquivo: {file.name}</Badge>
              <Badge variant="outline">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </Badge>
              {duration !== null && (
                <Badge variant="outline">Duração: {formatTime(duration)}</Badge>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="segment-seconds">Segundos por bloco</Label>
              <Input
                id="segment-seconds"
                type="number"
                inputMode="numeric"
                min={MIN_SEGMENT_SECONDS}
                max={MAX_SEGMENT_SECONDS}
                value={segmentSeconds}
                onChange={handleSecondsChange}
                onBlur={handleSecondsBlur}
                disabled={isProcessing}
                className="w-28"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="audio-language">Idioma do áudio</Label>
              <Select
                value={language}
                onValueChange={setLanguage}
                disabled={isProcessing}
              >
                <SelectTrigger id="audio-language" className="w-56">
                  <SelectValue placeholder="Selecione o idioma" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="pb-2 text-xs text-muted-foreground">
              O texto é transcrito no mesmo idioma do áudio (sem tradução). Informe
              o idioma ou deixe em &quot;Detectar automaticamente&quot;.
            </p>
          </div>

          {error && (
            <p
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {notice && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleProcess}
              disabled={!file || isProcessing}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? "Processando..." : "Processar áudio"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isProcessing || (!file && !hasResult)}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          </div>

          {stage === "transcribing" && !modelReady && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Baixando modelo de transcrição (apenas na 1ª vez)...</span>
                <span>{modelPct}%</span>
              </div>
              <Progress value={modelPct} />
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {stage === "splitting"
                    ? "Dividindo o áudio..."
                    : `Transcrevendo trechos (${doneCount + errorCount}/${segments.length})...`}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={stage === "splitting" ? undefined : progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {hasResult && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">Resultado</CardTitle>
                <Badge variant="secondary">{segments.length} blocos</Badge>
                {stage === "done" && (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluído
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} com erro</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  disabled={isProcessing}
                >
                  {copied ? (
                    <Check className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Copy className="mr-1.5 h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar texto"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTxt}
                  disabled={isProcessing}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Baixar TXT
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJson}
                  disabled={isProcessing}
                >
                  <FileJson className="mr-1.5 h-4 w-4" />
                  Baixar JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[480px] space-y-2 overflow-y-auto rounded-md border border-input p-3">
              {segments.map((segment) => {
                const num = String(segment.index).padStart(3, "0");
                const header = `PROMPT ${num} | ${formatTime(segment.start)} - ${formatTime(segment.end)}`;
                const isError = segment.status === "error";
                const isTranscribing = segment.status === "transcribing";
                return (
                  <div key={segment.index} className="space-y-1">
                    <p
                      className={`text-xs font-mono font-semibold ${
                        isError ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {header}
                      {isError && " — ERRO"}
                    </p>
                    <textarea
                      readOnly
                      rows={3}
                      value={
                        isError
                          ? segment.error ?? "Falha ao transcrever este trecho."
                          : isTranscribing
                          ? "Transcrevendo..."
                          : segment.transcript || "[sem transcrição]"
                      }
                      className={`w-full resize-y rounded-md border px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none ${
                        isError
                          ? "border-destructive/60 bg-destructive/5 text-destructive"
                          : "border-input bg-muted/40 text-foreground"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Blocos de {segmentSeconds} segundos. Use os botões acima para copiar ou
              baixar o resultado no padrão de sincronização.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AudioSplitter;
