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
            language: "portuguese",
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
            <p className="pb-2 text-xs text-muted-foreground">
              Entre {MIN_SEGMENT_SECONDS} e {MAX_SEGMENT_SECONDS} segundos. Padrão:{" "}
              {SEGMENT_SECONDS}.
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
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
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
