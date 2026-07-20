# Plano — Scriptly como "Gerenciador de Canais do YouTube"

> Reformular o app para ser um **gerenciador de canais**: cada Canal tem seus dados,
> uma agenda (data por vídeo) e seus Vídeos; cada Vídeo carrega o fluxo que hoje é o
> **Estúdio** (Roteiro → Narração → Sincronização) **persistido**, mais os **prompts
> de imagem/cena**. Navegação reescrita para ser canal-cêntrica.

## Decisões de produto (confirmadas com o dono)

1. **Áudio:** persistir só artefatos de **texto** (roteiro, segmentos, timings, SRT, voz
   escolhida). O MP3 **não** é salvo — é regenerado sob demanda ao reabrir o vídeo.
2. **Navegação:** **substituição total** — home vira lista de Canais; o `/estudio` solto
   é aposentado; ferramentas auxiliares migram para um grupo "Ferramentas" e/ou para
   dentro do contexto do vídeo.
3. **Prompts do vídeo:** **ambos** — o prompt de roteiro (sistema/tom) **e** a lista de
   prompts de imagem/cena (integrando o Separador de Prompts).
4. **Calendário:** só um **campo de data** (`scheduledAt`) por vídeo agora; a vista de
   calendário mensal / kanban fica marcada como **fase futura**.

## Estado atual (levantado no código)

- **Stack:** Next.js 15 (App Router) + React 19, Prisma + Neon Postgres, Tailwind v4,
  shadcn/ui. Auth por usuário via cookie de sessão assinado.
- **Estúdio** (`src/components/estudio.tsx` + `estudio-workflow.tsx`): fluxo efêmero de 3
  etapas. **Nada é persistido** — todo o estado vive no componente.
  - Roteiro: `gerarRoteiro` (`roteiro-client.ts`) → provider fake/gemini/openai.
  - Narração: Darkvi TTS (`src/lib/darkvi.ts`) → Blob de áudio na sessão.
  - Sincronização: Whisper no browser (`whisper-browser.ts`) fatia o áudio e transcreve;
    `sync.ts` monta `segmentos`/`timings` e exporta texto/SRT/JSON.
- **Persistência existente (padrão a copiar):** modelos `Prompt` e `ApiCredential` no
  `prisma/schema.prisma`; rotas `/api/prompts` → `getCurrentUser()` → Prisma escopado por
  `userId` → DTO; client em `src/lib/prompt-api.ts`. IDOR evitado com
  `updateMany/deleteMany where { id, userId }`.
- **Navegação:** `src/components/scriptly-shell.tsx` — sidebar com lista plana de
  ferramentas (`mainTools`).
- **Nota:** a memória cita multi-tenant (Role/Status/email, `/admin`, `/register`,
  `src/lib/credentials/`) como concluído, mas **não está nesta branch**. O plano não
  depende disso; usa apenas `User.id` + `getCurrentUser()`.

## Modelo de dados (Prisma) — alvo

```prisma
model Channel {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nome        String
  handle      String?               // @canal
  descricao   String?
  nicho       String?
  promptSistemaPadrao String?        // tom/estilo padrão herdado pelos vídeos
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  videos      Video[]
  @@index([userId])
}

model Video {
  id           String    @id @default(cuid())
  channelId    String
  channel      Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  titulo       String
  tema         String?
  scheduledAt  DateTime?               // "calendário" (campo de data)
  // ---- artefatos do Estúdio (persistidos como texto) ----
  promptSistema String?                // prompt de roteiro do vídeo
  provider     String?                 // fake | gemini | openai
  roteiro      String?                 // texto do roteiro
  voz          String?                 // idApi da voz Darkvi escolhida
  segmentos    Json?                   // Segmento[] da sincronização
  timings      Json?                   // Timings
  srt          String?                 // legenda gerada
  notas        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  scenePrompts ScenePrompt[]
  @@index([channelId])
}

model ScenePrompt {              // prompts de imagem/cena por vídeo
  id        String   @id @default(cuid())
  videoId   String
  video     Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)
  ordem     Int
  texto     String
  createdAt DateTime @default(now())
  @@index([videoId])
}
```

- `User` ganha `channels Channel[]`.
- Escopo por usuário nos vídeos/prompts via relação: `where: { channel: { userId } }`
  (mantém o padrão anti-IDOR).
- Migração aplicada com `prisma db push` (padrão do projeto; ver `package.json`).

## Grafo de dependências

```
Fase 1 Canais (CRUD + nav) ──▶ Fase 2 Vídeos (CRUD) ──▶ Fase 3 Roteiro persistido
                                      │                        │
                                      │                        ├─▶ Fase 4 Narração+Sinc.
                                      │                        └─▶ Fase 5 Prompts de cena
                                      └─▶ Fase 6 Data (scheduledAt) + limpeza de nav
```

Cada fase é uma **fatia vertical** (schema → API → client → UI) que entrega algo usável.

## Fases

### Fase 1 — Canais: CRUD + navegação canal-cêntrica
Home vira a lista de canais; criar/editar/excluir; página do canal com dados.
Entrega o esqueleto de navegação novo.

### Fase 2 — Vídeos: CRUD dentro do canal
Aba/lista de vídeos no canal; criar vídeo (título+tema); abrir vídeo → "shell" do vídeo
(placeholder das etapas). Migração já cria o `Video` com todos os campos de artefato.

### Fase 3 — Estúdio no vídeo: Roteiro persistido
Reaproveita `RoteiroEtapa`; gera/edita roteiro e salva `roteiro/promptSistema/provider/
tema` no vídeo. Puxa prompt de roteiro da Biblioteca e/ou do `promptSistemaPadrao` do
canal. **Checkpoint de valor central começa aqui.**

### Fase 4 — Narração + Sincronização persistidas
Narração gera áudio efêmero (salva só a `voz`). Sincronização (Whisper no browser) salva
`segmentos/timings/srt`. Reabrir o vídeo mostra tudo; botão regenera áudio p/ reexportar.

### Fase 5 — Prompts de imagem/cena por vídeo
Modelo `ScenePrompt` + CRUD/reordenar. Gera a lista a partir do roteiro reusando
`src/lib/separar-prompts.ts`; editar/copiar/baixar (.txt/zip como já existe).

### Fase 6 — Data agendada + limpeza de navegação
`scheduledAt` editável no vídeo; ordenação/badge por data na lista. Ferramentas auxiliares
reagrupadas; `/estudio` removido. Vista de calendário mensal fica documentada como
**fase futura**.

## Checkpoints (revisão humana)

- **CP-A** após Fase 1 — navegação nova e canais funcionando isolados por usuário.
- **CP-B** após Fase 2 — canal → vídeos criáveis e abríveis.
- **CP-C** após Fase 4 — **fluxo do Estúdio persistido dentro do vídeo** (valor central).
- **CP-D** após Fase 6 — app completo, `/estudio` aposentado, nav limpa.

## Verificação (por fase)

- `npm run build` e `npm run lint` sem erros novos.
- Fluxo exercitado no preview (dev server): criar canal → criar vídeo → gerar roteiro →
  narrar → sincronizar → gerar prompts de cena → recarregar e confirmar persistência.
- Isolamento por usuário: dados de um usuário não aparecem para outro (rotas escopadas por
  `userId`/relação de canal).

## Riscos / decisões em aberto

- **`Json` no Postgres** para `segmentos/timings` — ok no Prisma; validar shape ao ler.
- **Regenerar áudio** exige a chave Darkvi ativa ao reabrir; se ausente, mostrar aviso e
  ainda permitir baixar SRT/timings salvos.
- **Vista de calendário** e **kanban de status** ficam fora do MVP (fase futura).
