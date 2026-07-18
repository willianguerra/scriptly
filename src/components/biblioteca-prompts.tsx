"use client";

import * as React from "react";
import { Library, Plus, Pencil, Trash2, Save, X, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
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
import { Textarea } from "@/components/ui/textarea";
import {
  listarPrompts,
  criarPrompt,
  atualizarPrompt,
  excluirPrompt,
} from "@/lib/prompt-api";
import type { PromptSalvo } from "@/types/prompt";

export function BibliotecaPrompts() {
  const [lista, setLista] = React.useState<PromptSalvo[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [nome, setNome] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    listarPrompts()
      .then(setLista)
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Falha ao carregar prompts.")
      )
      .finally(() => setCarregando(false));
  }, []);

  function limparForm() {
    setEditandoId(null);
    setNome("");
    setTexto("");
    setErro(null);
  }

  async function handleSalvar() {
    setErro(null);
    setSalvando(true);
    try {
      if (editandoId) {
        const atualizado = await atualizarPrompt(editandoId, { nome, texto });
        setLista((atual) =>
          atual.map((p) => (p.id === editandoId ? atualizado : p))
        );
      } else {
        const criado = await criarPrompt({ nome, texto });
        setLista((atual) => [criado, ...atual]);
      }
      limparForm();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function handleEditar(p: PromptSalvo) {
    setEditandoId(p.id);
    setNome(p.nome);
    setTexto(p.texto);
    setErro(null);
  }

  async function handleExcluir(id: string) {
    try {
      await excluirPrompt(id);
      setLista((atual) => atual.filter((p) => p.id !== id));
      if (editandoId === id) limparForm();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        icon={Library}
        title="Biblioteca de prompts"
        description="Salve prompts nomeados (por canal ou estilo) e reutilize-os no Estúdio ao gerar roteiros."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editandoId ? "Editar prompt" : "Novo prompt"}
          </CardTitle>
          <CardDescription>
            O prompt define o comportamento do roteirista (tom, formato, público…).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nome-prompt">Nome</Label>
            <Input
              id="nome-prompt"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Canal de Ciência — narração séria"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="texto-prompt">Prompt</Label>
            <Textarea
              id="texto-prompt"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Você é um roteirista de vídeos para YouTube. Escreva..."
              className="min-h-32"
            />
          </div>

          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              className="gap-2"
              onClick={handleSalvar}
              disabled={!nome.trim() || salvando}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editandoId ? (
                <Save className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editandoId ? "Salvar alterações" : "Adicionar prompt"}
            </Button>
            {editandoId && (
              <Button variant="ghost" className="gap-2" onClick={limparForm}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Prompts salvos ({lista.length})
        </h2>

        {carregando ? (
          <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        ) : lista.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum prompt salvo ainda. Crie o primeiro acima.
          </p>
        ) : (
          lista.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{p.nome}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.texto || "(sem texto)"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() => handleEditar(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleExcluir(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
