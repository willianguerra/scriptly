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

- [ ] **3.1 Ligar `RoteiroEtapa` ao vídeo**
  - Mover/reusar `RoteiroEtapa`; carregar `roteiro/tema/provider/promptSistema` do vídeo.
  - Seleção de prompt puxa da Biblioteca + opção "usar padrão do canal".
- [ ] **3.2 Persistir roteiro**
  - `onGerar`/edição chamam PATCH `/api/videos/[id]` salvando os campos.
  - **Aceite:** gerar/editar roteiro, recarregar a página, o texto continua lá.
  - **Verificação:** preview — gerar com provider `fake`, F5, conferir persistência.
- [ ] **CP-C começa:** valor central (fluxo persistido) em construção.

## Fase 4 — Narração + Sincronização persistidas

- [ ] **4.1 Narração no vídeo**
  - Reusar `NarracaoEtapa`; gerar áudio efêmero; salvar apenas `voz` (PATCH).
  - Ao reabrir com roteiro: botão "gerar áudio" regenera on-demand; se sem chave Darkvi,
    aviso claro mas ainda permite baixar artefatos salvos.
- [ ] **4.2 Sincronização no vídeo**
  - Reusar `SincronizacaoEtapa` (Whisper no browser); ao concluir, PATCH salva
    `segmentos/timings/srt`.
  - **Aceite:** sincronizar, recarregar, segmentos/SRT persistem e baixam.
  - **Verificação:** preview — fluxo completo; F5; baixar `.srt` e `timings.json`.
- [ ] **CP-C — checkpoint:** Estúdio completo persistido dentro do vídeo.

## Fase 5 — Prompts de imagem/cena por vídeo

- [ ] **5.1 Schema `ScenePrompt`** + `prisma db push`.
- [ ] **5.2 API `/api/videos/[id]/prompts`** (GET/POST/PATCH/DELETE, reordenar), escopo por
  canal→usuário.
- [ ] **5.3 UI — seção "Prompts de imagem" no vídeo**
  - Gerar lista a partir do roteiro reusando `src/lib/separar-prompts.ts`; editar, copiar,
    baixar (.txt/zip como no Separador atual).
  - **Aceite:** gerar prompts de cena do roteiro, editar um, recarregar, persiste.
- [ ] **5.4 Prompt de roteiro do vídeo** — expor edição/salvamento do `promptSistema` do
  vídeo junto à etapa de roteiro (fecha o "ambos").

## Fase 6 — Data agendada + limpeza de navegação

- [ ] **6.1 `scheduledAt` no vídeo** — campo de data editável (PATCH); badge/ordenação por
  data na lista de vídeos do canal.
  - **Aceite:** agendar data, aparece na lista e persiste.
- [ ] **6.2 Aposentar `/estudio`** — remover rota `src/app/estudio/` e referências;
  redirecionar para `/canais` se necessário.
- [ ] **6.3 Reagrupar ferramentas auxiliares** (divisor de áudio, thumbnail, contadores,
  link de inscrição) num grupo "Ferramentas" na nav.
- [ ] **6.4 Doc** — anotar "vista de calendário mensal / kanban de status" como fase
  futura no `tasks/plan.md`.
- [ ] **CP-D — checkpoint final:** app canal-cêntrico completo; `/estudio` removido.

---

### Fora do MVP (fase futura)
- Vista de **calendário mensal** e **quadro kanban** de status por canal.
- **Persistir o MP3** da narração em storage externo (S3/R2/Vercel Blob).
- Thumbnails/assets do vídeo anexados ao registro do `Video`.
