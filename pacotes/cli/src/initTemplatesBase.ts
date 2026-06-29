// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: contrato base e dispatcher de templates de inicializa??o.


import type { FrameworkGeracao } from "@sema/padroes";
import { arquivosInitTemplatesBackend } from "./initTemplatesBackend.js";
import { arquivosInitTemplatesWeb } from "./initTemplatesWeb.js";
import { arquivosInitTemplatesFlutter } from "./initTemplatesFlutter.js";
import { arquivosInitTemplatesRuntime } from "./initTemplatesRuntime.js";

export interface ArquivoTemplateIniciar { caminhoRelativo: string; conteudo: string }
export type ArquivosTemplateIniciar = ArquivoTemplateIniciar[];
export type TemplateIniciar =
  | FrameworkGeracao
  | "nextjs-api"
  | "nextjs-consumer"
  | "react-vite-consumer"
  | "angular-consumer"
  | "flutter-consumer"
  | "node-firebase-worker"
  | "aspnet-api"
  | "springboot-api"
  | "go-http-api"
  | "rust-axum-api"
  | "cpp-service-bridge";

export function arquivosBaseIniciar(): ArquivosTemplateIniciar {
  return [
    {
      caminhoRelativo: "contratos/pedidos.sema",
      conteudo: `module app.pedidos {
  entity Pedido {
    fields {
      id: Id
      status: Texto
      total: Decimal
    }
  }

  task criar_pedido {
    input {
      cliente_id: Id required
      total: Decimal required
    }
    output {
      pedido_id: Id
      status: Texto
    }
    rules {
      total > 0
    }
    effects {
      persistencia Pedido criticidade=alta
      auditoria pedidos
    }
    guarantees {
      pedido_id existe
      status existe
    }
    tests {
      caso "pedido valido" {
        given {
          cliente_id: "cli-1"
          total: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route criar_pedido_publico {
    metodo: POST
    caminho: /pedidos
    task: criar_pedido
  }
}
`,
    },
  ];
}

function arquivosApoioIaIniciar(): ArquivosTemplateIniciar {
  return [
    {
      caminhoRelativo: "README.md",
      conteudo: `# Projeto Sema

Este projeto foi inicializado com Sema.

## Entrada para IA

Antes de alterar codigo, contrato ou documentacao:

1. leia \`AGENTS.md\`;
2. rode \`sema --version\`;
3. rode \`sema preflight resumo --json\`;
4. rode \`sema resumo\`;
5. rode \`sema docs-impacto --intencao "<acao>" --json\`;
6. leia \`docs/commands.md\` antes de escolher comando ou interpretar \`--saida\`;
7. use \`exemplos/\` e \`docs/syntax.md\` antes de criar ou corrigir \`.sema\`.

## Estrutura criada

- \`contratos/\`: contratos semanticamente governados.
- \`exemplos/\`: exemplos oficiais da DSL Sema.
- \`docs/commands.md\`: catalogo de comandos, gates e regra de \`--saida\`.
- \`docs/syntax.md\`: referencia curta para escrever \`.sema\`.
- \`docs/ai-workflow.md\`: fluxo minimo para agentes.
- \`SEMA_BOOT.md\`, \`SEMA_SMALL_MODEL.md\`, \`AGENT_CONTEXT_PACK.json\` e \`SEMA_INDEX.json\`: contexto IA-first.

## Geracao

O template base ja declara alvo JavaScript. Exemplo:

\`\`\`bash
sema compilar contratos/pedidos.sema --alvo javascript --saida ./generated/javascript
\`\`\`
`,
    },
  ];
}

function anexarApoioIaSemDuplicar(arquivos: ArquivosTemplateIniciar): ArquivosTemplateIniciar {
  const existentes = new Set(arquivos.map((arquivo) => arquivo.caminhoRelativo));
  return [
    ...arquivos,
    ...arquivosApoioIaIniciar().filter((arquivo) => !existentes.has(arquivo.caminhoRelativo)),
  ];
}

export function arquivosTemplateIniciar(template: TemplateIniciar): ArquivosTemplateIniciar {
  const arquivosBase = arquivosBaseIniciar();
  const arquivosTemplate = arquivosInitTemplatesBackend(template, arquivosBase)
    ?? arquivosInitTemplatesWeb(template, arquivosBase)
    ?? arquivosInitTemplatesFlutter(template, arquivosBase)
    ?? arquivosInitTemplatesRuntime(template, arquivosBase)
    ?? [
      {
        caminhoRelativo: "sema.config.json",
        conteudo: "{\n  \"origens\": [\"./contratos\"],\n  \"saida\": \"./generated\",\n  \"alvos\": [\"typescript\", \"javascript\", \"python\", \"dart\", \"lua\", \"html\", \"css\"],\n  \"alvoPadrao\": \"typescript\",\n  \"estruturaSaida\": \"modulos\",\n  \"framework\": \"base\",\n  \"modoEstrito\": true,\n  \"diretoriosSaidaPorAlvo\": {\n    \"typescript\": \"./generated/typescript\",\n    \"javascript\": \"./generated/javascript\",\n    \"python\": \"./generated/python\",\n    \"dart\": \"./generated/dart\",\n    \"lua\": \"./generated/lua\",\n    \"html\": \"./generated/html\",\n    \"css\": \"./generated/css\"\n  },\n  \"convencoesGeracaoPorProjeto\": \"base\"\n}\n",
      },
      ...arquivosBase,
    ];

  return anexarApoioIaSemDuplicar(arquivosTemplate);
}
