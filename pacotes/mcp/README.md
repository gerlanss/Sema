# @semacode/mcp

Servidor MCP da Sema. Expoe os comandos da CLI como ferramentas para agentes (Claude Code, Cursor, etc.).

## Ferramentas disponíveis

| Ferramenta | Descricao |
|---|---|
| `sema_validar` | Valida um arquivo `.sema` |
| `sema_ir` | Compila e retorna a IR em JSON |
| `sema_drift` | Analisa drift entre contrato e codigo |
| `sema_resumo` | Resumo IA-first do projeto |
| `sema_prompt_ia` | Prompt-curto para briefar agentes |
| `sema_contexto_ia` | Pacote completo de contexto IA para um modulo |
| `sema_verificar` | Verifica todos os alvos de geracao |
| `sema_inspecionar` | Inspeciona detalhes de um modulo |

**Pre-requisito:** `sema` instalado e disponivel no PATH (`npm install -g @semacode/cli`).

## Configuracao no Claude Code

Adicione em `~/.claude/settings.json` (ou `.claude/settings.json` no projeto):

```json
{
  "mcpServers": {
    "sema": {
      "command": "node",
      "args": ["/caminho/para/Sema/pacotes/mcp/dist/index.js"]
    }
  }
}
```

Ou apos publicar no npm:

```json
{
  "mcpServers": {
    "sema": {
      "command": "npx",
      "args": ["-y", "@semacode/mcp"]
    }
  }
}
```

## Configuracao no Cursor / VS Code (cline)

```json
{
  "mcpServers": {
    "sema": {
      "command": "npx",
      "args": ["-y", "@semacode/mcp"]
    }
  }
}
```
