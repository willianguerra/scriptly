"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clapperboard,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowRight,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CanalCentralModal } from "@/components/canais/canal-central-modal";
import { listarCanais, excluirCanal } from "@/lib/channels/client";
import { listarPrompts } from "@/lib/prompt-api";
import type { CanalSalvo } from "@/types/channel";
import type { PromptSalvo } from "@/types/prompt";

export function CanaisLista() {
  const [lista, setLista] = React.useState<CanalSalvo[]>([]);
  const [prompts, setPrompts] = React.useState<PromptSalvo[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  const [modalAberto, setModalAberto] = React.useState(false);
  const [canalEditando, setCanalEditando] = React.useState<CanalSalvo | null>(
    null
  );

  React.useEffect(() => {
    listarCanais()
      .then(setLista)
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Falha ao carregar canais.")
      )
      .finally(() => setCarregando(false));
    listarPrompts()
      .then(setPrompts)
      .catch(() => {
        // A biblioteca é opcional para o canal.
      });
  }, []);

  function abrirNovo() {
    setCanalEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(c: CanalSalvo) {
    setCanalEditando(c);
    setModalAberto(true);
  }

  function handleSalvo(salvo: CanalSalvo) {
    setLista((atual) => {
      const existe = atual.some((c) => c.id === salvo.id);
      return existe
        ? atual.map((c) => (c.id === salvo.id ? salvo : c))
        : [salvo, ...atual];
    });
  }

  async function handleExcluir(c: CanalSalvo) {
    if (
      !window.confirm(
        `Excluir o canal "${c.nome}"? Os vídeos dele também serão removidos.`
      )
    ) {
      return;
    }
    try {
      await excluirCanal(c.id);
      setLista((atual) => atual.filter((x) => x.id !== c.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={Clapperboard}
          title="Canais"
          description="Gerencie seus canais do YouTube — cada um com seus dados, agenda e vídeos."
        />
        <Button className="w-fit gap-2" onClick={abrirNovo}>
          <Plus className="h-4 w-4" /> Novo canal
        </Button>
      </div>

      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando canais…
        </p>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum canal ainda. Crie o primeiro para começar a organizar seus
            vídeos.
          </p>
          <Button className="mt-4 gap-2" onClick={abrirNovo}>
            <Plus className="h-4 w-4" /> Criar canal
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((c) => (
            <Card key={c.id} className="group relative overflow-hidden">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.nome}</p>
                    {c.handle ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {c.handle}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar canal"
                      onClick={() => abrirEdicao(c)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir canal"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleExcluir(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {c.nicho ? (
                  <span className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {c.nicho}
                  </span>
                ) : null}

                <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {c.descricao || "Sem descrição."}
                </p>

                <Link
                  href={`/canais/${c.id}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Abrir canal <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CanalCentralModal
        aberto={modalAberto}
        canal={canalEditando}
        prompts={prompts}
        onOpenChange={setModalAberto}
        onSalvo={handleSalvo}
      />
    </div>
  );
}
