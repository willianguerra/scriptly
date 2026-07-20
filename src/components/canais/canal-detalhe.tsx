"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clapperboard,
  Info,
  Video,
  CalendarDays,
  Loader2,
  ChevronLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { obterCanal } from "@/lib/channels/client";
import { rotuloIdioma } from "@/lib/idiomas";
import type { CanalSalvo } from "@/types/channel";
import { cn } from "@/lib/utils";
import { VideosAba } from "@/components/canais/videos-aba";

type Aba = "dados" | "videos" | "calendario";

const ABAS: { id: Aba; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dados", label: "Dados", icon: Info },
  { id: "videos", label: "Vídeos", icon: Video },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
];

export function CanalDetalhe({ id }: { id: string }) {
  const [canal, setCanal] = React.useState<CanalSalvo | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aba, setAba] = React.useState<Aba>("dados");

  React.useEffect(() => {
    let ativo = true;
    obterCanal(id)
      .then((c) => {
        if (ativo) setCanal(c);
      })
      .catch((e) => {
        if (ativo)
          setErro(e instanceof Error ? e.message : "Falha ao carregar o canal.");
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
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando canal…
      </p>
    );
  }

  if (erro || !canal) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {erro ?? "Canal não encontrado."}
        </p>
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/">
            <ChevronLeft className="h-4 w-4" /> Voltar aos canais
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 gap-1.5 text-muted-foreground"
        >
          <Link href="/">
            <ChevronLeft className="h-4 w-4" /> Canais
          </Link>
        </Button>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <Clapperboard className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{canal.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {canal.handle || "Sem handle"}
              {canal.nicho ? ` · ${canal.nicho}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {ABAS.map(({ id: abaId, label, icon: Icon }) => (
          <button
            key={abaId}
            type="button"
            onClick={() => setAba(abaId)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              aba === abaId
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {aba === "dados" && <AbaDados canal={canal} />}
      {aba === "videos" && <VideosAba channelId={canal.id} />}
      {aba === "calendario" && (
        <PlaceholderAba texto="A agenda dos vídeos aparecerá aqui (Fase 6)." />
      )}
    </div>
  );
}

function AbaDados({ canal }: { canal: CanalSalvo }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="space-y-4 p-5">
          <Campo rotulo="Nome" valor={canal.nome} />
          <Campo rotulo="Handle" valor={canal.handle} />
          <Campo rotulo="Nicho" valor={canal.nicho} />
          <Campo rotulo="Idioma da narração" valor={rotuloIdioma(canal.idioma)} />
          <Campo rotulo="Descrição" valor={canal.descricao} />
          <Campo
            rotulo="Prompt padrão do canal"
            valor={
              canal.defaultPromptNome
                ? `${canal.defaultPromptNome} (biblioteca)`
                : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  mono,
}: {
  rotulo: string;
  valor: string | null;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={cn(
          "whitespace-pre-wrap text-sm",
          !valor && "text-muted-foreground/60",
          mono && valor && "font-mono text-xs"
        )}
      >
        {valor || "—"}
      </p>
    </div>
  );
}

function PlaceholderAba({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}
