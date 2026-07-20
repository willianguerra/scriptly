"use client";

import * as React from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  Download,
  Loader2,
  MessageSquareText,
  Send,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import type { MensagemChatPrompts } from "@/lib/video-prompts/flow";

type EtapaStatus = "concluida" | "atual" | "pendente";
type EstadoConversa = "inicio" | "analise" | "referencias" | "gestao";

const STATUS_LABEL: Record<EtapaStatus, string> = {
  concluida: "Concluída",
  atual: "Em andamento",
  pendente: "Aguardando",
};

function baixarResultado(texto: string) {
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "prompts-veo3-sincronizados.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function MensagensChat({
  mensagens,
  carregando,
  fimRef,
}: {
  mensagens: MensagemChatPrompts[];
  carregando: boolean;
  fimRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="max-h-[42rem] min-h-72 space-y-4 overflow-y-auto rounded-lg border bg-muted/15 p-3 sm:p-4"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Conversa com o agente de prompts"
    >
      {mensagens.length === 0 && (
        <div className="grid min-h-64 place-items-center px-4 text-center">
          <div className="max-w-md space-y-2">
            <Bot className="mx-auto size-8 text-primary" />
            <p className="font-medium">Contexto pronto para o agente</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              O fluxo mantém roteiro, sincronização, personagens confirmados e resultados anteriores em todas as mensagens.
            </p>
          </div>
        </div>
      )}

      {mensagens.map((mensagem) => (
        <article
          key={mensagem.id}
          className={`flex items-start gap-2.5 ${mensagem.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {mensagem.role === "assistant" && (
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
              <Bot className="size-4" />
            </span>
          )}
          <div
            className={`max-w-[92%] rounded-lg border px-3 py-2.5 sm:max-w-[86%] ${
              mensagem.role === "user"
                ? "border-primary/25 bg-primary text-primary-foreground"
                : "bg-card"
            }`}
          >
            <p className="mb-1 text-xs font-semibold opacity-70">
              {mensagem.role === "user" ? "Você" : "Scriptly"}
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
              {mensagem.content}
            </pre>
          </div>
          {mensagem.role === "user" && (
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
              <User className="size-4" />
            </span>
          )}
        </article>
      ))}

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" />
          O agente está verificando o fluxo e preparando a resposta completa...
        </div>
      )}
      <div ref={fimRef} />
    </div>
  );
}

export function VideoPromptsChatView({
  status,
  provider,
  liberado,
  estado,
  mensagens,
  entrada,
  carregando,
  erro,
  resultadoCenas,
  copiado,
  proximaAcao,
  fimRef,
  onEntradaChange,
  onAcaoPrincipal,
  onEnviar,
  onCopiarResultado,
}: {
  status: EtapaStatus;
  provider: ProviderRoteiro;
  liberado: boolean;
  estado: EstadoConversa;
  mensagens: MensagemChatPrompts[];
  entrada: string;
  carregando: boolean;
  erro: string | null;
  resultadoCenas: string;
  copiado: boolean;
  proximaAcao: string | null;
  fimRef: React.RefObject<HTMLDivElement | null>;
  onEntradaChange: (value: string) => void;
  onAcaoPrincipal: () => void;
  onEnviar: (event: React.FormEvent<HTMLFormElement>) => void;
  onCopiarResultado: () => void;
}) {
  const ajudaEntrada =
    estado === "gestao"
      ? 'Informe falhas ou conformidade, por exemplo: "falharam 5, 12 e 23".'
      : "Peça um ajuste nesta etapa antes de confirmar e avançar.";

  return (
    <Card id="etapa-prompts-video" className="scroll-mt-6 gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="border-b py-5!">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${status === "concluida" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`} aria-hidden="true">
            {status === "concluida" ? <CheckCircle2 className="size-5" /> : <MessageSquareText className="size-5" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle><h2 className="text-base leading-6 sm:text-lg"><span className="text-muted-foreground">4.</span> Gere os prompts de vídeo</h2></CardTitle>
            <CardDescription className="leading-relaxed">Converse com o Scriptly Agent 2.0 usando o roteiro e a sincronização já carregados.</CardDescription>
          </div>
          <Badge variant={status === "atual" ? "default" : "secondary"} className="shrink-0">{STATUS_LABEL[status]}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 py-5 sm:py-6">
        {!liberado ? (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            <CircleDashed className="mt-0.5 size-4 shrink-0" />
            Conclua a sincronização para liberar o agente. O roteiro e os blocos serão carregados automaticamente.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5"><Bot className="size-3.5" /> Scriptly Agent 2.0</Badge>
                <Badge variant="secondary">{provider === "fake" ? "Modo de teste" : provider === "openai" ? "OpenAI" : "Gemini"}</Badge>
              </div>
              {resultadoCenas && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={onCopiarResultado}>{copiado ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado ? "Copiado" : "Copiar prompts"}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => baixarResultado(resultadoCenas)}><Download className="size-4" /> Baixar TXT</Button>
                </div>
              )}
            </div>

            <MensagensChat mensagens={mensagens} carregando={carregando} fimRef={fimRef} />
            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

            {proximaAcao && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" onClick={onAcaoPrincipal} disabled={carregando} className="w-full sm:w-auto">
                  {carregando ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}{proximaAcao}
                </Button>
                <span className="text-xs text-muted-foreground">O agente executa uma etapa por vez.</span>
              </div>
            )}

            {estado !== "inicio" && (
              <form className="space-y-2 border-t pt-5" onSubmit={onEnviar}>
                <label htmlFor="mensagem-prompts" className="text-sm font-medium">{estado === "gestao" ? "Gerenciar prompts gerados" : "Solicitar ajuste antes de avançar"}</label>
                <Textarea id="mensagem-prompts" value={entrada} onChange={(event) => onEntradaChange(event.target.value)} placeholder={ajudaEntrada} className="min-h-24 resize-y" disabled={carregando} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">{ajudaEntrada}</p>
                  <Button type="submit" variant="outline" disabled={carregando || !entrada.trim()} className="sm:shrink-0">{carregando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Enviar</Button>
                </div>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
