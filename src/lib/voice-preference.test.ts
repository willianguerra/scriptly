import assert from "node:assert/strict";
import test from "node:test";

import {
  criarCookieVoz,
  escolherVozPreferida,
  lerVozDoCookie,
} from "./voice-preference.ts";

test("lerVozDoCookie encontra e decodifica a preferencia entre outros cookies", () => {
  assert.equal(
    lerVozDoCookie("tema=escuro; darkvi_voice=voz%2Fpt-BR; sessao=abc"),
    "voz/pt-BR"
  );
});

test("criarCookieVoz persiste a voz em todo o site por um ano", () => {
  assert.equal(
    criarCookieVoz("voz/pt-BR", true),
    "darkvi_voice=voz%2Fpt-BR; Path=/; Max-Age=31536000; SameSite=Lax; Secure"
  );
});

test("escolherVozPreferida prioriza o cookie quando a voz continua disponivel", () => {
  assert.equal(
    escolherVozPreferida(["voz-1", "voz-2"], "voz-2", "voz-1"),
    "voz-2"
  );
});

test("escolherVozPreferida migra a voz legada ou usa a primeira disponivel", () => {
  assert.equal(
    escolherVozPreferida(["voz-1", "voz-2"], "voz-removida", "voz-2"),
    "voz-2"
  );
  assert.equal(
    escolherVozPreferida(["voz-1", "voz-2"], "voz-removida", ""),
    "voz-1"
  );
  assert.equal(escolherVozPreferida([], "voz-1", "voz-2"), "");
});
