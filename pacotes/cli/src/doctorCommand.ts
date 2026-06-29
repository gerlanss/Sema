// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: comando doctor e preflight de depend?ncias externas por alvo de gera??o.

import type { AlvoGeracao, FrameworkGeracao } from "@sema/padroes";
import {
  comandoDisponivel,
  resolverExecucaoPython,
  resolverExecucaoPytest,
  TSX_EXECUTOR_CLI,
  TSX_IMPORTADOR_CLI,
  type ExecucaoComandoExterno,
} from "./execucoesExternas.js";

interface ItemDependenciaComando {
  nome: string;
  ok: boolean;
  detalhe?: string;
  obrigatoria: boolean;
}

interface DependenciaComandoDoctor {
  comando: string;
  itens: ItemDependenciaComando[];
}

interface PreflightVerificacao {
  ok: boolean;
  dependencias: DependenciaComandoDoctor[];
  faltando: Array<{
    comando: string;
    nome: string;
    detalhe?: string;
  }>;
}
function criarItemDependencia(
  nome: string,
  ok: boolean,
  detalhe: string | undefined,
  obrigatoria = true,
): ItemDependenciaComando {
  return { nome, ok, detalhe, obrigatoria };
}

function coletarDependenciasDoctor(): DependenciaComandoDoctor[] {
  const python = resolverExecucaoPython();
  const pytest = resolverExecucaoPytest();
  return [
    {
      comando: "base",
      itens: [
        criarItemDependencia("node", comandoDisponivel("node"), "runtime principal da CLI"),
        criarItemDependencia("npm", comandoDisponivel("npm"), "instalacao, pack e publish"),
        criarItemDependencia("python", Boolean(python), python?.rotulo ? `resolvido via ${python.rotulo}` : "python ou py"),
        criarItemDependencia("dotnet", comandoDisponivel("dotnet"), "ecosistema ASP.NET", false),
        criarItemDependencia("go", comandoDisponivel("go"), "ecosistema Go", false),
        criarItemDependencia("cargo", comandoDisponivel("cargo"), "ecosistema Rust", false),
        criarItemDependencia("java", comandoDisponivel("java"), "ecosistema Java/Spring", false),
        criarItemDependencia("code", comandoDisponivel("code", ["--version"]), "VS Code / extensao", false),
      ],
    },
    {
      comando: "verificar/typescript",
      itens: [
        criarItemDependencia("node", comandoDisponivel("node"), "execucao do runner TypeScript"),
        criarItemDependencia(
          "tsx",
          Boolean(TSX_EXECUTOR_CLI ?? TSX_IMPORTADOR_CLI),
          TSX_EXECUTOR_CLI
            ? `runner resolvido em ${TSX_EXECUTOR_CLI}`
            : TSX_IMPORTADOR_CLI
              ? `importador resolvido em ${TSX_IMPORTADOR_CLI}`
              : "tsx nao foi encontrado junto da CLI",
        ),
      ],
    },
    {
      comando: "verificar/javascript",
      itens: [
        criarItemDependencia("node", comandoDisponivel("node"), "node --test"),
      ],
    },
    {
      comando: "verificar/python",
      itens: [
        criarItemDependencia("python", Boolean(python), python?.rotulo ? `resolvido via ${python.rotulo}` : "python ou py"),
        criarItemDependencia("pytest", Boolean(pytest), pytest?.rotulo ? `runner resolvido via ${pytest.rotulo}` : "instale pytest ou exponha python -m pytest"),
      ],
    },
    {
      comando: "verificar/lua",
      itens: [
        criarItemDependencia("lua", comandoDisponivel("lua", ["-v"]), "runner de testes Lua"),
      ],
    },
  ];
}

function renderizarCaixaAscii(linhas: string[]): string {
  const largura = Math.max(...linhas.map((linha) => linha.length), 12);
  const borda = `+${"-".repeat(largura + 2)}+`;
  return [
    borda,
    ...linhas.map((linha) => `| ${linha.padEnd(largura, " ")} |`),
    borda,
  ].join("\n");
}

export function avaliarPreflightVerificacao(
  configuracoesAlvo: Array<{ alvo: AlvoGeracao; framework: FrameworkGeracao }>,
): PreflightVerificacao {
  const dependencias: DependenciaComandoDoctor[] = [];
  const faltando: PreflightVerificacao["faltando"] = [];

  const registrar = (comando: string, itens: ItemDependenciaComando[]) => {
    dependencias.push({ comando, itens });
    for (const item of itens) {
      if (item.obrigatoria && !item.ok) {
        faltando.push({
          comando,
          nome: item.nome,
          detalhe: item.detalhe,
        });
      }
    }
  };

  registrar("base", [
    criarItemDependencia("node", comandoDisponivel("node"), "runtime principal da CLI"),
    criarItemDependencia("npm", comandoDisponivel("npm"), "instalacao e empacotamento"),
  ]);

  for (const configuracao of configuracoesAlvo) {
    if (configuracao.framework !== "base") {
      continue;
    }

    if (configuracao.alvo === "typescript") {
      registrar("verificar/typescript", [
        criarItemDependencia("node", comandoDisponivel("node"), "execucao do runner TypeScript"),
        criarItemDependencia(
          "tsx",
          Boolean(TSX_EXECUTOR_CLI ?? TSX_IMPORTADOR_CLI),
          TSX_EXECUTOR_CLI
            ? `runner resolvido em ${TSX_EXECUTOR_CLI}`
            : TSX_IMPORTADOR_CLI
              ? `importador resolvido em ${TSX_IMPORTADOR_CLI}`
              : "tsx nao foi encontrado junto da CLI",
        ),
      ]);
      continue;
    }

    if (configuracao.alvo === "javascript") {
      registrar("verificar/javascript", [
        criarItemDependencia("node", comandoDisponivel("node"), "node --test"),
      ]);
      continue;
    }

    if (configuracao.alvo === "python") {
      const python = resolverExecucaoPython();
      const pytest = resolverExecucaoPytest();
      registrar("verificar/python", [
        criarItemDependencia("python", Boolean(python), python?.rotulo ? `resolvido via ${python.rotulo}` : "python ou py"),
        criarItemDependencia("pytest", Boolean(pytest), pytest?.rotulo ? `runner resolvido via ${pytest.rotulo}` : "instale pytest ou exponha python -m pytest"),
      ]);
      continue;
    }

    if (configuracao.alvo === "lua") {
      registrar("verificar/lua", [
        criarItemDependencia("lua", comandoDisponivel("lua", ["-v"]), "runner de testes Lua"),
      ]);
    }
  }

  return {
    ok: faltando.length === 0,
    dependencias,
    faltando,
  };
}

function imprimirDependenciasDoctor(dependencias: DependenciaComandoDoctor[]): void {
  for (const dependencia of dependencias) {
    console.log(`\n[${dependencia.comando}]`);
    for (const item of dependencia.itens) {
      const sufixo = item.detalhe ? ` (${item.detalhe})` : "";
      console.log(`- ${item.nome}: ${item.ok ? "ok" : item.obrigatoria ? "faltando" : "ausente"}${sufixo}`);
    }
  }
}

export function imprimirPreflightVerificacao(preflight: PreflightVerificacao): void {
  console.error(renderizarCaixaAscii([
    "Preflight de verificacao falhou",
    "a CLI sabe o que falta antes de gerar e testar",
  ]));
  for (const item of preflight.faltando) {
    const detalhe = item.detalhe ? ` (${item.detalhe})` : "";
    console.error(`- ${item.comando}: ${item.nome} faltando${detalhe}`);
  }
  console.error("Rode `sema doctor` para ver as dependencias por comando.");
}

export async function comandoDoctor(): Promise<number> {
  const dependencias = coletarDependenciasDoctor();

  console.log(renderizarCaixaAscii([
    "Sema doctor",
    "checa a toolchain minima e as dependencias reais por comando",
  ]));
  imprimirDependenciasDoctor(dependencias);

  const obrigatorios = dependencias
    .find((dependencia) => dependencia.comando === "base")
    ?.itens.filter((item) => item.obrigatoria) ?? [];
  return obrigatorios.every((check) => check.ok) ? 0 : 1;
}
