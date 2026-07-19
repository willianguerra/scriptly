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
import { gerarRespostaChat } from "@/lib/video-prompts/client";
import type {
  EtapaChatPrompts,
  MensagemChatPrompts,
} from "@/lib/video-prompts/flow";

type EstadoConversa = "inicio" | "analise" | "referencias" | "gestao";
type EtapaStatus = "concluida" | "atual" | "pendente";

const STATUS_LABEL: Record<EtapaStatus, string> = {
  concluida: "Concluída",
  atual: "Em andamento",
  pendente: "Aguardando",
};

const PROXIMA_ACAO: Record<Exclude<EstadoConversa, "gestao">, string> = {
  inicio: "Analisar roteiro",
  analise: "Confirmar e gerar referências",
  referencias: "Imagens prontas — gerar prompts",
};

function etapaDaAcao(estado: Exclude<EstadoConversa, "gestao">): EtapaChatPrompts {
  if (estado === "inicio") return "analise";
  if (estado === "analise") return "referencias";
  return "cenas";
}

function mensagemDaAcao(estado: Exclude<EstadoConversa, "gestao">): string {
  if (estado === "inicio") return "Analise o roteiro e apresente personagens e paleta visual.";
  if (estado === "analise") return "Confirmo a análise. Gere os prompts de referência.";
  return "As imagens de referência estão prontas. Gere todos os prompts sincronizados.";
}

function proximoEstado(etapa: EtapaChatPrompts): EstadoConversa {
  if (etapa === "analise") return "analise";
  if (etapa === "referencias") return "referencias";
  return "gestao";
}

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

export function VideoPromptsChat({
  status,
  provider,
  roteiro,
  sincronizacao,
  liberado,
  onConcluidoChange,
}: {
  status: EtapaStatus;
  provider: ProviderRoteiro;
  roteiro: string;
  sincronizacao: string;
  liberado: boolean;
  onConcluidoChange: (concluido: boolean) => void;
}) {
  const [estado, setEstado] = React.useState<EstadoConversa>("inicio");
  const [mensagens, setMensagens] = React.useState<MensagemChatPrompts[]>([]);
  const [entrada, setEntrada] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultadoCenas, setResultadoCenas] = React.useState("");
  const [copiado, setCopiado] = React.useState(false);
  const fimRef = React.useRef<HTMLDivElement>(null);
  const copiaTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setEstado("inicio");
    setMensagens([]);
    setEntrada("");
    setErro(null);
    setResultadoCenas("");
    onConcluidoChange(false);
  }, [provider, roteiro, sincronizacao, onConcluidoChange]);

  React.useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensagens, carregando]);

  React.useEffect(() => {
    return () => {
      if (copiaTimerRef.current !== null) window.clearTimeout(copiaTimerRef.current);
    };
  }, []);

  async function executar(
    etapa: EtapaChatPrompts,
    mensagemExibida: string,
    mensagemUsuario?: string
  ) {
    const mensagem: MensagemChatPrompts = {
      id: crypto.randomUUID(),
      role: "user",
      content: mensagemExibida,
    };
    const historicoAnterior = mensagens;
    setMensagens((atuais) => [...atuais, mensagem]);
    setCarregando(true);
    setErro(null);

    try {
      const resultado = await gerarRespostaChat({
        provider,
        etapa,
        roteiro,
        sincronizacao,
        mensagens: historicoAnterior,
        mensagemUsuario,
      });
      const resposta: MensagemChatPrompts = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: resultado.texto,
      };
      setMensagens((atuais) => [...atuais, resposta]);
      setEstado(proximoEstado(etapa));
      if (etapa === "cenas") {
        setResultadoCenas(resultado.texto);
        onConcluidoChange(true);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao conversar com o agente.");
    } finally {
      setCarregando(false);
    }
  }

  function handleAcaoPrincipal() {
    if (estado === "gestao") return;
    const etapa = etapaDaAcao(estado);
    void executar(etapa, mensagemDaAcao(estado));
  }

  function handleEnviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const texto = entrada.trim();
    if (!texto || carregando || estado === "inicio") return;
    const etapa: EtapaChatPrompts = estado === "gestao" ? "gestao" : estado;
    setEntrada("");
    void executar(etapa, texto, texto);
  }

  async function handleCopiarResultado() {
    if (!resultadoCenas) return;
    try {
      await navigator.clipboard.writeText(resultadoCenas);
      setCopiado(true);
      if (copiaTimerRef.current !== null) window.clearTimeout(copiaTimerRef.current);
      copiaTimerRef.current = window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar os prompts.");
    }
  }

  const ajudaEntrada =
    estado === "gestao"
      ? 'Informe falhas ou conformidade, por exemplo: "falharam 5, 12 e 23".'
      : "Peça um ajuste nesta etapa antes de confirmar e avançar.";

  return (
    <Card id="etapa-prompts-video" className="scroll-mt-6 gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="border-b py-5!">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-lg ${
              status === "concluida"
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary"
            }`}
            aria-hidden="true"
          >
            {status === "concluida" ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <MessageSquareText className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle>
              <h2 className="text-base leading-6 sm:text-lg">
                <span className="text-muted-foreground">4.</span> Gere os prompts de vídeo
              </h2>
            </CardTitle>
            <CardDescription className="leading-relaxed">
              Converse com o DOTTI AGENT 2.0 usando o roteiro e a sincronização já carregados.
            </CardDescription>
          </div>
          <Badge variant={status === "atual" ? "default" : "secondary"} className="shrink-0">
            {STATUS_LABEL[status]}
          </Badge>
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
                <Badge variant="outline" className="gap-1.5">
                  <Bot className="size-3.5" /> DOTTI AGENT 2.0
                </Badge>
                <Badge variant="secondary">
                  {provider === "fake" ? "Modo de teste" : provider === "openai" ? "OpenAI" : "Gemini"}
                </Badge>
              </div>
              {resultadoCenas && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleCopiarResultado}>
                    {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copiado ? "Copiado" : "Copiar prompts"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => baixarResultado(resultadoCenas)}>
                    <Download className="size-4" /> Baixar TXT
                  </Button>
                </div>
              )}
            </div>

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
                      {mensagem.role === "user" ? "Você" : "DOTTI"}
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

            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

            {estado !== "gestao" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" onClick={handleAcaoPrincipal} disabled={carregando} className="w-full sm:w-auto">
                  {carregando ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}
                  {PROXIMA_ACAO[estado]}
                </Button>
                <span className="text-xs text-muted-foreground">O agente executa uma etapa por vez.</span>
              </div>
            )}

            {estado !== "inicio" && (
              <form className="space-y-2 border-t pt-5" onSubmit={handleEnviar}>
                <label htmlFor="mensagem-prompts" className="text-sm font-medium">
                  {estado === "gestao" ? "Gerenciar prompts gerados" : "Solicitar ajuste antes de avançar"}
                </label>
                <Textarea
                  id="mensagem-prompts"
                  value={entrada}
                  onChange={(event) => setEntrada(event.target.value)}
                  placeholder={ajudaEntrada}
                  className="min-h-24 resize-y"
                  disabled={carregando}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">{ajudaEntrada}</p>
                  <Button type="submit" variant="outline" disabled={carregando || !entrada.trim()} className="sm:shrink-0">
                    {carregando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Enviar
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
