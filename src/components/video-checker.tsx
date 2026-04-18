"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function extractIndexFromFilename(filename: string): number | undefined {
  const base = filename.replace(/\.[^/.]+$/, ""); // remove extensão
  const match = base.match(/\d+/); // primeiro grupo de dígitos
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
}

export default function VideoDePara() {
  const [expectedTotal, setExpectedTotal] = React.useState<number>(100);
  const [files, setFiles] = React.useState<File[]>([]);

  const summary = React.useMemo(() => {
    const numberToFiles = new Map<number, string[]>();

    for (const file of files) {
      const n = extractIndexFromFilename(file.name);
      if (typeof n !== "number" || !Number.isInteger(n)) continue;

      const filenames = numberToFiles.get(n) ?? [];
      filenames.push(file.name);
      numberToFiles.set(n, filenames);
    }

    const unique = new Set(numberToFiles.keys());

    const missing: number[] = [];
    for (let i = 1; i <= expectedTotal; i++) {
      if (!unique.has(i)) missing.push(i);
    }

    const duplicates = Array.from(numberToFiles.entries())
      .filter(([, filenames]) => filenames.length > 1)
      .sort(([a], [b]) => a - b)
      .map(([n, filenames]) => `${n} (${filenames.length})`);

    return `Informei ${expectedTotal} vídeos.\n\nFaltantes: ${
      missing.length ? missing.join(", ") : "Nenhum"
    }\n\nDuplicados: ${duplicates.length ? duplicates.join("\n") : "Nenhum"}`;
  }, [files, expectedTotal]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>De/Para de Vídeos</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="expectedTotal">Quantidade informada</Label>
          <Input
            id="expectedTotal"
            type="number"
            min={0}
            value={expectedTotal}
            onChange={(e) => setExpectedTotal(Number(e.target.value || 0))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="videos">Anexar vídeos</Label>
          <Input
            id="videos"
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        <div className="grid gap-2">
          <Label>Resultado</Label>
          <Textarea value={summary} readOnly className="min-h-[120px]" />
        </div>
      </CardContent>
    </Card>
  );
}
