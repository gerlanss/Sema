# @semacode/mcp

`@semacode/mcp` expoe a Sema como servidor MCP para Claude Code, Cursor, VS Code, Cline e clientes compativeis.

Ele usa a CLI da Sema como backend operacional. Instale a CLI antes ou junto:

```bash
npm install -g @semacode/cli @semacode/mcp
```

Tambem funciona sem instalacao previa da ferramenta MCP:

```bash
npx -y @semacode/mcp
```

## Ferramentas expostas

- `sema_validar`
- `sema_ir`
- `sema_drift`
- `sema_resumo`
- `sema_prompt_ia`
- `sema_contexto_ia`
- `sema_verificar`
- `sema_inspecionar`

Essas ferramentas acompanham a linha publica atual da Sema, incluindo persistencia vendor-first para `postgres`, `mysql`, `sqlite`, `mongodb` e `redis`.

## Configuracao no Claude Code

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

## Configuracao no Cursor, VS Code ou Cline

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

## Rodando localmente pelo repo

```json
{
  "mcpServers": {
    "sema": {
      "command": "node",
      "args": ["C:/GitHub/Sema/pacotes/mcp/dist/index.js"]
    }
  }
}
```

## Modo stdio e modo HTTP

- padrao: `stdio`, ideal para uso local com agentes
- remoto: defina `MCP_PORT` para expor `/mcp` e `/sse`

Exemplo:

```bash
MCP_PORT=3333 npx -y @semacode/mcp
```

## Observacoes

- o servidor MCP resolve `sema` pelo PATH do sistema
- `sema_verificar` usa o diretorio do projeto informado como `cwd`, evitando escrever artefatos no lugar errado
- para reproduzibilidade, mantenha `@semacode/cli` e `@semacode/mcp` na mesma versao
