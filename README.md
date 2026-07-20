# Scriptly

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
