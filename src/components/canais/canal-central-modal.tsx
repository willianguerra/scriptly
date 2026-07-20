"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  AudioLines,
  Images,
  ImageIcon,
  Loader2,
  Plus,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarCanal, atualizarCanal, type DadosCanal } from "@/lib/channels/client";
import { listarVozes } from "@/lib/darkvi";
import { IDIOMAS, normalizarIdioma } from "@/lib/idiomas";
import { cn } from "@/lib/utils";
import type { CanalSalvo } from "@/types/channel";
import type { PromptSalvo } from "@/types/prompt";
import type { DarkviVoice } from "@/types/darkvi";

const SEM_PROMPT = "__nenhum__";

// Tamanho-alvo do vídeo (em caracteres). 0 = curto (1 parte).
const TAMANHOS: { value: number; label: string; nota: string }[] = [
  { value: 0, label: "Curto", nota: "1 parte" },
  { value: 10000, label: "10K", nota: "~8 min" },
  { value: 20000, label: "20K", nota: "~16 min" },
  { value: 30000, label: "30K", nota: "~25 min" },
  { value: 40000, label: "40K", nota: "~33 min" },
  { value: 50000, label: "50K", nota: "~42 min" },
];

type Aba = "roteiro" | "audio" | "cenas" | "thumbnail";

const ABAS: { id: Aba; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "roteiro", label: "Roteiro", icon: FileText },
  { id: "audio", label: "Áudio", icon: AudioLines },
  { id: "cenas", label: "Cenas", icon: Images },
  { id: "thumbnail", label: "Thumbnail", icon: ImageIcon },
];

type Form = DadosCanal & { tamanhoAlvo: number };

function formInicial(canal: CanalSalvo | null): Form {
  return {
    nome: canal?.nome ?? "",
    handle: canal?.handle ?? "",
    descricao: canal?.descricao ?? "",
    nicho: canal?.nicho ?? "",
    idioma: normalizarIdioma(canal?.idioma),
    tamanhoAlvo: canal?.tamanhoAlvo ?? 0,
    vozPadrao: canal?.vozPadrao ?? "",
    estiloCenas: canal?.estiloCenas ?? "",
    estiloThumbnail: canal?.estiloThumbnail ?? "",
    defaultPromptId: canal?.defaultPromptId ?? null,
  };
}

export function CanalCentralModal({
  aberto,
  canal,
  prompts,
  onOpenChange,
  onSalvo,
}: {
  aberto: boolean;
  canal: CanalSalvo | null;
  prompts: PromptSalvo[];
  onOpenChange: (v: boolean) => void;
  onSalvo: (canal: CanalSalvo) => void;
}) {
  const [aba, setAba] = React.useState<Aba>("roteiro");
  const [form, setForm] = React.useState<Form>(() => formInicial(canal));
  const [vozes, setVozes] = React.useState<DarkviVoice[]>([]);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // Reinicia o form sempre que abrir (novo ou editar).
  React.useEffect(() => {
    if (aberto) {
      setForm(formInicial(canal));
      setAba("roteiro");
      setErro(null);
    }
  }, [aberto, canal]);

  React.useEffect(() => {
    listarVozes()
      .then(setVozes)
      .catch(() => {
        // Áudio é opcional — a lista pode estar vazia sem chave Darkvi.
      });
  }, []);

  const promptSelecionado = prompts.find((p) => p.id === form.defaultPromptId);

  function set<K extends keyof Form>(chave: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  async function handleSalvar() {
    setErro(null);
    setSalvando(true);
    const dados: DadosCanal = {
      ...form,
      tamanhoAlvo: form.tamanhoAlvo > 0 ? form.tamanhoAlvo : null,
    };
    try {
      const salvo = canal
        ? await atualizarCanal(canal.id, dados)
        : await criarCanal(dados);
      onSalvo(salvo);
      onOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {canal ? `Central do canal — ${canal.nome}` : "Novo canal"}
          </DialogTitle>
          <DialogDescription>
            Estes padrões já abrem preenchidos quando você gera pela pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="canal-nome">Nome</Label>
            <Input
              id="canal-nome"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex.: Ciência em 5 minutos"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="canal-handle">Handle</Label>
              <Input
                id="canal-handle"
                value={form.handle ?? ""}
                onChange={(e) => set("handle", e.target.value)}
                placeholder="@meucanal"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="canal-nicho">Nicho</Label>
              <Input
                id="canal-nicho"
                value={form.nicho ?? ""}
                onChange={(e) => set("nicho", e.target.value)}
                placeholder="Ex.: Curiosidades"
              />
            </div>
          </div>

          {/* Abas */}
          <div className="flex gap-1 border-b border-border">
            {ABAS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  aba === id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[45vh] overflow-y-auto pr-1">
            {aba === "roteiro" && (
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="canal-idioma">Idioma da narração</Label>
                  <Select
                    value={normalizarIdioma(form.idioma)}
                    onValueChange={(v) => set("idioma", v)}
                  >
                    <SelectTrigger id="canal-idioma" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IDIOMAS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canal-prompt">Tom &amp; estilo do canal</Label>
                    <Link
                      href="/prompts"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Gerenciar biblioteca
                    </Link>
                  </div>
                  <Select
                    value={form.defaultPromptId ?? SEM_PROMPT}
                    onValueChange={(v) =>
                      set("defaultPromptId", v === SEM_PROMPT ? null : v)
                    }
                  >
                    <SelectTrigger id="canal-prompt" className="w-full">
                      <SelectValue placeholder="Escolha um prompt da biblioteca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_PROMPT}>Nenhum</SelectItem>
                      {prompts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Somado sobre o roteirista base ao gerar.
                  </p>
                  {promptSelecionado && (
                    <p className="line-clamp-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {promptSelecionado.texto || "(sem texto)"}
                    </p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label>Tamanho alvo do vídeo</Label>
                  <div className="flex flex-wrap gap-2">
                    {TAMANHOS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => set("tamanhoAlvo", t.value)}
                        className={cn(
                          "flex min-w-14 flex-col items-center rounded-md border px-3 py-1.5 text-sm transition-colors",
                          form.tamanhoAlvo === t.value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        <span className="font-medium">{t.label}</span>
                        <span className="text-[10px]">{t.nota}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Acima de &quot;Curto&quot;, o roteiro é gerado em partes de
                    ~5.000 caracteres e emendado.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="canal-descricao">Descrição</Label>
                  <Textarea
                    id="canal-descricao"
                    value={form.descricao ?? ""}
                    onChange={(e) => set("descricao", e.target.value)}
                    placeholder="Sobre o que é o canal…"
                    className="min-h-16"
                  />
                </div>
              </div>
            )}

            {aba === "audio" && (
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="canal-voz">Voz padrão da narração</Label>
                  <Select
                    value={form.vozPadrao || SEM_PROMPT}
                    onValueChange={(v) =>
                      set("vozPadrao", v === SEM_PROMPT ? "" : v)
                    }
                  >
                    <SelectTrigger id="canal-voz" className="w-full">
                      <SelectValue placeholder="Escolha uma voz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_PROMPT}>Nenhuma (usar a última)</SelectItem>
                      {vozes.map((v) => (
                        <SelectItem key={v.idApi} value={v.idApi}>
                          {v.name}
                          {v.language ? ` · ${v.language}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pré-selecionada ao gerar a narração dos vídeos deste canal.
                    {vozes.length === 0
                      ? " (Configure a chave da Darkvi em Configurações.)"
                      : ""}
                  </p>
                </div>
              </div>
            )}

            {aba === "cenas" && (
              <div className="grid gap-1.5">
                <Label htmlFor="canal-cenas">Estilo visual das cenas</Label>
                <Textarea
                  id="canal-cenas"
                  value={form.estiloCenas ?? ""}
                  onChange={(e) => set("estiloCenas", e.target.value)}
                  placeholder="Ex.: cinematográfico, câmera lenta, luz baixa, fotorrealista…"
                  className="min-h-28"
                />
                <p className="text-xs text-muted-foreground">
                  Referência de estilo para os prompts de cena do canal.
                </p>
              </div>
            )}

            {aba === "thumbnail" && (
              <div className="grid gap-1.5">
                <Label htmlFor="canal-thumb">Estilo da thumbnail</Label>
                <Textarea
                  id="canal-thumb"
                  value={form.estiloThumbnail ?? ""}
                  onChange={(e) => set("estiloThumbnail", e.target.value)}
                  placeholder="Ex.: rosto em close, cores saturadas, texto curto em destaque…"
                  className="min-h-28"
                />
                <p className="text-xs text-muted-foreground">
                  Padrão de thumbnail do canal (referência).
                </p>
              </div>
            )}
          </div>

          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            className="gap-2"
            onClick={handleSalvar}
            disabled={!form.nome.trim() || salvando}
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : canal ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {canal ? "Salvar configuração" : "Criar canal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
