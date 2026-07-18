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
exigem autenticação, com exceção do endpoint de login e dos arquivos estáticos.

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
