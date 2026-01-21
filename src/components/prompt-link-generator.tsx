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

export default function SincronizacaoDottiPage() {
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
      "SINCRONIZACAO DOTTI SYNC - DETECCAO DE FALA (INTERVALOS)\n" +
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
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 space-y-6">
        {/* UPLOAD */}
        <Card className="border-white/10 bg-black/30">
          <CardHeader>
            <CardTitle className="text-lg">Upload do áudio</CardTitle>
          </CardHeader>

          <CardContent>
            <div
              className={[
                "relative rounded-xl border-2 border-dashed p-6 transition",
                dragOver ? "border-emerald-400/80 bg-emerald-500/5" : "border-emerald-400/40 bg-white/5",
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
                  <div className="text-sm text-white/80">Clique ou arraste um arquivo</div>
                  <div className="text-xs text-white/50">MP3, WAV, M4A, OGG (máx. 100MB)</div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={onPickFile}
                  className="bg-white/10 hover:bg-white/15 text-white border border-white/10"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Escolher
                </Button>
              </div>

              {file && (
                <div className="mt-4 flex items-center gap-3 text-sm text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-white/40">
                    ({(file.size / 1024 / 1024).toFixed(2)}MB)
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <Button
                onClick={handleStart}
                disabled={!file || isBusy}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95"
              >
                <Play className="mr-2 h-5 w-5" />
                INICIAR SINCRONIZAÇÃO
              </Button>
            </div>

            {status === "error" && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {errorMsg}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PROGRESSO */}
        <Card className="border-white/10 bg-black/30">
          <CardHeader>
            <CardTitle className="text-lg">Progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>{isBusy ? "Processando..." : status === "done" ? "Concluído!" : "Aguardando..."}</span>
              {status === "done" && (
                <span className="inline-flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Concluído!
                </span>
              )}
            </div>

            <div className="rounded-full bg-white/10 p-[2px]">
              <Progress
                value={progress}
                className="h-3 rounded-full bg-transparent"
              />
            </div>
          </CardContent>
        </Card>

        {/* SINCRONIZACAO */}
        <Card className="border-white/10 bg-black/30">
          <CardHeader>
            <CardTitle className="text-lg">Sincronização</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea
              value={resultTxt}
              readOnly
              placeholder="Aqui vai aparecer o log/resultado (intervalos de fala)..."
              className="min-h-[260px] font-mono text-xs leading-5 bg-black/50 border-white/10 text-white/80"
            />

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                onClick={handleCopy}
                disabled={!resultTxt}
                className="w-full md:w-auto bg-white/10 hover:bg-white/15 border border-white/10 text-white"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>

              <div className="text-xs text-white/40">
                {file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
