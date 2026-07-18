"use client";

import * as React from "react";
import {
  Clapperboard,
  Sparkles,
  AudioLines,
  Waypoints,
  Loader2,
  AlertCircle,
  Download,
  FileJson,
  Captions,
  Wand2,
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
import { Textarea } from "@/components/ui/textarea";

import { gerarRoteiro } from "@/lib/roteiro-client";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import {
  listarVozes,
  criarAudio,
  aguardarConclusao,
  baixarAudioBlob,
} from "@/lib/darkvi";
import type { DarkviVoice } from "@/types/darkvi";
import { audioBufferToMono16k } from "@/lib/audioUtils";
import { transcribeSamplesWithTimestamps } from "@/lib/whisper-browser";
import {
  agruparPalavras,
  montarTimings,
  segmentosParaSRT,
  type Segmento,
  type Timings,
} from "@/lib/roteiro/sync";

const PROVIDERS: { value: ProviderRoteiro; label: string; nota: string }[] = [
  { value: "fake", label: "Teste (sem IA)", nota: "Não usa chave — valida o fluxo." },
  { value: "gemini", label: "Google Gemini", nota: "Requer chave nas Configurações." },
  { value: "openai", label: "OpenAI (GPT)", nota: "Requer chave nas Configurações." },
];

/** Baixa um conteúdo textual como arquivo. */
function baixarTexto(nome: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Decodifica um Blob de áudio num AudioBuffer. */
async function decodificarBlob(blob: Blob): Promise<AudioBuffer> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arr = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arr.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }
}

export function Estudio() {
  // Etapa 1 — roteiro
  const [tema, setTema] = React.useState("");
  const [provider, setProvider] = React.useState<ProviderRoteiro>("fake");
  const [promptSistema, setPromptSistema] = React.useState("");
  const [roteiro, setRoteiro] = React.useState("");
  const [gerandoRoteiro, setGerandoRoteiro] = React.useState(false);

  // Etapa 2 — áudio (DarkVI)
  const [vozes, setVozes] = React.useState<DarkviVoice[]>([]);
  const [vozErro, setVozErro] = React.useState<string | null>(null);
  const [voz, setVoz] = React.useState("");
  const [gerandoAudio, setGerandoAudio] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const audioBlobRef = React.useRef<Blob | null>(null);

  // Etapa 3 — sincronização
  const [sincronizando, setSincronizando] = React.useState(false);
  const [modelPct, setModelPct] = React.useState(0);
  const [segmentos, setSegmentos] = React.useState<Segmento[]>([]);
  const [timings, setTimings] = React.useState<Timings | null>(null);

  const [erro, setErro] = React.useState<string | null>(null);

  // Carrega as vozes da DarkVI ao montar (usa a chave salva ou a do servidor).
  React.useEffect(() => {
    let ativo = true;
    listarVozes()
      .then((lista) => {
        if (!ativo) return;
        setVozes(lista);
        if (lista.length > 0) setVoz(lista[0].idApi);
      })
      .catch((e) => {
        if (!ativo) return;
        setVozErro(e instanceof Error ? e.message : "Falha ao carregar vozes.");
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Libera o object URL do áudio quando trocar/desmontar.
  React.useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function handleGerarRoteiro() {
    if (!tema.trim()) {
      setErro("Informe o tema do vídeo.");
      return;
    }
    setErro(null);
    setGerandoRoteiro(true);
    try {
      const resultado = await gerarRoteiro({
        provider,
        tema: tema.trim(),
        promptSistema: promptSistema.trim() || undefined,
      });
      setRoteiro(resultado.texto);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o roteiro.");
    } finally {
      setGerandoRoteiro(false);
    }
  }

  async function handleGerarAudio() {
    if (!roteiro.trim()) {
      setErro("Gere ou escreva um roteiro antes de sintetizar o áudio.");
      return;
    }
    if (!voz) {
      setErro("Selecione uma voz. Configure a chave da Darkvi se a lista estiver vazia.");
      return;
    }
    setErro(null);
    setGerandoAudio(true);
    // Reinicia sincronização anterior (o áudio mudou).
    setSegmentos([]);
    setTimings(null);
    try {
      const id = await criarAudio({ text: roteiro.trim(), voice: voz });
      await aguardarConclusao(id);
      const blob = await baixarAudioBlob(id);
      audioBlobRef.current = blob;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o áudio.");
    } finally {
      setGerandoAudio(false);
    }
  }

  async function handleSincronizar() {
    const blob = audioBlobRef.current;
    if (!blob) {
      setErro("Gere o áudio antes de sincronizar.");
      return;
    }
    setErro(null);
    setSincronizando(true);
    setModelPct(0);
    setSegmentos([]);
    setTimings(null);
    try {
      const buffer = await decodificarBlob(blob);
      const samples = await audioBufferToMono16k(buffer);
      const { palavras } = await transcribeSamplesWithTimestamps(samples, {
        language: "portuguese",
        duracaoSegundos: buffer.duration,
        onModelProgress: setModelPct,
      });
      if (palavras.length === 0) {
        throw new Error(
          "A transcrição não retornou palavras com tempo. Tente um áudio com fala mais clara."
        );
      }
      const segs = agruparPalavras(palavras);
      setSegmentos(segs);
      setTimings(montarTimings(segs, buffer.duration));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao sincronizar.");
    } finally {
      setSincronizando(false);
    }
  }

  const srt = segmentos.length > 0 ? segmentosParaSRT(segmentos) : "";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        icon={Clapperboard}
        title="Estúdio"
        description="Gere o roteiro com IA, sintetize a narração e sincronize o texto ao áudio — tudo em sequência."
      />

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Etapa 1 — Roteiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary text-sm font-semibold">
              1
            </span>
            <Sparkles className="h-4 w-4" /> Roteiro
          </CardTitle>
          <CardDescription>
            Escolha o provider de IA e descreva o tema. Você pode editar o texto depois.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tema">Tema do vídeo</Label>
              <Input
                id="tema"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex.: a história dos buracos negros"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="provider">Provider de IA</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as ProviderRoteiro)}
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {PROVIDERS.find((p) => p.value === provider)?.nota}
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="promptSistema">
              Instruções do canal <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="promptSistema"
              value={promptSistema}
              onChange={(e) => setPromptSistema(e.target.value)}
              placeholder="Tom, duração-alvo, público, estilo de narração..."
              className="min-h-20"
            />
          </div>

          <Button onClick={handleGerarRoteiro} disabled={gerandoRoteiro} className="gap-2">
            {gerandoRoteiro ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {gerandoRoteiro ? "Gerando..." : "Gerar roteiro"}
          </Button>

          {roteiro && (
            <div className="grid gap-1.5">
              <Label htmlFor="roteiro">Roteiro (editável)</Label>
              <Textarea
                id="roteiro"
                value={roteiro}
                onChange={(e) => setRoteiro(e.target.value)}
                className="min-h-40"
              />
              <p className="text-xs text-muted-foreground">
                {roteiro.length} caracteres
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Etapa 2 — Áudio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary text-sm font-semibold">
              2
            </span>
            <AudioLines className="h-4 w-4" /> Narração (Darkvi)
          </CardTitle>
          <CardDescription>
            Sintetiza o roteiro em áudio com a voz escolhida.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {vozErro ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {vozErro} Configure a chave da Darkvi em Configurações para carregar as vozes.
              </span>
            </div>
          ) : (
            <div className="grid gap-1.5 sm:max-w-sm">
              <Label htmlFor="voz">Voz</Label>
              <Select value={voz} onValueChange={setVoz} disabled={vozes.length === 0}>
                <SelectTrigger id="voz">
                  <SelectValue placeholder="Carregando vozes..." />
                </SelectTrigger>
                <SelectContent>
                  {vozes.map((v) => (
                    <SelectItem key={v.idApi} value={v.idApi}>
                      {v.name}
                      {v.language ? ` · ${v.language}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleGerarAudio}
            disabled={gerandoAudio || !roteiro.trim()}
            className="gap-2"
          >
            {gerandoAudio ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AudioLines className="h-4 w-4" />
            )}
            {gerandoAudio ? "Sintetizando..." : "Gerar áudio"}
          </Button>

          {audioUrl && (
            <div className="space-y-2">
              <audio controls src={audioUrl} className="w-full" />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => baixarTextoBlob(audioBlobRef.current, "narracao.mp3")}
              >
                <Download className="h-4 w-4" /> Baixar MP3
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Etapa 3 — Sincronização */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary text-sm font-semibold">
              3
            </span>
            <Waypoints className="h-4 w-4" /> Sincronização
          </CardTitle>
          <CardDescription>
            Alinha o texto ao áudio (Whisper, no navegador) e gera legenda SRT + timings.json.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleSincronizar}
            disabled={sincronizando || !audioUrl}
            className="gap-2"
          >
            {sincronizando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Waypoints className="h-4 w-4" />
            )}
            {sincronizando ? "Sincronizando..." : "Sincronizar áudio ↔ texto"}
          </Button>

          {sincronizando && modelPct > 0 && modelPct < 100 && (
            <div className="space-y-1">
              <Progress value={modelPct} />
              <p className="text-xs text-muted-foreground">
                Baixando modelo de transcrição… {modelPct}%
              </p>
            </div>
          )}

          {segmentos.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{segmentos.length} segmentos</Badge>
                {timings && (
                  <Badge variant="secondary">
                    {timings.duracao.toFixed(1)}s de áudio
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => baixarTexto("legenda.srt", srt, "application/x-subrip")}
                >
                  <Captions className="h-4 w-4" /> Baixar SRT
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    baixarTexto(
                      "timings.json",
                      JSON.stringify(timings, null, 2),
                      "application/json"
                    )
                  }
                >
                  <FileJson className="h-4 w-4" /> Baixar timings.json
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Início</th>
                      <th className="px-3 py-2 font-medium">Fim</th>
                      <th className="px-3 py-2 font-medium">Texto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmentos.map((seg, i) => (
                      <tr key={i} className="border-t">
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-muted-foreground">
                          {seg.inicio.toFixed(2)}s
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-muted-foreground">
                          {seg.fim.toFixed(2)}s
                        </td>
                        <td className="px-3 py-1.5">{seg.texto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Baixa um Blob (áudio) já em memória. */
function baixarTextoBlob(blob: Blob | null, nome: string) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
