# Scriptly Flow Agent

Fundação do serviço Python local que futuramente controlará um Chromium para o
Scriptly. Esta fase expõe somente endpoints de diagnóstico; não há automação do
Google Flow, login, geração, download, fila, WebSocket ou integração com Prisma.

## Requisitos

- Python 3.12 ou superior;
- acesso local às portas configuradas;
- Google Chromium instalado pelo Playwright para as fases futuras.

## Instalação

Execute a partir da raiz do repositório:

```bash
cd flow-agent
python -m venv .venv
pip install -e .
playwright install chromium
uvicorn app.main:app --host 127.0.0.1 --port 8765
```

Ative o ambiente virtual antes de `pip`, `playwright` e `uvicorn`. No Windows
PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

O download do Chromium já prepara a dependência para a fase de automação, mas
esta versão ainda não abre nem controla o navegador.

Também é possível iniciar usando as configurações do ambiente:

```bash
python -m app.main
```

Por segurança, o Agent aceita apenas endereços de loopback e usa
`127.0.0.1:8765` como padrão. `0.0.0.0` é rejeitado pela validação.

## Endpoints

### `GET /health`

```json
{
  "status": "ok",
  "service": "scriptly-flow-agent",
  "version": "0.1.0"
}
```

### `GET /status`

```json
{
  "agent": "ready",
  "browser": "stopped",
  "flow": "unknown"
}
```

## Configuração

Copie `.env.example` para `.env` ou defina as variáveis no ambiente. O arquivo
`.env` não deve ser versionado.

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `FLOW_AGENT_HOST` | `127.0.0.1` | Endereço de loopback do serviço |
| `FLOW_AGENT_PORT` | `8765` | Porta TCP local |
| `FLOW_AGENT_CORS_ORIGINS` | `http://127.0.0.1:3000,http://localhost:3000` | Origens Scriptly permitidas, separadas por vírgula |
| `FLOW_AGENT_LOG_LEVEL` | `INFO` | Nível de logging padrão |

O CORS não aceita wildcard, não permite credenciais cross-origin e libera
somente o método `GET` nesta fase.

## Testes

Instale o extra de desenvolvimento e execute o pytest:

```bash
pip install -e ".[test]"
pytest
```

Os testes não iniciam Chromium e não acessam serviços externos.
