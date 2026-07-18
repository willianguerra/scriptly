"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AudioLines,
  Captions,
  CheckCircle2,
  CircleDashed,
  Download,
  FileJson,
  FileText,
  Library,
  Loader2,
  Settings2,
  Sparkles,
  Wand2,
  Waypoints,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { ProviderRoteiro } from "@/lib/roteiro/types";
import type { Timings, Segmento } from "@/lib/roteiro/sync";
import type { DarkviVoice } from "@/types/darkvi";
import type { PromptSalvo } from "@/types/prompt";

export type EtapaStatus = "concluida" | "atual" | "pendente";

const STATUS_LABEL: Record<EtapaStatus, string> = {
  concluida: "Concluída",
  atual: "Em andamento",
  pendente: "Aguardando",
};

const PROVIDERS: { value: ProviderRoteiro; label: string; nota: string }[] = [
  { value: "fake", label: "Teste (sem IA)", nota: "Não usa chave — valida o fluxo." },
  { value: "gemini", label: "Google Gemini", nota: "Requer chave nas Configurações." },
  { value: "openai", label: "OpenAI (GPT)", nota: "Requer chave nas Configurações." },
];

function EtapaCabecalho({
  numero,
  titulo,
  descricao,
  icon: Icon,
  status,
}: {
  numero: number;
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  status: EtapaStatus;
}) {
  return (
    <CardHeader className="gap-3 border-b pb-5 sm:grid-cols-[auto_1fr_auto]">
      <span
        className={`grid size-9 place-items-center rounded-lg ${
          status === "concluida"
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        }`}
        aria-hidden="true"
      >
        {status === "concluida" ? (
          <CheckCircle2 className="size-5" />
        ) : (
          <Icon className="size-5" />
        )}
      </span>
      <div className="min-w-0 space-y-1">
        <CardTitle>
          <h2 className="text-base leading-6 sm:text-lg">
            <span className="text-muted-foreground">{numero}.</span> {titulo}
          </h2>
        </CardTitle>
        <CardDescription className="leading-relaxed">{descricao}</CardDescription>
      </div>
      <Badge
        variant={status === "atual" ? "default" : "secondary"}
        className="w-fit sm:justify-self-end"
      >
        {STATUS_LABEL[status]}
      </Badge>
    </CardHeader>
  );
}

export function EtapasNavegacao({
  roteiro,
  audio,
  sincronizacao,
}: {
  roteiro: EtapaStatus;
  audio: EtapaStatus;
  sincronizacao: EtapaStatus;
}) {
  const etapas = [
    { numero: 1, titulo: "Roteiro", href: "#etapa-roteiro", status: roteiro },
    { numero: 2, titulo: "Narração", href: "#etapa-narracao", status: audio },
    {
      numero: 3,
      titulo: "Sincronização",
      href: "#etapa-sincronizacao",
      status: sincronizacao,
    },
  ];

  return (
    <nav aria-label="Etapas do Estúdio">
      <ol className="grid gap-2 sm:grid-cols-3">
        {etapas.map((etapa) => (
          <li key={etapa.numero}>
            <a
              href={etapa.href}
              aria-current={etapa.status === "atual" ? "step" : undefined}
              className={`group flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                etapa.status === "atual"
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card/70 hover:bg-muted/60"
              }`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                  etapa.status === "concluida"
                    ? "bg-primary text-primary-foreground"
                    : etapa.status === "atual"
                      ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                      : "bg-muted text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {etapa.status === "concluida" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  etapa.numero
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{etapa.titulo}</span>
                <span className="block text-xs text-muted-foreground">
                  {STATUS_LABEL[etapa.status]}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type RoteiroEtapaProps = {
  status: EtapaStatus;
  tema: string;
  provider: ProviderRoteiro;
  prompts: PromptSalvo[];
  promptId: string;
  promptSistema: string;
  roteiro: string;
  gerando: boolean;
  palavras: number;
  onTemaChange: (value: string) => void;
  onProviderChange: (value: ProviderRoteiro) => void;
  onPromptSelect: (value: string) => void;
  onPromptChange: (value: string) => void;
  onRoteiroChange: (value: string) => void;
  onGerar: () => void;
};

export function RoteiroEtapa({
  status,
  tema,
  provider,
  prompts,
  promptId,
  promptSistema,
  roteiro,
  gerando,
  palavras,
  onTemaChange,
  onProviderChange,
  onPromptSelect,
  onPromptChange,
  onRoteiroChange,
  onGerar,
}: RoteiroEtapaProps) {
  const temRoteiro = roteiro.trim().length > 0;

  return (
    <Card id="etapa-roteiro" className="scroll-mt-6 gap-0 overflow-hidden py-0 shadow-none">
      <EtapaCabecalho
        numero={1}
        titulo="Crie o roteiro"
        descricao="Defina o assunto, escolha a IA e revise o texto antes de seguir."
        icon={Sparkles}
        status={status}
      />
      <CardContent className="space-y-5 py-5 sm:py-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="tema">Sobre o que será o vídeo?</Label>
            <Input
              id="tema"
              value={tema}
              onChange={(event) => onTemaChange(event.target.value)}
              placeholder="Ex.: a história dos buracos negros"
              aria-describedby="tema-ajuda"
              autoComplete="off"
            />
            <p id="tema-ajuda" className="text-xs text-muted-foreground">
              Quanto mais específico, melhor será o primeiro resultado.
            </p>
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="provider">Modelo de IA</Label>
            <Select value={provider} onValueChange={(value) => onProviderChange(value as ProviderRoteiro)}>
              <SelectTrigger id="provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PROVIDERS.find((item) => item.value === provider)?.nota}
            </p>
          </div>
        </div>

        <details className="group rounded-lg border bg-muted/25 open:bg-muted/15">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-medium marker:hidden sm:px-4">
            <Settings2 className="size-4 text-muted-foreground" />
            Personalizar instruções
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
              Opcional
            </span>
          </summary>
          <div className="space-y-3 border-t px-3 py-4 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="prompt-salvo">Prompt do roteiro</Label>
              <Link
                href="/prompts"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                <Library className="size-3.5" /> Gerenciar biblioteca
              </Link>
            </div>
            <Select value={promptId} onValueChange={onPromptSelect}>
              <SelectTrigger id="prompt-salvo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__padrao__">Padrão do Estúdio</SelectItem>
                {prompts.map((prompt) => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    {prompt.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              id="promptSistema"
              value={promptSistema}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Acrescente tom, público, formato ou outras instruções específicas."
              className="min-h-28 resize-y"
              aria-label="Instruções personalizadas do roteiro"
            />
          </div>
        </details>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={onGerar}
            disabled={gerando}
            className="w-full sm:w-auto"
            aria-busy={gerando}
          >
            {gerando ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {gerando ? "Criando roteiro..." : temRoteiro ? "Gerar nova versão" : "Gerar roteiro"}
          </Button>
          {!tema.trim() && (
            <span className="text-xs text-muted-foreground">Informe um tema para começar.</span>
          )}
        </div>

        {temRoteiro ? (
          <div className="space-y-2 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="roteiro">Revise o roteiro</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {palavras} palavras · {roteiro.length} caracteres
              </span>
            </div>
            <Textarea
              id="roteiro"
              value={roteiro}
              onChange={(event) => onRoteiroChange(event.target.value)}
              className="min-h-64 resize-y leading-relaxed"
              aria-describedby="roteiro-ajuda"
            />
            <p id="roteiro-ajuda" className="text-xs text-muted-foreground">
              Faça os ajustes finais aqui. A narração usará exatamente este texto.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
            <FileText className="size-5 shrink-0" />
            O roteiro editável aparecerá aqui depois da geração.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type NarracaoEtapaProps = {
  status: EtapaStatus;
  temRoteiro: boolean;
  temAudio: boolean;
  vozErro: string | null;
  vozes: DarkviVoice[];
  voz: string;
  gerando: boolean;
  audioUrl: string | null;
  minutosEstimados: number;
  onVozChange: (value: string) => void;
  onGerar: () => void;
  onBaixar: () => void;
};

export function NarracaoEtapa({
  status,
  temRoteiro,
  temAudio,
  vozErro,
  vozes,
  voz,
  gerando,
  audioUrl,
  minutosEstimados,
  onVozChange,
  onGerar,
  onBaixar,
}: NarracaoEtapaProps) {
  return (
    <Card id="etapa-narracao" className="scroll-mt-6 gap-0 overflow-hidden py-0 shadow-none">
      <EtapaCabecalho
        numero={2}
        titulo="Gere a narração"
        descricao="Escolha a voz e transforme o roteiro aprovado em áudio."
        icon={AudioLines}
        status={status}
      />
      <CardContent className="space-y-5 py-5 sm:py-6">
        {!temRoteiro && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            <CircleDashed className="mt-0.5 size-4 shrink-0" />
            Conclua a etapa de roteiro para liberar a geração de áudio.
          </div>
        )}

        {vozErro ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p>{vozErro}</p>
              <Link
                href="/configuracoes"
                className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
              >
                Abrir Configurações
              </Link>
            </div>
          </div>
        ) : vozes.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" /> Carregando vozes disponíveis...
          </div>
        ) : (
          <div className="grid gap-1.5 sm:max-w-md">
            <Label htmlFor="voz">Voz da narração</Label>
            <Select value={voz} onValueChange={onVozChange}>
              <SelectTrigger id="voz" className="w-full">
                <SelectValue placeholder="Escolha uma voz" />
              </SelectTrigger>
              <SelectContent>
                {vozes.map((item) => (
                  <SelectItem key={item.idApi} value={item.idApi}>
                    {item.name}
                    {item.language ? ` · ${item.language}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={onGerar}
            disabled={gerando || !temRoteiro || !voz}
            className="w-full sm:w-auto"
            aria-busy={gerando}
            aria-describedby="audio-ajuda"
          >
            {gerando ? <Loader2 className="size-4 animate-spin" /> : <AudioLines className="size-4" />}
            {gerando ? "Gerando narração..." : temAudio ? "Gerar novamente" : "Gerar narração"}
          </Button>
          <span id="audio-ajuda" className="text-xs text-muted-foreground">
            {temRoteiro ? `Tempo estimado do texto: ${minutosEstimados} min.` : "Aguardando o roteiro."}
          </span>
        </div>

        {audioUrl && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Prévia da narração</p>
              <Badge variant="secondary">MP3 pronto</Badge>
            </div>
            <audio controls src={audioUrl} className="w-full" aria-label="Prévia da narração gerada" />
            <Button variant="outline" size="sm" onClick={onBaixar}>
              <Download className="size-4" /> Baixar MP3
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type SincronizacaoEtapaProps = {
  status: EtapaStatus;
  temAudio: boolean;
  concluida: boolean;
  sincronizando: boolean;
  modelPct: number;
  segmentos: Segmento[];
  timings: Timings | null;
  onSincronizar: () => void;
  onBaixarSrt: () => void;
  onBaixarTimings: () => void;
};

export function SincronizacaoEtapa({
  status,
  temAudio,
  concluida,
  sincronizando,
  modelPct,
  segmentos,
  timings,
  onSincronizar,
  onBaixarSrt,
  onBaixarTimings,
}: SincronizacaoEtapaProps) {
  return (
    <Card id="etapa-sincronizacao" className="scroll-mt-6 gap-0 overflow-hidden py-0 shadow-none">
      <EtapaCabecalho
        numero={3}
        titulo="Sincronize e exporte"
        descricao="Alinhe texto e áudio no navegador para gerar legenda e marcações de tempo."
        icon={Waypoints}
        status={status}
      />
      <CardContent className="space-y-5 py-5 sm:py-6">
        {!temAudio && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            <CircleDashed className="mt-0.5 size-4 shrink-0" />
            Gere a narração para liberar a sincronização e os arquivos finais.
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={onSincronizar}
            disabled={sincronizando || !temAudio}
            className="w-full sm:w-auto"
            aria-busy={sincronizando}
            aria-describedby="sincronizacao-ajuda"
          >
            {sincronizando ? <Loader2 className="size-4 animate-spin" /> : <Waypoints className="size-4" />}
            {sincronizando
              ? "Sincronizando..."
              : concluida
                ? "Sincronizar novamente"
                : "Sincronizar texto e áudio"}
          </Button>
          <span id="sincronizacao-ajuda" className="text-xs text-muted-foreground">
            O processamento usa Whisper e acontece neste navegador.
          </span>
        </div>

        {sincronizando && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">
                {modelPct > 0 && modelPct < 100 ? "Preparando transcrição" : "Alinhando roteiro e narração"}
              </span>
              {modelPct > 0 && modelPct < 100 && (
                <span className="tabular-nums text-muted-foreground">{modelPct}%</span>
              )}
            </div>
            <Progress
              value={modelPct > 0 ? modelPct : undefined}
              aria-label="Progresso da sincronização"
            />
            <p className="text-xs text-muted-foreground">
              Na primeira execução, o modelo de transcrição precisa ser baixado.
            </p>
          </div>
        )}

        {segmentos.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{segmentos.length} segmentos</Badge>
              {timings && <Badge variant="secondary">{timings.duracao.toFixed(1)}s de áudio</Badge>}
              <Button variant="outline" size="sm" onClick={onBaixarSrt}>
                <Captions className="size-4" /> Baixar SRT
              </Button>
              <Button variant="outline" size="sm" onClick={onBaixarTimings}>
                <FileJson className="size-4" /> Baixar timings.json
              </Button>
            </div>

            <div className="max-h-80 overflow-auto rounded-lg border">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">Trechos sincronizados da narração</caption>
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-medium">Início</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Fim</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Texto</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentos.map((segmento, index) => (
                    <tr key={`${segmento.inicio}-${index}`} className="border-t hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                        {segmento.inicio.toFixed(2)}s
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                        {segmento.fim.toFixed(2)}s
                      </td>
                      <td className="px-3 py-2 leading-relaxed">{segmento.texto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ResumoProjeto({
  progresso,
  temRoteiro,
  temAudio,
  temSincronizacao,
  proximaAcao,
  palavras,
  minutosEstimados,
}: {
  progresso: number;
  temRoteiro: boolean;
  temAudio: boolean;
  temSincronizacao: boolean;
  proximaAcao: string;
  palavras: number;
  minutosEstimados: number;
}) {
  const itens: [string, boolean][] = [
    ["Roteiro revisado", temRoteiro],
    ["Narração gerada", temAudio],
    ["Arquivos sincronizados", temSincronizacao],
  ];

  return (
    <aside className="xl:sticky xl:top-6" aria-label="Resumo do projeto">
      <Card className="gap-5 py-5 shadow-none">
        <CardHeader className="gap-1 px-5">
          <CardTitle><h2 className="text-base">Resumo do projeto</h2></CardTitle>
          <CardDescription>Acompanhe o que falta para finalizar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">Progresso</span>
              <span className="tabular-nums text-muted-foreground">{progresso}%</span>
            </div>
            <Progress value={progresso} aria-label={`${progresso}% do projeto concluído`} />
          </div>

          <ol className="space-y-3 text-sm">
            {itens.map(([label, done]) => (
              <li key={label} className="flex items-center gap-2.5">
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Próxima ação</p>
            <p className="mt-1.5 text-sm leading-relaxed">{proximaAcao}</p>
          </div>

          {temRoteiro && (
            <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Palavras</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{palavras}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Duração estimada</dt>
                <dd className="mt-0.5 font-medium tabular-nums">~{minutosEstimados} min</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
