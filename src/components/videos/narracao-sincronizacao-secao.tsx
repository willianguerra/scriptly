"use client";

import * as React from "react";
import { AlertCircle, Check, X } from "lucide-react";

import {
  NarracaoEtapa,
  SincronizacaoEtapa,
  type EtapaStatus,
} from "@/components/estudio-workflow";
import { Button } from "@/components/ui/button";
import { useUsuarioAtual } from "@/components/user-context";

import {
  MAX_SEGMENT_SECONDS,
  MIN_SEGMENT_SECONDS,
  SEGMENT_SECONDS,
  audioBufferToMono16k,
  sliceAudioBuffer,
} from "@/lib/audioUtils";
import {
  aguardarConclusao,
  baixarAudioBlob,
  criarAudio,
  listarVozes,
} from "@/lib/darkvi";
import {
  montarTimings,
  obterAudioGeradoParaSincronizacao,
  segmentosParaTexto,
  segmentosParaSRT,
  type Segmento,
  type Timings,
} from "@/lib/roteiro/sync";
import { transcribeSamples } from "@/lib/whisper-browser";
import {
  escolherVozPreferida,
  lerPreferenciaVoz,
  salvarPreferenciaVoz,
} from "@/lib/voice-preference";
import { atualizarVideo } from "@/lib/videos/client";
import type { DarkviVoice } from "@/types/darkvi";
import type { VideoSalvo } from "@/types/video";

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

function baixarBlob(blob: Blob | null, nome: string) {
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

function normalizarSegundos(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return SEGMENT_SECONDS;
  return Math.min(
    MAX_SEGMENT_SECONDS,
    Math.max(MIN_SEGMENT_SECONDS, Math.round(valor))
  );
}

// Reconstrói os segmentos salvos (Json) para o formato usado na UI.
function segmentosDoVideo(valor: unknown): Segmento[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (s): s is Segmento =>
      !!s &&
      typeof s === "object" &&
      typeof (s as Segmento).texto === "string" &&
      typeof (s as Segmento).inicio === "number" &&
      typeof (s as Segmento).fim === "number"
  );
}

type NarracaoSincronizacaoSecaoProps = {
  video: VideoSalvo;
  idioma: string;
  vozPadrao: string;
  onVideoChange: (patch: Partial<VideoSalvo>) => void;
};

export function NarracaoSincronizacaoSecao({
  video,
  idioma,
  vozPadrao,
  onVideoChange,
}: NarracaoSincronizacaoSecaoProps) {
  const { username } = useUsuarioAtual();

  const roteiro = video.roteiro ?? "";
  const temRoteiro = roteiro.trim().length > 0;

  const [vozes, setVozes] = React.useState<DarkviVoice[]>([]);
  const [vozErro, setVozErro] = React.useState<string | null>(null);
  const [voz, setVoz] = React.useState(video.voz ?? "");
  const [gerandoAudio, setGerandoAudio] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioGerado, setAudioGerado] = React.useState<Blob | null>(null);

  const [sincronizando, setSincronizando] = React.useState(false);
  const [modelPct, setModelPct] = React.useState(0);
  const [modelPronto, setModelPronto] = React.useState(false);
  const [segundosPorBloco, setSegundosPorBloco] =
    React.useState(SEGMENT_SECONDS);
  const [blocosTranscritos, setBlocosTranscritos] = React.useState(0);
  const [totalBlocos, setTotalBlocos] = React.useState(0);
  const [segmentos, setSegmentos] = React.useState<Segmento[]>(() =>
    segmentosDoVideo(video.segmentos)
  );
  const [timings, setTimings] = React.useState<Timings | null>(
    () => (video.timings as Timings | null) ?? null
  );
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvo, setSalvo] = React.useState(false);
  const vozManualRef = React.useRef(false);

  React.useEffect(() => {
    let ativo = true;
    listarVozes()
      .then((lista) => {
        if (ativo) setVozes(lista);
      })
      .catch((error) => {
        if (!ativo) return;
        setVozErro(
          error instanceof Error ? error.message : "Falha ao carregar vozes."
        );
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Pré-seleção da voz: escolha do usuário > voz do vídeo > voz padrão do canal
  // > preferência. Reavalia quando as vozes ou a voz padrão chegam.
  React.useEffect(() => {
    if (vozes.length === 0 || vozManualRef.current) return;
    const ids = vozes.map((v) => v.idApi);
    const escolha =
      video.voz && ids.includes(video.voz)
        ? video.voz
        : vozPadrao && ids.includes(vozPadrao)
          ? vozPadrao
          : escolherVozPreferida(ids, lerPreferenciaVoz(username));
    setVoz(escolha);
  }, [vozes, vozPadrao, video.voz, username]);

  React.useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function marcarSalvo() {
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1500);
  }

  function handleVozChange(value: string) {
    vozManualRef.current = true;
    setVoz(value);
    salvarPreferenciaVoz(value, username);
    // Persiste a voz escolhida no vídeo (o áudio em si não é salvo).
    atualizarVideo(video.id, { voz: value })
      .then(() => {
        onVideoChange({ voz: value });
        marcarSalvo();
      })
      .catch(() => {
        // Falha ao salvar a voz não deve travar a geração.
      });
  }

  async function handleGerarAudio() {
    if (!temRoteiro) {
      setErro("Gere ou escreva um roteiro antes de sintetizar o áudio.");
      return;
    }
    if (!voz) {
      setErro(
        "Selecione uma voz. Configure a chave da Darkvi se a lista estiver vazia."
      );
      return;
    }
    setErro(null);
    setGerandoAudio(true);
    setAudioGerado(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const id = await criarAudio({ text: roteiro.trim(), voice: voz });
      await aguardarConclusao(id);
      const blob = await baixarAudioBlob(id);
      setAudioGerado(blob);
      setAudioUrl(URL.createObjectURL(blob));
      // Garante a voz salva mesmo que o usuário não tenha trocado no select.
      if (video.voz !== voz) {
        await atualizarVideo(video.id, { voz }).catch(() => {});
        onVideoChange({ voz });
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao gerar o áudio.");
    } finally {
      setGerandoAudio(false);
    }
  }

  async function handleSincronizar() {
    let blob: Blob;
    try {
      blob = obterAudioGeradoParaSincronizacao(audioGerado);
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Áudio gerado indisponível."
      );
      return;
    }

    const segundos = normalizarSegundos(segundosPorBloco);
    setSegundosPorBloco(segundos);

    setErro(null);
    setSincronizando(true);
    setModelPct(0);
    setModelPronto(false);
    setBlocosTranscritos(0);
    setTotalBlocos(0);
    setSegmentos([]);
    setTimings(null);

    let ctx: AudioContext | null = null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AudioCtx();

      const arr = await blob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arr.slice(0));

      const brutos = sliceAudioBuffer(buffer, segundos, ctx);
      if (brutos.length === 0) {
        throw new Error("Não foi possível dividir o áudio gerado em blocos.");
      }
      setTotalBlocos(brutos.length);

      const novosSegmentos: Segmento[] = [];
      let concluidos = 0;
      for (const bruto of brutos) {
        const samples = await audioBufferToMono16k(bruto.buffer);
        const texto = await transcribeSamples(samples, {
          language: idioma,
          onModelProgress: (pct) => {
            setModelPct(pct);
            if (pct >= 100) setModelPronto(true);
          },
        });
        setModelPronto(true);

        novosSegmentos.push({ texto, inicio: bruto.start, fim: bruto.end });
        concluidos += 1;
        setBlocosTranscritos(concluidos);
        setSegmentos([...novosSegmentos]);
      }

      const novosTimings = montarTimings(novosSegmentos, buffer.duration);
      setTimings(novosTimings);

      // Persiste os artefatos de texto (áudio não é salvo).
      const srt = segmentosParaSRT(novosSegmentos);
      await atualizarVideo(video.id, {
        segmentos: novosSegmentos,
        timings: novosTimings,
        srt,
      });
      onVideoChange({ segmentos: novosSegmentos, timings: novosTimings, srt });
      marcarSalvo();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao sincronizar.");
    } finally {
      ctx?.close().catch(() => {});
      setSincronizando(false);
    }
  }

  const temAudio = Boolean(audioUrl && audioGerado);
  const temSincronizacao = segmentos.length > 0;
  const palavras = temRoteiro
    ? roteiro.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const minutosEstimados = Math.max(1, Math.ceil(palavras / 150));

  const statusAudio: EtapaStatus = temAudio
    ? "concluida"
    : temRoteiro
      ? "atual"
      : "pendente";
  const statusSincronizacao: EtapaStatus = temSincronizacao
    ? "concluida"
    : temAudio
      ? "atual"
      : "pendente";

  return (
    <div className="space-y-4">
      <div className="flex h-5 items-center justify-end gap-1.5 text-xs text-muted-foreground">
        {salvo && (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" /> Salvo
          </>
        )}
      </div>

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{erro}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-mr-1 -mt-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Fechar aviso"
            onClick={() => setErro(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {!temAudio && temSincronizacao && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Sincronização salva carregada abaixo. O áudio não é guardado — para
            sincronizar de novo, gere a narração novamente. Os arquivos (SRT,
            timings) já podem ser baixados.
          </span>
        </div>
      )}

      <NarracaoEtapa
        status={statusAudio}
        temRoteiro={temRoteiro}
        temAudio={temAudio}
        vozErro={vozErro}
        vozes={vozes}
        voz={voz}
        gerando={gerandoAudio}
        audioUrl={audioUrl}
        minutosEstimados={minutosEstimados}
        onVozChange={handleVozChange}
        onGerar={handleGerarAudio}
        onBaixar={() => baixarBlob(audioGerado, "narracao.mp3")}
      />

      <SincronizacaoEtapa
        status={statusSincronizacao}
        temAudio={temAudio}
        concluida={temSincronizacao}
        sincronizando={sincronizando}
        modelPct={modelPct}
        modelPronto={modelPronto}
        segundosPorBloco={segundosPorBloco}
        blocosTranscritos={blocosTranscritos}
        totalBlocos={totalBlocos}
        onSegundosChange={setSegundosPorBloco}
        segmentos={segmentos}
        timings={timings}
        audioUrl={audioUrl}
        textoExportacao={segmentosParaTexto(segmentos, timings?.duracao ?? 0)}
        onSincronizar={handleSincronizar}
        onBaixarTexto={() =>
          baixarTexto(
            "sincronizacao-audio.txt",
            segmentosParaTexto(segmentos, timings?.duracao ?? 0),
            "text/plain"
          )
        }
        onBaixarSrt={() =>
          baixarTexto(
            "legenda.srt",
            segmentosParaSRT(segmentos),
            "application/x-subrip"
          )
        }
        onBaixarTimings={() =>
          baixarTexto(
            "timings.json",
            JSON.stringify(timings, null, 2),
            "application/json"
          )
        }
      />
    </div>
  );
}
