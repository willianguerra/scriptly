"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  Film,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useUsuarioAtual } from "@/components/user-context";
import { atualizarVideo, obterVideo } from "@/lib/videos/client";
import { obterCanal } from "@/lib/channels/client";
import { estagioDoVideo } from "@/lib/videos/estagio";
import { msParaInputDate, inputDateParaISO } from "@/lib/videos/data";
import {
  executarPipeline,
  type PipelineEtapa,
  type PipelineProgresso,
} from "@/lib/videos/pipeline";
import { RoteiroSecao } from "@/components/videos/roteiro-secao";
import { NarracaoSincronizacaoSecao } from "@/components/videos/narracao-sincronizacao-secao";
import { PromptsCenaSecao } from "@/components/videos/prompts-cena-secao";
import type { VideoSalvo } from "@/types/video";

const ETAPA_LABEL: Record<PipelineEtapa, string> = {
  roteiro: "Gerando roteiro",
  narracao: "Gerando narração",
  sincronizacao: "Sincronizando áudio",
  prompts: "Gerando prompts de cena",
  concluido: "Concluído",
};

const ETAPA_ORDEM: PipelineEtapa[] = [
  "roteiro",
  "narracao",
  "sincronizacao",
  "prompts",
];

export function VideoShell({ id }: { id: string }) {
  const [video, setVideo] = React.useState<VideoSalvo | null>(null);
  const [promptPadraoCanal, setPromptPadraoCanal] = React.useState<string | null>(
    null
  );
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  const { username } = useUsuarioAtual();
  const [autoRodando, setAutoRodando] = React.useState(false);
  const [autoProgresso, setAutoProgresso] =
    React.useState<PipelineProgresso | null>(null);
  const [autoErro, setAutoErro] = React.useState<string | null>(null);
  const [autoConcluido, setAutoConcluido] = React.useState(false);
  const [sectionsKey, setSectionsKey] = React.useState(0);
  const autoIniciado = React.useRef(false);

  React.useEffect(() => {
    let ativo = true;
    obterVideo(id)
      .then(async (v) => {
        if (!ativo) return;
        setVideo(v);
        // Busca o prompt padrão do canal para oferecer como base do roteiro.
        try {
          const canal = await obterCanal(v.channelId);
          if (ativo) setPromptPadraoCanal(canal.promptSistemaPadrao);
        } catch {
          // Sem canal não impede o fluxo do roteiro.
        }
      })
      .catch((e) => {
        if (ativo)
          setErro(e instanceof Error ? e.message : "Falha ao carregar o vídeo.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  const handleVideoChange = React.useCallback((patch: Partial<VideoSalvo>) => {
    setVideo((atual) => (atual ? { ...atual, ...patch } : atual));
  }, []);

  const handleAgendarChange = React.useCallback(
    (valor: string) => {
      if (!video) return;
      const iso = inputDateParaISO(valor);
      setVideo((atual) =>
        atual ? { ...atual, scheduledAt: iso ? Date.parse(iso) : null } : atual
      );
      atualizarVideo(video.id, { scheduledAt: iso }).catch(() => {});
    },
    [video]
  );

  const handleGerarTudo = React.useCallback(async () => {
    if (!video || autoRodando) return;
    setAutoErro(null);
    setAutoConcluido(false);
    setAutoRodando(true);
    try {
      await executarPipeline(video, {
        username,
        onProgress: setAutoProgresso,
        onPatch: handleVideoChange,
      });
      // Re-monta as seções para refletirem os artefatos recém-gerados.
      setSectionsKey((k) => k + 1);
      setAutoConcluido(true);
      window.setTimeout(() => setAutoConcluido(false), 4000);
    } catch (e) {
      setAutoErro(
        e instanceof Error ? e.message : "Falha ao gerar automaticamente."
      );
    } finally {
      setAutoRodando(false);
      setAutoProgresso(null);
    }
  }, [video, autoRodando, username, handleVideoChange]);

  // Auto-início quando aberto com ?auto=1 (vindo de "Criar e gerar tudo").
  React.useEffect(() => {
    if (typeof window === "undefined" || !video || autoIniciado.current) return;
    const auto = new URLSearchParams(window.location.search).get("auto");
    if (auto === "1") {
      autoIniciado.current = true;
      void handleGerarTudo();
    }
  }, [video, handleGerarTudo]);

  if (carregando) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando vídeo…
      </p>
    );
  }

  if (erro || !video) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {erro ?? "Vídeo não encontrado."}
        </p>
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/">
            <ChevronLeft className="h-4 w-4" /> Voltar aos canais
          </Link>
        </Button>
      </div>
    );
  }

  const estagio = estagioDoVideo(video);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 gap-1.5 text-muted-foreground"
        >
          <Link href={`/canais/${video.channelId}`}>
            <ChevronLeft className="h-4 w-4" /> Voltar ao canal
          </Link>
        </Button>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <Film className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold">{video.titulo}</h1>
            <p className="text-sm text-muted-foreground">
              {video.tema || "Sem tema definido"}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-md px-2 py-1 text-xs ${estagio.classe}`}
          >
            {estagio.rotulo}
          </span>
        </div>
        <Progress value={estagio.progresso} className="h-1.5" />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <label
            htmlFor="agenda-video"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <CalendarDays className="h-4 w-4" /> Publicação:
          </label>
          <Input
            id="agenda-video"
            type="date"
            value={msParaInputDate(video.scheduledAt)}
            onChange={(e) => handleAgendarChange(e.target.value)}
            className="h-8 w-auto"
          />
          {video.scheduledAt != null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAgendarChange("")}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">Gerar tudo automaticamente</p>
              <p className="text-sm text-muted-foreground">
                Roteiro → narração → sincronização → prompts de cena, em sequência.
              </p>
            </div>
          </div>
          <Button onClick={handleGerarTudo} disabled={autoRodando} className="gap-2">
            {autoRodando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {autoRodando ? "Gerando…" : "Gerar tudo"}
          </Button>
        </div>

        {autoRodando && autoProgresso && (
          <div className="mt-4 space-y-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {ETAPA_LABEL[autoProgresso.etapa]}
                {autoProgresso.detalhe ? ` — ${autoProgresso.detalhe}` : ""}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {Math.min(
                  ETAPA_ORDEM.indexOf(autoProgresso.etapa) + 1,
                  ETAPA_ORDEM.length
                )}
                /{ETAPA_ORDEM.length}
              </span>
            </div>
            <Progress
              value={
                ((ETAPA_ORDEM.indexOf(autoProgresso.etapa) + 1) /
                  ETAPA_ORDEM.length) *
                100
              }
            />
            <p className="text-xs text-muted-foreground">
              Não feche esta aba — a sincronização roda no navegador.
            </p>
          </div>
        )}

        {autoConcluido && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-500">
            <Check className="h-4 w-4" /> Tudo pronto! Confira abaixo.
          </p>
        )}

        {autoErro && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{autoErro}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setAutoErro(null)}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>

      <RoteiroSecao
        key={`roteiro-${sectionsKey}`}
        video={video}
        promptPadraoCanal={promptPadraoCanal}
        onVideoChange={handleVideoChange}
      />

      <NarracaoSincronizacaoSecao
        key={`narracao-${sectionsKey}`}
        video={video}
        onVideoChange={handleVideoChange}
      />

      <PromptsCenaSecao
        key={`prompts-${sectionsKey}`}
        video={video}
        onVideoChange={handleVideoChange}
      />
    </div>
  );
}
