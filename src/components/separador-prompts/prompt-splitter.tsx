"use client";

import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";

import {
  distribuirPrompts,
  extrairPrompts,
  formatarSaida,
} from "@/lib/separar-prompts";

function baixarArquivo(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function normalizarNumero(valor: string, fallback: number) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return fallback;
  return Math.floor(numero);
}

async function copiarTexto(texto: string) {
  if (!texto) return;
  await navigator.clipboard.writeText(texto);
}

export function PromptSplitter() {
  const [texto, setTexto] = useState("");
  const [quantidadeLista1, setQuantidadeLista1] = useState("3");
  const [quantidadeLista2, setQuantidadeLista2] = useState("2");
  const [arquivoNome, setArquivoNome] = useState("");
  const [textoProcessado, setTextoProcessado] = useState("");

  const qtdLista1 = normalizarNumero(quantidadeLista1, 3);
  const qtdLista2 = normalizarNumero(quantidadeLista2, 2);
  const tamanhoBloco = qtdLista1 + qtdLista2;

  const resultado = useMemo(() => {
    const prompts = extrairPrompts(textoProcessado);
    return distribuirPrompts(prompts, qtdLista1, qtdLista2);
  }, [textoProcessado, qtdLista1, qtdLista2]);

  const textoLista1 = useMemo(() => formatarSaida(resultado.lista1), [resultado.lista1]);
  const textoLista2 = useMemo(() => formatarSaida(resultado.lista2), [resultado.lista2]);

  async function importarArquivo(file: File | null) {
    if (!file) return;
    const conteudo = await file.text();
    setTexto(conteudo);
    setTextoProcessado(conteudo);
    setArquivoNome(file.name);
  }

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Importacao e Exportacao de Prompts</CardTitle>
          <CardDescription>
            Importe o arquivo bruto. O sistema remove cabecalho/rodape e considera
            apenas os blocos PROMPT, separando automaticamente em 2 listas.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="arquivo-prompts">Arquivo .txt</Label>
              <Input
                id="arquivo-prompts"
                type="file"
                accept=".txt,text/plain"
                onChange={(e) => importarArquivo(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade-lista-1">Quantidade na Lista 1</Label>
              <Input
                id="quantidade-lista-1"
                type="number"
                min={0}
                step={1}
                value={quantidadeLista1}
                onChange={(e) => setQuantidadeLista1(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade-lista-2">Quantidade na Lista 2</Label>
              <Input
                id="quantidade-lista-2"
                type="number"
                min={0}
                step={1}
                value={quantidadeLista2}
                onChange={(e) => setQuantidadeLista2(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Acao rapida</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setQuantidadeLista1("3");
                  setQuantidadeLista2("2");
                }}
              >
                Restaurar padrao
              </Button>
            </div>
          </div>

          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cole aqui o arquivo bruto se preferir..."
            className="h-32 md:h-40 resize-none font-mono text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              Arquivo: {arquivoNome || "sem importacao"}
            </Badge>
            <Badge variant="outline">
              Prompts limpos: {resultado.promptsOriginais.length}
            </Badge>
            <Badge variant="outline">Lista 1: {resultado.lista1.length}</Badge>
            <Badge variant="outline">Lista 2: {resultado.lista2.length}</Badge>
            <Badge variant="outline">Bloco: {tamanhoBloco}</Badge>
          </div>

          <Button
            type="button"
            onClick={() => setTextoProcessado(texto)}
            disabled={!texto.trim()}
            className="w-full md:w-auto"
          >
            Comecar processo
          </Button>
        </CardContent>
      </Card>

      <div className="grid min-h-0 gap-4 lg:grid-cols-2">
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Lista 1</CardTitle>
            <CardDescription>
              Resultado da divisao para a primeira lista.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <Textarea
              readOnly
              value={textoLista1}
              className="h-full min-h-0 resize-none font-mono text-sm"
              placeholder="A lista 1 aparece aqui apos o processamento."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                disabled={!textoLista1}
                onClick={() => copiarTexto(textoLista1)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Lista 1
              </Button>
              <Button
                disabled={!textoLista1}
                onClick={() => baixarArquivo("lista1.txt", textoLista1)}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Lista 1
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Lista 2</CardTitle>
            <CardDescription>
              Resultado da divisao para a segunda lista.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <Textarea
              readOnly
              value={textoLista2}
              className="h-full min-h-0 resize-none font-mono text-sm"
              placeholder="A lista 2 aparece aqui apos o processamento."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                disabled={!textoLista2}
                onClick={() => copiarTexto(textoLista2)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Lista 2
              </Button>
              <Button
                disabled={!textoLista2}
                onClick={() => baixarArquivo("lista2.txt", textoLista2)}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Lista 2
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
