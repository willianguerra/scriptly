"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Mic,
  Download,
  Loader2,
  AudioLines,
  AlertCircle,
  Plus,
  CheckCircle2,
  FileArchive,
  Captions,
  RotateCcw,
  Eraser,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { motion, AnimatePresence } from "framer-motion";
import { baixarSRT, baixarZIP } from "@/lib/fileUtils";
import { converterParaSRT, INTERVALO_ENTRE_ROTEIROS } from "@/lib/srtConverter";
import {
  aguardarConclusao,
  baixarAudioBlob,
  criarAudio,
  listarVozes,
} from "@/lib/darkvi";
import type { Roteiro } from "@/types/roteiro";
import type { DarkviVoice, RoteiroAudio } from "@/types/darkvi";

const STORAGE_KEY = "roteiros-salvos";
const VOZ_KEY = "darkvi-voz";

const LIMITE_TEXTO = 80000; // limite da API Darkvi

export default function ConversorRoteiros() {
  const [roteiros, setRoteiros] = useState<Roteiro[]>([{ titulo: "", texto: "" }]);
  const [resultado, setResultado] = useState("");
  const [salvarSomenteTitulo, setSalvarSomenteTitulo] = useState(false); // 👈 novo estado
  const sliderRef = useRef<HTMLDivElement>(null);
  const textareasRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // === Estado da integração Darkvi (TTS) ===
  // A chave da API é gerenciada na tela de Configurações (localStorage) e, na
  // ausência dela, o servidor usa a chave do .env. Por isso não há campo de token aqui.
  const [vozes, setVozes] = useState<DarkviVoice[]>([]);
  const [vozId, setVozId] = useState("");
  const [carregandoVozes, setCarregandoVozes] = useState(false);
  const [erroVozes, setErroVozes] = useState("");
  const [audios, setAudios] = useState<Record<number, RoteiroAudio>>({});
  const [gerandoTodos, setGerandoTodos] = useState(false);
  const audioUrlsRef = useRef<string[]>([]);

  // 🧠 Carregar roteiros do localStorage
  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        const parsed: Roteiro[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoteiros(parsed);
        }
      } catch (error) {
        console.error("Erro ao carregar roteiros salvos:", error);
      }
    }
  }, []);

  // 💾 Salvar roteiros no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roteiros));
  }, [roteiros]);

  // 🔑 Carregar voz salva e listar vozes automaticamente.
  // Funciona tanto com a chave salva em Configurações quanto com a do servidor (.env).
  useEffect(() => {
    const savedVoz = localStorage.getItem(VOZ_KEY) ?? "";
    if (savedVoz && savedVoz !== "undefined") setVozId(savedVoz);
    carregarVozes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🧹 Revogar object URLs dos áudios ao desmontar
  useEffect(() => {
    const urls = audioUrlsRef.current;
    return () => {
      // revoga a lista mais recente acumulada até o unmount
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // === Funções Darkvi (TTS) ===
  const handleVozChange = (value: string) => {
    if (!value) return;
    setVozId(value);
    localStorage.setItem(VOZ_KEY, value);
  };

  async function carregarVozes() {
    setCarregandoVozes(true);
    setErroVozes("");
    try {
      const lista = await listarVozes();
      setVozes(lista);
      // mantém a voz salva se ainda existir; caso contrário seleciona a primeira
      const savedVoz = localStorage.getItem(VOZ_KEY) ?? "";
      const jaValida = lista.some((v) => v.idApi === savedVoz);
      if (jaValida) {
        setVozId(savedVoz);
      } else if (lista.length) {
        handleVozChange(lista[0].idApi);
      }
    } catch (e) {
      setVozes([]);
      setErroVozes(e instanceof Error ? e.message : "Falha ao listar vozes.");
    } finally {
      setCarregandoVozes(false);
    }
  }

  const setAudioEstado = (index: number, patch: RoteiroAudio) =>
    setAudios((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } }));

  async function gerarAudio(index: number) {
    const r = roteiros[index];
    const texto = r?.texto?.trim();
    if (!texto) return;
    if (!vozId) {
      setErroVozes("Selecione uma voz antes de gerar o áudio.");
      return;
    }
    if (texto.length > LIMITE_TEXTO) {
      setAudioEstado(index, { status: "ERROR", erro: `Texto acima do limite de ${LIMITE_TEXTO} caracteres.` });
      return;
    }

    setAudioEstado(index, { status: "REQUESTING", erro: undefined });
    try {
      const id = await criarAudio({
        text: texto,
        voice: vozId,
        title: r.titulo?.trim() || undefined,
      });
      setAudioEstado(index, { id, status: "PROCESSING" });

      await aguardarConclusao(id);

      const blob = await baixarAudioBlob(id);
      const url = URL.createObjectURL(blob);
      audioUrlsRef.current.push(url);
      setAudioEstado(index, { id, status: "DONE", audioUrl: url });
    } catch (e) {
      setAudioEstado(index, {
        status: "ERROR",
        erro: e instanceof Error ? e.message : "Falha ao gerar o áudio.",
      });
    }
  }

  async function gerarTodos() {
    setGerandoTodos(true);
    try {
      for (let i = 0; i < roteiros.length; i++) {
        if (roteiros[i]?.texto?.trim()) {
          await gerarAudio(i);
        }
      }
    } finally {
      setGerandoTodos(false);
    }
  }

  const nomeArquivoAudio = (index: number) => {
    const titulo = roteiros[index]?.titulo?.trim();
    const base = titulo || `audio-${index + 1}`;
    return `${base}.mp3`;
  };

  // 📌 Scroll até o último card ao adicionar novo roteiro
  useEffect(() => {
    const last = textareasRefs.current[roteiros.length - 1];
    if (sliderRef.current) {
      sliderRef.current.scrollTo({ left: sliderRef.current.scrollWidth, behavior: "smooth" });
    }
    setTimeout(() => last?.focus(), 250);
  }, [roteiros.length]);

  const scrollLeft = () => {
    sliderRef.current?.scrollBy({ left: -400, behavior: "smooth" });
  };

  const scrollRight = () => {
    sliderRef.current?.scrollBy({ left: 400, behavior: "smooth" });
  };

  const handleRemove = (index: number) => {
    if (roteiros.length === 1) {
      setRoteiros([{ titulo: "", texto: "" }]);
      return;
    }
    setRoteiros((prev) => prev.filter((_, i) => i !== index));
  };

  const converterTodos = () => {
    let srtFinal = "";
    let contador = 1;
    let tempoAcumulado = 0;

    roteiros.forEach((r, idx) => {
      if (!r.texto.trim()) return;
      const res = converterParaSRT(r.texto.trim(), contador, tempoAcumulado);
      srtFinal += res.srt;
      contador = res.contador;
      tempoAcumulado = res.tempoAcumulado;
      if (idx < roteiros.length - 1) tempoAcumulado += INTERVALO_ENTRE_ROTEIROS;
    });

    setResultado(srtFinal.trim());
  };

  const handleClearSRT = () => setResultado("");

  const handleResetRoteiros = () => {
    setRoteiros([{ titulo: "", texto: "" }]);
    setResultado("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const contarPalavras = (texto: string) =>
    texto.trim() ? texto.trim().split(/\s+/).length : 0;

  const roteirosComTexto = roteiros.filter((r) => r.texto.trim()).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        icon={Clapperboard}
        title="Conversor de Roteiros"
        description="Escreva vários roteiros e transforme tudo em narração, legendas SRT ou arquivos TXT organizados."
      />

      {/* === Painel Darkvi (TTS) === */}
      <Card className="gap-0 overflow-hidden py-0">
        {/* Cabeçalho do painel */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-br from-primary/8 via-primary/4 to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <AudioLines className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h2 className="text-base font-semibold">Gerar áudios com a Darkvi</h2>
              <p className="text-xs text-muted-foreground">
                Transforme seus roteiros em narração com IA
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium"
            role="status"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                vozes.length
                  ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20"
                  : "bg-muted-foreground/40"
              )}
            />
            {vozes.length ? `Conectado · ${vozes.length} vozes` : "Não conectado"}
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="darkvi-voz">Voz</Label>
              <Select value={vozId} onValueChange={handleVozChange} disabled={!vozes.length}>
                <SelectTrigger id="darkvi-voz" className="w-full">
                  <SelectValue placeholder={vozes.length ? "Selecione uma voz" : "Nenhuma voz carregada"} />
                </SelectTrigger>
                <SelectContent>
                  {vozes.map((v) => (
                    <SelectItem key={v.idApi} value={v.idApi}>
                      {v.name}
                      {v.language ? ` — ${v.language}` : ""}
                      {v.novidade ? " ✨" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => carregarVozes()}
              disabled={carregandoVozes}
            >
              {carregandoVozes ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AudioLines className="h-4 w-4" />
              )}
              {carregandoVozes ? "Carregando..." : "Recarregar vozes"}
            </Button>
          </div>

          {erroVozes && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{erroVozes}</span>
              <Link href="/configuracoes" className="font-medium underline underline-offset-2 hover:opacity-80">
                Configurar chave
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button
              size="lg"
              className="gap-2"
              onClick={gerarTodos}
              disabled={gerandoTodos || !vozId || roteirosComTexto === 0}
            >
              {gerandoTodos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {gerandoTodos ? "Gerando áudios..." : "Gerar áudios de todos"}
            </Button>
            {roteirosComTexto > 0 && (
              <span className="text-xs text-muted-foreground">
                {roteirosComTexto} {roteirosComTexto === 1 ? "roteiro pronto" : "roteiros prontos"} para narrar
              </span>
            )}
            <Link
              href="/configuracoes"
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
              Gerenciar chave da API
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* === Slider de roteiros === */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Seus roteiros
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
              {roteiros.length}
            </span>
          </h2>
          <div className="hidden gap-2 md:flex">
            <button
              onClick={scrollLeft}
              aria-label="Rolar para o roteiro anterior"
              className="grid h-8 w-8 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={scrollRight}
              aria-label="Rolar para o próximo roteiro"
              className="grid h-8 w-8 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={sliderRef}
          className="
            grid grid-flow-col
            auto-cols-[100%]
            sm:auto-cols-[100%]
            lg:auto-cols-[minmax(48%,1fr)]
            overflow-x-auto
            gap-4
            scroll-smooth
            snap-x snap-mandatory
            px-1 pb-4
          "
        >
          <AnimatePresence>
            {roteiros.map((r, i) => {
              const a = audios[i];
              const emAndamento = a?.status === "REQUESTING" || a?.status === "PROCESSING";
              const tituloExcedido = r.titulo.length > 100;
              return (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.3 }}
                  className="snap-center"
                >
                  <Card className="group relative h-full gap-0 overflow-hidden py-0 transition-all hover:border-primary/30 hover:shadow-md">
                    {/* Cabeçalho do card */}
                    <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium">Roteiro</span>
                        {a?.status === "DONE" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Áudio pronto
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(i)}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Excluir roteiro ${i + 1}`}
                        title="Excluir roteiro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <CardContent className="space-y-3 p-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`titulo-${i}`} className="text-xs text-muted-foreground">
                            Título
                          </Label>
                          <span
                            className={cn(
                              "text-[11px] tabular-nums",
                              tituloExcedido ? "text-destructive" : "text-muted-foreground/70"
                            )}
                          >
                            {r.titulo.length}/100
                          </span>
                        </div>
                        <Input
                          id={`titulo-${i}`}
                          value={r.titulo}
                          aria-invalid={tituloExcedido}
                          onChange={(e) => {
                            const novos = [...roteiros];
                            novos[i].titulo = e.target.value;
                            setRoteiros(novos);
                          }}
                          placeholder="Digite o título..."
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`roteiro-${i}`} className="text-xs text-muted-foreground">
                          Roteiro
                        </Label>
                        <Textarea
                          id={`roteiro-${i}`}
                          ref={(el) => {
                            textareasRefs.current[i] = el;
                          }}
                          value={r.texto}
                          onChange={(e) => {
                            const novos = [...roteiros];
                            novos[i].texto = e.target.value;
                            setRoteiros(novos);
                          }}
                          className="h-32 w-full resize-none text-sm"
                          placeholder="Digite seu roteiro..."
                        />
                        <div className="flex justify-end gap-1 text-[11px] tabular-nums text-muted-foreground">
                          <span>{contarPalavras(r.texto)} palavras</span>
                          <span aria-hidden>·</span>
                          <span>{r.texto.length} caracteres</span>
                        </div>
                      </div>

                      {/* === Áudio (Darkvi TTS) === */}
                      <div className="space-y-2 border-t pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={a?.status === "DONE" ? "outline" : "secondary"}
                            className="gap-2"
                            disabled={!r.texto.trim() || emAndamento || gerandoTodos}
                            onClick={() => gerarAudio(i)}
                          >
                            {emAndamento ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                            {a?.status === "REQUESTING"
                              ? "Enviando..."
                              : a?.status === "PROCESSING"
                                ? "Gerando..."
                                : a?.status === "DONE"
                                  ? "Gerar novamente"
                                  : "Gerar áudio"}
                          </Button>

                          {a?.status === "DONE" && a.audioUrl && (
                            <Button asChild size="sm" className="gap-2">
                              <a href={a.audioUrl} download={nomeArquivoAudio(i)}>
                                <Download className="h-4 w-4" />
                                Baixar MP3
                              </a>
                            </Button>
                          )}
                        </div>

                        {emAndamento && (
                          <p className="text-[11px] text-muted-foreground">
                            Isso pode levar alguns segundos...
                          </p>
                        )}

                        {a?.status === "DONE" && a.audioUrl && (
                          <div className="rounded-lg border bg-background/60 p-2 animate-in fade-in-0 slide-in-from-top-1">
                            <audio controls src={a.audioUrl} className="h-9 w-full" />
                          </div>
                        )}

                        {a?.status === "ERROR" && (
                          <div
                            role="alert"
                            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive animate-in fade-in-0 slide-in-from-top-1"
                          >
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{a.erro}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* === Adicionar roteiro === */}
      <Button
        variant="outline"
        className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground"
        onClick={() => setRoteiros([...roteiros, { titulo: "", texto: "" }])}
      >
        <Plus className="h-4 w-4" />
        Adicionar roteiro
      </Button>

      {/* === Ações de exportação === */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="salvarTitulo"
            checked={salvarSomenteTitulo}
            onCheckedChange={(checked) => setSalvarSomenteTitulo(!!checked)}
          />
          <label htmlFor="salvarTitulo" className="cursor-pointer select-none text-sm">
            Salvar apenas título no TXT
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="secondary" className="gap-2" onClick={() => baixarZIP(roteiros, salvarSomenteTitulo)}>
            <FileArchive className="h-4 w-4" />
            Converter em TXT (ZIP)
          </Button>
          <Button className="gap-2" onClick={converterTodos}>
            <Captions className="h-4 w-4" />
            Converter para SRT
          </Button>
          <Button
            variant="ghost"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleResetRoteiros}
          >
            <RotateCcw className="h-4 w-4" />
            Resetar
          </Button>
        </div>
      </div>

      {resultado && (
        <Card className="gap-0 overflow-hidden py-0 animate-in fade-in-0 slide-in-from-bottom-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Captions className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">Legenda SRT gerada</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-2" onClick={() => baixarSRT(resultado)}>
                <Download className="h-4 w-4" />
                Baixar SRT
              </Button>
              <Button size="sm" variant="ghost" className="gap-2" onClick={handleClearSRT}>
                <Eraser className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
              {resultado}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
