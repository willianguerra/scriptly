"use client";

import * as React from "react";
import {
  Check,
  Copy,
  CopyCheck,
  Files,
  Film,
  Hash,
  Trash2,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";

function extractIndexFromFilename(filename: string): number | undefined {
  const base = filename.replace(/\.[^/.]+$/, ""); // remove extensão
  const match = base.match(/\d+/); // primeiro grupo de dígitos
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
}

type StatCardProps = {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: "default" | "danger";
};

function StatCard({ icon: Icon, label, value, tone = "default" }: StatCardProps) {
  const active = tone === "danger" && value > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors",
        active && "border-destructive/40 bg-destructive/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            active
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <p
          className={cn(
            "text-2xl font-semibold leading-none tabular-nums",
            active && "text-destructive"
          )}
        >
          {value}
        </p>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export default function VideoDePara() {
  const [expectedTotal, setExpectedTotal] = React.useState<number>(100);
  const [files, setFiles] = React.useState<File[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { missing, duplicates, uniqueCount } = React.useMemo(() => {
    const numberToFiles = new Map<number, string[]>();

    for (const file of files) {
      const n = extractIndexFromFilename(file.name);
      if (typeof n !== "number" || !Number.isInteger(n)) continue;

      const filenames = numberToFiles.get(n) ?? [];
      filenames.push(file.name);
      numberToFiles.set(n, filenames);
    }

    const unique = new Set(numberToFiles.keys());

    const missingList: number[] = [];
    for (let i = 1; i <= expectedTotal; i++) {
      if (!unique.has(i)) missingList.push(i);
    }

    const duplicateList = Array.from(numberToFiles.entries())
      .filter(([, filenames]) => filenames.length > 1)
      .sort(([a], [b]) => a - b)
      .map(([n, filenames]) => ({ n, count: filenames.length }));

    return {
      missing: missingList,
      duplicates: duplicateList,
      uniqueCount: unique.size,
    };
  }, [files, expectedTotal]);

  const missingText = missing.join(", ");
  const duplicatesText = duplicates.map((d) => `${d.n} (${d.count})`).join("\n");
  const fullSummary = `Informei ${expectedTotal} vídeos.\n\nFaltantes: ${
    missing.length ? missingText : "Nenhum"
  }\n\nDuplicados: ${duplicates.length ? duplicatesText : "Nenhum"}`;

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const merged = [...prev];
      for (const file of incoming) {
        const key = `${file.name}-${file.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      }
      return merged;
    });
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function copy(text: string, key: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    } catch {
      // silencioso: clipboard indisponível
    }
  }

  function clearAll() {
    setFiles([]);
    setCopiedKey(null);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        icon={Film}
        title="De/Para de Vídeos"
        description="Anexe os vídeos e descubra rapidamente quais números estão faltando ou duplicados."
      />

      {/* Banda de entrada: configuração + dropzone lado a lado */}
      <Card>
        <CardContent className="grid gap-6 p-5 md:grid-cols-[minmax(240px,300px)_1fr] md:items-stretch">
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="expectedTotal">Quantidade informada</Label>
              <Input
                id="expectedTotal"
                type="number"
                min={0}
                value={expectedTotal}
                onChange={(e) => setExpectedTotal(Number(e.target.value || 0))}
              />
              <p className="text-xs text-muted-foreground">
                Total de vídeos que deveriam existir (de 1 até este número).
              </p>
            </div>

            {files.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={clearAll}
                className="mt-auto w-full gap-1.5 text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Limpar {files.length} arquivo{files.length > 1 ? "s" : ""}
              </Button>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Anexar vídeos</Label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex min-h-[180px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-accent/40",
                isDragging ? "border-primary bg-accent/50" : "border-border"
              )}
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium">
                Arraste os vídeos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Você pode soltar vários arquivos (eles são acumulados)
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Files} label="Arquivos" value={files.length} />
        <StatCard icon={Hash} label="Números únicos" value={uniqueCount} />
        <StatCard
          icon={TriangleAlert}
          label="Faltantes"
          value={missing.length}
          tone="danger"
        />
        <StatCard
          icon={CopyCheck}
          label="Duplicados"
          value={duplicates.length}
          tone="danger"
        />
      </div>

      {/* Resultados em largura total */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">
              Faltantes ({missing.length})
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!missingText}
              onClick={() => copy(missingText, "missing")}
            >
              {copiedKey === "missing" ? (
                <Check className="mr-1.5 h-4 w-4" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
              )}
              {copiedKey === "missing" ? "Copiado" : "Copiar"}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={missing.length ? missingText : "Nenhum"}
              readOnly
              className="min-h-[280px] font-mono text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">
              Duplicados ({duplicates.length})
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!duplicatesText}
              onClick={() => copy(duplicatesText, "duplicates")}
            >
              {copiedKey === "duplicates" ? (
                <Check className="mr-1.5 h-4 w-4" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
              )}
              {copiedKey === "duplicates" ? "Copiado" : "Copiar"}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={duplicates.length ? duplicatesText : "Nenhum"}
              readOnly
              className="min-h-[280px] font-mono text-sm"
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={() => copy(fullSummary, "all")}
        >
          {copiedKey === "all" ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copiedKey === "all" ? "Resumo copiado" : "Copiar resumo completo"}
        </Button>
      </div>
    </div>
  );
}
