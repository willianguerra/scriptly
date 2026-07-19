"use client";

import * as React from "react";

import { VideoPromptsChatView } from "@/components/video-prompts-chat-view";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import { gerarRespostaChat } from "@/lib/video-prompts/client";
import type {
  EtapaChatPrompts,
  MensagemChatPrompts,
} from "@/lib/video-prompts/flow";

type EstadoConversa = "inicio" | "analise" | "referencias" | "gestao";
type EtapaStatus = "concluida" | "atual" | "pendente";

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

export function VideoPromptsChat({
  status,
  provider,
  roteiro,
  sincronizacao,
  liberado,
  onConcluidoChange,
  onResultado,
}: {
  status: EtapaStatus;
  provider: ProviderRoteiro;
  roteiro: string;
  sincronizacao: string;
  liberado: boolean;
  onConcluidoChange: (concluido: boolean) => void;
  /** Chamado quando o agente termina de gerar os prompts de cena (opcional). */
  onResultado?: (texto: string) => void;
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
    const historicoAnterior = mensagens;
    setMensagens((atuais) => [
      ...atuais,
      { id: crypto.randomUUID(), role: "user", content: mensagemExibida },
    ]);
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
      setMensagens((atuais) => [
        ...atuais,
        { id: crypto.randomUUID(), role: "assistant", content: resultado.texto },
      ]);
      setEstado(proximoEstado(etapa));
      if (etapa === "cenas") {
        setResultadoCenas(resultado.texto);
        onConcluidoChange(true);
        onResultado?.(resultado.texto);
      }
    } catch (error) {
      setMensagens(historicoAnterior);
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

  return (
    <VideoPromptsChatView
      status={status}
      provider={provider}
      liberado={liberado}
      estado={estado}
      mensagens={mensagens}
      entrada={entrada}
      carregando={carregando}
      erro={erro}
      resultadoCenas={resultadoCenas}
      copiado={copiado}
      proximaAcao={estado === "gestao" ? null : PROXIMA_ACAO[estado]}
      fimRef={fimRef}
      onEntradaChange={setEntrada}
      onAcaoPrincipal={handleAcaoPrincipal}
      onEnviar={handleEnviar}
      onCopiarResultado={handleCopiarResultado}
    />
  );
}
