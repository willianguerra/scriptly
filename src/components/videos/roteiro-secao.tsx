"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { RoteiroEtapa, type EtapaStatus } from "@/components/estudio-workflow";
import { listarPrompts } from "@/lib/prompt-api";
import { gerarRoteiro } from "@/lib/roteiro-client";
import { atualizarVideo } from "@/lib/videos/client";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import type { PromptSalvo } from "@/types/prompt";
import type { VideoSalvo } from "@/types/video";

const PROVIDERS_VALIDOS: ProviderRoteiro[] = ["fake", "gemini", "openai"];

function normalizarProvider(valor: string | null): ProviderRoteiro {
  return PROVIDERS_VALIDOS.includes(valor as ProviderRoteiro)
    ? (valor as ProviderRoteiro)
    : "fake";
}

type StatusSalvamento = "idle" | "salvando" | "salvo";

type RoteiroSecaoProps = {
  video: VideoSalvo;
  promptPadraoCanal: string | null;
  onVideoChange: (patch: Partial<VideoSalvo>) => void;
};

export function RoteiroSecao({
  video,
  promptPadraoCanal,
  onVideoChange,
}: RoteiroSecaoProps) {
  const [tema, setTema] = React.useState(video.tema ?? "");
  const [provider, setProvider] = React.useState<ProviderRoteiro>(
    normalizarProvider(video.provider)
  );
  const [promptSistema, setPromptSistema] = React.useState(
    video.promptSistema ?? ""
  );
  const [promptId, setPromptId] = React.useState("__padrao__");
  const [roteiro, setRoteiro] = React.useState(video.roteiro ?? "");
  const [prompts, setPrompts] = React.useState<PromptSalvo[]>([]);
  const [gerando, setGerando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [statusSalvamento, setStatusSalvamento] =
    React.useState<StatusSalvamento>("idle");

  // Biblioteca de prompts + a opção sintética "Padrão do canal".
  React.useEffect(() => {
    let ativo = true;
    listarPrompts()
      .then((lista) => {
        if (ativo) setPrompts(lista);
      })
      .catch(() => {
        // A biblioteca é opcional aqui.
      });
    return () => {
      ativo = false;
    };
  }, []);

  const promptsComCanal = React.useMemo<PromptSalvo[]>(() => {
    if (!promptPadraoCanal || promptPadraoCanal.trim().length === 0) {
      return prompts;
    }
    return [
      {
        id: "__canal__",
        nome: "Padrão do canal",
        texto: promptPadraoCanal,
        atualizadoEm: 0,
      },
      ...prompts,
    ];
  }, [prompts, promptPadraoCanal]);

  // Baseline do que já está persistido. Compararmos contra ele (em vez de
  // "pular o primeiro render") evita saves espúrios do estado inicial — inclusive
  // com o duplo-efeito do StrictMode — e a corrida com o "Gerar tudo".
  type Snapshot = {
    tema: string;
    provider: ProviderRoteiro;
    promptSistema: string;
    roteiro: string;
  };
  const ultimoSalvo = React.useRef<Snapshot>({
    tema: video.tema ?? "",
    provider: normalizarProvider(video.provider),
    promptSistema: video.promptSistema ?? "",
    roteiro: video.roteiro ?? "",
  });

  const salvar = React.useCallback(
    async (snap: Snapshot) => {
      ultimoSalvo.current = snap;
      setStatusSalvamento("salvando");
      try {
        await atualizarVideo(video.id, {
          tema: snap.tema,
          provider: snap.provider,
          promptSistema: snap.promptSistema,
          roteiro: snap.roteiro,
        });
        onVideoChange(snap);
        setStatusSalvamento("salvo");
        window.setTimeout(() => setStatusSalvamento("idle"), 1500);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao salvar o roteiro.");
        setStatusSalvamento("idle");
      }
    },
    [video.id, onVideoChange]
  );

  // Auto-save com debounce: só dispara quando algo muda de fato vs. o salvo.
  React.useEffect(() => {
    const snap: Snapshot = { tema, provider, promptSistema, roteiro };
    const prev = ultimoSalvo.current;
    if (
      snap.tema === prev.tema &&
      snap.provider === prev.provider &&
      snap.promptSistema === prev.promptSistema &&
      snap.roteiro === prev.roteiro
    ) {
      return;
    }
    const t = window.setTimeout(() => void salvar(snap), 800);
    return () => window.clearTimeout(t);
  }, [tema, provider, promptSistema, roteiro, salvar]);

  function handleSelecionarPrompt(id: string) {
    setPromptId(id);
    if (id === "__padrao__") {
      setPromptSistema("");
      return;
    }
    if (id === "__canal__") {
      setPromptSistema(promptPadraoCanal ?? "");
      return;
    }
    const escolhido = promptsComCanal.find((p) => p.id === id);
    if (escolhido) setPromptSistema(escolhido.texto);
  }

  function handlePromptSistemaChange(value: string) {
    setPromptSistema(value);
    if (promptId !== "__padrao__") setPromptId("__padrao__");
  }

  async function handleGerar() {
    if (!tema.trim()) {
      setErro("Informe o tema do vídeo.");
      return;
    }
    setErro(null);
    setGerando(true);
    try {
      const resultado = await gerarRoteiro({
        provider,
        tema: tema.trim(),
        promptSistema: promptSistema.trim() || undefined,
      });
      setRoteiro(resultado.texto);
      await salvar({
        tema,
        provider,
        promptSistema,
        roteiro: resultado.texto,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o roteiro.");
    } finally {
      setGerando(false);
    }
  }

  const palavras = roteiro.trim()
    ? roteiro.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const status: EtapaStatus = roteiro.trim().length > 0 ? "concluida" : "atual";

  return (
    <div className="space-y-2">
      <div className="flex h-5 items-center justify-end gap-1.5 text-xs text-muted-foreground">
        {statusSalvamento === "salvando" && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
          </>
        )}
        {statusSalvamento === "salvo" && (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" /> Salvo
          </>
        )}
      </div>

      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      <RoteiroEtapa
        status={status}
        tema={tema}
        provider={provider}
        prompts={promptsComCanal}
        promptId={promptId}
        promptSistema={promptSistema}
        roteiro={roteiro}
        gerando={gerando}
        palavras={palavras}
        onTemaChange={setTema}
        onProviderChange={setProvider}
        onPromptSelect={handleSelecionarPrompt}
        onPromptChange={handlePromptSistemaChange}
        onRoteiroChange={setRoteiro}
        onGerar={handleGerar}
      />
    </div>
  );
}
