"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Link2, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";

function normalizeInputToYoutubeSubscribe(value: string): string {
  const raw = value.trim();
  if (!raw) return "";

  if (raw.startsWith("@")) return `https://www.youtube.com/${raw}?sub_confirmation=1`;
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(raw)) return `https://www.youtube.com/channel/${raw}?sub_confirmation=1`;

  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtube.com")) {
      url.searchParams.set("sub_confirmation", "1");
      return url.toString();
    }
  } catch {
    return "";
  }

  return "";
}

export default function LinkInscricao() {
  const [channelInput, setChannelInput] = React.useState("");
  const [result, setResult] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function handleGenerate() {
    const next = normalizeInputToYoutubeSubscribe(channelInput);
    if (!next) {
      setError("Informe uma URL valida do YouTube, @handle ou ID do canal.");
      setResult("");
      return;
    }
    setError("");
    setResult(next);
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        icon={Link2}
        title="Gerador de Link de Inscricao"
        description="Gere links de inscricao automatica para seu canal do YouTube."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Configuracao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="channel-input">
              URL ou ID do Canal
            </Label>
            <Input
              id="channel-input"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="https://youtube.com/@seucanal ou @seucanal ou UCxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">Aceita URL do canal, @handle, ou ID do canal (UC...)</p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button onClick={handleGenerate} className="h-11 w-full gap-2">
            <Link2 className="h-4 w-4" />
            Gerar Link de Inscricao
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Exemplos de Entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-muted-foreground">
            <li>https://youtube.com/@MrBeast</li>
            <li>@MrBeast</li>
            <li>https://youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA</li>
            <li>UCX6OQ3DkcsbYNE6H8uQQuVA</li>
          </ul>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl">Link Gerado</CardTitle>
              <Button onClick={handleCopy} variant="secondary" className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              value={result}
              className="min-h-[100px] font-mono"
            />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
