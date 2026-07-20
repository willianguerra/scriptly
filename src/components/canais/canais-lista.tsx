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
import {
  listarCanais,
  criarCanal,
  atualizarCanal,
  excluirCanal,
  type DadosCanal,
} from "@/lib/channels/client";
import { listarPrompts } from "@/lib/prompt-api";
import { IDIOMAS, normalizarIdioma } from "@/lib/idiomas";
import type { CanalSalvo } from "@/types/channel";
import type { PromptSalvo } from "@/types/prompt";

const SEM_PROMPT = "__nenhum__";

const VAZIO: DadosCanal = {
  nome: "",
  handle: "",
  descricao: "",
  nicho: "",
  idioma: "portuguese",
  promptSistemaPadrao: "",
  defaultPromptId: null,
};

export function CanaisLista() {
  const [lista, setLista] = React.useState<CanalSalvo[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);

  const [dialogAberto, setDialogAberto] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<DadosCanal>(VAZIO);
  const [prompts, setPrompts] = React.useState<PromptSalvo[]>([]);
  const [salvando, setSalvando] = React.useState(false);
  const [erroForm, setErroForm] = React.useState<string | null>(null);

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
    setEditandoId(null);
    setForm(VAZIO);
    setErroForm(null);
    setDialogAberto(true);
  }

  function abrirEdicao(c: CanalSalvo) {
    setEditandoId(c.id);
    setForm({
      nome: c.nome,
      handle: c.handle ?? "",
      descricao: c.descricao ?? "",
      nicho: c.nicho ?? "",
      idioma: normalizarIdioma(c.idioma),
      promptSistemaPadrao: c.promptSistemaPadrao ?? "",
      defaultPromptId: c.defaultPromptId,
    });
    setErroForm(null);
    setDialogAberto(true);
  }

  async function handleSalvar() {
    setErroForm(null);
    setSalvando(true);
    try {
      if (editandoId) {
        const atualizado = await atualizarCanal(editandoId, form);
        setLista((atual) =>
          atual.map((c) => (c.id === editandoId ? atualizado : c))
        );
      } else {
        const criado = await criarCanal(form);
        setLista((atual) => [criado, ...atual]);
      }
      setDialogAberto(false);
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
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

  const promptSelecionado = prompts.find((p) => p.id === form.defaultPromptId);

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

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editandoId ? "Editar canal" : "Novo canal"}
            </DialogTitle>
            <DialogDescription>
              Dados do canal. O prompt padrão define o tom herdado pelos roteiros
              dos vídeos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="canal-nome">Nome</Label>
              <Input
                id="canal-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Ciência em 5 minutos"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="canal-handle">Handle</Label>
                <Input
                  id="canal-handle"
                  value={form.handle ?? ""}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  placeholder="@meucanal"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="canal-nicho">Nicho</Label>
                <Input
                  id="canal-nicho"
                  value={form.nicho ?? ""}
                  onChange={(e) => setForm({ ...form, nicho: e.target.value })}
                  placeholder="Ex.: Curiosidades"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="canal-idioma">Idioma da narração</Label>
              <Select
                value={normalizarIdioma(form.idioma)}
                onValueChange={(v) => setForm({ ...form, idioma: v })}
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
              <p className="text-xs text-muted-foreground">
                Usado na sincronização para transcrever o áudio no idioma certo.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="canal-descricao">Descrição</Label>
              <Textarea
                id="canal-descricao"
                value={form.descricao ?? ""}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Sobre o que é o canal…"
                className="min-h-20"
              />
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
                  setForm({
                    ...form,
                    defaultPromptId: v === SEM_PROMPT ? null : v,
                  })
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
                Somado sobre o roteirista base ao gerar. Todo vídeo do canal já
                nasce com este tom — sem precisar selecionar de novo.
              </p>
              {promptSelecionado && (
                <p className="line-clamp-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {promptSelecionado.texto || "(sem texto)"}
                </p>
              )}
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
              onClick={handleSalvar}
              disabled={!form.nome.trim() || salvando}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editandoId ? "Salvar" : "Criar canal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
