"use client";

import React, { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, Play, Copy, CheckCircle2 } from "lucide-react";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

const API_URL = "/api/audio/segments"; // ajuste aqui

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SincronizacaoScriptlyPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);

  const [resultTxt, setResultTxt] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isBusy = status === "uploading" || status === "processing";

  const durationLabel = useMemo(() => {
    // se você quiser exibir duração real, pode vir do backend
    // por enquanto, estimativa via tamanho (placeholder) ou vazio
    return file ? "—" : "--:--";
  }, [file]);

  function onPickFile() {
    inputRef.current?.click();
  }

  function onFileSelected(f?: File | null) {
    if (!f) return;
    setFile(f);
    setResultTxt("");
    setErrorMsg("");
    setStatus("idle");
    setProgress(0);
  }

  async function handleStart() {
    if (!file) return;

    try {
      setStatus("uploading");
      setProgress(15);

      const form = new FormData();
      form.append("audio", file);
      // você pode mandar ajustes do silencedetect se quiser:
      // form.append("noise", "-30dB");
      // form.append("d", "0.20");

      setStatus("processing");
      setProgress(40);

      const res = await fetch(API_URL, { method: "POST", body: form });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erro HTTP ${res.status}`);
      }

      // endpoint retorna text/plain
      const txt = await res.text();

      setProgress(100);
      setStatus("done");
      setResultTxt(buildConsoleOutput(file.name, txt));
    } catch (e) {
      setStatus("error");
      setProgress(0);
      setErrorMsg("Erro ao processar.");
    }
  }

  function buildConsoleOutput(fileName: string, segmentsTxt: string) {
    const lines = segmentsTxt
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Se seu endpoint já devolve no formato "0.08s | 0.16s",
    // vamos transformar em "PROMPT 001 | 00:00 - 00:08" opcionalmente.
    // Aqui vou manter também o bruto, mas com cabeçalho estilo terminal.

    const header =
      "============================================================\n" +
      "SINCRONIZACAO SCRIPTLY SYNC - DETECCAO DE FALA (INTERVALOS)\n" +
      "============================================================\n" +
      `Arquivo: ${fileName}\n` +
      `Duracao: ${durationLabel}\n` +
      `Total de intervalos: ${lines.length}\n` +
      "============================================================\n\n";

    // lista simples, tipo:
    // 001 | 0.08s | 0.16s
    const body = lines
      .map((l, idx) => {
        const n = String(idx + 1).padStart(3, "0");
        return `${n} | ${l}`;
      })
      .join("\n");

    return header + body;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resultTxt || "");
    } catch {
      // fallback simples
      const ta = document.createElement("textarea");
      ta.value = resultTxt || "";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 space-y-6">
        {/* UPLOAD */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload do áudio</CardTitle>
          </CardHeader>

          <CardContent>
            <div
              className={[
                "relative rounded-xl border-2 border-dashed p-6 transition",
                dragOver ? "border-primary/80 bg-primary/5" : "border-border bg-muted/30",
              ].join(" ")}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                onFileSelected(f ?? null);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
              />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm">Clique ou arraste um arquivo</div>
                  <div className="text-xs text-muted-foreground">MP3, WAV, M4A, OGG (máx. 100MB)</div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={onPickFile}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Escolher
                </Button>
              </div>

              {file && (
                <div className="mt-4 flex items-center gap-3 text-sm text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground">
                    ({(file.size / 1024 / 1024).toFixed(2)}MB)
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <Button
                onClick={handleStart}
                disabled={!file || isBusy}
                className="w-full h-12 rounded-xl"
              >
                <Play className="mr-2 h-5 w-5" />
                INICIAR SINCRONIZAÇÃO
              </Button>
            </div>

            {status === "error" && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PROGRESSO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{isBusy ? "Processando..." : status === "done" ? "Concluído!" : "Aguardando..."}</span>
              {status === "done" && (
                <span className="inline-flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Concluído!
                </span>
              )}
            </div>

            <div className="rounded-full bg-secondary p-[2px]">
              <Progress
                value={progress}
                className="h-3 rounded-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* SINCRONIZACAO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sincronização</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea
              value={resultTxt}
              readOnly
              placeholder="Aqui vai aparecer o log/resultado (intervalos de fala)..."
              className="min-h-[260px] font-mono text-xs leading-5"
            />

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                onClick={handleCopy}
                disabled={!resultTxt}
                className="w-full md:w-auto"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>

              <div className="text-xs text-muted-foreground">
                {file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
