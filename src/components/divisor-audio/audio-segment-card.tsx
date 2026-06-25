"use client";

import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/audioUtils";
import type { AudioSegment } from "@/types/audio";

type AudioSegmentCardProps = {
  segment: AudioSegment;
  onTranscriptChange: (index: number, transcript: string) => void;
};

/** Card de um trecho de 8 segundos: player + transcrição editável. */
export function AudioSegmentCard({ segment, onTranscriptChange }: AudioSegmentCardProps) {
  const textareaId = `transcricao-parte-${segment.index}`;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge>Parte {segment.index}</Badge>
            <span className="text-sm text-muted-foreground">
              {formatTime(segment.start)} até {formatTime(segment.end)}
            </span>
          </div>
          <StatusBadge segment={segment} />
        </div>

        <audio controls preload="metadata" src={segment.url} className="w-full">
          Seu navegador não suporta a reprodução de áudio.
        </audio>

        <div className="grid gap-1.5">
          <Label htmlFor={textareaId}>Transcrição</Label>
          <Textarea
            id={textareaId}
            value={segment.transcript}
            onChange={(event) => onTranscriptChange(segment.index, event.target.value)}
            placeholder={
              segment.status === "transcribing"
                ? "Transcrevendo..."
                : "Transcrição deste trecho..."
            }
            className="min-h-[80px] resize-none text-sm"
          />
          {segment.status === "error" && segment.error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {segment.error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ segment }: { segment: AudioSegment }) {
  switch (segment.status) {
    case "transcribing":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Transcrevendo
        </Badge>
      );
    case "done":
      return <Badge variant="outline">Concluído</Badge>;
    case "error":
      return <Badge variant="destructive">Erro</Badge>;
    default:
      return <Badge variant="secondary">Aguardando</Badge>;
  }
}

export default AudioSegmentCard;
