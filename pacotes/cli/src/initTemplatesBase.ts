// SEMA-GOVERNED: sema.produto.cli_init_templates, sema.produto.governanca_ia.drift.cache.modos
// Descrição: contrato base e dispatcher dos templates multi-agente de inicialização.


import { separarDemonstracoesTemplate } from "./initProjectPlan.js";
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
  return [{ caminhoRelativo: "contratos/.gitkeep", conteudo: "" }];
}

function arquivosApoioIaIniciar(): ArquivosTemplateIniciar {
  return [
    {
      caminhoRelativo: "README.md",
      conteudo: `# Projeto Sema

Sema foi adotado neste projeto. A inicialização prepara configuração, protocolo e exemplos; o contrato de negócio deve representar o pedido do usuário.

1. Use AGENTS.md, SEMA_BOOT.md e sema sessao "<intenção>" --json.
2. Se ainda não houver contrato aplicável, modele o comportamento solicitado em contratos/ antes de implementar. Consulte somente exemplos pertinentes em exemplos/ para sintaxe.
3. Valide o contrato e siga os gates locais antes de alterar o código da aplicação.

Contratos já existentes são preservados. Não trate exemplos como funcionalidades solicitadas nem como evidência de implementação.

## Estrutura

- contratos/: contratos reais do projeto; a inicialização não inventa um domínio.
- exemplos/: referências da DSL e demonstrações de templates. Não são origens de contratos ativos.
- AGENTS.md e SEMA_BOOT.md: protocolo de operação.
- sema.config.json: configuração do projeto.
- SEMA_INDEX.json e AGENT_CONTEXT_PACK.json: bases internas da CLI, sem leitura integral obrigatória.
- docs/: referências sob demanda.

Depois de modelar e validar o contrato solicitado, gere o suporte necessário com sema compilar <contrato.sema> --alvo <alvo-configurado> --saida <diretório> e implemente o comportamento real.

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
        conteudo: "{\n  \"origens\": [\"./contratos\"],\n  \"saida\": \"./generated\",\n  \"alvos\": [\"typescript\", \"javascript\"],\n  \"alvoPadrao\": \"typescript\",\n  \"estruturaSaida\": \"modulos\",\n  \"framework\": \"base\",\n  \"modoEstrito\": true,\n  \"diretoriosSaidaPorAlvo\": {\n    \"typescript\": \"./generated/typescript\",\n    \"javascript\": \"./generated/javascript\",\n    \"python\": \"./generated/python\",\n    \"php\": \"./generated/php\",\n    \"dart\": \"./generated/dart\",\n    \"lua\": \"./generated/lua\",\n    \"html\": \"./generated/html\",\n    \"css\": \"./generated/css\",\n    \"dotnet\": \"./generated/dotnet\",\n    \"cpp\": \"./generated/cpp\"\n  },\n  \"convencoesGeracaoPorProjeto\": \"base\"\n}\n",
      },
      ...arquivosBase,
    ];

  return anexarApoioIaSemDuplicar(separarDemonstracoesTemplate(template, arquivosTemplate));
}
