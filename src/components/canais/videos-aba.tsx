"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, Loader2, ArrowRight, Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listarVideos,
  criarVideo,
  excluirVideo,
} from "@/lib/videos/client";
import { estagioDoVideo } from "@/lib/videos/estagio";
import type { VideoSalvo } from "@/types/video";

export function VideosAba({ channelId }: { channelId: string }) {
  const [lista, setLista] = React.useState<VideoSalvo[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  const [dialogAberto, setDialogAberto] = React.useState(false);
  const [titulo, setTitulo] = React.useState("");
  const [tema, setTema] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const [erroForm, setErroForm] = React.useState<string | null>(null);

  React.useEffect(() => {
    let ativo = true;
    listarVideos(channelId)
      .then((v) => {
        if (ativo) setLista(v);
      })
      .catch((e) => {
        if (ativo)
          setErro(e instanceof Error ? e.message : "Falha ao carregar vídeos.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [channelId]);

  function abrirNovo() {
    setTitulo("");
    setTema("");
    setErroForm(null);
    setDialogAberto(true);
  }

  async function handleCriar() {
    setErroForm(null);
    setSalvando(true);
    try {
      const criado = await criarVideo(channelId, {
        titulo,
        tema: tema.trim() || undefined,
      });
      setLista((atual) => [criado, ...atual]);
      setDialogAberto(false);
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não foi possível criar.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(v: VideoSalvo) {
    if (!window.confirm(`Excluir o vídeo "${v.titulo}"?`)) return;
    try {
      await excluirVideo(v.id);
      setLista((atual) => atual.filter((x) => x.id !== v.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Vídeos ({lista.length})
        </h2>
        <Button size="sm" className="gap-2" onClick={abrirNovo}>
          <Plus className="h-4 w-4" /> Novo vídeo
        </Button>
      </div>

      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando vídeos…
        </p>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum vídeo neste canal ainda.
          </p>
          <Button className="mt-4 gap-2" onClick={abrirNovo}>
            <Plus className="h-4 w-4" /> Criar primeiro vídeo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((v) => {
            const estagio = estagioDoVideo(v);
            return (
              <Card key={v.id} className="group">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Film className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.titulo}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {v.tema || "Sem tema definido"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`hidden rounded-md px-2 py-0.5 text-xs sm:inline ${estagio.classe}`}
                    >
                      {estagio.rotulo}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir vídeo"
                      className="text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      onClick={() => handleExcluir(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                      <Link href={`/videos/${v.id}`}>
                        Abrir <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo vídeo</DialogTitle>
            <DialogDescription>
              Comece pelo título e, opcionalmente, o tema. O roteiro e a narração
              vêm depois, dentro do vídeo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="video-titulo">Título</Label>
              <Input
                id="video-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Por que o céu é azul?"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="video-tema">Tema (opcional)</Label>
              <Textarea
                id="video-tema"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Assunto para gerar o roteiro depois…"
                className="min-h-20"
              />
            </div>

            {erroForm && (
              <p className="text-sm text-destructive" role="alert">
                {erroForm}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              className="gap-2"
              onClick={handleCriar}
              disabled={!titulo.trim() || salvando}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar vídeo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
