# Scriptly

## Docker

Docker Compose inicia o Scriptly, PostgreSQL e o worker de renderização. A primeira subida constrói a imagem, aguarda o banco, aplica o schema Prisma e então inicia a aplicação e o worker. O Postgres e os arquivos de mídia usam volumes persistentes.

```powershell
Copy-Item .env.docker.example .env
```

Edite `.env`: defina senhas e chaves fortes para `POSTGRES_PASSWORD`, `AUTH_SESSION_SECRET` e `APP_ENCRYPTION_KEY`. Gere os valores secretos em PowerShell com:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" # AUTH_SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"    # APP_ENCRYPTION_KEY
```

Use uma senha de Postgres alfanumérica para evitar escape de caracteres reservados na URL de conexão. Para criar a imagem e subir os serviços:

```powershell
docker compose up --build -d
```

Crie o primeiro usuário administrador e informe uma senha forte:

```powershell
docker compose exec app node scripts/create-user.mjs --username=admin --password=SUA_SENHA_FORTE --admin
```

Abra `http://localhost:3000`. Configure `PEXELS_API_KEY` para buscar mídia e, se desejar, as chaves de LLM e VoiceStudio no `.env`; depois aplique com `docker compose up -d`. A aplicação fica no serviço `app`, e `worker` consome os jobs com o mesmo volume de mídia.

```powershell
docker compose logs -f app worker
docker compose down
```

`docker compose down` mantém os volumes. Para apagar também o banco e a mídia persistida, use `docker compose down -v`. A inicialização aplica o schema com `prisma db push`, conforme o fluxo já usado pelo projeto; para deploys versionados em produção, adote migrations Prisma antes de automatizar mudanças de schema.

Aplicação Next.js com ferramentas para roteiros, áudio, legendas e imagens.
 
## Desenvolvimento local

Requisitos: Node.js 24+ e npm.

```bash
npm install
npm run auth:setup
```

O segundo comando mostra um usuário, uma senha gerada e três variáveis de
ambiente. Copie as variáveis para `.env` sem remover as chaves já existentes e
guarde a senha em um gerenciador seguro. O arquivo `.env` é ignorado pelo Git.

Depois, inicie a aplicação:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Todas as páginas e APIs
exigem autenticação, com exceção dos endpoints de login/cadastro e dos arquivos
estáticos.

## Usuários, cadastro e aprovação

Cada usuário vê apenas os próprios dados (prompts, credenciais). O acesso é
controlado por dois campos em `User`: `role` (`ADMIN` ou `USER`) e `status`
(`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`). Só quem está `APPROVED`
consegue fazer login.

- **Cadastro:** qualquer visitante pode solicitar acesso na própria tela de
  login ("Solicitar cadastro"). O cadastro entra como `PENDING` e não loga até
  ser aprovado.
- **Aprovação:** um administrador aprova, rejeita ou suspende cadastros no painel
  `/admin` (visível só para admins). Suspender ou remover um usuário tem **efeito
  imediato**: o layout revalida o `status` no banco a cada carregamento, então o
  acesso cai já na próxima navegação, sem esperar a sessão expirar.
- **Criar admin pela CLI** (a partir de uma base zerada ou para promover alguém):

  ```bash
  npm run db:create-user -- --username=admin --password=SUA_SENHA --admin
  ```

  Usuários criados pela CLI já entram como `APPROVED`. Sem `--admin`, o papel é
  `USER`.

Após alterar o schema do Prisma, aplique com `npm run db:push`.

## Chaves de API por usuário

Cada usuário cadastra as próprias chaves (Darkvi, Gemini, OpenAI) na tela de
**Configurações**. Elas são guardadas **criptografadas** (AES-256-GCM, tabela
`ApiCredential`) e usadas apenas por quem as cadastrou — ninguém consome a chave
(nem o custo) de outro. As variáveis de ambiente `DARKVI_API_TOKEN`,
`GEMINI_API_KEY` e `OPENAI_API_KEY` continuam existindo como **fallback só para o
admin**; usuários comuns precisam informar a própria chave.

Requer `APP_ENCRYPTION_KEY` (32 bytes em base64) no ambiente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `AUTH_USERNAME` | Usuário autorizado a entrar |
| `AUTH_PASSWORD_HASH` | Hash `scrypt` gerado por `npm run auth:setup` |
| `AUTH_SESSION_SECRET` | Chave usada para assinar a sessão |
| `DARKVI_API_TOKEN` | Token server-side da API de voz |
| `APP_URL` | URL pública da aplicação, usada nos metadados sociais |

Configure os mesmos valores no ambiente de hospedagem. Nunca use a senha em
texto puro como variável e nunca exponha tokens com o prefixo `NEXT_PUBLIC_`.

## Verificação

```bash
npm test
npm run lint
npm run build
```

As sessões duram oito horas, usam cookie `httpOnly`, `sameSite=strict` e
`secure` em produção. O login é limitado a cinco falhas por endereço em uma
janela de quinze minutos. Em hospedagem distribuída, substitua o limitador em
memória por um armazenamento compartilhado antes de aumentar o tráfego.

## Estúdio de produção documental

O `/estudio` agora cria projetos persistentes de documentário. Informe um
briefing ou cole um roteiro, configure idioma, duração alvo, proporção, resolução
e estilo editorial. A conversão inicial divide o texto em cartões; **Planejar
cenas com IA** é uma etapa separada e usa a chave OpenAI/Gemini do usuário. O
plano estruturado é validado e guarda sujeito, ação, ambiente, intenção visual,
consultas em inglês/português e termos a evitar.

### Mídia e direitos

- A busca usa a API oficial de vídeos Pexels e requer `PEXELS_API_KEY` no
  servidor. O Pexels exige link proeminente para a plataforma e recomenda
  crédito ao autor; o Scriptly mostra fonte, licença e atribuição nos resultados.
  Veja a [documentação de busca de vídeos Pexels](https://www.pexels.com/api/documentation/)
  e a [licença Pexels](https://www.pexels.com/license/).
- O endpoint de busca fornece metadados limitados, não transcrições nem prova de
  conteúdo quadro a quadro. Por isso os resultados começam com confiança baixa;
  confira o preview antes de dizer que um clipe mostra uma espécie ou ação exata.
- O Scriptly não busca nem baixa vídeos do YouTube. O worker baixa somente os
  links Pexels selecionados no projeto, com host HTTPS permitido. Não cole mídia
  sem direito de uso.
- Música e efeitos são enviados pelo usuário. Informe licença/termos e crédito;
  o projeto guarda esses dados junto da faixa. Os arquivos precisam caber no
  limite de 80 MB por faixa e 300 MB por clipe.
- O workspace não continha `catalogo.json`, `cues.json` ou `prioridade.json` de
  mídia. O Scriptly agora tem sementes tipadas em
  `src/lib/production/data/`: o catálogo começa vazio; as seeds de cue e
  prioridades são configurações identificadas como demonstração. Nenhuma faixa
  de áudio fictícia é apresentada como licenciada. Títulos, chamadas, legendas
  e subtítulos resolvem disputas de tempo por prioridade em
  `src/lib/production/catalog.ts`.

### Narração, legendas e render

- **VoiceStudio:** configure `VOICESTUDIO_BASE_URL`, opcionalmente
  `VOICESTUDIO_API_KEY` e `VOICESTUDIO_MODEL`. O servidor chama o endpoint
  OpenAI-compatible `/v1/audio/speech`; o serviço deve ser alcançável pelo
  processo do Scriptly. `localhost` no navegador do usuário não é encaminhado
  automaticamente ao servidor. O formato segue o [guia de API do VoiceStudio](https://github.com/debpalash/VoiceStudio/blob/main/docs/api-auth.md).
- Se VoiceStudio não estiver acessível, a tela mostra o estado e permite enviar
  áudio próprio ou gerado por um serviço configurado separadamente. O áudio
  fica no diretório privado de mídia do projeto. O Whisper já incluído no
  Scriptly transcreve localmente no navegador para gerar legendas alinhadas;
  o modelo `whisper-base` pode ser baixado na primeira utilização.
- O worker executa FFmpeg e ffprobe instalados pelo `ffmpeg-static` e
  `ffprobe-static`. O renderer usa H.264/AAC, trabalha fora das requisições HTTP,
  valida a faixa de áudio/vídeo do resultado e não recebe comandos de shell do
  usuário. Os jobs guardam espera, processamento, conclusão ou erro, e oferecem
  repetir/cancelar.
- O worker e o servidor web precisam compartilhar o mesmo armazenamento
  persistente em `MEDIA_STORAGE_DIR`. Isso funciona com um volume compartilhado
  no mesmo host; armazenamento distribuído/S3 ainda precisa de um adapter.
  Limites por render: 120 cenas, 2 horas de duração e 2 GB de mídia de vídeo.

### Configuração e execução

1. Aplique o novo schema Prisma à base configurada:

   ```bash
   npm run db:push
   ```

2. Defina `PEXELS_API_KEY` para busca. Configure `VOICESTUDIO_BASE_URL` para
   gerar voz; sem ele, associe um arquivo de áudio. Para gerar roteiro ou plano
   com OpenAI/Gemini, salve a respectiva chave em **Configurações**.
3. Mantenha o Next.js e o worker rodando com o mesmo banco e volume:

   ```bash
   npm run dev
   npm run worker:production
   ```

   Em produção, rode `npm run worker:production` como processo de serviço
   separado e configure no ambiente do worker as mesmas `DATABASE_URL`,
   `DIRECT_URL` quando exigido, `MEDIA_STORAGE_DIR` e credenciais de mídia/voz.
   Cada projeto e job é escopado pelo usuário autenticado.

| Variável | Uso |
| --- | --- |
| `PEXELS_API_KEY` | Busca Pexels server-side; nunca vai ao navegador |
| `MEDIA_STORAGE_DIR` | Volume privado compartilhado entre web e worker; padrão `./storage/media` |
| `VOICESTUDIO_BASE_URL` | URL do serviço HTTP acessível ao servidor Scriptly |
| `VOICESTUDIO_API_KEY` | Bearer opcional para VoiceStudio protegido |
| `VOICESTUDIO_MODEL` | Modelo solicitado ao endpoint compatível; padrão `tts-1` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Valores que serão necessários se o catálogo legado do Supabase reaparecer; **nenhum adapter Supabase está ativo** e essas variáveis não são lidas pelo código atual |

O renderer usa regras de prioridade e cue configuráveis, volumes de narração,
música e efeitos, ducking automático, estilos `broadcast`, `cinema`, `dossie` e
`kinetico`, 16:9/9:16/1:1 e 720p/1080p. Quando o briefing de tubarões é usado, a
IA recebe instrução para marcar alegações sem suporte como `[revisar]`. Não há
pesquisa de fontes científicas integrada nesta versão: etimologias, nomes e
curiosidades precisam de revisão editorial antes da publicação.
