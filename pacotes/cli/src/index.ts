#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  compilarCodigo,
  formatarCodigo,
  formatarDiagnosticos,
  lerArquivoTexto,
  temErros,
  type IrModulo,
} from "@sema/nucleo";
import { descreverEstruturaModulo, type AlvoGeracao, type FrameworkGeracao } from "@sema/padroes";
import { gerarDart } from "@sema/gerador-dart";
import { gerarPython } from "@sema/gerador-python";
import { gerarTypeScript } from "@sema/gerador-typescript";
import {
  carregarConfiguracaoProjeto,
  carregarProjeto,
  resolverAlvoPadrao,
  resolverAlvosVerificacao,
  resolverEstruturaSaidaPadrao,
  resolverFrameworkPadrao,
  resolverSaidaPadrao,
  type ContextoProjetoCarregado,
} from "./projeto.js";
import type { EstruturaSaida } from "./tipos.js";
import { importarProjetoLegado, resumoImportacao, type FonteImportacao } from "./importador.js";
import { analisarDriftLegado } from "./drift.js";

type Comando =
  | "iniciar"
  | "validar"
  | "ast"
  | "ir"
  | "compilar"
  | "gerar"
  | "testar"
  | "diagnosticos"
  | "verificar"
  | "inspecionar"
  | "drift"
  | "importar"
  | "formatar"
  | "ajuda-ia"
  | "starter-ia"
  | "prompt-ia"
  | "prompt-ia-ui"
  | "prompt-ia-react"
  | "prompt-ia-sema-primeiro"
  | "exemplos-prompt-ia"
  | "contexto-ia";

interface ResultadoExecucaoTestes {
  codigoSaida: number;
  quantidadeTestes: number;
}

interface ResumoAlvoVerificacao {
  alvo: AlvoGeracao;
  arquivosGerados: number;
  quantidadeTestes: number;
  pastaSaida: string;
  sucesso: boolean;
}

interface ResumoModuloVerificacao {
  modulo: string;
  arquivoFonte: string;
  alvos: ResumoAlvoVerificacao[];
}

interface SaidaTesteCapturada {
  codigoSaida: number;
  quantidadeTestes: number;
  saidaPadrao: string;
  saidaErro: string;
}

interface ResultadoFormatacaoArquivo {
  caminho: string;
  alterado: boolean;
  sucesso: boolean;
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
}

interface ContextoIaGerado {
  sucesso: boolean;
  arquivo: string;
  modulo: string;
  pastaSaida: string;
  artefatos: string[];
}

interface DescobertaDocsIa {
  origemInstalacao: string;
  baseDetectada: string | null;
  documentos: Array<{ nome: string; caminho: string }>;
}

const STARTER_IA = `Voce esta trabalhando com Sema, uma linguagem estruturada para IA, voltada a modelagem explicita de contratos e intencao.

Importante:
- a Sema modela contratos, estados, fluxos, erros, efeitos e garantias
- a Sema gera codigo e scaffolding real para TypeScript, Python e Dart
- a Sema pode servir de base para interfaces graficas elegantes e coerentes
- a Sema nao gera uma interface completa sozinha no estado atual
- trate a Sema como cerebro semantico da aplicacao, nao como gerador magico de front-end pronto
- se a tarefa envolver UI, prefira pedir Sema + React + TypeScript ou Sema + arquitetura de front-end
- evite pedir HTML unico solto quando a intencao for testar a Sema de verdade

Regras:
- nao invente sintaxe fora da gramatica e dos exemplos oficiais
- trate \`ir --json\` como fonte de verdade semantica
- trate \`diagnosticos --json\` como fonte de correcao
- use \`sema formatar\` como fonte unica de estilo
- preserve a intencao do contrato

Comandos essenciais:
- contexto completo do modulo: \`sema contexto-ia <arquivo.sema>\`
- estrutura sintatica: \`sema ast <arquivo.sema> --json\`
- estrutura semantica: \`sema ir <arquivo.sema> --json\`
- validacao: \`sema validar <arquivo.sema> --json\`
- diagnosticos: \`sema diagnosticos <arquivo.sema> --json\`
- formatacao: \`sema formatar <arquivo.sema>\`
- geracao de codigo: \`sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart> --saida <diretorio>\`
- verificacao final: \`sema verificar <arquivo-ou-pasta> [--json]\`

Antes de editar:
1. leia README, docs de IA e um exemplo oficial parecido
2. consulte AST e IR do modulo alvo

Depois de editar:
1. rode \`sema formatar\`
2. rode \`sema validar --json\`
3. se houver falha, use \`diagnosticos --json\`
4. se a tarefa pedir codigo derivado, rode \`sema compilar\`
5. feche com \`sema verificar\` ou \`npm run project:check\`

Priorize sempre:
- exemplos oficiais
- JSON da CLI
- consistencia semantica

Nao improvise quando faltar contexto.
`;

const PROMPT_BASE_IA = `Voce esta trabalhando com Sema, uma DSL semantica orientada a contrato, desenhada para facilitar entendimento e operacao por IA.

Trate a Sema como linguagem de especificacao executavel. Nao invente sintaxe, palavras-chave ou blocos fora da gramatica e dos exemplos oficiais.

Fontes de verdade, em ordem:
1. README do projeto
2. gramatica e documentacao de sintaxe da Sema
3. especificacao semantica da linguagem
4. exemplos oficiais, com prioridade para o vertical de pagamento
5. AST, IR e diagnosticos exportados pela CLI em JSON

Regras de operacao:
- preserve o significado semantico
- use o formatador oficial da Sema como fonte unica de estilo
- use diagnosticos estruturados como contrato de correcao
- use a IR como fonte de verdade semantica quando houver duvida
- nao conclua uma alteracao sem validar e verificar o modulo

Antes de editar \`.sema\`, entenda:
- o module alvo
- os contratos de task, route, error, effects, guarantees, state e flow
- os exemplos oficiais relacionados

Depois de editar \`.sema\`, execute este fluxo:
1. formatar
2. validar
3. diagnosticar, se houver falha
4. verificar

Se houver conflito entre texto livre e IR/diagnosticos, priorize a IR e os diagnosticos da CLI.

Se algo nao estiver claro, siga a forma ja usada nos exemplos oficiais. Nao improvise sem base.
`;

const PROMPT_IA_UI = `Atue como Engenheiro de Software Senior e UX/UI Designer de elite.

Quero que voce trabalhe com Sema como fonte de verdade semantica do sistema e com React + TypeScript como camada de interface.

Entregue obrigatoriamente duas partes integradas:
1. os arquivos \`.sema\` do dominio
2. a proposta ou implementacao da interface em React + TypeScript

Regras:
- nao entregue apenas HTML solto em arquivo unico
- nao trate a Sema como enfeite conceitual
- a interface deve nascer do contrato semantico definido em Sema
- use os exemplos oficiais da Sema como referencia de estilo e semantica
- nao invente sintaxe fora da gramatica suportada

A Sema deve modelar, quando fizer sentido:
- \`module\`
- \`use\`
- \`entity\`
- \`enum\`
- \`state\`
- \`task\`
- \`flow\`
- \`route\`
- \`effects\`
- \`error\`
- \`guarantees\`
- \`tests\`
- \`docs\`

A interface deve refletir visualmente:
- \`state\` como status e progresso observavel
- \`flow\` como etapas ou orquestracao visivel
- \`error\` como falhas tratadas com clareza
- \`effects\` como operacoes relevantes para usuario ou operacao
- \`guarantees\` como confianca, confirmacao ou consistencia final

Estruture a entrega assim:
1. visao do produto
2. dominio modelado em Sema
3. arquitetura de pastas em React + TypeScript
4. componentes principais
5. estrategia visual
6. codigo principal da interface
7. explicacao curta de como a UI conversa com a semantica da Sema

Se a tarefa envolver app visual, a Sema governa o significado e o React renderiza a experiencia. Nao atropele essa separacao.
`;

const PROMPT_IA_REACT = `Crie uma solucao com Sema + React + TypeScript.

Regras principais:
- a Sema deve ser a fonte de verdade semantica do dominio
- React + TypeScript deve ser a camada de interface e experiencia
- nao entregue HTML unico solto
- nao trate a Sema como enfeite

Entregue obrigatoriamente:
1. arquivos \`.sema\` do dominio
2. arquitetura de pastas do frontend
3. componentes React principais
4. contratos e tipos derivados da semantica
5. interface elegante e implementavel

A modelagem Sema deve cobrir, quando fizer sentido:
- \`entity\`
- \`enum\`
- \`state\`
- \`task\`
- \`flow\`
- \`route\`
- \`effects\`
- \`error\`
- \`guarantees\`
- \`tests\`

A interface React deve tornar visiveis:
- estado atual e transicoes relevantes
- fluxo operacional
- erros publicos
- efeitos operacionais importantes
- garantias ou confirmacoes finais

Estruture a entrega assim:
1. visao do produto
2. arquivos \`.sema\`
3. arquitetura React + TypeScript
4. componentes e telas
5. codigo principal
6. explicacao de como a UI deriva da semantica da Sema

Se houver duvida, siga os exemplos oficiais e mantenha a separacao:
- Sema governa o significado
- React governa a apresentacao
`;

const PROMPT_IA_SEMA_PRIMEIRO = `Quero que voce trabalhe no modo "Sema primeiro".

Regra principal:
- modele primeiro o dominio em arquivos \`.sema\`
- so depois proponha ou gere codigo de aplicacao derivado disso

Fluxo obrigatorio:
1. entender o dominio pedido
2. modelar o contrato em Sema
3. validar coerencia entre \`task\`, \`route\`, \`state\`, \`flow\`, \`error\`, \`effects\` e \`guarantees\`
4. so depois gerar TypeScript, Python, React ou outra camada de implementacao

Nao entregue apenas codigo de interface ou codigo imperativo direto sem antes entregar a camada semantica.

A modelagem em Sema deve:
- preservar a intencao do dominio
- explicitar entradas, saidas, erros, efeitos e garantias
- usar apenas blocos e sintaxe oficiais
- incluir testes embutidos quando fizer sentido

Se houver interface grafica:
- entregue a modelagem Sema primeiro
- depois explique como a interface deve refletir a semantica
- se gerar UI, use React + TypeScript em vez de HTML unico solto

Se houver backend:
- entregue a modelagem Sema primeiro
- depois gere a borda publica e a implementacao derivada

Nao pule a etapa semantica. A camada \`.sema\` e a ancora principal da solucao.
`;

const EXEMPLOS_PROMPT_IA = `Exemplos de prompt oficial para trabalhar com Sema

1. Sema primeiro

Crie uma solucao seguindo a estrategia "Sema primeiro".
Entregue primeiro os arquivos \`.sema\` do dominio e so depois a implementacao derivada.
Nao entregue apenas codigo imperativo.
Use Sema como fonte de verdade para contratos, estados, erros, efeitos e garantias.

2. Sema + React + TypeScript

Crie um projeto com Sema + React + TypeScript.
Entregue:
- os arquivos \`.sema\` do dominio
- a arquitetura de pastas do frontend
- componentes React que reflitam \`state\`, \`flow\`, \`error\`, \`effects\` e \`guarantees\`
- uma interface elegante e implementavel
- nao entregue HTML solto em arquivo unico

3. Revisar ou corrigir um modulo Sema

Revise e corrija um modulo \`.sema\`.
Antes de editar:
- leia os exemplos oficiais parecidos
- consulte AST e IR
Depois de editar:
- rode \`sema formatar\`
- rode \`sema validar --json\`
- use \`diagnosticos --json\` se houver falha
- feche com \`sema verificar\`

4. Caso de UI sem perder a semantica

Quero uma interface premium para este dominio, mas a solucao deve continuar ancorada em Sema.
Modele primeiro o dominio em \`.sema\`.
Depois proponha uma interface em React + TypeScript que torne visiveis:
- estado
- fluxo
- erros
- efeitos
- garantias
Nao transforme isso em um \`index.html\` solto.

Comandos uteis da CLI para esse fluxo:
- \`sema starter-ia\`
- \`sema ajuda-ia\`
- \`sema prompt-ia\`
- \`sema prompt-ia-ui\`
- \`sema prompt-ia-react\`
- \`sema prompt-ia-sema-primeiro\`
- \`sema contexto-ia <arquivo.sema>\`
`;

const DIRETORIO_CLI_ATUAL = path.dirname(fileURLToPath(import.meta.url));

function obterArgumentos(): { comando?: Comando; resto: string[] } {
  const [, , comando, ...resto] = process.argv;
  return { comando: comando as Comando | undefined, resto };
}

function ajuda(): string {
  return `Sema CLI

Comandos:
  sema iniciar
  sema validar <arquivo-ou-pasta>
  sema ast <arquivo.sema>
  sema ir <arquivo.sema>
  sema compilar <arquivo-ou-pasta> --alvo <python|typescript|dart> --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]
  sema gerar <python|typescript|dart> <arquivo-ou-pasta> --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]
  sema testar <arquivo.sema> --alvo <python|typescript|dart> --saida <diretorio-temporario> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]
  sema diagnosticos <arquivo.sema> [--json]
  sema verificar <arquivo-ou-pasta> [--saida <diretorio-base>] [--json]
  sema inspecionar [arquivo-ou-pasta] [--json]
  sema drift <arquivo-ou-pasta> [--json]
  sema importar <nestjs|fastapi|typescript|python|dart> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]
  sema formatar <arquivo-ou-pasta> [--check] [--json]
  sema ajuda-ia
  sema starter-ia
  sema prompt-ia
  sema prompt-ia-ui
  sema prompt-ia-react
  sema prompt-ia-sema-primeiro
  sema exemplos-prompt-ia
  sema contexto-ia <arquivo.sema> [--saida <diretorio>] [--json]
`;
}

async function carregarModulos(entrada: string | undefined, cwd = process.cwd()): Promise<ContextoProjetoCarregado["modulosSelecionados"]> {
  return (await carregarProjeto(entrada, cwd)).modulosSelecionados;
}

async function escreverArquivos(base: string, arquivos: Array<{ caminhoRelativo: string; conteudo: string }>): Promise<void> {
  await mkdir(base, { recursive: true });
  for (const arquivo of arquivos) {
    const destino = path.join(base, arquivo.caminhoRelativo);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, arquivo.conteudo, "utf8");
  }
}

function obterOpcao(args: string[], nome: string, padrao?: string): string | undefined {
  const indice = args.findIndex((arg) => arg === nome);
  if (indice === -1) {
    return padrao;
  }
  return args[indice + 1] ?? padrao;
}

function possuiFlag(args: string[], nome: string): boolean {
  return args.includes(nome);
}

function obterPosicionais(args: string[]): string[] {
  const posicionais: string[] = [];
  for (let indice = 0; indice < args.length; indice += 1) {
    const atual = args[indice]!;
    if (atual.startsWith("--")) {
      indice += 1;
      continue;
    }
    posicionais.push(atual);
  }
  return posicionais;
}

function validarCompatibilidadeFramework(alvo: AlvoGeracao, framework: FrameworkGeracao): string | undefined {
  if (framework === "base") {
    return undefined;
  }
  if (framework === "nestjs" && alvo !== "typescript") {
    return `Framework "${framework}" so pode ser usado com o alvo typescript.`;
  }
  if (framework === "fastapi" && alvo !== "python") {
    return `Framework "${framework}" so pode ser usado com o alvo python.`;
  }
  if (alvo === "dart") {
    return `Framework "${framework}" nao e suportado para o alvo dart.`;
  }
  return undefined;
}

function normalizarFonteImportacao(valor: string | undefined): FonteImportacao | undefined {
  if (!valor) {
    return undefined;
  }
  if (valor === "ts") {
    return "typescript";
  }
  if (valor === "py") {
    return "python";
  }
  if (valor === "nest") {
    return "nestjs";
  }
  if (valor === "api") {
    return "fastapi";
  }
  if (valor === "nestjs" || valor === "fastapi" || valor === "typescript" || valor === "python" || valor === "dart") {
    return valor;
  }
  return undefined;
}

function garantirIr(resultado: ReturnType<typeof compilarCodigo>, caminho: string): IrModulo {
  if (!resultado.ir) {
    throw new Error(`Nao foi possivel gerar IR para ${caminho}.\n${formatarDiagnosticos(resultado.diagnosticos)}`);
  }
  return resultado.ir;
}

function gerarArquivosPorAlvo(ir: IrModulo, alvo: AlvoGeracao, framework: FrameworkGeracao) {
  if (alvo === "python") {
    return gerarPython(ir, { framework });
  }
  if (alvo === "dart") {
    return gerarDart(ir);
  }
  return gerarTypeScript(ir, { framework });
}

function aplicarEstruturaSaida(
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
  ir: IrModulo,
  estrutura: EstruturaSaida,
): Array<{ caminhoRelativo: string; conteudo: string }> {
  if (estrutura === "flat" || estrutura === "backend") {
    return arquivos;
  }

  const estruturaModulo = descreverEstruturaModulo(ir.nome);
  const pastaModulo = estruturaModulo.contextoSegmentos.join(path.sep);
  const nomeArquivo = estruturaModulo.nomeArquivo;
  const nomeBaseAntigo = estruturaModulo.nomeBase;

  return arquivos.map((arquivo) => {
    const basename = path.basename(arquivo.caminhoRelativo);
    let novoBasename = basename;
    let conteudo = arquivo.conteudo;

    if (basename === `${nomeBaseAntigo}.ts`) {
      novoBasename = `${nomeArquivo}.ts`;
    } else if (basename === `${nomeBaseAntigo}.test.ts`) {
      novoBasename = `${nomeArquivo}.test.ts`;
      conteudo = conteudo.replace(`./${nomeBaseAntigo}.ts`, `./${nomeArquivo}.ts`);
    } else if (basename === `${nomeBaseAntigo}.py`) {
      novoBasename = `${nomeArquivo}.py`;
    } else if (basename === `test_${nomeBaseAntigo}.py`) {
      novoBasename = `test_${nomeArquivo}.py`;
      conteudo = conteudo.replace(`from ${nomeBaseAntigo} import *`, `from ${nomeArquivo} import *`);
    } else if (basename === `${nomeBaseAntigo}.dart`) {
      novoBasename = `${nomeArquivo}.dart`;
    }

    return {
      caminhoRelativo: pastaModulo ? path.join(pastaModulo, novoBasename) : novoBasename,
      conteudo,
    };
  });
}

function contarCasosDeTesteGerados(alvo: AlvoGeracao, arquivos: Array<{ caminhoRelativo: string; conteudo: string }>): number {
  if (alvo === "dart") {
    return 0;
  }

  if (alvo === "typescript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.ts"));
    if (!arquivoTeste) {
      return 0;
    }
    return (arquivoTeste.conteudo.match(/\btest\(/g) ?? []).length;
  }

  const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_"));
  if (!arquivoTeste) {
    return 0;
  }
  return (arquivoTeste.conteudo.match(/\bdef test_/g) ?? []).length;
}

function executarTestesGerados(
  alvo: AlvoGeracao,
  baseSaida: string,
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
  silencioso = false,
): SaidaTesteCapturada {
  const quantidadeTestes = contarCasosDeTesteGerados(alvo, arquivos);
  if (quantidadeTestes === 0) {
    if (!silencioso) {
      console.log(`Nenhum teste ${alvo === "typescript" ? "TypeScript" : "Python"} foi gerado.`);
    }
    return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
  }

  if (alvo === "typescript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.ts"))?.caminhoRelativo;
    if (!arquivoTeste) {
      if (!silencioso) {
        console.log("Nenhum teste TypeScript foi gerado.");
      }
      return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
    }
    const execucao = spawnSync("node", ["--import", "tsx", path.join(baseSaida, arquivoTeste)], {
      stdio: silencioso ? "pipe" : "inherit",
      encoding: silencioso ? "utf8" : undefined,
    });
    return {
      codigoSaida: execucao.status ?? 1,
      quantidadeTestes,
      saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
      saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : "",
    };
  }

  const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_"))?.caminhoRelativo;
  if (!arquivoTeste) {
    if (!silencioso) {
      console.log("Nenhum teste Python foi gerado.");
    }
    return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
  }
  const execucao = spawnSync("pytest", [arquivoTeste], {
    stdio: silencioso ? "pipe" : "inherit",
    cwd: baseSaida,
    encoding: silencioso ? "utf8" : undefined,
  });
  return {
    codigoSaida: execucao.status ?? 1,
    quantidadeTestes,
    saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
    saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : "",
  };
}

function nomeSubpastaModulo(caminhoArquivo: string): string {
  return path.basename(caminhoArquivo, ".sema");
}

async function caminhoExiste(caminhoAlvo: string): Promise<boolean> {
  try {
    await stat(caminhoAlvo);
    return true;
  } catch {
    return false;
  }
}

async function descobrirDocsIa(): Promise<DescobertaDocsIa> {
  const candidatosBase = [];
  let atual = DIRETORIO_CLI_ATUAL;

  for (let tentativas = 0; tentativas < 8; tentativas += 1) {
    candidatosBase.push(atual);
    const proximo = path.dirname(atual);
    if (proximo === atual) {
      break;
    }
    atual = proximo;
  }

  const nomesDocs = [
    "AGENT_STARTER.md",
    "como-ensinar-a-sema-para-ia.md",
    "prompt-base-ia-sema.md",
    "fluxo-pratico-ia-sema.md",
  ];

  for (const base of candidatosBase) {
    const documentos = [];
    let encontrouTodos = true;

    for (const nome of nomesDocs) {
      const caminhoDoc = path.join(base, "docs", nome);
      if (!(await caminhoExiste(caminhoDoc))) {
        encontrouTodos = false;
        break;
      }
      documentos.push({ nome, caminho: caminhoDoc });
    }

    if (encontrouTodos) {
      return {
        origemInstalacao: DIRETORIO_CLI_ATUAL,
        baseDetectada: base,
        documentos,
      };
    }
  }

  return {
    origemInstalacao: DIRETORIO_CLI_ATUAL,
    baseDetectada: null,
    documentos: [],
  };
}

function renderizarCabecalhoDocsIa(descoberta: DescobertaDocsIa): string {
  const linhas = [
    "Informacoes da instalacao atual",
    `- Origem da instalacao: ${descoberta.origemInstalacao}`,
    `- Base detectada: ${descoberta.baseDetectada ?? "nao encontrada"}`,
  ];

  if (descoberta.documentos.length > 0) {
    linhas.push("- Documentos locais encontrados:");
    for (const documento of descoberta.documentos) {
      linhas.push(`  - ${documento.nome}: ${documento.caminho}`);
    }
  } else {
    linhas.push("- Documentos locais encontrados: nenhum");
    linhas.push("  - Esta instalacao da CLI nao conseguiu localizar a pasta docs ao redor do pacote atual.");
  }

  return linhas.join("\n");
}

function falharContextoIa(mensagem: string): never {
  throw new Error(mensagem);
}

function garantirArquivoSema(caminhoArquivo: string): void {
  if (!caminhoArquivo.toLowerCase().endsWith(".sema")) {
    falharContextoIa("O caminho informado precisa apontar para um arquivo .sema.");
  }
}

function resumirDriftPorModulo(
  modulo: string | null,
  caminho: string,
  resultadoDrift: Awaited<ReturnType<typeof analisarDriftLegado>>,
) {
  const tasks = modulo
    ? resultadoDrift.tasks.filter((task) => task.modulo === modulo)
    : [];
  const implsValidos = modulo
    ? resultadoDrift.impls_validos.filter((impl) => impl.modulo === modulo)
    : [];
  const implsQuebrados = modulo
    ? resultadoDrift.impls_quebrados.filter((impl) => impl.modulo === modulo)
    : [];
  const rotasDivergentes = modulo
    ? resultadoDrift.rotas_divergentes.filter((rota) => rota.modulo === modulo)
    : [];

  return {
    caminho,
    modulo,
    implsValidos: implsValidos.length,
    implsQuebrados: implsQuebrados.length,
    tasksSemImplementacao: tasks.filter((task) => task.semImplementacao).length,
    arquivosRelacionados: [...new Set([
      ...tasks.flatMap((task) => task.arquivosReferenciados),
      ...implsValidos.map((impl) => impl.arquivo).filter((item): item is string => Boolean(item)),
      ...implsQuebrados.flatMap((impl) => impl.candidatos?.map((candidato) => candidato.arquivo) ?? []),
    ])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    tasks,
    rotasDivergentes,
  };
}

async function gerarContextoIa(arquivoEntrada: string, pastaSaidaOpcional?: string): Promise<ContextoIaGerado> {
  const arquivo = path.resolve(arquivoEntrada);
  garantirArquivoSema(arquivo);

  const pastaBase = pastaSaidaOpcional
    ? path.resolve(pastaSaidaOpcional)
    : path.resolve(process.cwd(), ".tmp", "contexto-ia", path.basename(arquivo, ".sema"));

  await mkdir(pastaBase, { recursive: true });

  const contextoProjeto = await carregarProjeto(arquivo, process.cwd());
  const resultadoModulo = contextoProjeto.modulosSelecionados.find((item) => path.resolve(item.caminho) === arquivo)?.resultado;

  if (!resultadoModulo) {
    falharContextoIa(`Nao foi possivel encontrar o modulo correspondente ao arquivo ${arquivo}.`);
  }

  const sucesso = !temErros(resultadoModulo.diagnosticos);
  const modulo = resultadoModulo.modulo?.nome ?? path.basename(arquivo, ".sema");
  const resultadoDrift = await analisarDriftLegado(contextoProjeto);
  const drift = {
    comando: "drift",
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso: resultadoDrift.sucesso,
    resumo: resumirDriftPorModulo(resultadoModulo.modulo?.nome ?? null, arquivo, resultadoDrift),
    drift: resultadoDrift,
  };

  const validar = {
    comando: "validar",
    sucesso,
    resultados: [
      {
        caminho: arquivo,
        modulo: resultadoModulo.modulo?.nome ?? null,
        sucesso,
        diagnosticos: resultadoModulo.diagnosticos,
      },
    ],
  };

  const diagnosticos = {
    comando: "diagnosticos",
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    diagnosticos: resultadoModulo.diagnosticos,
  };

  const ast = {
    comando: "ast",
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso,
    diagnosticos: resultadoModulo.diagnosticos,
    ast: resultadoModulo.modulo ?? null,
  };

  const ir = {
    comando: "ir",
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso,
    diagnosticos: resultadoModulo.diagnosticos,
    ir: resultadoModulo.ir ?? null,
  };

  await writeFile(path.join(pastaBase, "validar.json"), `${JSON.stringify(validar, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "diagnosticos.json"), `${JSON.stringify(diagnosticos, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "ast.json"), `${JSON.stringify(ast, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "ir.json"), `${JSON.stringify(ir, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "drift.json"), `${JSON.stringify(drift, null, 2)}\n`, "utf8");

  const resumo = `# Contexto de IA para ${modulo}

- Arquivo alvo: \`${arquivo}\`
- Modulo: \`${modulo}\`
- Sucesso em validar: \`${sucesso}\`
- Quantidade de diagnosticos: \`${resultadoModulo.diagnosticos.length}\`

## Arquivos gerados neste pacote

- \`validar.json\`
- \`diagnosticos.json\`
- \`ast.json\`
- \`ir.json\`
- \`drift.json\`

## Fluxo recomendado para o agente

1. Ler \`ast.json\` para entender a forma escrita.
2. Ler \`ir.json\` para entender a forma semantica resolvida.
3. Ler \`drift.json\` para ver quais arquivos e simbolos vivos sustentam a implementacao.
4. Ler \`diagnosticos.json\` se houver falha ou aviso relevante.
5. Editar o arquivo \`.sema\`.
6. Rodar \`sema formatar "${arquivo}"\`.
7. Rodar \`sema validar "${arquivo}" --json\`.
8. Fechar com \`sema verificar exemplos --json --saida ./.tmp/verificacao-ia\` ou \`npm run project:check\`.

## Textos base para onboarding do agente

- \`sema starter-ia\`
- \`sema prompt-ia\`
`;

  await writeFile(path.join(pastaBase, "README.md"), resumo, "utf8");

  return {
    sucesso: true,
    arquivo,
    modulo,
    pastaSaida: pastaBase,
    artefatos: ["validar.json", "diagnosticos.json", "ast.json", "ir.json", "drift.json", "README.md"],
  };
}

async function comandoIniciar(cwd: string, template: FrameworkGeracao): Promise<number> {
  const arquivosBase = [
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
  } else {
    arquivos = [
      {
        caminhoRelativo: "sema.config.json",
        conteudo: `{
  "origens": ["./contratos"],
  "saida": "./generated",
  "alvos": ["typescript", "python", "dart"],
  "alvoPadrao": "typescript",
  "estruturaSaida": "modulos",
  "framework": "base",
  "modoEstrito": true,
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/typescript",
    "python": "./generated/python",
    "dart": "./generated/dart"
  },
  "convencoesGeracaoPorProjeto": "base"
}
`,
      },
      ...arquivosBase,
    ];
  }

  await escreverArquivos(cwd, arquivos);
  console.log(`Projeto Sema inicializado com template ${template}.`);
  return 0;
}

async function comandoValidar(entrada?: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  console.log(formatarDiagnosticos(diagnosticos));
  return temErros(diagnosticos) ? 1 : 0;
}

async function comandoValidarJson(entrada?: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const resultados = modulos.map((item) => ({
    caminho: item.caminho,
    modulo: item.resultado.modulo?.nome ?? null,
    sucesso: !temErros(item.resultado.diagnosticos),
    diagnosticos: item.resultado.diagnosticos,
  }));
  console.log(JSON.stringify({
    comando: "validar",
    sucesso: resultados.every((resultado) => resultado.sucesso),
    resultados,
  }, null, 2));
  return resultados.every((resultado) => resultado.sucesso) ? 0 : 1;
}

async function comandoInspecionar(entrada: string | undefined, emJson: boolean, cwd = process.cwd()): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const resultadoDrift = await analisarDriftLegado(contextoProjeto);
  const framework = resolverFrameworkPadrao(undefined, contextoProjeto.configCarregada);
  const estruturaSaida = resolverEstruturaSaidaPadrao(undefined, framework, contextoProjeto.configCarregada);
  const alvos = resolverAlvosVerificacao(contextoProjeto.configCarregada);
  const saidas = Object.fromEntries(alvos.map((alvo) => [alvo, resolverSaidaPadrao(undefined, alvo, contextoProjeto.configCarregada)]));
  const payload = {
    comando: "inspecionar",
    entrada: contextoProjeto.entradaResolvida,
    configuracao: {
      caminho: contextoProjeto.configCarregada?.caminho ?? null,
      framework,
      estruturaSaida,
      alvos,
      saidas,
      origens: contextoProjeto.origensProjeto,
      diretoriosCodigo: contextoProjeto.diretoriosCodigo,
      fontesLegado: contextoProjeto.fontesLegado,
      modoAdocao: contextoProjeto.modoAdocao,
    },
    projeto: {
      arquivos: contextoProjeto.arquivosProjeto,
      modulos: contextoProjeto.modulosSelecionados.map((item) => ({
        caminho: item.caminho,
        modulo: item.resultado.modulo?.nome ?? null,
        sucesso: !temErros(item.resultado.diagnosticos),
        diagnosticos: item.resultado.diagnosticos.length,
        implementacao: resumirDriftPorModulo(item.resultado.modulo?.nome ?? null, item.caminho, resultadoDrift),
      })),
    },
  };

  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  console.log("Inspecao de projeto Sema");
  console.log(`- Entrada: ${payload.entrada}`);
  console.log(`- Configuracao: ${payload.configuracao.caminho ?? "nenhuma"}`);
  console.log(`- Framework: ${payload.configuracao.framework}`);
  console.log(`- Estrutura de saida: ${payload.configuracao.estruturaSaida}`);
  console.log(`- Alvos: ${payload.configuracao.alvos.join(", ")}`);
  console.log(`- Modo de adocao: ${payload.configuracao.modoAdocao}`);
  console.log("- Saidas por alvo:");
  for (const [alvo, saida] of Object.entries(payload.configuracao.saidas)) {
    console.log(`  - ${alvo}: ${saida}`);
  }
  console.log("- Origens do projeto:");
  for (const origem of payload.configuracao.origens) {
    console.log(`  - ${origem}`);
  }
  console.log("- Diretorios de codigo:");
  for (const diretorio of payload.configuracao.diretoriosCodigo) {
    console.log(`  - ${diretorio}`);
  }
  console.log(`- Fontes de legado detectadas: ${payload.configuracao.fontesLegado.join(", ") || "nenhuma"}`);
  console.log("- Modulos selecionados:");
  for (const modulo of payload.projeto.modulos) {
    console.log(`  - ${modulo.modulo ?? "(sem modulo)"} :: ${modulo.caminho} :: diagnosticos=${modulo.diagnosticos}`);
    console.log(`    impls validos=${modulo.implementacao.implsValidos} quebrados=${modulo.implementacao.implsQuebrados} sem_impl=${modulo.implementacao.tasksSemImplementacao}`);
    for (const arquivoRelacionado of modulo.implementacao.arquivosRelacionados.slice(0, 5)) {
      console.log(`    arquivo relacionado: ${arquivoRelacionado}`);
    }
  }
  return 0;
}

async function comandoDrift(entrada: string | undefined, emJson: boolean, cwd = process.cwd()): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const resultado = await analisarDriftLegado(contextoProjeto);

  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
    return resultado.sucesso ? 0 : 1;
  }

  console.log("Drift entre Sema e codigo legado");
  console.log(`- Modulos analisados: ${resultado.modulos.length}`);
  console.log(`- Tasks analisadas: ${resultado.tasks.length}`);
  console.log(`- Impl validos: ${resultado.impls_validos.length}`);
  console.log(`- Impl quebrados: ${resultado.impls_quebrados.length}`);
  console.log(`- Rotas divergentes: ${resultado.rotas_divergentes.length}`);

  if (resultado.impls_quebrados.length > 0) {
    console.log("- Impl quebrados:");
    for (const impl of resultado.impls_quebrados) {
      console.log(`  - ${impl.modulo}.${impl.task} :: ${impl.origem}:${impl.caminho}`);
      if (impl.candidatos && impl.candidatos.length > 0) {
        console.log("    candidatos provaveis:");
        for (const candidato of impl.candidatos) {
          console.log(`      - [${candidato.confianca}] ${candidato.caminho} :: ${candidato.arquivo} :: ${candidato.simbolo}`);
        }
      }
    }
  }

  if (resultado.rotas_divergentes.length > 0) {
    console.log("- Rotas divergentes:");
    for (const rota of resultado.rotas_divergentes) {
      console.log(`  - ${rota.modulo}.${rota.route} :: ${rota.metodo ?? "?"} ${rota.caminho ?? "?"}`);
    }
  }

  const semImpl = resultado.tasks.filter((task) => task.semImplementacao);
  if (semImpl.length > 0) {
    console.log("- Tasks sem implementacao vinculada:");
    for (const task of semImpl) {
      console.log(`  - ${task.modulo}.${task.task}`);
      if (task.candidatosImpl.length > 0) {
        console.log("    candidatos provaveis:");
        for (const candidato of task.candidatosImpl) {
          console.log(`      - [${candidato.confianca}] ${candidato.caminho} :: ${candidato.arquivo} :: ${candidato.simbolo}`);
        }
      }
    }
  }

  if (resultado.diagnosticos.length === 0) {
    console.log("Nenhum drift relevante encontrado.");
  }

  return resultado.sucesso ? 0 : 1;
}

async function comandoImportar(
  fonte: FonteImportacao,
  diretorio: string,
  saida: string,
  namespaceBase: string | undefined,
  emJson: boolean,
): Promise<number> {
  const resultado = await importarProjetoLegado(fonte, diretorio, namespaceBase);
  const resumo = resumoImportacao(resultado);

  if (!resumo.sucesso) {
    const payloadErro = {
      comando: "importar",
      fonte,
      diretorio: path.resolve(diretorio),
      namespaceBase: resultado.namespaceBase,
      resumo,
      arquivos: resultado.arquivos.map((arquivo) => ({
        caminho: path.join(path.resolve(saida), arquivo.caminhoRelativo),
        modulo: arquivo.modulo,
        tarefas: arquivo.tarefas,
        rotas: arquivo.rotas,
        entidades: arquivo.entidades,
        enums: arquivo.enums,
      })),
      diagnosticos: resultado.diagnosticos,
    };

    if (emJson) {
      console.log(JSON.stringify(payloadErro, null, 2));
    } else {
      console.error("Falha na importacao assistida. O rascunho gerado ainda nao ficou semanticamente valido.");
      console.error(formatarDiagnosticos(resultado.diagnosticos));
    }
    return 1;
  }

  await escreverArquivos(saida, resultado.arquivos.map((arquivo) => ({
    caminhoRelativo: arquivo.caminhoRelativo,
    conteudo: arquivo.conteudo,
  })));

  const payload = {
    comando: "importar",
    fonte,
    diretorio: path.resolve(diretorio),
    saida: path.resolve(saida),
    namespaceBase: resultado.namespaceBase,
    resumo,
    arquivos: resultado.arquivos.map((arquivo) => ({
      caminho: path.join(path.resolve(saida), arquivo.caminhoRelativo),
      modulo: arquivo.modulo,
      tarefas: arquivo.tarefas,
      rotas: arquivo.rotas,
      entidades: arquivo.entidades,
      enums: arquivo.enums,
    })),
  };

  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  console.log("Importacao assistida para Sema concluida.");
  console.log(`- Fonte: ${fonte}`);
  console.log(`- Diretorio analisado: ${payload.diretorio}`);
  console.log(`- Namespace base: ${payload.namespaceBase}`);
  console.log(`- Saida: ${payload.saida}`);
  console.log(`- Modulos: ${resumo.modulos}`);
  console.log(`- Tarefas: ${resumo.tarefas}`);
  console.log(`- Rotas: ${resumo.rotas}`);
  console.log(`- Entidades: ${resumo.entidades}`);
  console.log(`- Enums: ${resumo.enums}`);
  console.log("- Arquivos gerados:");
  for (const arquivo of payload.arquivos) {
    console.log(`  - ${arquivo.caminho} :: modulo=${arquivo.modulo} tarefas=${arquivo.tarefas} rotas=${arquivo.rotas}`);
  }
  console.log("Ajuste os rascunhos .sema, rode `sema formatar`, `sema validar --json` e depois `sema compilar`.");
  return 0;
}

async function comandoAst(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify(resultado.modulo ?? null, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoAstJson(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify({
    comando: "ast",
    caminho: path.resolve(arquivo),
    modulo: resultado.modulo?.nome ?? null,
    sucesso: !temErros(resultado.diagnosticos),
    diagnosticos: resultado.diagnosticos,
    ast: resultado.modulo ?? null,
  }, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoIr(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify(resultado.ir ?? null, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoIrJson(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify({
    comando: "ir",
    caminho: path.resolve(arquivo),
    modulo: resultado.modulo?.nome ?? null,
    sucesso: !temErros(resultado.diagnosticos),
    diagnosticos: resultado.diagnosticos,
    ir: resultado.ir ?? null,
  }, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoCompilar(
  entrada: string | undefined,
  alvo: AlvoGeracao,
  saida: string,
  estrutura: EstruturaSaida,
  framework: FrameworkGeracao,
  cwd = process.cwd(),
): Promise<number> {
  const incompatibilidade = validarCompatibilidadeFramework(alvo, framework);
  if (incompatibilidade) {
    console.error(incompatibilidade);
    return 1;
  }

  const modulos = await carregarModulos(entrada, cwd);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.error(formatarDiagnosticos(diagnosticos));
    return 1;
  }

  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    const arquivos = aplicarEstruturaSaida(gerarArquivosPorAlvo(ir, alvo, framework), ir, estrutura);
    await escreverArquivos(saida, arquivos);
  }
  console.log(`Compilacao concluida para o alvo ${alvo} com estrutura ${estrutura} e framework ${framework}.`);
  return 0;
}

async function comandoDiagnosticos(arquivo: string, emJson: boolean): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  if (emJson) {
    console.log(JSON.stringify(resultado.diagnosticos, null, 2));
  } else {
    console.log(formatarDiagnosticos(resultado.diagnosticos));
  }
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoFormatar(entrada: string | undefined, verificarApenas: boolean, emJson: boolean): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, process.cwd());
  const entradaResolvida = contextoProjeto.entradaResolvida;
  const estatisticas = await stat(entradaResolvida);
  const arquivos = estatisticas.isFile()
    ? [entradaResolvida]
    : contextoProjeto.arquivosProjeto.filter((arquivo) => arquivo.startsWith(path.resolve(entradaResolvida)));
  const resultados: ResultadoFormatacaoArquivo[] = [];

  for (const arquivo of arquivos) {
    const codigo = await lerArquivoTexto(arquivo);
    const resultado = formatarCodigo(codigo, arquivo);
    const sucesso = !temErros(resultado.diagnosticos) && Boolean(resultado.codigoFormatado);
    resultados.push({
      caminho: arquivo,
      alterado: resultado.alterado,
      sucesso,
      diagnosticos: resultado.diagnosticos,
    });

    if (sucesso && !verificarApenas && resultado.alterado && resultado.codigoFormatado) {
      await writeFile(arquivo, resultado.codigoFormatado, "utf8");
    }
  }

  const possuiErros = resultados.some((resultado) => !resultado.sucesso);
  const possuiDiferencas = resultados.some((resultado) => resultado.alterado);
  const codigoSaida = possuiErros ? 1 : verificarApenas && possuiDiferencas ? 1 : 0;

  if (emJson) {
    console.log(JSON.stringify({
      comando: "formatar",
      sucesso: codigoSaida === 0,
      modo: verificarApenas ? "check" : "write",
      arquivos: resultados,
      totais: {
        arquivos: resultados.length,
        alterados: resultados.filter((resultado) => resultado.alterado).length,
        erros: resultados.filter((resultado) => !resultado.sucesso).length,
      },
    }, null, 2));
    return codigoSaida;
  }

  if (possuiErros) {
    console.error(formatarDiagnosticos(resultados.flatMap((resultado) => resultado.diagnosticos)));
    return 1;
  }

  if (verificarApenas) {
    if (possuiDiferencas) {
      console.error("Arquivos fora do formato canonico:");
      for (const resultado of resultados.filter((item) => item.alterado)) {
        console.error(`- ${resultado.caminho}`);
      }
      return 1;
    }
    console.log("Todos os arquivos ja estao no formato canonico.");
    return 0;
  }

  console.log(`Formatacao concluida. Arquivos verificados=${resultados.length} alterados=${resultados.filter((resultado) => resultado.alterado).length}`);
  return 0;
}

async function comandoStarterIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Starter de IA da Sema");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(STARTER_IA);
  return 0;
}

async function comandoAjudaIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Ajuda de IA da Sema");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log("Fluxo recomendado");
  console.log("- Use `sema starter-ia` para um texto curto de onboarding.");
  console.log("- Use `sema prompt-ia` para o prompt-base geral.");
  console.log("- Use `sema prompt-ia-ui` para tarefas visuais com Sema + UI.");
  console.log("- Use `sema prompt-ia-react` para projeto com Sema + React + TypeScript.");
  console.log("- Use `sema prompt-ia-sema-primeiro` para forcar modelagem semantica antes da implementacao.");
  console.log("- Use `sema exemplos-prompt-ia` para pegar modelos prontos de prompt.");
  console.log("- Use `sema contexto-ia <arquivo.sema>` para gerar AST, IR e diagnosticos do modulo alvo.");
  console.log("- Use `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart> --saida <diretorio>` quando a tarefa pedir codigo derivado.");
  console.log("");
  console.log("Regra pratica");
  console.log("- Se voce quer testar a Sema de verdade, nao peca so HTML solto.");
  console.log("- Peca `.sema` + arquitetura + React + TypeScript, ou use o modo `Sema primeiro`.");
  return 0;
}

async function comandoPromptIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt-base de IA da Sema");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_BASE_IA);
  return 0;
}

async function comandoPromptIaUi(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt de IA da Sema para UI");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_IA_UI);
  return 0;
}

async function comandoPromptIaReact(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt de IA da Sema para React");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_IA_REACT);
  return 0;
}

async function comandoPromptIaSemaPrimeiro(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Prompt de IA da Sema no modo Sema primeiro");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(PROMPT_IA_SEMA_PRIMEIRO);
  return 0;
}

async function comandoExemplosPromptIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Exemplos de prompt de IA da Sema");
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(EXEMPLOS_PROMPT_IA);
  return 0;
}

async function comandoContextoIa(arquivo: string, pastaSaida: string | undefined, emJson: boolean): Promise<number> {
  const resultado = await gerarContextoIa(arquivo, pastaSaida);

  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
    return 0;
  }

  const resumoGerado = await readFile(path.join(resultado.pastaSaida, "README.md"), "utf8");
  console.log(`Pacote de contexto gerado em ${resultado.pastaSaida}`);
  console.log("");
  console.log(resumoGerado);
  return 0;
}

async function comandoTestar(
  arquivo: string,
  alvo: AlvoGeracao,
  saida: string,
  estrutura: EstruturaSaida,
  framework: FrameworkGeracao,
): Promise<number> {
  const incompatibilidade = validarCompatibilidadeFramework(alvo, framework);
  if (incompatibilidade) {
    console.error(incompatibilidade);
    return 1;
  }
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  if (temErros(resultado.diagnosticos)) {
    console.error(formatarDiagnosticos(resultado.diagnosticos));
    return 1;
  }
  const ir = garantirIr(resultado, arquivo);
  const arquivos = aplicarEstruturaSaida(gerarArquivosPorAlvo(ir, alvo, framework), ir, estrutura);
  await escreverArquivos(saida, arquivos);
  if (framework !== "base") {
    console.log(`Scaffold ${framework} gerado em ${saida}. A execucao automatica de testes continua focada no framework base da Sema.`);
    return 0;
  }
  return executarTestesGerados(alvo, saida, arquivos).codigoSaida;
}

function imprimirResumoVerificacao(resumos: ResumoModuloVerificacao[]): void {
  console.log("\nResumo da verificacao:");
  let totalArquivos = 0;
  let totalTestes = 0;
  let totalAlvos = 0;

  for (const resumo of resumos) {
    console.log(`- Modulo ${resumo.modulo} (${resumo.arquivoFonte})`);
    for (const alvo of resumo.alvos) {
      totalArquivos += alvo.arquivosGerados;
      totalTestes += alvo.quantidadeTestes;
      totalAlvos += 1;
      console.log(
        `  alvo=${alvo.alvo} status=${alvo.sucesso ? "ok" : "falhou"} arquivos=${alvo.arquivosGerados} testes=${alvo.quantidadeTestes} saida=${alvo.pastaSaida}`,
      );
    }
  }

  console.log(`Totais: modulos=${resumos.length} alvos=${totalAlvos} arquivos=${totalArquivos} testes=${totalTestes}`);
}

async function comandoVerificar(
  entrada: string | undefined,
  baseSaida: string,
  cwd = process.cwd(),
): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const modulos = contextoProjeto.modulosSelecionados;
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.error(formatarDiagnosticos(diagnosticos));
    return 1;
  }

  const alvos = resolverAlvosVerificacao(contextoProjeto.configCarregada);
  const resumos: ResumoModuloVerificacao[] = [];
  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    console.log(`Verificando modulo ${modulo.caminho}`);
    const resumoModulo: ResumoModuloVerificacao = {
      modulo: ir.nome,
      arquivoFonte: modulo.caminho,
      alvos: [],
    };
    for (const alvo of alvos) {
      const pastaAlvo = path.join(baseSaida, alvo, nomeSubpastaModulo(modulo.caminho));
      const framework = alvo === "typescript" ? "base" : alvo === "python" ? "base" : "base";
      const arquivos = gerarArquivosPorAlvo(ir, alvo, framework);
      await escreverArquivos(pastaAlvo, arquivos);
      const execucao = executarTestesGerados(alvo, pastaAlvo, arquivos);
      resumoModulo.alvos.push({
        alvo,
        arquivosGerados: arquivos.length,
        quantidadeTestes: execucao.quantidadeTestes,
        pastaSaida: pastaAlvo,
        sucesso: execucao.codigoSaida === 0,
      });
      if (execucao.codigoSaida !== 0) {
        imprimirResumoVerificacao([...resumos, resumoModulo]);
        console.error(`Falha na verificacao do modulo ${modulo.caminho} para o alvo ${alvo}.`);
        return execucao.codigoSaida;
      }
    }
    resumos.push(resumoModulo);
  }

  imprimirResumoVerificacao(resumos);
  console.log("Verificacao completa concluida com sucesso.");
  return 0;
}

async function comandoVerificarJson(
  entrada: string | undefined,
  baseSaida: string,
  cwd = process.cwd(),
): Promise<number> {
  const contextoProjeto = await carregarProjeto(entrada, cwd);
  const modulos = contextoProjeto.modulosSelecionados;
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.log(JSON.stringify({
      comando: "verificar",
      sucesso: false,
      diagnosticos,
      modulos: [],
      totais: { modulos: 0, alvos: 0, arquivos: 0, testes: 0 },
    }, null, 2));
    return 1;
  }

  const alvos = resolverAlvosVerificacao(contextoProjeto.configCarregada);
  const resumos: Array<ResumoModuloVerificacao & { saidaTestes?: Array<{ alvo: string; stdout: string; stderr: string }> }> = [];
  let codigoSaida = 0;

  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    const resumoModulo: ResumoModuloVerificacao & { saidaTestes: Array<{ alvo: string; stdout: string; stderr: string }> } = {
      modulo: ir.nome,
      arquivoFonte: modulo.caminho,
      alvos: [],
      saidaTestes: [],
    };

    for (const alvo of alvos) {
      const pastaAlvo = path.join(baseSaida, alvo, nomeSubpastaModulo(modulo.caminho));
      const arquivos = gerarArquivosPorAlvo(ir, alvo, "base");
      await escreverArquivos(pastaAlvo, arquivos);
      const execucao = executarTestesGerados(alvo, pastaAlvo, arquivos, true);
      resumoModulo.alvos.push({
        alvo,
        arquivosGerados: arquivos.length,
        quantidadeTestes: execucao.quantidadeTestes,
        pastaSaida: pastaAlvo,
        sucesso: execucao.codigoSaida === 0,
      });
      resumoModulo.saidaTestes.push({ alvo, stdout: execucao.saidaPadrao, stderr: execucao.saidaErro });
      if (execucao.codigoSaida !== 0) {
        codigoSaida = execucao.codigoSaida;
      }
    }

    resumos.push(resumoModulo);
  }

  const totais = {
    modulos: resumos.length,
    alvos: resumos.reduce((total, resumo) => total + resumo.alvos.length, 0),
    arquivos: resumos.reduce((total, resumo) => total + resumo.alvos.reduce((subTotal, alvo) => subTotal + alvo.arquivosGerados, 0), 0),
    testes: resumos.reduce((total, resumo) => total + resumo.alvos.reduce((subTotal, alvo) => subTotal + alvo.quantidadeTestes, 0), 0),
  };

  console.log(JSON.stringify({
    comando: "verificar",
    sucesso: codigoSaida === 0,
    modulos: resumos,
    totais,
  }, null, 2));

  return codigoSaida;
}

async function principal(): Promise<void> {
  const { comando, resto } = obterArgumentos();
  if (!comando) {
    console.log(ajuda());
    process.exit(0);
  }

  const cwd = process.cwd();
  const posicionais = obterPosicionais(resto);
  let codigoSaida = 0;
  switch (comando) {
    case "iniciar":
      codigoSaida = await comandoIniciar(cwd, resolverFrameworkPadrao(obterOpcao(resto, "--template"), undefined));
      break;
    case "validar":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoValidarJson(posicionais[0])
        : await comandoValidar(posicionais[0]);
      break;
    case "ast":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoAstJson(resto[0] ?? "")
        : await comandoAst(resto[0] ?? "");
      break;
    case "ir":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoIrJson(resto[0] ?? "")
        : await comandoIr(resto[0] ?? "");
      break;
    case "compilar":
      {
        const config = await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd);
        const alvo = resolverAlvoPadrao(obterOpcao(resto, "--alvo"), config);
        const framework = resolverFrameworkPadrao(obterOpcao(resto, "--framework"), config);
        const estrutura = resolverEstruturaSaidaPadrao(obterOpcao(resto, "--estrutura"), framework, config);
        const saida = resolverSaidaPadrao(obterOpcao(resto, "--saida"), alvo, config);
        codigoSaida = await comandoCompilar(posicionais[0], alvo, saida, estrutura, framework, cwd);
      }
      break;
    case "gerar":
      {
        const config = await carregarConfiguracaoProjeto(posicionais[1] ? path.resolve(cwd, posicionais[1]) : cwd);
        const alvo = resolverAlvoPadrao(posicionais[0] ?? obterOpcao(resto, "--alvo"), config);
        const framework = resolverFrameworkPadrao(obterOpcao(resto, "--framework"), config);
        const estrutura = resolverEstruturaSaidaPadrao(obterOpcao(resto, "--estrutura"), framework, config);
        const saida = resolverSaidaPadrao(obterOpcao(resto, "--saida"), alvo, config);
        codigoSaida = await comandoCompilar(posicionais[1], alvo, saida, estrutura, framework, cwd);
      }
      break;
    case "diagnosticos":
      codigoSaida = await comandoDiagnosticos(posicionais[0] ?? "", resto.includes("--json"));
      break;
    case "testar":
      {
        const config = await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd);
        const alvo = resolverAlvoPadrao(obterOpcao(resto, "--alvo"), config);
        const framework = resolverFrameworkPadrao(obterOpcao(resto, "--framework"), config);
        const estrutura = resolverEstruturaSaidaPadrao(obterOpcao(resto, "--estrutura"), framework, config);
        const saida = resolverSaidaPadrao(obterOpcao(resto, "--saida", "./.tmp/sema-testes"), alvo, config);
        codigoSaida = await comandoTestar(
          path.resolve(cwd, posicionais[0] ?? ""),
          alvo,
          saida,
          estrutura,
          framework,
        );
      }
      break;
    case "verificar":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoVerificarJson(
          posicionais[0],
          resolverSaidaPadrao(obterOpcao(resto, "--saida", "./.tmp/sema-verificar"), "typescript", await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd)),
          cwd,
        )
        : await comandoVerificar(
          posicionais[0],
          resolverSaidaPadrao(obterOpcao(resto, "--saida", "./.tmp/sema-verificar"), "typescript", await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd)),
          cwd,
        );
      break;
    case "inspecionar":
      codigoSaida = await comandoInspecionar(posicionais[0], possuiFlag(resto, "--json"), cwd);
      break;
    case "drift":
      codigoSaida = await comandoDrift(posicionais[0], possuiFlag(resto, "--json"), cwd);
      break;
    case "importar":
      {
        const fonte = normalizarFonteImportacao(posicionais[0]);
        if (!fonte || !posicionais[1]) {
          console.error("Uso: sema importar <nestjs|fastapi|typescript|python|dart> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]");
          codigoSaida = 1;
          break;
        }
        codigoSaida = await comandoImportar(
          fonte,
          path.resolve(cwd, posicionais[1]),
          path.resolve(cwd, obterOpcao(resto, "--saida", "./sema/importado")!),
          obterOpcao(resto, "--namespace"),
          possuiFlag(resto, "--json"),
        );
      }
      break;
    case "formatar":
      codigoSaida = await comandoFormatar(
        posicionais[0],
        possuiFlag(resto, "--check"),
        possuiFlag(resto, "--json"),
      );
      break;
    case "ajuda-ia":
      codigoSaida = await comandoAjudaIa();
      break;
    case "starter-ia":
      codigoSaida = await comandoStarterIa();
      break;
    case "prompt-ia":
      codigoSaida = await comandoPromptIa();
      break;
    case "prompt-ia-ui":
      codigoSaida = await comandoPromptIaUi();
      break;
    case "prompt-ia-react":
      codigoSaida = await comandoPromptIaReact();
      break;
    case "prompt-ia-sema-primeiro":
      codigoSaida = await comandoPromptIaSemaPrimeiro();
      break;
    case "exemplos-prompt-ia":
      codigoSaida = await comandoExemplosPromptIa();
      break;
    case "contexto-ia":
      codigoSaida = await comandoContextoIa(
        posicionais[0] ?? "",
        obterOpcao(resto, "--saida"),
        possuiFlag(resto, "--json"),
      );
      break;
    default:
      console.log(ajuda());
      codigoSaida = 1;
      break;
  }

  process.exit(codigoSaida);
}

principal().catch((erro) => {
  console.error("Falha ao executar a CLI da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
