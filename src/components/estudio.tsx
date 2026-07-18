"use client";

import * as React from "react";
import { AlertCircle, Clapperboard, Clock3, X } from "lucide-react";

import {
  EtapasNavegacao,
  NarracaoEtapa,
  ResumoProjeto,
  RoteiroEtapa,
  SincronizacaoEtapa,
  type EtapaStatus,
} from "@/components/estudio-workflow";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { audioBufferToMono16k } from "@/lib/audioUtils";
import {
  aguardarConclusao,
  baixarAudioBlob,
  criarAudio,
  listarVozes,
} from "@/lib/darkvi";
import { listarPrompts } from "@/lib/prompt-api";
import {
  agruparPalavras,
  montarTimings,
  segmentosParaSRT,
  type Segmento,
  type Timings,
} from "@/lib/roteiro/sync";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import { gerarRoteiro } from "@/lib/roteiro-client";
import { transcribeSamplesWithTimestamps } from "@/lib/whisper-browser";
import type { DarkviVoice } from "@/types/darkvi";
import type { PromptSalvo } from "@/types/prompt";

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

async function decodificarBlob(blob: Blob): Promise<AudioBuffer> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arr = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arr.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }
}

export function Estudio() {
  const [tema, setTema] = React.useState("");
  const [provider, setProvider] = React.useState<ProviderRoteiro>("fake");
  const [promptSistema, setPromptSistema] = React.useState("");
  const [prompts, setPrompts] = React.useState<PromptSalvo[]>([]);
  const [promptId, setPromptId] = React.useState("__padrao__");
  const [roteiro, setRoteiro] = React.useState("");
  const [gerandoRoteiro, setGerandoRoteiro] = React.useState(false);

  const [vozes, setVozes] = React.useState<DarkviVoice[]>([]);
  const [vozErro, setVozErro] = React.useState<string | null>(null);
  const [voz, setVoz] = React.useState("");
  const [gerandoAudio, setGerandoAudio] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const audioBlobRef = React.useRef<Blob | null>(null);

  const [sincronizando, setSincronizando] = React.useState(false);
  const [modelPct, setModelPct] = React.useState(0);
  const [segmentos, setSegmentos] = React.useState<Segmento[]>([]);
  const [timings, setTimings] = React.useState<Timings | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let ativo = true;
    listarPrompts()
      .then((lista) => {
        if (ativo) setPrompts(lista);
      })
      .catch(() => {
        // A biblioteca é opcional no fluxo do Estúdio.
      });
    return () => {
      ativo = false;
    };
  }, []);

  React.useEffect(() => {
    let ativo = true;
    listarVozes()
      .then((lista) => {
        if (!ativo) return;
        setVozes(lista);
        if (lista.length > 0) setVoz(lista[0].idApi);
      })
      .catch((error) => {
        if (!ativo) return;
        setVozErro(error instanceof Error ? error.message : "Falha ao carregar vozes.");
      });
    return () => {
      ativo = false;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function handleSelecionarPrompt(id: string) {
    setPromptId(id);
    if (id === "__padrao__") {
      setPromptSistema("");
      return;
    }
    const escolhido = prompts.find((prompt) => prompt.id === id);
    if (escolhido) setPromptSistema(escolhido.texto);
  }

  function handlePromptSistemaChange(value: string) {
    setPromptSistema(value);
    if (promptId !== "__padrao__") setPromptId("__padrao__");
  }

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
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao gerar o roteiro.");
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
    setSegmentos([]);
    setTimings(null);
    try {
      const id = await criarAudio({ text: roteiro.trim(), voice: voz });
      await aguardarConclusao(id);
      const blob = await baixarAudioBlob(id);
      audioBlobRef.current = blob;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao gerar o áudio.");
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
      const novosSegmentos = agruparPalavras(palavras);
      setSegmentos(novosSegmentos);
      setTimings(montarTimings(novosSegmentos, buffer.duration));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao sincronizar.");
    } finally {
      setSincronizando(false);
    }
  }

  const temRoteiro = roteiro.trim().length > 0;
  const temAudio = Boolean(audioUrl);
  const temSincronizacao = segmentos.length > 0;
  const palavrasRoteiro = temRoteiro
    ? roteiro.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const minutosEstimados = Math.max(1, Math.ceil(palavrasRoteiro / 150));
  const statusRoteiro: EtapaStatus = temRoteiro ? "concluida" : "atual";
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
  const progresso = temSincronizacao ? 100 : temAudio ? 66 : temRoteiro ? 33 : 0;
  const proximaAcao = !temRoteiro
    ? "Descreva o vídeo e gere o primeiro roteiro."
    : !temAudio
      ? "Escolha uma voz e gere a narração."
      : !temSincronizacao
        ? "Sincronize a narração para criar os arquivos finais."
        : "Projeto pronto para baixar e usar na edição.";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={Clapperboard}
          title="Estúdio"
          description="Do tema aos arquivos de edição, em um fluxo guiado de três etapas."
        />
        <Badge variant="outline" className="w-fit gap-1.5 px-2.5 py-1">
          <Clock3 className="size-3.5" />
          {temRoteiro ? `~${minutosEstimados} min de narração` : "Novo projeto"}
        </Badge>
      </div>

      <EtapasNavegacao
        roteiro={statusRoteiro}
        audio={statusAudio}
        sincronizacao={statusSincronizacao}
      />

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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <RoteiroEtapa
            status={statusRoteiro}
            tema={tema}
            provider={provider}
            prompts={prompts}
            promptId={promptId}
            promptSistema={promptSistema}
            roteiro={roteiro}
            gerando={gerandoRoteiro}
            palavras={palavrasRoteiro}
            onTemaChange={setTema}
            onProviderChange={setProvider}
            onPromptSelect={handleSelecionarPrompt}
            onPromptChange={handlePromptSistemaChange}
            onRoteiroChange={setRoteiro}
            onGerar={handleGerarRoteiro}
          />
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
            onVozChange={setVoz}
            onGerar={handleGerarAudio}
            onBaixar={() => baixarBlob(audioBlobRef.current, "narracao.mp3")}
          />
          <SincronizacaoEtapa
            status={statusSincronizacao}
            temAudio={temAudio}
            concluida={temSincronizacao}
            sincronizando={sincronizando}
            modelPct={modelPct}
            segmentos={segmentos}
            timings={timings}
            onSincronizar={handleSincronizar}
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

        <ResumoProjeto
          progresso={progresso}
          temRoteiro={temRoteiro}
          temAudio={temAudio}
          temSincronizacao={temSincronizacao}
          proximaAcao={proximaAcao}
          palavras={palavrasRoteiro}
          minutosEstimados={minutosEstimados}
        />
      </div>
    </div>
  );
}
