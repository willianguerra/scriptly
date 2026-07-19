"use client";

import * as React from "react";
import { Check, Copy, Download, Images, Loader2 } from "lucide-react";

import { VideoPromptsChat } from "@/components/video-prompts-chat";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { atualizarVideo } from "@/lib/videos/client";
import { sincronizacaoTexto } from "@/lib/videos/artefatos";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import type { VideoSalvo } from "@/types/video";

const PROVIDERS_VALIDOS: ProviderRoteiro[] = ["fake", "gemini", "openai"];

function normalizarProvider(valor: string | null): ProviderRoteiro {
  return PROVIDERS_VALIDOS.includes(valor as ProviderRoteiro)
    ? (valor as ProviderRoteiro)
    : "fake";
}

function baixarTexto(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type PromptsCenaSecaoProps = {
  video: VideoSalvo;
  onVideoChange: (patch: Partial<VideoSalvo>) => void;
};

export function PromptsCenaSecao({
  video,
  onVideoChange,
}: PromptsCenaSecaoProps) {
  const provider = normalizarProvider(video.provider);
  const roteiro = video.roteiro ?? "";
  const sincronizacao = React.useMemo(
    () => sincronizacaoTexto(video),
    [video]
  );
  const liberado = sincronizacao.trim().length > 0;

  const [promptsSalvos, setPromptsSalvos] = React.useState(
    video.promptsCena ?? ""
  );
  const [chatConcluido, setChatConcluido] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);
  const [copiado, setCopiado] = React.useState(false);

  const salvar = React.useCallback(
    async (texto: string) => {
      setSalvando(true);
      try {
        await atualizarVideo(video.id, { promptsCena: texto });
        onVideoChange({ promptsCena: texto });
        setSalvo(true);
        window.setTimeout(() => setSalvo(false), 1500);
      } catch {
        // Mantém o texto na tela mesmo se o salvamento falhar.
      } finally {
        setSalvando(false);
      }
    },
    [video.id, onVideoChange]
  );

  function handleResultado(texto: string) {
    setPromptsSalvos(texto);
    void salvar(texto);
  }

  // Auto-save com debounce das edições manuais no painel salvo.
  const montado = React.useRef(false);
  React.useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      void salvar(promptsSalvos);
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptsSalvos]);

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(promptsSalvos);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Ignora falha de cópia.
    }
  }

  const status = promptsSalvos.trim() || chatConcluido
    ? "concluida"
    : liberado
      ? "atual"
      : "pendente";

  return (
    <div className="space-y-4">
      {promptsSalvos.trim() && (
        <Card>
          <CardHeader className="gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Images className="size-4 text-primary" /> Prompts de cena salvos
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
                  {salvando ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
                    </>
                  ) : salvo ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" /> Salvo
                    </>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopiar}
                >
                  {copiado ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copiado ? "Copiado" : "Copiar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => baixarTexto("prompts-cena.txt", promptsSalvos)}
                >
                  <Download className="size-4" /> Baixar
                </Button>
              </div>
            </div>
            <CardDescription>
              Editáveis — as alterações são salvas automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={promptsSalvos}
              onChange={(e) => setPromptsSalvos(e.target.value)}
              className="min-h-64 resize-y font-mono text-sm leading-relaxed"
              aria-label="Prompts de cena salvos"
            />
          </CardContent>
        </Card>
      )}

      <VideoPromptsChat
        status={status}
        provider={provider}
        roteiro={roteiro}
        sincronizacao={sincronizacao}
        liberado={liberado}
        onConcluidoChange={setChatConcluido}
        onResultado={handleResultado}
      />
    </div>
  );
}
