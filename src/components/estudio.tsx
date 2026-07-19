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
import { VideoPromptsChat } from "@/components/video-prompts-chat";
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
import { listarPrompts } from "@/lib/prompt-api";
import {
  montarTimings,
  obterAudioGeradoParaSincronizacao,
  segmentosParaTexto,
  segmentosParaSRT,
  type Segmento,
  type Timings,
} from "@/lib/roteiro/sync";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import { gerarRoteiro } from "@/lib/roteiro-client";
import { transcribeSamples } from "@/lib/whisper-browser";
import {
  escolherVozPreferida,
  lerPreferenciaVoz,
  salvarPreferenciaVoz,
} from "@/lib/voice-preference";
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

/** Mantém o tamanho do bloco dentro dos limites suportados. */
function normalizarSegundos(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return SEGMENT_SECONDS;
  return Math.min(
    MAX_SEGMENT_SECONDS,
    Math.max(MIN_SEGMENT_SECONDS, Math.round(valor))
  );
}

export function Estudio() {
  const { username } = useUsuarioAtual();
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
  const [audioGerado, setAudioGerado] = React.useState<Blob | null>(null);

  const [sincronizando, setSincronizando] = React.useState(false);
  const [modelPct, setModelPct] = React.useState(0);
  const [modelPronto, setModelPronto] = React.useState(false);
  const [segundosPorBloco, setSegundosPorBloco] = React.useState(SEGMENT_SECONDS);
  const [blocosTranscritos, setBlocosTranscritos] = React.useState(0);
  const [totalBlocos, setTotalBlocos] = React.useState(0);
  const [segmentos, setSegmentos] = React.useState<Segmento[]>([]);
  const [timings, setTimings] = React.useState<Timings | null>(null);
  const [promptsVideoConcluidos, setPromptsVideoConcluidos] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const handlePromptsVideoConcluidos = React.useCallback((concluido: boolean) => {
    setPromptsVideoConcluidos(concluido);
  }, []);

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
        const preferida = escolherVozPreferida(
          lista.map((item) => item.idApi),
          lerPreferenciaVoz(username)
        );
        setVoz(preferida);
        salvarPreferenciaVoz(preferida, username);
      })
      .catch((error) => {
        if (!ativo) return;
        setVozErro(error instanceof Error ? error.message : "Falha ao carregar vozes.");
      });
    return () => {
      ativo = false;
    };
  }, [username]);

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

  function handleVozChange(value: string) {
    setVoz(value);
    salvarPreferenciaVoz(value, username);
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
    setPromptsVideoConcluidos(false);
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
      setErro(error instanceof Error ? error.message : "Áudio gerado indisponível.");
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

      // Fatia a narração em blocos fixos e transcreve cada um — o mesmo caminho
      // confiável do Divisor de Áudio, para o resultado sair no mesmo padrão.
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
          language: "portuguese",
          onModelProgress: (pct) => {
            setModelPct(pct);
            if (pct >= 100) setModelPronto(true);
          },
        });
        setModelPronto(true);

        novosSegmentos.push({ texto, inicio: bruto.start, fim: bruto.end });
        concluidos += 1;
        setBlocosTranscritos(concluidos);
        // Exibe os blocos conforme são transcritos, como no Divisor de Áudio.
        setSegmentos([...novosSegmentos]);
      }

      setTimings(montarTimings(novosSegmentos, buffer.duration));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao sincronizar.");
    } finally {
      ctx?.close().catch(() => {});
      setSincronizando(false);
    }
  }

  const temRoteiro = roteiro.trim().length > 0;
  const temAudio = Boolean(audioUrl && audioGerado);
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
  const statusPromptsVideo: EtapaStatus = promptsVideoConcluidos
    ? "concluida"
    : temSincronizacao
      ? "atual"
      : "pendente";
  const progresso = promptsVideoConcluidos
    ? 100
    : temSincronizacao
      ? 75
      : temAudio
        ? 50
        : temRoteiro
          ? 25
          : 0;
  const proximaAcao = !temRoteiro
    ? "Descreva o vídeo e gere o primeiro roteiro."
    : !temAudio
      ? "Escolha uma voz e gere a narração."
      : !temSincronizacao
        ? "Sincronize a narração para criar os arquivos finais."
        : !promptsVideoConcluidos
          ? "Abra o agente e gere os prompts de vídeo sincronizados."
          : "Prompts prontos para gerar e revisar os vídeos.";
  const proximaAcaoHref = !temRoteiro
    ? "#etapa-roteiro"
    : !temAudio
      ? "#etapa-narracao"
      : !temSincronizacao
        ? "#etapa-sincronizacao"
        : !promptsVideoConcluidos
          ? "#etapa-prompts-video"
          : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={Clapperboard}
          title="Estúdio"
          description="Do tema aos prompts de vídeo, em um fluxo guiado de quatro etapas."
        />
        <Badge variant="outline" className="w-fit gap-1.5 px-2.5 py-1">
          <Clock3 className="size-3.5" />
          {temRoteiro ? `~${minutosEstimados} min de narração` : "Novo projeto"}
        </Badge>
      </div>

      <div className="xl:hidden">
        <EtapasNavegacao
          roteiro={statusRoteiro}
          audio={statusAudio}
          sincronizacao={statusSincronizacao}
          promptsVideo={statusPromptsVideo}
        />
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
            textoExportacao={segmentosParaTexto(
              segmentos,
              timings?.duracao ?? 0
            )}
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
          <VideoPromptsChat
            status={statusPromptsVideo}
            provider={provider}
            roteiro={roteiro}
            sincronizacao={segmentosParaTexto(segmentos, timings?.duracao ?? 0)}
            liberado={temSincronizacao}
            onConcluidoChange={handlePromptsVideoConcluidos}
          />
        </div>

        <ResumoProjeto
          progresso={progresso}
          statusRoteiro={statusRoteiro}
          statusAudio={statusAudio}
          statusSincronizacao={statusSincronizacao}
          statusPromptsVideo={statusPromptsVideo}
          proximaAcao={proximaAcao}
          proximaAcaoHref={proximaAcaoHref}
          temRoteiro={temRoteiro}
          palavras={palavrasRoteiro}
          minutosEstimados={minutosEstimados}
        />
      </div>
    </div>
  );
}
