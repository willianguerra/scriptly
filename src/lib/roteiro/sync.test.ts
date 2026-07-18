import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparPalavras,
  formatarTempoSRT,
  montarTimings,
  segmentosParaSRT,
  type Segmento,
} from "./sync.ts";

const palavras: Segmento[] = [
  { texto: "Olá", inicio: 0.0, fim: 0.4 },
  { texto: "mundo.", inicio: 0.4, fim: 0.9 },
  { texto: "Tudo", inicio: 1.0, fim: 1.3 },
  { texto: "bem", inicio: 1.3, fim: 1.6 },
  { texto: "com", inicio: 1.6, fim: 1.8 },
  { texto: "você?", inicio: 1.8, fim: 2.2 },
];

test("agruparPalavras quebra em fim de frase", () => {
  const segmentos = agruparPalavras(palavras);
  assert.equal(segmentos.length, 2);
  assert.equal(segmentos[0].texto, "Olá mundo.");
  assert.equal(segmentos[0].inicio, 0.0);
  assert.equal(segmentos[0].fim, 0.9);
  assert.equal(segmentos[1].texto, "Tudo bem com você?");
});

test("agruparPalavras respeita o limite de caracteres", () => {
  const muitas: Segmento[] = Array.from({ length: 20 }, (_, i) => ({
    texto: "palavra",
    inicio: i,
    fim: i + 0.5,
  }));
  const segmentos = agruparPalavras(muitas, 30);
  assert.ok(segmentos.length > 1);
  for (const seg of segmentos) {
    assert.ok(seg.texto.length <= 30 || seg.texto.split(" ").length === 1);
  }
});

test("agruparPalavras ignora palavras sem tempo válido", () => {
  const comLixo: Segmento[] = [
    { texto: "boa", inicio: 0, fim: 0.5 },
    { texto: "", inicio: 0.5, fim: 1 },
    { texto: "tarde.", inicio: NaN, fim: 1.5 },
  ];
  const segmentos = agruparPalavras(comLixo);
  assert.equal(segmentos.length, 1);
  assert.equal(segmentos[0].texto, "boa");
});

test("montarTimings arredonda e preserva ordem", () => {
  const timings = montarTimings(
    [{ texto: "oi", inicio: 0.123456, fim: 0.98765 }],
    12.3456
  );
  assert.equal(timings.duracao, 12.346);
  assert.equal(timings.segmentos[0].inicio, 0.123);
  assert.equal(timings.segmentos[0].fim, 0.988);
});

test("formatarTempoSRT usa HH:MM:SS,mmm", () => {
  assert.equal(formatarTempoSRT(0), "00:00:00,000");
  assert.equal(formatarTempoSRT(3661.5), "01:01:01,500");
});

test("segmentosParaSRT numera e formata blocos", () => {
  const srt = segmentosParaSRT([
    { texto: "Olá mundo.", inicio: 0, fim: 0.9 },
    { texto: "Tudo bem?", inicio: 1, fim: 2.2 },
  ]);
  assert.ok(srt.startsWith("1\n00:00:00,000 --> 00:00:00,900\nOlá mundo."));
  assert.ok(srt.includes("2\n00:00:01,000 --> 00:00:02,200\nTudo bem?"));
});
