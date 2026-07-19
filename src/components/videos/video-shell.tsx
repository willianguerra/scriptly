"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Film,
  Loader2,
  FileText,
  AudioLines,
  ListChecks,
  Images,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { obterVideo } from "@/lib/videos/client";
import { estagioDoVideo } from "@/lib/videos/estagio";
import type { VideoSalvo } from "@/types/video";

const ETAPAS = [
  {
    icon: FileText,
    titulo: "Roteiro",
    descricao: "Gere e edite o roteiro do vídeo (Fase 3).",
  },
  {
    icon: AudioLines,
    titulo: "Narração",
    descricao: "Escolha a voz e gere a narração (Fase 4).",
  },
  {
    icon: ListChecks,
    titulo: "Sincronização",
    descricao: "Transcreva e gere legenda/timings (Fase 4).",
  },
  {
    icon: Images,
    titulo: "Prompts de imagem",
    descricao: "Prompts de cena a partir do roteiro (Fase 5).",
  },
];

export function VideoShell({ id }: { id: string }) {
  const [video, setVideo] = React.useState<VideoSalvo | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let ativo = true;
    obterVideo(id)
      .then((v) => {
        if (ativo) setVideo(v);
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
      </div>

      <div className="grid gap-4">
        {ETAPAS.map(({ icon: Icon, titulo, descricao }) => (
          <Card key={titulo}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-medium">{titulo}</p>
                <p className="text-sm text-muted-foreground">{descricao}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
