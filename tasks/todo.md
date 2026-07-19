# TODO — Gerenciador de Canais do YouTube

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluída
Cada tarefa tem **Aceite** (o que prova que ficou pronta) e **Verificação** (como testar).

---

## Fase 1 — Canais: CRUD + navegação canal-cêntrica

- [x] **1.1 Schema `Channel`** — modelo criado; `db push` aplicado (sem perda: recuperei
  os campos multi-tenant que estavam no banco mas faltavam no `schema.prisma`).
- [x] **1.2 API `/api/channels` e `/api/channels/[id]`** — GET/POST/GET/PATCH/DELETE
  escopados por `userId` (anti-IDOR). Verificado: 401 JSON sem sessão.
- [x] **1.3 Client `src/lib/channels/client.ts`** — listar/obter/criar/atualizar/excluir.
- [x] **1.4 UI — Home = lista de canais** — grid de cards + dialog criar/editar + excluir
  com confirmação (`src/components/canais/canais-lista.tsx`, `src/app/page.tsx`).
- [x] **1.5 UI — Página do canal `/canais/[id]`** — cabeçalho + abas Dados/Vídeos/
  Calendário (placeholders) (`src/components/canais/canal-detalhe.tsx`).
- [x] **1.6 Navegação nova (shell)** — "Canais" como âncora; auxiliares em "Ferramentas";
  `/estudio` fora da nav.
- [x] **CP-A — checkpoint VALIDADO:** logado como admin, criado canal "Ciência em 5
  minutos" (persistiu no banco, id real), aberto o canal com abas Dados/Vídeos/Calendário,
  navegação canal-cêntrica correta (Gerenciador + Ferramentas + Administração). Sem erros
  de console. Rebaseado sobre origin/main e publicado em `feat/gerenciador-canais`.

## Fase 2 — Vídeos: CRUD dentro do canal

- [x] **2.1 Schema `Video`** — todos os campos de artefato (roteiro/segmentos/timings/srt/
  scheduledAt/voz/provider/promptSistema/notas) + `videos Video[]` no Channel; `db push`.
- [x] **2.2 API vídeos** — `/api/channels/[id]/videos` (GET/POST, verifica posse do canal)
  e `/api/videos/[id]` (GET/PATCH/DELETE, escopo `where { id, channel: { userId } }`).
- [x] **2.3 Client `src/lib/videos/client.ts`** — listar/criar/obter/atualizar/excluir.
- [x] **2.4 UI — aba Vídeos do canal** (`videos-aba.tsx`) — lista com título/tema + badge
  de estágio derivado (`lib/videos/estagio.ts`); dialog criar (título+tema); excluir.
- [x] **2.5 UI — página do vídeo `/videos/[id]` (shell)** (`videos/video-shell.tsx`) —
  header + badge de estágio + barra de progresso + 4 cards de etapa (placeholders 3–5).
- [x] **CP-B — VALIDADO:** criado vídeo "Por que o céu é azul?" (persistiu, id real),
  badge "Ideia", aberto o shell. tsc/eslint limpos; sem erros de console.

## Fase 3 — Estúdio no vídeo: Roteiro persistido

- [x] **3.1 Ligar `RoteiroEtapa` ao vídeo** (`videos/roteiro-secao.tsx`) — reusa a
  `RoteiroEtapa` apresentacional; carrega tema/provider/promptSistema/roteiro do vídeo;
  dropdown de prompt puxa da Biblioteca + opção sintética "Padrão do canal".
- [x] **3.2 Persistir roteiro** — auto-save com debounce (800ms) + save imediato após
  gerar, via PATCH `/api/videos/[id]`; indicador "Salvando…/Salvo". Shell busca o canal
  para o prompt padrão.
- [x] **VALIDADO:** tema veio pré-preenchido do banco; gerado roteiro (fake, 378 chars);
  F5 → roteiro persiste (71 palavras) e badge de estágio virou "Roteiro". Sem erros.
- [~] **CP-C:** valor central em construção (falta Narração + Sincronização — Fase 4).

## Fase 4 — Narração + Sincronização persistidas

- [x] **4.1 Narração no vídeo** — `videos/narracao-sincronizacao-secao.tsx` reusa
  `NarracaoEtapa`; gera áudio efêmero (Darkvi); salva só `voz` (PATCH) + preferência.
- [x] **4.2 Sincronização no vídeo** — reusa `SincronizacaoEtapa` (Whisper no browser);
  ao concluir, PATCH salva `segmentos/timings/srt`; ao reabrir sem áudio, mostra o
  resultado salvo com aviso e libera downloads (SRT/timings/TXT).
- [x] **CP-C — VALIDADO:** fluxo completo no navegador — gerar narração (Darkvi, voz
  ALe), sincronizar (Whisper, 4 blocos), F5 → estágio "Sincronizado", 4 blocos persistem,
  voz salva, aviso de áudio-não-persistido. Sem erros de console. tsc/eslint limpos.

## Fase 5 — Prompts de imagem/cena por vídeo

> Mudança de abordagem (melhor que o plano): a base do origin/main já tem o agente
> `VideoPromptsChat` (DOTTI AGENT 2.0) que gera prompts de cena sincronizados. Reusei
> esse agente em vez de recriar via separador — só faltava PERSISTIR.

- [x] **5.1 Campo `promptsCena` (texto) no `Video`** (em vez de tabela ScenePrompt — o
  agente produz um bloco de texto sincronizado) + `db push`. DTO/client/rota atualizados.
- [x] **5.2 Persistência** — `VideoPromptsChat` ganhou callback opcional `onResultado`
  (retrocompatível; Estúdio não usa). `prompts-cena-secao.tsx` salva o resultado via PATCH
  e mantém painel editável (auto-save 800ms) com copiar/baixar.
- [x] **5.3 UI — seção no vídeo** — reusa o agente (roteiro+sincronização já carregados do
  vídeo) + painel "Prompts de cena salvos" ao reabrir.
- [x] **5.4 "Ambos" fechado** — prompt de roteiro persiste (Fase 3) + prompts de cena
  persistem (esta fase).
- [x] **VALIDADO:** rodado o agente (fake, 3 etapas), gerou prompts (3299 chars), F5 →
  painel salvo carrega o texto persistido. Sem erros de console. tsc/eslint limpos.

## Fase 6 — Data agendada + limpeza de navegação

- [x] **6.1 `scheduledAt` no vídeo** — input de data no shell do vídeo (`lib/videos/
  data.ts` p/ conversão UTC), PATCH ao mudar; badge de data na lista do canal; API já
  ordena por `scheduledAt asc`. **Validado:** data 2026-08-15 persiste e aparece na lista.
- [x] **6.2 Aposentar `/estudio`** — rota vira `redirect("/")`; `estudio.tsx` removido
  (código morto; a lógica vive nas seções do vídeo). **Validado:** `/estudio` → `/`.
- [x] **6.3 Ferramentas auxiliares** já agrupadas em "Ferramentas" (Fase 1); textos que
  citavam "Estúdio" atualizados para "vídeos" (configuracoes, biblioteca, prompts).
- [x] **6.4 Doc** — calendário mensal / kanban registrados como fase futura no plano.
- [x] **CP-D — VALIDADO:** app canal-cêntrico completo; `/estudio` aposentado; sem erros
  de console; tsc/eslint limpos.

---

### Fora do MVP (fase futura)
- Vista de **calendário mensal** e **quadro kanban** de status por canal.
- **Persistir o MP3** da narração em storage externo (S3/R2/Vercel Blob).
- Thumbnails/assets do vídeo anexados ao registro do `Video`.
