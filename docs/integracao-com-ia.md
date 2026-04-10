# Integracao com IA

Sema foi feita para IA operar software vivo com menos adivinhacao.

## Ordem recomendada

1. `sema inspecionar . --json`
2. `sema resumo <arquivo-ou-pasta> --micro --para onboarding`
3. `sema drift <arquivo-ou-pasta> --json`
4. `sema contexto-ia <arquivo.sema> --saida <diretorio> --json`

Nao comece cavando codigo bruto quando a ferramenta ja consegue te dar contrato, score, lacuna e superficie viva.

## Por capacidade do modelo

IA pequena:

- `sema resumo --micro`
- `briefing.min.json`
- `prompt-curto.txt`

IA media:

- `sema resumo --curto`
- `drift.json`
- `briefing.min.json`

IA grande:

- `sema contexto-ia`
- `briefing.json`
- `ir.json`
- `ast.json`

## MCP

Se o agente usa MCP:

```bash
npm install -g @semacode/cli @semacode/mcp
```

Depois configure:

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

## Regras praticas

- trate `.sema` e IR como fonte de verdade semantica
- trate `drift` como juiz da adocao incremental
- use `briefing.min.json` antes de abrir dezenas de arquivos
- nao invente sintaxe fora da gramatica oficial
- em persistencia, nao assuma que bancos diferentes tem o mesmo contrato operacional

## Arquivos uteis no repo

- `AGENTS.md`
- `llms.txt`
- `llms-full.txt`
- `SEMA_BRIEF.md`
- `SEMA_INDEX.json`
- `docs/persistencia-vendor-first.md`
