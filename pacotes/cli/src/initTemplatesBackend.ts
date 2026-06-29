// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: templates de inicializa??o para backends base, NestJS, FastAPI e Next API.


import type { ArquivosTemplateIniciar, TemplateIniciar } from "./initTemplatesBase.js";

export function arquivosInitTemplatesBackend(template: TemplateIniciar, arquivosBase: ArquivosTemplateIniciar): ArquivosTemplateIniciar | null {
  let arquivos = arquivosBase;
if (template === "nestjs") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated/nestjs",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "backend",
    "framework": "nestjs",
    "modoEstrito": true,
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/nestjs"
    },
    "convencoesGeracaoPorProjeto": "backend"
  }
  `,
        },
        { caminhoRelativo: "src/.gitkeep", conteudo: "" },
        { caminhoRelativo: "test/.gitkeep", conteudo: "" },
        ...arquivosBase,
      ];
    } else if (template === "fastapi") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated/fastapi",
    "alvos": ["python"],
    "alvoPadrao": "python",
    "estruturaSaida": "backend",
    "framework": "fastapi",
    "modoEstrito": true,
    "diretoriosSaidaPorAlvo": {
      "python": "./generated/fastapi"
    },
    "convencoesGeracaoPorProjeto": "backend"
  }
  `,
        },
        { caminhoRelativo: "app/.gitkeep", conteudo: "" },
        { caminhoRelativo: "tests/.gitkeep", conteudo: "" },
        ...arquivosBase,
      ];
    } else if (template === "nextjs-api") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["nextjs", "typescript"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/health.sema",
          conteudo: `module app.health {
    task get_api_health {
      output {
        status: Texto
        runtime: Texto
      }
      impl {
        ts: src.app.api.health.route.GET
      }
      guarantees {
        status existe
        runtime existe
      }
    }

    route get_api_health_publico {
      metodo: GET
      caminho: /api/health
      task: get_api_health
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/app/api/health/route.ts",
          conteudo: `export async function GET() {
    return Response.json({
      status: "ok",
      runtime: "nextjs",
    });
  }
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Next.js API + Sema

  - Contratos em \`contratos/\`
  - Handlers App Router em \`src/app/api/\`
  - Rota de exemplo validada por \`drift\`
  `,
        },
      ];
    }
  else {
    return null;
  }
  return arquivos;
}
