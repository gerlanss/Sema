#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pacoteCli from "../package.json" with { type: "json" };
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
import { gerarLua } from "@sema/gerador-lua";
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
  | "doctor"
  | "formatar"
  | "ajuda-ia"
  | "starter-ia"
  | "sync-ai-entrypoints"
  | "resumo"
  | "prompt-curto"
  | "prompt-ia"
  | "prompt-ia-ui"
  | "prompt-ia-react"
  | "prompt-ia-sema-primeiro"
  | "exemplos-prompt-ia"
  | "contexto-ia";

type TemplateIniciar =
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
  artefatosCompactos: string[];
  geradoEm: string;
  guiaPorCapacidade: Record<CapacidadeIa, GuiaCapacidadeIa>;
}

interface DescobertaDocsIa {
  origemInstalacao: string;
  baseDetectada: string | null;
  documentos: Array<{ nome: string; caminho: string }>;
}

type TamanhoResumoIa = "micro" | "curto" | "medio";
type ModoResumoIa = "resumo" | "onboarding" | "review" | "mudanca" | "bug" | "arquitetura";
type CapacidadeIa = "pequena" | "media" | "grande";
type ResultadoDriftIa = Awaited<ReturnType<typeof analisarDriftLegado>>;
type ResumoModuloDrift = ReturnType<typeof resumirDriftPorModulo>;

interface GuiaCapacidadeIa {
  descricao: string;
  artefatos: string[];
  ordemLeitura: string[];
  evitar: string[];
}

interface PacoteContextoModuloIa {
  arquivo: string;
  modulo: string;
  sucesso: boolean;
  geradoEm: string;
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
  ir: IrModulo | null;
  validar: {
    comando: "validar";
    sucesso: boolean;
    resultados: Array<{
      caminho: string;
      modulo: string | null;
      sucesso: boolean;
      diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
    }>;
  };
  diagnosticosJson: {
    comando: "diagnosticos";
    caminho: string;
    modulo: string | null;
    diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
  };
  ast: {
    comando: "ast";
    caminho: string;
    modulo: string | null;
    sucesso: boolean;
    diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
    ast: unknown;
  };
  irJson: {
    comando: "ir";
    caminho: string;
    modulo: string | null;
    sucesso: boolean;
    diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
    ir: IrModulo | null;
  };
  drift: {
    comando: "drift";
    caminho: string;
    modulo: string | null;
    sucesso: boolean;
    resumo: ResumoModuloDrift;
    drift: ResultadoDriftIa;
  };
  briefing: ReturnType<typeof criarBriefingAgente>;
}

interface ResumoSemanticoModuloIa {
  geradoEm: string;
  arquivo: string;
  modulo: string;
  perfilCompatibilidade: string;
  scoreSemantico: number;
  confiancaGeral: string;
  riscoOperacional: string;
  faz: string;
  tarefasPrincipais: string[];
  entradasChave: string[];
  saidasChave: string[];
  superficiesPublicas: string[];
  regrasCriticas: string[];
  efeitos: string[];
  erros: string[];
  entidadesAfetadas: string[];
  arquivosProvaveis: string[];
  simbolosRelacionados: string[];
  riscosPrincipais: string[];
  lacunas: string[];
  inferido: string[];
  checksSugeridos: string[];
  testesMinimos: string[];
  consumerFramework: string | null;
  appRoutes: string[];
  consumerSurfaces: string[];
  consumerBridges: string[];
  arquivosProvaveisEditar: string[];
}

const STARTER_IA = `Voce esta trabalhando com Sema, um Protocolo de Governanca de Intencao para IA sobre software vivo em backend e front consumer.

Importante:
- a Sema se apresenta publicamente como protocolo e funciona tecnicamente como linguagem de intencao
- a Sema e protocolo de governanca semantica desenhado para IA, nao para ergonomia humana
- leitura humana e bonus toleravel, nao objetivo de produto
- a Sema nao e gerador magico que deveria fazer tudo
- a Sema modela contratos, estados, fluxos, erros, efeitos, garantias, vinculos e execucao
- a Sema gera codigo e scaffolding real para TypeScript, Python, Dart e Lua
- a Sema usa \`importar\` para bootstrap revisavel, nao para contrato final automatico
- a Sema usa \`impl\` para ligar task a simbolo real do runtime
- a Sema usa \`vinculos\` para ligar contrato a arquivo, simbolo, recurso e superficie real
- a Sema usa \`execucao\` para explicitar timeout, retry, compensacao e criticidade
- a Sema usa \`drift\` para medir diferenca entre contrato e codigo vivo com score, confianca e lacunas
- a Sema usa \`resumo\` e \`prompt-curto\` para IA pequena ou gratuita
- a Sema usa \`contexto-ia\` para gerar \`ast.json\`, \`ir.json\`, \`drift.json\`, \`briefing.json\` e artefatos compactos antes da edicao
- a Sema pode servir de base para interfaces graficas elegantes e coerentes
- a Sema nao gera uma interface completa sozinha no estado atual
- trate a Sema como cerebro semantico da aplicacao, nao como gerador magico de front-end pronto
- se a tarefa envolver UI, prefira pedir Sema + React + TypeScript ou Sema + arquitetura de front-end
- evite pedir HTML unico solto quando a intencao for testar a Sema de verdade

Regras:
- nao invente sintaxe fora da gramatica e dos exemplos oficiais
- se a IA for pequena, nao tente abrir tudo de uma vez
- use \`sema resumo\` e \`briefing.min.json\` antes de subir para o pacote completo
- trate \`ir --json\` como fonte de verdade semantica
- trate \`briefing.json\` como plano de intervencao antes de editar projeto vivo
- trate \`diagnosticos --json\` como fonte de correcao
- use \`sema formatar\` como fonte unica de estilo
- preserve a intencao do contrato
- nao cobre da Sema adivinhacao de negocio que nao esta no contrato nem no codigo

Comandos essenciais:
- resumo compacto por capacidade: \`sema resumo <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>]\`
- prompt curto para IA pequena: \`sema prompt-curto <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>]\`
- descoberta do projeto: \`sema inspecionar [arquivo-ou-pasta] --json\`
- auditoria do contrato vivo: \`sema drift <arquivo-ou-pasta> [--json]\`
- contexto completo do modulo: \`sema contexto-ia <arquivo.sema>\`
- estrutura sintatica: \`sema ast <arquivo.sema> --json\`
- estrutura semantica: \`sema ir <arquivo.sema> --json\`
- validacao: \`sema validar <arquivo.sema> --json\`
- diagnosticos: \`sema diagnosticos <arquivo.sema> --json\`
- formatacao: \`sema formatar <arquivo.sema>\`
- importacao assistida de legado: \`sema importar <nestjs|fastapi|flask|nextjs|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|firebase|dotnet|java|go|rust|cpp|typescript|python|dart|lua> <diretorio> --saida <diretorio>\`
- geracao de codigo: \`sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua> --saida <diretorio>\`
- verificacao final: \`sema verificar <arquivo-ou-pasta> [--json]\`

Antes de editar:
1. leia README, docs de IA e um exemplo oficial parecido
2. se a IA for pequena, rode \`sema resumo <arquivo> --micro\` e leia \`briefing.min.json\`
3. se a IA aguentar mais, rode \`sema drift\` para medir impls, vinculos, rotas, score e lacunas
4. se a tarefa for pesada, rode \`sema contexto-ia\` e leia \`briefing.json\`
5. consulte AST e IR do modulo alvo so quando a capacidade realmente aguentar

Depois de editar:
1. rode \`sema formatar\`
2. rode \`sema validar --json\`
3. se houver falha, use \`diagnosticos --json\`
4. rode \`sema drift\` de novo quando mexer em codigo vivo
5. se a tarefa pedir codigo derivado, rode \`sema compilar\`
6. feche com \`sema verificar <arquivo-ou-pasta> --json\`

Priorize sempre:
- exemplos oficiais
- JSON da CLI
- o menor artefato que resolva a tarefa da IA atual
- score, confianca e lacunas do \`drift\`
- \`briefing.json\` como guia de mudanca
- consistencia semantica

Superficies que a IA deve enxergar como first-class:
- \`route\`
- \`worker\`
- \`evento\`
- \`fila\`
- \`cron\`
- \`webhook\`
- \`cache\`
- \`storage\`
- \`policy\`

Nao improvise quando faltar contexto.
`;

const PROMPT_BASE_IA = `Voce esta trabalhando com Sema, um Protocolo de Governanca de Intencao orientado a contrato, desenhado para operacao por IA.

Trate a Sema como camada semantica e linguagem de especificacao executavel feita para IA, nao para leitura humana confortavel. Nao invente sintaxe, palavras-chave ou blocos fora da gramatica e dos exemplos oficiais.

Fontes de verdade, em ordem:
1. README do projeto
2. gramatica e documentacao de sintaxe da Sema
3. especificacao semantica da linguagem
4. exemplos oficiais, com prioridade para o vertical de pagamento
5. \`sema resumo\` e \`briefing.min.json\` quando a IA for pequena
6. AST, IR e diagnosticos exportados pela CLI em JSON quando a capacidade aguentar

Regras de operacao:
- preserve o significado semantico
- use o formatador oficial da Sema como fonte unica de estilo
- use diagnosticos estruturados como contrato de correcao
- use a IR como fonte de verdade semantica quando houver duvida
- nao conclua uma alteracao sem validar e verificar o modulo
- comece pelo menor artefato semantico que resolva a tarefa

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
- \`sema resumo <arquivo-ou-pasta>\`
- \`sema prompt-curto <arquivo-ou-pasta>\`
- \`sema prompt-ia\`
- \`sema prompt-ia-ui\`
- \`sema prompt-ia-react\`
- \`sema prompt-ia-sema-primeiro\`
- \`sema contexto-ia <arquivo.sema>\`
`;

const DIRETORIO_CLI_ATUAL = path.dirname(fileURLToPath(import.meta.url));
const VERSAO_CLI = pacoteCli.version;
const ARQUIVOS_CANONICOS_IA_RAIZ = [
  "llms.txt",
  "SEMA_BRIEF.md",
  "SEMA_INDEX.json",
  "AGENTS.md",
  "README.md",
  "llms-full.txt",
] as const;
const DOCUMENTOS_SUPORTE_IA = [
  "docs/AGENT_STARTER.md",
  "docs/integracao-com-ia.md",
  "docs/fluxo-pratico-ia-sema.md",
  "docs/como-ensinar-a-sema-para-ia.md",
  "docs/sintaxe.md",
  "docs/cli.md",
] as const;

function obterArgumentos(): { comando?: Comando; resto: string[] } {
  const [, , comando, ...resto] = process.argv;
  return { comando: comando as Comando | undefined, resto };
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

function renderizarSecaoAscii(titulo: string, linhas: string[]): string {
  return [
    titulo,
    ...linhas.map((linha) => `  ${linha}`),
  ].join("\n");
}

function ajuda(): string {
  return [
    renderizarCaixaAscii([
      `Sema CLI v${VERSAO_CLI}`,
      "IA-first para contrato, geracao e adocao incremental",
      "novo projeto, edicao guiada e legado sem contrato inicial",
    ]),
    "",
    renderizarSecaoAscii("Fluxos rapidos", [
      "[1] Projeto novo / producao inicial",
      "sema iniciar --template <base|nestjs|fastapi|nextjs-api|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer>",
      "sema validar contratos/<modulo>.sema --json",
      "sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua> --saida <diretorio>",
      "sema verificar <arquivo-ou-pasta> --json",
      "",
      "[2] Editar projeto que ja usa Sema",
      "sema inspecionar . --json",
      "sema resumo <arquivo-ou-pasta> --micro --para mudanca",
      "sema drift <arquivo-ou-pasta> --json",
      "sema contexto-ia <arquivo.sema> --saida ./.tmp/contexto --json",
      "",
      "[3] Adotar Sema em projeto que ainda nao usa",
      "sema importar <fonte> <diretorio> --saida <diretorio> --json",
      "sema formatar <arquivo-ou-pasta>",
      "sema validar <arquivo-ou-pasta> --json",
      "sema drift <arquivo-ou-pasta> --json",
    ]),
    "",
    renderizarSecaoAscii("IA por capacidade", [
      "pequena: sema resumo --micro + briefing.min.json + prompt-curto.txt",
      "media: sema resumo --curto + drift.json + briefing.min.json",
      "grande: sema contexto-ia + briefing.json + ir.json + ast.json",
    ]),
    "",
    renderizarSecaoAscii("Comandos principais", [
      "descoberta: sema inspecionar [arquivo-ou-pasta] [--json]",
      "auditoria: sema drift <arquivo-ou-pasta> [--json]",
      "importacao: sema importar <nestjs|fastapi|flask|nextjs|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|firebase|dotnet|java|go|rust|cpp|typescript|python|dart|lua> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]",
      "validacao: sema validar <arquivo-ou-pasta> [--json]",
      "diagnostico: sema diagnosticos <arquivo.sema> [--json]",
      "geracao: sema compilar <arquivo-ou-pasta> --alvo <python|typescript|dart|lua> --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]",
      "teste local: sema testar <arquivo.sema> --alvo <python|typescript|dart|lua> --saida <diretorio-temporario> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]",
      "verificacao final: sema verificar <arquivo-ou-pasta> [--saida <diretorio-base>] [--json]",
      "formatacao: sema formatar <arquivo-ou-pasta> [--check] [--json]",
    ]),
    "",
    renderizarSecaoAscii("Ajuda IA-first", [
      "sema ajuda-ia",
      "sema starter-ia",
      "sema resumo <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--saida <diretorio>] [--raiz] [--json]",
      "sema prompt-curto <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--json]",
      "sema prompt-ia",
      "sema prompt-ia-ui",
      "sema prompt-ia-react",
      "sema prompt-ia-sema-primeiro",
      "sema exemplos-prompt-ia",
      "sema contexto-ia <arquivo.sema> [--saida <diretorio>] [--json]",
      "sema sync-ai-entrypoints [--json]",
    ]),
    "",
    renderizarSecaoAscii("Operacional", [
      "sema doctor",
      "sema --versao | --version | -v",
    ]),
  ].join("\n");
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

const OPCOES_COM_VALOR = new Set([
  "--template",
  "--alvo",
  "--saida",
  "--estrutura",
  "--framework",
  "--namespace",
  "--para",
]);

function obterPosicionais(args: string[]): string[] {
  const posicionais: string[] = [];
  for (let indice = 0; indice < args.length; indice += 1) {
    const atual = args[indice]!;
    if (atual.startsWith("--")) {
      if (OPCOES_COM_VALOR.has(atual)) {
        indice += 1;
      }
      continue;
    }
    posicionais.push(atual);
  }
  return posicionais;
}

function normalizarTamanhoResumo(args: string[]): TamanhoResumoIa {
  const escolhas = [
    possuiFlag(args, "--micro") ? "micro" : null,
    possuiFlag(args, "--curto") ? "curto" : null,
    possuiFlag(args, "--medio") ? "medio" : null,
  ].filter((item): item is TamanhoResumoIa => item !== null);

  if (escolhas.length > 1) {
    throw new Error("Use apenas uma entre as flags --micro, --curto ou --medio.");
  }

  return escolhas[0] ?? "curto";
}

function normalizarModoResumo(valor?: string): ModoResumoIa {
  if (
    valor === "resumo"
    || valor === "onboarding"
    || valor === "review"
    || valor === "mudanca"
    || valor === "bug"
    || valor === "arquitetura"
  ) {
    return valor;
  }
  return "resumo";
}

function comandoDisponivel(comando: string, argumentos: string[] = ["--version"]): boolean {
  const execucao = spawnSync(comando, argumentos, { stdio: "ignore", shell: process.platform === "win32" });
  return (execucao.status ?? 1) === 0;
}

function resolverComandoLua(): "lua" | "luajit" | undefined {
  if (comandoDisponivel("lua", ["-v"])) {
    return "lua";
  }
  if (comandoDisponivel("luajit", ["-v"])) {
    return "luajit";
  }
  return undefined;
}

async function comandoDoctor(): Promise<number> {
  const comandoLua = resolverComandoLua();
  const checks = [
    { nome: "node", ok: comandoDisponivel("node") },
    { nome: "npm", ok: comandoDisponivel("npm") },
    { nome: "python", ok: comandoDisponivel("python") || comandoDisponivel("py") },
    { nome: "lua", ok: comandoLua !== undefined },
    { nome: "dotnet", ok: comandoDisponivel("dotnet") },
    { nome: "go", ok: comandoDisponivel("go") },
    { nome: "cargo", ok: comandoDisponivel("cargo") },
    { nome: "java", ok: comandoDisponivel("java") },
    { nome: "code", ok: comandoDisponivel("code", ["--version"]) },
  ];

  console.log(renderizarCaixaAscii([
    "Sema doctor",
    "checa a toolchain minima para validar, gerar e operar a CLI",
  ]));
  for (const check of checks) {
    console.log(`- ${check.nome}: ${check.ok ? "ok" : "ausente"}`);
  }

  const obrigatorios = checks.filter((check) => ["node", "npm"].includes(check.nome));
  return obrigatorios.every((check) => check.ok) ? 0 : 1;
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
  if (alvo === "dart" || alvo === "lua") {
    return `Framework "${framework}" nao e suportado para o alvo ${alvo}.`;
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
  if (valor === "next") {
    return "nextjs";
  }
  if (valor === "next-consumer" || valor === "nextjs-consumer") {
    return "nextjs-consumer";
  }
  if (valor === "react-vite" || valor === "react-vite-consumer" || valor === "react-consumer") {
    return "react-vite-consumer";
  }
  if (valor === "angular" || valor === "angular-consumer") {
    return "angular-consumer";
  }
  if (valor === "flutter" || valor === "flutter-consumer") {
    return "flutter-consumer";
  }
  if (valor === "fb") {
    return "firebase";
  }
  if (valor === "csharp" || valor === "cs" || valor === "dotnet") {
    return "dotnet";
  }
  if (valor === "java") {
    return "java";
  }
  if (valor === "go" || valor === "golang") {
    return "go";
  }
  if (valor === "rust" || valor === "rs") {
    return "rust";
  }
  if (valor === "lua" || valor === "luajit") {
    return "lua";
  }
  if (valor === "cpp" || valor === "cxx" || valor === "cc" || valor === "c++") {
    return "cpp";
  }
  if (
    valor === "nestjs"
    || valor === "fastapi"
    || valor === "flask"
    || valor === "nextjs"
    || valor === "nextjs-consumer"
    || valor === "react-vite-consumer"
    || valor === "angular-consumer"
    || valor === "flutter-consumer"
    || valor === "firebase"
    || valor === "dotnet"
    || valor === "java"
    || valor === "go"
    || valor === "rust"
    || valor === "cpp"
    || valor === "typescript"
    || valor === "python"
    || valor === "dart"
    || valor === "lua"
  ) {
    return valor;
  }
  return undefined;
}

function normalizarTemplateIniciar(valor?: string): TemplateIniciar {
  if (
    valor === "nestjs"
    || valor === "fastapi"
    || valor === "nextjs-api"
    || valor === "nextjs-consumer"
    || valor === "react-vite-consumer"
    || valor === "angular-consumer"
    || valor === "flutter-consumer"
    || valor === "node-firebase-worker"
    || valor === "aspnet-api"
    || valor === "springboot-api"
    || valor === "go-http-api"
    || valor === "rust-axum-api"
    || valor === "cpp-service-bridge"
  ) {
    return valor;
  }
  return "base";
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
  if (alvo === "lua") {
    return gerarLua(ir);
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
    } else if (basename === `${nomeBaseAntigo}.lua`) {
      novoBasename = `${nomeArquivo}.lua`;
    } else if (basename === `test_${nomeBaseAntigo}.lua`) {
      novoBasename = `test_${nomeArquivo}.lua`;
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

  if (alvo === "lua") {
    const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_") && item.caminhoRelativo.endsWith(".lua"));
    if (!arquivoTeste) {
      return 0;
    }
    return (arquivoTeste.conteudo.match(/\blocal function test_/g) ?? []).length;
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
      const rotulo = alvo === "typescript" ? "TypeScript" : alvo === "python" ? "Python" : alvo === "dart" ? "Dart" : "Lua";
      console.log(`Nenhum teste ${rotulo} foi gerado.`);
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

  if (alvo === "lua") {
    const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_") && item.caminhoRelativo.endsWith(".lua"))?.caminhoRelativo;
    if (!arquivoTeste) {
      if (!silencioso) {
        console.log("Nenhum teste Lua foi gerado.");
      }
      return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
    }
    const comandoLua = resolverComandoLua();
    if (!comandoLua) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "Interpretador Lua nao encontrado. Instale `lua` ou `luajit` para rodar testes gerados.",
      };
    }
    const execucao = spawnSync(comandoLua, [arquivoTeste], {
      stdio: silencioso ? "pipe" : "inherit",
      cwd: baseSaida,
      encoding: silencioso ? "utf8" : undefined,
      shell: process.platform === "win32",
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
  const documentos = descoberta.documentos.map((documento) => `\`${documento.nome}\``);
  const linhas = [
    "Modo IA-first da instalacao atual",
    "- Use `sema` como interface publica principal.",
    "- A Sema entra em projeto novo, projeto ja semantizado e adocao incremental em legado sem contrato inicial.",
    "- Nao assuma monorepo, `node pacotes/cli/dist/index.js`, `npm run project:check` ou uma pasta `exemplos` externa ao projeto atual.",
    "- Se a IA tiver contexto curto, comece por `sema resumo` e `sema prompt-curto`.",
    "- Se a IA aguentar mais contexto, suba para `sema drift --json` e `sema contexto-ia`.",
    "- So leia `ast.json` e `ir.json` completos quando a capacidade da IA realmente aguentar esse volume.",
  ];

  if (documentos.length > 0) {
    linhas.push(`- Documentos locais empacotados: ${documentos.join(", ")}.`);
  } else {
    linhas.push("- Documentos locais empacotados: nenhum extra detectado. Siga a CLI, o contrato atual e os artefatos JSON.");
  }

  return linhas.join("\n");
}

function unicos<T>(itens: T[]): T[] {
  return [...new Set(itens)];
}

function unicosOrdenados(itens: string[]): string[] {
  return unicos(itens).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function limitarLista(itens: string[], limite: number): string[] {
  return itens.slice(0, limite);
}

function resumirListaTexto(itens: string[], limite: number, padrao = "nenhum"): string {
  if (itens.length === 0) {
    return padrao;
  }
  const visiveis = itens.slice(0, limite);
  const restante = itens.length - visiveis.length;
  return restante > 0 ? `${visiveis.join(", ")} (+${restante})` : visiveis.join(", ");
}

function normalizarIdentificadorResumo(valor: string): string {
  return valor.replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
}

function resumirCamposTask(
  task: { nome: string; input?: Array<{ nome: string }>; output?: Array<{ nome: string }> },
  campo: "input" | "output",
  limiteCampos: number,
): string {
  const campos = (task[campo] ?? []).map((item) => item.nome).slice(0, limiteCampos);
  if (campos.length === 0) {
    return `${task.nome}(-)`;
  }
  return `${task.nome}(${campos.join(", ")})`;
}

function formatarEfeitoSemanticoResumido(
  efeito: { categoria: string; alvo: string; criticidade?: string; detalhe?: string; textoOriginal?: string },
): string {
  if (efeito.textoOriginal) {
    return efeito.textoOriginal;
  }
  const partes = [`${efeito.categoria} ${efeito.alvo}`];
  if (efeito.criticidade) {
    partes.push(`criticidade=${efeito.criticidade}`);
  }
  if (efeito.detalhe) {
    partes.push(efeito.detalhe);
  }
  return partes.join(" ");
}

function calcularRiscoOperacionalResumo(resumoDrift: ResumoModuloDrift): string {
  if (resumoDrift.tasks.some((task) => task.riscoOperacional === "alto")) {
    return "alto";
  }
  if (resumoDrift.tasks.some((task) => task.riscoOperacional === "medio")) {
    return "medio";
  }
  return "baixo";
}

function descreverFazModulo(ir: IrModulo | null, modulo: string): string {
  if (!ir) {
    return `governa o modulo ${normalizarIdentificadorResumo(modulo)}`;
  }

  const partes: string[] = [];
  if (ir.routes.length > 0) {
    partes.push(`${ir.routes.length} rota(s)`);
  }
  if (ir.superficies.length > 0) {
    partes.push(`${ir.superficies.length} superficie(s)`);
  }
  if (ir.tasks.length > 0) {
    partes.push(`${ir.tasks.length} task(s)`);
  }

  const foco = ir.routes[0]?.nome ?? ir.superficies[0]?.nome ?? ir.tasks[0]?.nome ?? modulo;
  return partes.length > 0
    ? `governa ${partes.join(", ")} com foco em ${normalizarIdentificadorResumo(foco)}`
    : `governa o modulo ${normalizarIdentificadorResumo(modulo)}`;
}

function criarGuiaCapacidadeIa(): Record<CapacidadeIa, GuiaCapacidadeIa> {
  return {
    pequena: {
      descricao: "IA gratuita ou com contexto curto. Leia so o cartao semantico e o briefing minimo.",
      artefatos: ["resumo.micro.txt", "briefing.min.json", "prompt-curto.txt"],
      ordemLeitura: ["resumo.micro.txt", "briefing.min.json", "resumo.curto.txt"],
      evitar: ["ast.json", "ir.json", "diagnosticos.json"],
    },
    media: {
      descricao: "IA com contexto medio. Aguenta resumo expandido, briefing minimo e drift.",
      artefatos: ["resumo.curto.txt", "briefing.min.json", "drift.json", "prompt-curto.txt"],
      ordemLeitura: ["resumo.curto.txt", "briefing.min.json", "drift.json", "resumo.md"],
      evitar: ["ast.json"],
    },
    grande: {
      descricao: "IA com contexto grande ou tool use. Pode consumir o pacote completo.",
      artefatos: ["README.md", "resumo.md", "briefing.json", "drift.json", "ir.json", "ast.json"],
      ordemLeitura: ["README.md", "resumo.md", "briefing.json", "drift.json", "ir.json", "ast.json"],
      evitar: [],
    },
  };
}

function coletarResumoSemanticoModulo(
  contexto: Pick<PacoteContextoModuloIa, "arquivo" | "modulo" | "geradoEm" | "ir" | "briefing" | "drift">,
): ResumoSemanticoModuloIa {
  const { arquivo, modulo, geradoEm, ir, briefing, drift } = contexto;
  const tarefas = ir?.tasks ?? [];
  const rotas = ir?.routes ?? [];
  const superficies = ir?.superficies ?? [];
  const regrasCriticas = unicosOrdenados([
    ...tarefas.flatMap((task) => task.rules),
    ...tarefas.flatMap((task) => task.guarantees),
  ]);
  const efeitos = unicosOrdenados([
    ...tarefas.flatMap((task) => task.effects),
    ...rotas.flatMap((route) => route.efeitosPublicos.map((efeito) => formatarEfeitoSemanticoResumido(efeito))),
    ...superficies.flatMap((superficie) => superficie.effects.map((efeito) => formatarEfeitoSemanticoResumido(efeito))),
  ]);
  const erros = unicosOrdenados([
    ...tarefas.flatMap((task) => Object.keys(task.errors)),
    ...tarefas.flatMap((task) => task.errosDetalhados.map((erro) => erro.codigo)),
    ...rotas.flatMap((route) => route.errosPublicos.map((erro) => erro.codigo)),
  ]);
  const entidadesAfetadas = unicosOrdenados([
    ...(ir?.resumoAgente.entidadesAfetadas ?? []),
    ...tarefas.flatMap((task) => task.resumoAgente.entidadesAfetadas),
    ...rotas.flatMap((route) => route.resumoAgente.entidadesAfetadas),
    ...superficies.flatMap((superficie) => superficie.resumoAgente.entidadesAfetadas),
  ]);

  return {
    geradoEm,
    arquivo,
    modulo,
    perfilCompatibilidade: ir?.perfilCompatibilidade ?? briefing.perfilCompatibilidade,
    scoreSemantico: briefing.scoreSemantico,
    confiancaGeral: briefing.confiancaGeral,
    riscoOperacional: calcularRiscoOperacionalResumo(drift.resumo),
    faz: descreverFazModulo(ir, modulo),
    tarefasPrincipais: limitarLista(tarefas.map((task) => task.nome), 6),
    entradasChave: limitarLista(tarefas.map((task) => resumirCamposTask(task, "input", 4)), 4),
    saidasChave: limitarLista(tarefas.map((task) => resumirCamposTask(task, "output", 4)), 4),
    superficiesPublicas: limitarLista(unicosOrdenados([
      ...briefing.superficiesImpactadas,
      ...rotas.map((route) => `${route.metodo ?? "?"} ${route.caminho ?? route.nome}`),
    ]), 8),
    regrasCriticas: limitarLista(regrasCriticas, 8),
    efeitos: limitarLista(efeitos, 8),
    erros: limitarLista(erros, 8),
    entidadesAfetadas: limitarLista(entidadesAfetadas, 8),
    arquivosProvaveis: limitarLista(unicosOrdenados(briefing.oQueTocar), 8),
    simbolosRelacionados: limitarLista(unicosOrdenados(briefing.simbolosRelacionados), 8),
    riscosPrincipais: limitarLista(unicosOrdenados(briefing.riscosPrincipais), 6),
    lacunas: limitarLista(unicosOrdenados(briefing.oQueEstaFrouxo), 6),
    inferido: limitarLista(unicosOrdenados(briefing.oQueFoiInferido), 6),
    checksSugeridos: limitarLista(unicosOrdenados(briefing.oQueValidar), 6),
    testesMinimos: limitarLista(unicosOrdenados(briefing.testesMinimos), 6),
    consumerFramework: briefing.consumerFramework ?? drift.drift.consumerFramework ?? null,
    appRoutes: limitarLista(unicosOrdenados(briefing.appRoutes ?? drift.drift.appRoutes ?? []), 8),
    consumerSurfaces: limitarLista(unicosOrdenados(briefing.consumerSurfaces ?? []), 8),
    consumerBridges: limitarLista(unicosOrdenados(briefing.consumerBridges ?? []), 8),
    arquivosProvaveisEditar: limitarLista(unicosOrdenados(briefing.arquivosProvaveisEditar ?? briefing.oQueTocar), 8),
  };
}

function renderizarResumoModuloTexto(
  resumo: ResumoSemanticoModuloIa,
  tamanho: TamanhoResumoIa,
  modo: ModoResumoIa,
): string {
  const limite = tamanho === "micro" ? 2 : tamanho === "curto" ? 4 : 6;
  const linhas = [
    `MODO: ${modo}`,
    `MODULO: ${resumo.modulo}`,
    `FAZ: ${resumo.faz}`,
    `PERFIL: ${resumo.perfilCompatibilidade}`,
    `CONSUMER_FRAMEWORK: ${resumo.consumerFramework ?? "nenhum"}`,
    `APP_ROUTES: ${resumirListaTexto(resumo.appRoutes, limite)}`,
    `CONSUMER_SURFACES: ${resumirListaTexto(resumo.consumerSurfaces, limite)}`,
    `CONSUMER_BRIDGES: ${resumirListaTexto(resumo.consumerBridges, limite)}`,
    `PUBLICO: ${resumirListaTexto(resumo.superficiesPublicas, limite)}`,
    `TAREFAS: ${resumirListaTexto(resumo.tarefasPrincipais, limite)}`,
    `ENTRADAS: ${resumirListaTexto(resumo.entradasChave, limite)}`,
    `SAIDAS: ${resumirListaTexto(resumo.saidasChave, limite)}`,
    `REGRAS: ${resumirListaTexto(resumo.regrasCriticas, limite)}`,
    `EFEITOS: ${resumirListaTexto(resumo.efeitos, limite)}`,
    `ERROS: ${resumirListaTexto(resumo.erros, limite)}`,
    `TOCAR: ${resumirListaTexto(resumo.arquivosProvaveis, limite)}`,
    `VALIDAR: ${resumirListaTexto(resumo.checksSugeridos, limite)}`,
    `TESTES: ${resumirListaTexto(resumo.testesMinimos, limite)}`,
    `RISCOS: ${resumirListaTexto(resumo.riscosPrincipais, limite)}`,
    `LACUNAS: ${resumirListaTexto(resumo.lacunas, limite)}`,
    `INFERIDO: ${resumirListaTexto(resumo.inferido, limite)}`,
    `CONFIANCA: ${resumo.confiancaGeral}`,
    `RISCO_OPERACIONAL: ${resumo.riscoOperacional}`,
    `SCORE: ${resumo.scoreSemantico}`,
    `GERADO_EM: ${resumo.geradoEm}`,
  ];

  if (tamanho === "micro") {
    return `${linhas.slice(0, 12).join("\n")}\n`;
  }

  return `${linhas.join("\n")}\n`;
}

function renderizarResumoModuloMarkdown(
  resumo: ResumoSemanticoModuloIa,
  modo: ModoResumoIa,
  guiaPorCapacidade: Record<CapacidadeIa, GuiaCapacidadeIa>,
): string {
  const linhas = [
    `# Resumo Sema para ${resumo.modulo}`,
    "",
    `- Modo: \`${modo}\``,
    `- Gerado em: \`${resumo.geradoEm}\``,
    `- Arquivo: \`${resumo.arquivo}\``,
    `- Perfil: \`${resumo.perfilCompatibilidade}\``,
    `- Score: \`${resumo.scoreSemantico}\``,
    `- Confianca: \`${resumo.confiancaGeral}\``,
    `- Risco operacional: \`${resumo.riscoOperacional}\``,
    "",
    "## O que este modulo faz",
    "",
    `- ${resumo.faz}`,
    `- Superficies publicas: ${resumirListaTexto(resumo.superficiesPublicas, 8)}`,
    `- Tarefas principais: ${resumirListaTexto(resumo.tarefasPrincipais, 8)}`,
    "",
    "## Contrato util para IA",
    "",
    `- Entradas chave: ${resumirListaTexto(resumo.entradasChave, 6)}`,
    `- Saidas chave: ${resumirListaTexto(resumo.saidasChave, 6)}`,
    `- Regras criticas: ${resumirListaTexto(resumo.regrasCriticas, 6)}`,
    `- Efeitos: ${resumirListaTexto(resumo.efeitos, 6)}`,
    `- Erros: ${resumirListaTexto(resumo.erros, 6)}`,
    `- Entidades afetadas: ${resumirListaTexto(resumo.entidadesAfetadas, 6)}`,
    "",
    ...(resumo.consumerFramework
      ? [
        "## Consumer IA-first",
        "",
        `- Framework consumer: ${resumo.consumerFramework}`,
        `- Rotas de app: ${resumirListaTexto(resumo.appRoutes, 6)}`,
        `- Superficies consumer: ${resumirListaTexto(resumo.consumerSurfaces, 6)}`,
        `- Bridges consumer: ${resumirListaTexto(resumo.consumerBridges, 6)}`,
        "",
      ]
      : []),
    "## Intervencao segura",
    "",
    `- Arquivos provaveis: ${resumirListaTexto(resumo.arquivosProvaveis, 6)}`,
    `- Simbolos relacionados: ${resumirListaTexto(resumo.simbolosRelacionados, 6)}`,
    `- Riscos principais: ${resumirListaTexto(resumo.riscosPrincipais, 6)}`,
    `- Lacunas: ${resumirListaTexto(resumo.lacunas, 6)}`,
    `- O que foi inferido: ${resumirListaTexto(resumo.inferido, 6)}`,
    `- Checks sugeridos: ${resumirListaTexto(resumo.checksSugeridos, 6)}`,
    `- Testes minimos: ${resumirListaTexto(resumo.testesMinimos, 6)}`,
    "",
    "## Guia por capacidade de IA",
    "",
  ];

  for (const capacidade of ["pequena", "media", "grande"] as const) {
    const guia = guiaPorCapacidade[capacidade];
    linhas.push(`### ${capacidade}`);
    linhas.push("");
    linhas.push(`- ${guia.descricao}`);
    linhas.push(`- Artefatos: ${guia.artefatos.map((item) => `\`${item}\``).join(", ")}`);
    linhas.push(`- Ordem de leitura: ${guia.ordemLeitura.map((item) => `\`${item}\``).join(" -> ")}`);
    linhas.push(`- Evitar: ${guia.evitar.length > 0 ? guia.evitar.map((item) => `\`${item}\``).join(", ") : "nada obrigatorio"}`);
    linhas.push("");
  }

  return `${linhas.join("\n").trim()}\n`;
}

function criarBriefingMinimo(
  resumo: ResumoSemanticoModuloIa,
  modo: ModoResumoIa,
  tamanho: TamanhoResumoIa,
): Record<string, unknown> {
  return {
    comando: "briefing-minimo",
    geradoEm: resumo.geradoEm,
    cliVersao: VERSAO_CLI,
    modo,
    tamanho,
    arquivo: resumo.arquivo,
    modulo: resumo.modulo,
    perfilCompatibilidade: resumo.perfilCompatibilidade,
    scoreSemantico: resumo.scoreSemantico,
    confiancaGeral: resumo.confiancaGeral,
    riscoOperacional: resumo.riscoOperacional,
    faz: resumo.faz,
    publico: resumo.superficiesPublicas,
    tarefasPrincipais: resumo.tarefasPrincipais,
    entradasChave: resumo.entradasChave,
    saidasChave: resumo.saidasChave,
    regrasCriticas: resumo.regrasCriticas,
    efeitos: resumo.efeitos,
    erros: resumo.erros,
    arquivosProvaveis: resumo.arquivosProvaveis,
    arquivosProvaveisEditar: resumo.arquivosProvaveisEditar,
    simbolosRelacionados: resumo.simbolosRelacionados,
    riscosPrincipais: resumo.riscosPrincipais,
    lacunas: resumo.lacunas,
    inferido: resumo.inferido,
    checksSugeridos: resumo.checksSugeridos,
    testesMinimos: resumo.testesMinimos,
    consumerFramework: resumo.consumerFramework,
    appRoutes: resumo.appRoutes,
    consumerSurfaces: resumo.consumerSurfaces,
    consumerBridges: resumo.consumerBridges,
  };
}

function criarPromptCurtoModulo(
  resumo: ResumoSemanticoModuloIa,
  modo: ModoResumoIa,
  tamanho: TamanhoResumoIa,
  capacidade: CapacidadeIa,
): string {
  const resumoTexto = renderizarResumoModuloTexto(resumo, tamanho, modo).trim();
  return `Voce esta operando Sema em modo IA-first.

Esta linguagem nao foi desenhada para agradar humano; ela existe para reduzir ambiguidade para IA.

Capacidade alvo: ${capacidade}
Modo da tarefa: ${modo}

Regras:
- nao invente sintaxe nem bloco fora da gramatica oficial
- preserve a intencao do contrato
- use este resumo como fonte compacta inicial
- se a tarefa pedir mais contexto, suba para \`briefing.min.json\`, \`drift.json\` e depois \`ir.json\`
- nao saia editando software vivo sem olhar risco, lacuna e checks sugeridos
${resumo.consumerFramework ? "- se for tarefa visual consumer, priorize `appRoutes`, `consumerSurfaces` e `consumerBridges` antes de abrir arquivos aleatorios" : ""}

Contexto compacto:
${resumoTexto}
`;
}

function renderizarResumoProjetoMarkdown(
  geradoEm: string,
  modulos: ResumoSemanticoModuloIa[],
  guiaPorCapacidade: Record<CapacidadeIa, GuiaCapacidadeIa>,
): string {
  const entradaCanonica = criarEntradaCanonicaProjeto(guiaPorCapacidade);
  const linhas = [
    "# SEMA_BRIEF",
    "",
    "Sema e IA-first. Este arquivo existe para IA achar o ponto de entrada do projeto sem ter que catar o repo inteiro feito barata tonta.",
    "",
    `- Gerado em: \`${geradoEm}\``,
    `- Modulos: \`${modulos.length}\``,
    "",
    "## Entrada canonica para IA",
    "",
    `- Ordem minima: ${entradaCanonica.ordemLeitura.join(" -> ")}`,
    `- IA pequena: ${entradaCanonica.porCapacidade.pequena.join(" -> ")}`,
    `- IA media: ${entradaCanonica.porCapacidade.media.join(" -> ")}`,
    `- IA grande: ${entradaCanonica.porCapacidade.grande.join(" -> ")}`,
    "",
    "## Guia por capacidade",
    "",
  ];

  for (const capacidade of ["pequena", "media", "grande"] as const) {
    const guia = guiaPorCapacidade[capacidade];
    linhas.push(`- ${capacidade}: ${guia.descricao} Artefatos: ${guia.artefatos.join(", ")}.`);
  }

  linhas.push("");
  linhas.push("## Modulos");
  linhas.push("");

  for (const modulo of modulos) {
    linhas.push(`### ${modulo.modulo}`);
    linhas.push(`- Faz: ${modulo.faz}`);
    linhas.push(`- Publico: ${resumirListaTexto(modulo.superficiesPublicas, 4)}`);
    linhas.push(`- Tocar: ${resumirListaTexto(modulo.arquivosProvaveis, 4)}`);
    linhas.push(`- Score: ${modulo.scoreSemantico} | Confianca: ${modulo.confiancaGeral} | Risco: ${modulo.riscoOperacional}`);
    linhas.push(`- Lacunas: ${resumirListaTexto(modulo.lacunas, 4)}`);
    linhas.push("");
  }

  return `${linhas.join("\n").trim()}\n`;
}

function criarEntradaCanonicaProjeto(guiaPorCapacidade: Record<CapacidadeIa, GuiaCapacidadeIa>) {
  return {
    descricao: "Entrada canonica do repositorio para IA. O repo nao e human-first; a IA deve começar por esses artefatos antes de abrir codigo cru.",
    ordemLeitura: [...ARQUIVOS_CANONICOS_IA_RAIZ],
    porCapacidade: {
      pequena: ["llms.txt", "SEMA_BRIEF.micro.txt", "SEMA_INDEX.json", "AGENTS.md"],
      media: ["llms.txt", "SEMA_BRIEF.curto.txt", "SEMA_INDEX.json", "AGENTS.md", "README.md"],
      grande: ["llms-full.txt", "SEMA_BRIEF.md", "SEMA_INDEX.json", "AGENTS.md", "README.md"],
    },
    docsSuporte: [...DOCUMENTOS_SUPORTE_IA],
    guiaPorCapacidade,
  };
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
  const vinculosValidos = modulo
    ? resultadoDrift.vinculos_validos.filter((vinculo) => vinculo.modulo === modulo)
    : [];
  const vinculosQuebrados = modulo
    ? resultadoDrift.vinculos_quebrados.filter((vinculo) => vinculo.modulo === modulo)
    : [];
  const rotasDivergentes = modulo
    ? resultadoDrift.rotas_divergentes.filter((rota) => rota.modulo === modulo)
    : [];
  const recursosValidos = modulo
    ? resultadoDrift.recursos_validos.filter((recurso) => recurso.modulo === modulo)
    : [];
  const recursosDivergentes = modulo
    ? resultadoDrift.recursos_divergentes.filter((recurso) => recurso.modulo === modulo)
    : [];
  const vinculosModulo = modulo
    ? [
      ...resultadoDrift.vinculos_validos.filter((vinculo) => vinculo.modulo === modulo),
      ...resultadoDrift.vinculos_quebrados.filter((vinculo) => vinculo.modulo === modulo),
    ]
    : [];
  const rotasConsumerModulo = new Set(
    vinculosModulo
      .filter((vinculo) => vinculo.tipo === "superficie")
      .map((vinculo) => vinculo.valor),
  );
  const arquivosRelacionados = [...new Set([
    ...tasks.flatMap((task) => task.arquivosReferenciados),
    ...tasks.flatMap((task) => task.arquivosProvaveisEditar),
    ...implsValidos.map((impl) => impl.arquivo).filter((item): item is string => Boolean(item)),
    ...implsQuebrados.flatMap((impl) => impl.candidatos?.map((candidato) => candidato.arquivo) ?? []),
    ...vinculosValidos.map((vinculo) => vinculo.arquivo).filter((item): item is string => Boolean(item)),
    ...recursosValidos.map((recurso) => recurso.arquivo).filter(Boolean),
    ...recursosDivergentes.map((recurso) => recurso.arquivo).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consumerSurfaces = resultadoDrift.consumerSurfaces
    .filter((surface) =>
      arquivosRelacionados.includes(surface.arquivo)
      || rotasConsumerModulo.has(surface.rota))
    .map((surface) => `${surface.tipoArquivo}:${surface.rota} -> ${surface.arquivo}`)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consumerBridges = resultadoDrift.consumerBridges
    .filter((bridge) => arquivosRelacionados.includes(bridge.arquivo))
    .map((bridge) => bridge.caminho)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const appRoutes = [...new Set(resultadoDrift.consumerSurfaces
    .filter((surface) =>
      arquivosRelacionados.includes(surface.arquivo)
      || rotasConsumerModulo.has(surface.rota))
    .map((surface) => surface.rota))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const consumerFramework = appRoutes.length > 0 || consumerBridges.length > 0
      ? resultadoDrift.consumerFramework
      : null;

  return {
    caminho,
    modulo,
    implsValidos: implsValidos.length,
    implsQuebrados: implsQuebrados.length,
    vinculosValidos: vinculosValidos.length,
    vinculosQuebrados: vinculosQuebrados.length,
    recursosValidos: recursosValidos.length,
    recursosDivergentesCount: recursosDivergentes.length,
    tasksSemImplementacao: tasks.filter((task) => task.semImplementacao).length,
    scoreMedio: tasks.length > 0 ? Math.round(tasks.reduce((total, task) => total + task.scoreSemantico, 0) / tasks.length) : 0,
    confiancaGeral: tasks.some((task) => task.confiancaVinculo === "alta")
      ? "alta"
      : tasks.some((task) => task.confiancaVinculo === "media")
        ? "media"
        : "baixa",
    arquivosRelacionados,
    arquivosProvaveisEditar: arquivosRelacionados,
    consumerFramework,
    appRoutes,
    consumerSurfaces,
    consumerBridges,
    checksSugeridos: [...new Set(tasks.flatMap((task) => task.checksSugeridos))],
    lacunas: [...new Set(tasks.flatMap((task) => task.lacunas))],
    tasks,
    rotasDivergentes,
    recursosDivergentes,
    vinculosQuebradosDetalhes: vinculosQuebrados,
  };
}

function criarBriefingAgente(
  arquivo: string,
  modulo: string,
  ir: IrModulo | null,
  resumoDrift: ReturnType<typeof resumirDriftPorModulo>,
  resultadoDrift: Awaited<ReturnType<typeof analisarDriftLegado>>,
) {
  const tarefasModulo = resultadoDrift.tasks.filter((task) => task.modulo === modulo);
  return {
    arquivo,
    modulo,
    perfilCompatibilidade: ir?.perfilCompatibilidade ?? "interno",
    scoreSemantico: resumoDrift.scoreMedio,
    confiancaGeral: resumoDrift.confiancaGeral,
    riscosPrincipais: [...new Set([
      ...resultadoDrift.resumo_operacional.riscosPrincipais.filter((item) => item.startsWith(`${modulo}:`) || tarefasModulo.some((task) => item.startsWith(`${task.task}:`))),
      ...(ir?.resumoAgente.riscos ?? []),
    ])],
    oQueTocar: resumoDrift.arquivosRelacionados,
    arquivosProvaveisEditar: resumoDrift.arquivosProvaveisEditar,
    oQueValidar: [...new Set([
      ...resumoDrift.checksSugeridos,
      ...resultadoDrift.resumo_operacional.oQueValidar,
    ])],
    oQueEstaFrouxo: [...new Set([
      ...resumoDrift.lacunas,
      ...resultadoDrift.resumo_operacional.oQueEstaFrouxo,
    ])],
    oQueFoiInferido: [...new Set([
      ...resultadoDrift.impls_quebrados
        .filter((impl) => impl.modulo === modulo)
        .flatMap((impl) => impl.candidatos?.map((candidato) => candidato.caminho) ?? []),
      ...resultadoDrift.vinculos_validos
        .filter((vinculo) => vinculo.modulo === modulo && vinculo.status === "parcial")
        .map((vinculo) => `${vinculo.dono}:${vinculo.valor}`),
    ])],
    simbolosRelacionados: [...new Set([
      ...tarefasModulo.flatMap((task) => task.simbolosReferenciados),
      ...resultadoDrift.vinculos_validos
        .filter((vinculo) => vinculo.modulo === modulo)
        .map((vinculo) => vinculo.simbolo)
        .filter((item): item is string => Boolean(item)),
    ])],
    superficiesImpactadas: [
      ...(ir?.routes.map((route) => `${route.metodo ?? "?"} ${route.caminho ?? route.nome}`) ?? []),
      ...(ir?.superficies.map((superficie) => `${superficie.tipo}:${superficie.nome}`) ?? []),
    ],
    consumerFramework: resumoDrift.consumerFramework,
    appRoutes: resumoDrift.appRoutes,
    consumerSurfaces: resumoDrift.consumerSurfaces,
    consumerBridges: resumoDrift.consumerBridges,
    testesMinimos: [
      "sema validar <arquivo> --json",
      "sema drift <arquivo> --json",
      "sema verificar <arquivo-ou-pasta> --json",
    ],
  };
}

async function carregarContextoModuloIa(arquivoEntrada: string): Promise<PacoteContextoModuloIa> {
  const arquivo = path.resolve(arquivoEntrada);
  garantirArquivoSema(arquivo);
  const contextoProjeto = await carregarProjeto(arquivo, process.cwd());
  const resultadoModulo = contextoProjeto.modulosSelecionados.find((item) => path.resolve(item.caminho) === arquivo)?.resultado;

  if (!resultadoModulo) {
    falharContextoIa(`Nao foi possivel encontrar o modulo correspondente ao arquivo ${arquivo}.`);
  }

  const sucesso = !temErros(resultadoModulo.diagnosticos);
  const modulo = resultadoModulo.modulo?.nome ?? path.basename(arquivo, ".sema");
  const geradoEm = new Date().toISOString();
  const resultadoDrift = await analisarDriftLegado(contextoProjeto);
  const drift = {
    comando: "drift" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso: resultadoDrift.sucesso,
    resumo: resumirDriftPorModulo(resultadoModulo.modulo?.nome ?? null, arquivo, resultadoDrift),
    drift: resultadoDrift,
  };

  const validar = {
    comando: "validar" as const,
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
    comando: "diagnosticos" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    diagnosticos: resultadoModulo.diagnosticos,
  };

  const ast = {
    comando: "ast" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso,
    diagnosticos: resultadoModulo.diagnosticos,
    ast: resultadoModulo.modulo ?? null,
  };

  const ir = {
    comando: "ir" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso,
    diagnosticos: resultadoModulo.diagnosticos,
    ir: resultadoModulo.ir ?? null,
  };
  const briefing = criarBriefingAgente(
    arquivo,
    modulo,
    resultadoModulo.ir ?? null,
    drift.resumo,
    resultadoDrift,
  );

  return {
    arquivo,
    modulo,
    sucesso,
    geradoEm,
    diagnosticos: resultadoModulo.diagnosticos,
    ir: resultadoModulo.ir ?? null,
    validar,
    diagnosticosJson: diagnosticos,
    ast,
    irJson: ir,
    drift,
    briefing,
  };
}

async function gerarArquivosResumoModuloIa(
  contexto: PacoteContextoModuloIa,
  pastaBase: string,
): Promise<{
  artefatosCompactos: string[];
  guiaPorCapacidade: Record<CapacidadeIa, GuiaCapacidadeIa>;
}> {
  const guiaPorCapacidade = criarGuiaCapacidadeIa();
  const resumoSemantico = coletarResumoSemanticoModulo(contexto);
  const resumoMicro = renderizarResumoModuloTexto(resumoSemantico, "micro", "resumo");
  const resumoCurto = renderizarResumoModuloTexto(resumoSemantico, "curto", "resumo");
  const resumoMarkdown = renderizarResumoModuloMarkdown(resumoSemantico, "resumo", guiaPorCapacidade);
  const briefingMinimo = criarBriefingMinimo(resumoSemantico, "resumo", "curto");
  const promptCurto = criarPromptCurtoModulo(resumoSemantico, "mudanca", "curto", "pequena");

  await writeFile(path.join(pastaBase, "resumo.micro.txt"), resumoMicro, "utf8");
  await writeFile(path.join(pastaBase, "resumo.curto.txt"), resumoCurto, "utf8");
  await writeFile(path.join(pastaBase, "resumo.md"), resumoMarkdown, "utf8");
  await writeFile(path.join(pastaBase, "briefing.min.json"), `${JSON.stringify(briefingMinimo, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "prompt-curto.txt"), promptCurto, "utf8");

  return {
    artefatosCompactos: ["resumo.micro.txt", "resumo.curto.txt", "resumo.md", "briefing.min.json", "prompt-curto.txt"],
    guiaPorCapacidade,
  };
}

async function gerarResumoProjetoIa(
  entrada: string | undefined,
  pastaSaidaOpcional?: string,
  escreverNaRaiz = false,
): Promise<{
  geradoEm: string;
  baseProjeto: string;
  pastaSaida: string;
  artefatos: string[];
  modulos: ResumoSemanticoModuloIa[];
  guiaPorCapacidade: Record<CapacidadeIa, GuiaCapacidadeIa>;
}> {
  const contextoProjeto = await carregarProjeto(entrada, process.cwd());
  const geradoEm = new Date().toISOString();
  const guiaPorCapacidade = criarGuiaCapacidadeIa();
  const entradaCanonica = criarEntradaCanonicaProjeto(guiaPorCapacidade);
  const resultadoDrift = await analisarDriftLegado(contextoProjeto);
  const modulos = contextoProjeto.modulosSelecionados.map((item) => {
    const modulo = item.resultado.modulo?.nome ?? path.basename(item.caminho, ".sema");
    const driftResumo = resumirDriftPorModulo(modulo, item.caminho, resultadoDrift);
    const briefing = criarBriefingAgente(item.caminho, modulo, item.resultado.ir ?? null, driftResumo, resultadoDrift);
    return coletarResumoSemanticoModulo({
      arquivo: item.caminho,
      modulo,
      geradoEm,
      ir: item.resultado.ir ?? null,
      briefing,
      drift: {
        comando: "drift",
        caminho: item.caminho,
        modulo,
        sucesso: resultadoDrift.sucesso,
        resumo: driftResumo,
        drift: resultadoDrift,
      },
    });
  });

  const baseProjeto = contextoProjeto.baseProjeto;
  const pastaSaida = escreverNaRaiz
    ? baseProjeto
    : pastaSaidaOpcional
      ? path.resolve(pastaSaidaOpcional)
      : path.resolve(baseProjeto, ".tmp", "sema-resumo");

  await mkdir(pastaSaida, { recursive: true });

  const semaBrief = renderizarResumoProjetoMarkdown(geradoEm, modulos, guiaPorCapacidade);
  const indexJson = {
    comando: "resumo-projeto",
    geradoEm,
    cliVersao: VERSAO_CLI,
    baseProjeto,
    totalModulos: modulos.length,
    entradaCanonica,
    guiaPorCapacidade,
    modulos,
  };
  const micro = [
    `PROJETO: ${path.basename(baseProjeto)}`,
    `MODULOS: ${modulos.length}`,
    `ENTRADA_IA: ${entradaCanonica.porCapacidade.pequena.join(" -> ")}`,
    `TOP_MODULOS: ${resumirListaTexto(modulos.map((modulo) => modulo.modulo), 3)}`,
    `TOP_RISCOS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.riscosPrincipais)), 3)}`,
    `TOP_LACUNAS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.lacunas)), 3)}`,
    `GERADO_EM: ${geradoEm}`,
    "",
  ].join("\n");
  const curto = [
    `PROJETO: ${path.basename(baseProjeto)}`,
    `BASE: ${baseProjeto}`,
    `MODULOS: ${modulos.length}`,
    `ENTRADA_IA: ${entradaCanonica.porCapacidade.media.join(" -> ")}`,
    `TOP_MODULOS: ${resumirListaTexto(modulos.map((modulo) => modulo.modulo), 6)}`,
    `TOP_RISCOS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.riscosPrincipais)), 6)}`,
    `TOP_LACUNAS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.lacunas)), 6)}`,
    `TOP_ARQUIVOS: ${resumirListaTexto(unicosOrdenados(modulos.flatMap((modulo) => modulo.arquivosProvaveis)), 6)}`,
    `GERADO_EM: ${geradoEm}`,
    "",
  ].join("\n");

  await writeFile(path.join(pastaSaida, "SEMA_BRIEF.md"), semaBrief, "utf8");
  await writeFile(path.join(pastaSaida, "SEMA_BRIEF.micro.txt"), micro, "utf8");
  await writeFile(path.join(pastaSaida, "SEMA_BRIEF.curto.txt"), curto, "utf8");
  await writeFile(path.join(pastaSaida, "SEMA_INDEX.json"), `${JSON.stringify(indexJson, null, 2)}\n`, "utf8");

  return {
    geradoEm,
    baseProjeto,
    pastaSaida,
    artefatos: ["SEMA_BRIEF.md", "SEMA_BRIEF.micro.txt", "SEMA_BRIEF.curto.txt", "SEMA_INDEX.json"],
    modulos,
    guiaPorCapacidade,
  };
}

async function gerarContextoIa(arquivoEntrada: string, pastaSaidaOpcional?: string): Promise<ContextoIaGerado> {
  const contexto = await carregarContextoModuloIa(arquivoEntrada);
  const pastaBase = pastaSaidaOpcional
    ? path.resolve(pastaSaidaOpcional)
    : path.resolve(process.cwd(), ".tmp", "contexto-ia", path.basename(contexto.arquivo, ".sema"));

  await mkdir(pastaBase, { recursive: true });

  await writeFile(path.join(pastaBase, "validar.json"), `${JSON.stringify(contexto.validar, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "diagnosticos.json"), `${JSON.stringify(contexto.diagnosticosJson, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "ast.json"), `${JSON.stringify(contexto.ast, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "ir.json"), `${JSON.stringify(contexto.irJson, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "drift.json"), `${JSON.stringify(contexto.drift, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "briefing.json"), `${JSON.stringify(contexto.briefing, null, 2)}\n`, "utf8");
  const resumoGerado = await gerarArquivosResumoModuloIa(contexto, pastaBase);

  const resumo = `# Contexto de IA para ${contexto.modulo}

- Arquivo alvo: \`${contexto.arquivo}\`
- Modulo: \`${contexto.modulo}\`
- Sucesso em validar: \`${contexto.sucesso}\`
- Quantidade de diagnosticos: \`${contexto.diagnosticos.length}\`
- Gerado em: \`${contexto.geradoEm}\`

## Arquivos gerados neste pacote

- \`resumo.micro.txt\`
- \`resumo.curto.txt\`
- \`resumo.md\`
- \`briefing.min.json\`
- \`prompt-curto.txt\`
- \`validar.json\`
- \`diagnosticos.json\`
- \`ast.json\`
- \`ir.json\`
- \`drift.json\`
- \`briefing.json\`

## Fluxo recomendado para o agente

### IA pequena ou gratuita

1. Ler \`resumo.micro.txt\`.
2. Ler \`briefing.min.json\`.
3. Se ainda couber contexto, ler \`resumo.curto.txt\`.

### IA media

1. Ler \`resumo.curto.txt\`.
2. Ler \`briefing.min.json\`.
3. Ler \`drift.json\`.
4. Se precisar, subir para \`resumo.md\`.

### IA grande ou com tool use

1. Ler \`README.md\`.
2. Ler \`resumo.md\`.
3. Ler \`briefing.json\`.
4. Ler \`drift.json\`.
5. So depois abrir \`ir.json\` e \`ast.json\`.

## Fechamento

1. Editar o arquivo \`.sema\`.
2. Rodar \`sema formatar "${contexto.arquivo}"\`.
3. Rodar \`sema validar "${contexto.arquivo}" --json\`.
4. Rodar \`sema drift "${contexto.arquivo}" --json\`.
5. Fechar com \`sema verificar <arquivo-ou-pasta> --json --saida ./.tmp/verificacao-ia\`.

## Textos base para onboarding do agente

- \`sema starter-ia\`
- \`sema resumo "${contexto.arquivo}" --micro --para onboarding\`
- \`sema prompt-curto "${contexto.arquivo}" --para mudanca\`
- \`sema prompt-ia\`
`;

  await writeFile(path.join(pastaBase, "README.md"), resumo, "utf8");

  return {
    sucesso: contexto.sucesso,
    arquivo: contexto.arquivo,
    modulo: contexto.modulo,
    pastaSaida: pastaBase,
    artefatos: [
      "validar.json",
      "diagnosticos.json",
      "ast.json",
      "ir.json",
      "drift.json",
      "briefing.json",
      "README.md",
      ...resumoGerado.artefatosCompactos,
    ],
    artefatosCompactos: resumoGerado.artefatosCompactos,
    geradoEm: contexto.geradoEm,
    guiaPorCapacidade: resumoGerado.guiaPorCapacidade,
  };
}

async function comandoIniciar(cwd: string, template: TemplateIniciar): Promise<number> {
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
  } else if (template === "nextjs-consumer") {
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
  "fontesLegado": ["nextjs-consumer", "typescript"],
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/typescript"
  },
  "convencoesGeracaoPorProjeto": "base"
}
`,
      },
      {
        caminhoRelativo: "contratos/showroom_consumer.sema",
        conteudo: `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      ranking: Json
    }
    impl {
      ts: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "src/lib/sema_consumer_bridge.ts"
      simbolo: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "src/app/ranking/page.tsx"
      arquivo: "src/app/ranking/loading.tsx"
      arquivo: "src/app/ranking/error.tsx"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
      },
      {
        caminhoRelativo: "src/lib/sema_consumer_bridge.ts",
        conteudo: `export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}
`,
      },
      {
        caminhoRelativo: "src/app/ranking/page.tsx",
        conteudo: `import { semaFetchShowroomRanking } from "../../lib/sema_consumer_bridge";

export default async function RankingPage() {
  const { ranking } = await semaFetchShowroomRanking();

  return (
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        {ranking.map((item) => (
          <li key={item.clube}>
            {item.clube} - {item.pontos} pts
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
      },
      {
        caminhoRelativo: "src/app/ranking/loading.tsx",
        conteudo: `export default function Loading() {
  return <p>Carregando ranking...</p>;
}
`,
      },
      {
        caminhoRelativo: "src/app/ranking/error.tsx",
        conteudo: `"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main>
      <h1>Falha ao carregar ranking</h1>
      <p>{error.message}</p>
      <button type="button" onClick={reset}>Tentar novamente</button>
    </main>
  );
}
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter Next.js Consumer + Sema

- Contratos em \`contratos/\`
- Bridge consumer canonico em \`src/lib/sema_consumer_bridge.ts\`
- Superficies App Router em \`src/app/\`
- O slice oficial desta fase e \`consumer bridge + App Router surfaces\`
- \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual drift
`,
      },
    ];
  } else if (template === "react-vite-consumer") {
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
  "fontesLegado": ["react-vite-consumer", "typescript"],
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/typescript"
  },
  "convencoesGeracaoPorProjeto": "base"
}
`,
      },
      {
        caminhoRelativo: "contratos/showroom_consumer.sema",
        conteudo: `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      ranking: Json
    }
    impl {
      ts: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "src/lib/sema_consumer_bridge.ts"
      simbolo: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "src/router.tsx"
      arquivo: "src/pages/ranking.tsx"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
      },
      {
        caminhoRelativo: "src/lib/sema_consumer_bridge.ts",
        conteudo: `export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}
`,
      },
      {
        caminhoRelativo: "src/pages/ranking.tsx",
        conteudo: `import { useEffect, useState } from "react";
import { semaFetchShowroomRanking } from "../lib/sema_consumer_bridge";

export function RankingPage() {
  const [ranking, setRanking] = useState<Array<{ clube: string; pontos: number }>>([]);

  useEffect(() => {
    void semaFetchShowroomRanking().then((payload) => setRanking(payload.ranking ?? []));
  }, []);

  return (
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        {ranking.map((item) => (
          <li key={item.clube}>
            {item.clube} - {item.pontos} pts
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
      },
      {
        caminhoRelativo: "src/router.tsx",
        conteudo: `import { createBrowserRouter } from "react-router-dom";
import { RankingPage } from "./pages/ranking";

export const appRouter = createBrowserRouter([
  {
    path: "/ranking",
    Component: RankingPage,
  },
]);
`,
      },
      {
        caminhoRelativo: "src/App.tsx",
        conteudo: `import { RouterProvider } from "react-router-dom";
import { appRouter } from "./router";

export default function App() {
  return <RouterProvider router={appRouter} />;
}
`,
      },
      {
        caminhoRelativo: "src/main.tsx",
        conteudo: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter React Vite Consumer + Sema

- Contratos em \`contratos/\`
- Bridge consumer canonico em \`src/lib/sema_consumer_bridge.ts\`
- Rotas explicitas em \`src/router.tsx\`
- Superficies consumer em \`src/pages/\`
- O slice oficial desta fase e \`consumer bridge + react-router surfaces\`
- \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual drift
`,
      },
    ];
  } else if (template === "angular-consumer") {
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
  "fontesLegado": ["angular-consumer", "typescript"],
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/typescript"
  },
  "convencoesGeracaoPorProjeto": "base"
}
`,
      },
      {
        caminhoRelativo: "contratos/showroom_consumer.sema",
        conteudo: `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      ranking: Json
    }
    impl {
      ts: src.app.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "src/app/sema_consumer_bridge.ts"
      simbolo: src.app.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "src/app/app.routes.ts"
      arquivo: "src/app/features/ranking/ranking.routes.ts"
      arquivo: "src/app/features/ranking/ranking-page.component.ts"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
      },
      {
        caminhoRelativo: "src/app/sema_consumer_bridge.ts",
        conteudo: `export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}
`,
      },
      {
        caminhoRelativo: "src/app/app.routes.ts",
        conteudo: `import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "ranking",
    loadChildren: () => import("./features/ranking/ranking.routes").then((m) => m.RANKING_ROUTES),
  },
];
`,
      },
      {
        caminhoRelativo: "src/app/features/ranking/ranking.routes.ts",
        conteudo: `import { Routes } from "@angular/router";

export const RANKING_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () => import("./ranking-page.component").then((m) => m.RankingPageComponent),
  },
];
`,
      },
      {
        caminhoRelativo: "src/app/features/ranking/ranking-page.component.ts",
        conteudo: `import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { semaFetchShowroomRanking } from "../../sema_consumer_bridge";

@Component({
  selector: "app-ranking-page",
  standalone: true,
  imports: [CommonModule],
  template: \`
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        <li *ngFor="let item of ranking">
          {{ item.clube }} - {{ item.pontos }} pts
        </li>
      </ul>
    </main>
  \`,
})
export class RankingPageComponent implements OnInit {
  ranking: Array<{ clube: string; pontos: number }> = [];

  async ngOnInit() {
    const payload = await semaFetchShowroomRanking();
    this.ranking = payload.ranking ?? [];
  }
}
`,
      },
      {
        caminhoRelativo: "src/app/app.component.ts",
        conteudo: `import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: "<router-outlet />",
})
export class AppComponent {}
`,
      },
      {
        caminhoRelativo: "src/main.ts",
        conteudo: `import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";

void bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)],
});
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter Angular Consumer + Sema

- Contratos em \`contratos/\`
- Bridge consumer canonico em \`src/app/sema_consumer_bridge.ts\`
- Rotas lazy em \`src/app/app.routes.ts\`
- Feature folders em \`src/app/features/\`
- O slice oficial desta fase e \`consumer bridge + route config surfaces\`
- \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual drift
`,
      },
    ];
  } else if (template === "flutter-consumer") {
    arquivos = [
      {
        caminhoRelativo: "sema.config.json",
        conteudo: `{
  "origens": ["./contratos"],
  "saida": "./generated",
  "alvos": ["dart"],
  "alvoPadrao": "dart",
  "estruturaSaida": "modulos",
  "framework": "base",
  "modoEstrito": true,
  "diretoriosCodigo": ["./lib"],
  "fontesLegado": ["flutter-consumer", "dart"],
  "diretoriosSaidaPorAlvo": {
    "dart": "./generated/dart"
  },
  "convencoesGeracaoPorProjeto": "base"
}
`,
      },
      {
        caminhoRelativo: "pubspec.yaml",
        conteudo: `name: sema_flutter_consumer
description: Starter Flutter consumer IA-first com Sema
publish_to: "none"

environment:
  sdk: ">=3.3.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  go_router: ^14.0.0
`,
      },
      {
        caminhoRelativo: "contratos/showroom_consumer.sema",
        conteudo: `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      resultado: Json
    }
    impl {
      dart: lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "lib/sema_consumer_bridge.dart"
      simbolo: lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "lib/router.dart"
      arquivo: "lib/screens/ranking_screen.dart"
    }
    guarantees {
      resultado existe
    }
  }
}
`,
      },
      {
        caminhoRelativo: "lib/sema_consumer_bridge.dart",
        conteudo: `Future<Map<String, dynamic>> semaFetchShowroomRanking() async {
  return {
    "ranking": [
      {"clube": "Tigres do Norte", "pontos": 33},
      {"clube": "Porto Azul", "pontos": 31},
      {"clube": "Galo de Ouro", "pontos": 28},
    ],
  };
}
`,
      },
      {
        caminhoRelativo: "lib/router.dart",
        conteudo: `import "package:go_router/go_router.dart";
import "package:flutter/widgets.dart";
import "screens/ranking_screen.dart";

final appRouter = GoRouter(
  routes: [
    GoRoute(
      path: "/ranking",
      builder: (BuildContext context, GoRouterState state) => const RankingScreen(),
    ),
  ],
);
`,
      },
      {
        caminhoRelativo: "lib/screens/ranking_screen.dart",
        conteudo: `import "package:flutter/widgets.dart";
import "../sema_consumer_bridge.dart";

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  List<Map<String, dynamic>> ranking = const [];

  @override
  void initState() {
    super.initState();
    semaFetchShowroomRanking().then((payload) {
      final itens = (payload["ranking"] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (!mounted) return;
      setState(() {
        ranking = itens;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text("Ranking showroom"),
        ),
        ...ranking.map((item) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text("\${item["clube"]} - \${item["pontos"]} pts"),
        )),
      ],
    );
  }
}
`,
      },
      {
        caminhoRelativo: "lib/main.dart",
        conteudo: `import "package:flutter/material.dart";
import "router.dart";

void main() {
  runApp(const ShowroomApp());
}

class ShowroomApp extends StatelessWidget {
  const ShowroomApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      routerConfig: appRouter,
    );
  }
}
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter Flutter Consumer + Sema

- Contratos em \`contratos/\`
- Bridge consumer canonico em \`lib/sema_consumer_bridge.dart\`
- Rotas consumer em \`lib/router.dart\`
- Superficies consumer em \`lib/screens/\`
- O slice oficial desta fase e \`consumer bridge + router/screen surfaces\`
- \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual diff
`,
      },
    ];
  } else if (template === "node-firebase-worker") {
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
  "fontesLegado": ["firebase", "typescript"],
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/typescript"
  },
  "convencoesGeracaoPorProjeto": "base"
}
`,
      },
      {
        caminhoRelativo: "contratos/worker_runtime.sema",
        conteudo: `module worker.runtime {
  task publicar_payload_health {
    output {
      status: Texto
      timestamp: Texto
    }
    effects {
      evento payload_health criticidade = alta
    }
    impl {
      ts: src.sema_contract_bridge.semaWorkerHealthPayload
    }
    guarantees {
      status existe
      timestamp existe
    }
  }

  task inventariar_colecoes {
    output {
      collections: Json
    }
    effects {
      consulta runtime criticidade = baixa
    }
    impl {
      ts: src.sema_contract_bridge.semaCollectionNames
    }
    guarantees {
      collections existe
    }
  }

  route get_health_worker {
    metodo: GET
    caminho: /health
    task: publicar_payload_health
  }
}
`,
      },
      {
        caminhoRelativo: "src/config/collections.ts",
        conteudo: `export const COLLECTIONS = {
  worker_status: "worker_status",
  audit_log: "audit_log",
} as const;
`,
      },
      {
        caminhoRelativo: "src/services/health-check.ts",
        conteudo: `import http from "node:http";

export type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy" | "initializing";
  timestamp: string;
};

export type HealthProvider = () => HealthStatus;

export function startHealthCheckServer(port: number, provider: HealthProvider) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(provider()));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port);
  return server;
}
`,
      },
      {
        caminhoRelativo: "src/sema_contract_bridge.ts",
        conteudo: `import { COLLECTIONS } from "./config/collections";
import { startHealthCheckServer, type HealthProvider, type HealthStatus } from "./services/health-check";

export function semaStartWorkerHealthServer(port: number, provider: HealthProvider) {
  return startHealthCheckServer(port, provider);
}

export function semaWorkerHealthPayload(payload: HealthStatus): HealthStatus {
  return payload;
}

export function semaCollectionNames() {
  return COLLECTIONS;
}
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter Node Firebase Worker + Sema

- Contratos em \`contratos/\`
- Worker e bridges em \`src/\`
- \`drift\` valida impl, endpoint de health e recursos Firestore declarados
`,
      },
    ];
  } else if (template === "aspnet-api") {
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
  "fontesLegado": ["dotnet"],
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
  task get_health {
    output {
      status: Texto
      runtime: Texto
    }
    impl {
      cs: src.Controllers.HealthController.Get
    }
    guarantees {
      status existe
      runtime existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: /api/health
    task: get_health
  }
}
`,
      },
      {
        caminhoRelativo: "src/Controllers/HealthController.cs",
        conteudo: `using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public object Get()
    {
        return new { status = "ok", runtime = "aspnet" };
    }
}
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter ASP.NET Core API + Sema

- Contratos em \`contratos/\`
- Controllers/Minimal API em \`src/\`
- \`drift\` valida impl e rota publica
`,
      },
    ];
  } else if (template === "springboot-api") {
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
  "fontesLegado": ["java"],
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
  task get_health {
    output {
      status: Texto
      runtime: Texto
    }
    impl {
      java: src.main.java.com.acme.health.HealthController.health
    }
    guarantees {
      status existe
      runtime existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: /api/health
    task: get_health
  }
}
`,
      },
      {
        caminhoRelativo: "src/main/java/com/acme/health/HealthController.java",
        conteudo: `package com.acme.health;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "ok", "runtime", "spring");
    }
}
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter Spring Boot API + Sema

- Contratos em \`contratos/\`
- Controllers REST em \`src/main/java/\`
- \`drift\` valida impl e rota publica
`,
      },
    ];
  } else if (template === "go-http-api") {
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
  "diretoriosCodigo": ["./internal"],
  "fontesLegado": ["go"],
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
  task get_health {
    output {
      resultado: Json
    }
    impl {
      go: internal.health.getHealth
    }
    guarantees {
      resultado existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: /health
    task: get_health
  }
}
`,
      },
      {
        caminhoRelativo: "internal/health.go",
        conteudo: `package internal

import "github.com/gin-gonic/gin"

func registerRoutes(router *gin.Engine) {
    router.GET("/health", getHealth)
}

func getHealth(ctx *gin.Context) {
    ctx.JSON(200, gin.H{"status": "ok", "runtime": "go"})
}
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter Go HTTP API + Sema

- Contratos em \`contratos/\`
- Handlers em \`internal/\`
- \`drift\` valida impl e rota publica
`,
      },
    ];
  } else if (template === "rust-axum-api") {
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
  "fontesLegado": ["rust"],
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
  task get_health {
    output {
      resultado: Json
    }
    impl {
      rust: src.handlers.health
    }
    guarantees {
      resultado existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: /health
    task: get_health
  }
}
`,
      },
      {
        caminhoRelativo: "src/main.rs",
        conteudo: `use axum::{routing::get, Router};

mod handlers;

fn app() -> Router {
    Router::new().route("/health", get(handlers::health))
}
`,
      },
      {
        caminhoRelativo: "src/handlers.rs",
        conteudo: `pub async fn health() -> &'static str {
    "ok"
}
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter Rust Axum API + Sema

- Contratos em \`contratos/\`
- Handlers em \`src/\`
- \`drift\` valida impl e rota publica
`,
      },
    ];
  } else if (template === "cpp-service-bridge") {
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
  "fontesLegado": ["cpp"],
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/typescript"
  },
  "convencoesGeracaoPorProjeto": "base"
}
`,
      },
      {
        caminhoRelativo: "contratos/runtime_bridge.sema",
        conteudo: `module app.runtime_bridge {
  task processar_snapshot {
    input {
      payload: Json required
    }
    output {
      resultado: Json
    }
    impl {
      cpp: src.runtime.RuntimeBridge.processSnapshot
    }
    guarantees {
      resultado existe
    }
  }
}
`,
      },
      {
        caminhoRelativo: "src/runtime.cpp",
        conteudo: `class RuntimeBridge {
public:
    int processSnapshot(int payload) {
        return payload;
    }
};
`,
      },
      {
        caminhoRelativo: "README.md",
        conteudo: `# Starter C++ Service Bridge + Sema

- Contratos em \`contratos/\`
- Symbols e bridges em \`src/\`
- \`drift\` valida impl de simbolos, sem prometer rota HTTP
`,
      },
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
      baseProjeto: contextoProjeto.baseProjeto,
      framework,
      estruturaSaida,
      alvos,
      saidas,
      origens: contextoProjeto.origensProjeto,
      diretoriosCodigo: contextoProjeto.diretoriosCodigo,
      fontesLegado: contextoProjeto.fontesLegado,
      modoAdocao: contextoProjeto.modoAdocao,
      scoreDrift: resultadoDrift.resumo_operacional.scoreMedio,
      confiancaGeral: resultadoDrift.resumo_operacional.confiancaGeral,
      consumerFramework: resultadoDrift.consumerFramework,
      appRoutes: resultadoDrift.appRoutes,
      consumerSurfaces: resultadoDrift.consumerSurfaces,
      consumerBridges: resultadoDrift.consumerBridges,
    },
    projeto: {
      arquivos: contextoProjeto.arquivosProjeto,
      modulos: contextoProjeto.modulosSelecionados.map((item) => ({
        caminho: item.caminho,
        modulo: item.resultado.modulo?.nome ?? null,
        sucesso: !temErros(item.resultado.diagnosticos),
        diagnosticos: item.resultado.diagnosticos.length,
        superficies: item.resultado.ir?.superficies.map((superficie) => `${superficie.tipo}:${superficie.nome}`) ?? [],
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
  console.log(`- Base do projeto: ${payload.configuracao.baseProjeto}`);
  console.log(`- Framework: ${payload.configuracao.framework}`);
  console.log(`- Estrutura de saida: ${payload.configuracao.estruturaSaida}`);
  console.log(`- Alvos: ${payload.configuracao.alvos.join(", ")}`);
  console.log(`- Modo de adocao: ${payload.configuracao.modoAdocao}`);
  console.log(`- Score medio de drift: ${payload.configuracao.scoreDrift}`);
  console.log(`- Confianca geral: ${payload.configuracao.confiancaGeral}`);
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
    console.log(`    impls validos=${modulo.implementacao.implsValidos} quebrados=${modulo.implementacao.implsQuebrados} recursos divergentes=${modulo.implementacao.recursosDivergentesCount} sem_impl=${modulo.implementacao.tasksSemImplementacao}`);
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
  console.log(`- Vinculos validos: ${resultado.vinculos_validos.length}`);
  console.log(`- Vinculos quebrados: ${resultado.vinculos_quebrados.length}`);
  console.log(`- Rotas divergentes: ${resultado.rotas_divergentes.length}`);
  console.log(`- Recursos vivos validos: ${resultado.recursos_validos.length}`);
  console.log(`- Recursos vivos divergentes: ${resultado.recursos_divergentes.length}`);
  console.log(`- Score medio: ${resultado.resumo_operacional.scoreMedio}`);
  console.log(`- Confianca geral: ${resultado.resumo_operacional.confiancaGeral}`);

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

  if (resultado.recursos_divergentes.length > 0) {
    console.log("- Recursos divergentes:");
    for (const recurso of resultado.recursos_divergentes) {
      console.log(`  - ${recurso.modulo}.${recurso.task} :: ${recurso.categoria} ${recurso.alvo}`);
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

  if (resultado.vinculos_quebrados.length > 0) {
    console.log("- Vinculos quebrados:");
    for (const vinculo of resultado.vinculos_quebrados) {
      console.log(`  - ${vinculo.modulo}.${vinculo.dono} :: ${vinculo.tipo}=${vinculo.valor}`);
    }
  }

  if (resultado.resumo_operacional.oQueTocar.length > 0) {
    console.log("- O que tocar primeiro:");
    for (const alvo of resultado.resumo_operacional.oQueTocar.slice(0, 8)) {
      console.log(`  - ${alvo}`);
    }
  }

  if (resultado.resumo_operacional.oQueValidar.length > 0) {
    console.log("- O que validar:");
    for (const check of resultado.resumo_operacional.oQueValidar.slice(0, 8)) {
      console.log(`  - ${check}`);
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

async function comandoSyncAiEntrypoints(emJson: boolean): Promise<number> {
  const resumoProjeto = await gerarResumoProjetoIa(process.cwd(), undefined, true);
  const indexJson = JSON.parse(await readFile(path.join(resumoProjeto.pastaSaida, "SEMA_INDEX.json"), "utf8"));
  const artefatos = [...new Set([
    ...ARQUIVOS_CANONICOS_IA_RAIZ,
    ...resumoProjeto.artefatos,
  ])];

  if (emJson) {
    console.log(JSON.stringify({
      comando: "sync-ai-entrypoints",
      sucesso: true,
      baseProjeto: resumoProjeto.baseProjeto,
      pastaSaida: resumoProjeto.pastaSaida,
      artefatos,
      entradaCanonica: indexJson.entradaCanonica,
    }, null, 2));
    return 0;
  }

  console.log("Entrypoints IA-first sincronizados");
  console.log("");
  console.log(`Base do projeto: ${resumoProjeto.baseProjeto}`);
  console.log(`Ordem canonica: ${indexJson.entradaCanonica.ordemLeitura.join(" -> ")}`);
  console.log(`IA pequena: ${indexJson.entradaCanonica.porCapacidade.pequena.join(" -> ")}`);
  console.log(`IA media: ${indexJson.entradaCanonica.porCapacidade.media.join(" -> ")}`);
  console.log(`IA grande: ${indexJson.entradaCanonica.porCapacidade.grande.join(" -> ")}`);
  return 0;
}

async function comandoAjudaIa(): Promise<number> {
  const descoberta = await descobrirDocsIa();
  console.log("Ajuda de IA da Sema");
  console.log("");
  console.log(renderizarCaixaAscii([
    "IA-first para greenfield, edicao guiada e legado sem contrato inicial",
    "use o menor artefato semantico que resolva a tarefa",
  ]));
  console.log("");
  console.log(renderizarCabecalhoDocsIa(descoberta));
  console.log("");
  console.log(renderizarSecaoAscii("Tres jeitos de usar a Sema", [
    "[1] Producao inicial: modele, valide, compile e verifique antes de subir codigo derivado.",
    "[2] Edicao em projeto com Sema: inspecione, leia resumo, rode drift e gere contexto antes de editar codigo vivo.",
    "[3] Projeto sem Sema ainda: importe, revise o rascunho, formate, valide e use drift como juiz da adocao incremental.",
  ]));
  console.log("");
  console.log(renderizarSecaoAscii("Capacidade de IA", [
    "pequena: `sema resumo --micro`, `briefing.min.json`, `prompt-curto.txt`",
    "media: `sema resumo --curto`, `drift.json`, `briefing.min.json`",
    "grande: `sema contexto-ia`, `briefing.json`, `ir.json`, `ast.json`",
  ]));
  console.log("");
  console.log(renderizarSecaoAscii("Fluxo recomendado", [
    "Use `sema starter-ia` para um texto curto de onboarding.",
    "Use `sema sync-ai-entrypoints` para regenerar `SEMA_BRIEF.*` e `SEMA_INDEX.json` na raiz.",
    "Use `sema resumo <arquivo> --micro --para onboarding` para IA pequena.",
    "Use `sema prompt-curto <arquivo> --curto --para mudanca` para colar contexto em modelo gratuito.",
    "Use `sema prompt-ia`, `sema prompt-ia-ui`, `sema prompt-ia-react` e `sema prompt-ia-sema-primeiro` conforme a tarefa.",
    "Use `sema exemplos-prompt-ia` para pegar modelos prontos de prompt.",
    "Use `sema inspecionar` para descobrir base, codigo vivo e fontes legado.",
    "Use `sema drift` para medir impls, vinculos, rotas, score e lacunas.",
    "Use `sema contexto-ia <arquivo.sema>` para gerar AST, IR, drift, `briefing.json` e `briefing.min.json`.",
      "Use `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua> --saida <diretorio>` quando a tarefa pedir codigo derivado.",
  ]));
  console.log("");
  console.log(renderizarSecaoAscii("Regras praticas", [
    "Foi feita para IA operar melhor; leitura humana e consequencia, nao centro de produto.",
    "Governa contrato, intencao, erro, efeito, garantia, fluxo, vinculos e execucao.",
    "Nao escreve contrato final sozinho nem substitui decisao arquitetural.",
    "Se voce quer testar a Sema de verdade, nao peca so HTML solto.",
    "Peca `.sema` + arquitetura + React + TypeScript, ou use o modo `Sema primeiro`.",
    "Se o projeto ja existe, trate `importar` como rascunho e `drift` como juiz.",
    "IA pequena comeca no menor artefato que resolve a tarefa; nao enfie `ast.json` inteiro nela de bobeira.",
    "Antes de editar software vivo, leia `briefing.min.json` ou `briefing.json` em vez de sair cavando arquivo na fe.",
    "Trate `route`, `worker`, `evento`, `fila`, `cron`, `webhook`, `cache`, `storage` e `policy` como superficies de primeira classe.",
  ]));
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

async function comandoResumo(
  entrada: string | undefined,
  args: string[],
  emJson: boolean,
): Promise<number> {
  const tamanho = normalizarTamanhoResumo(args);
  const modo = normalizarModoResumo(obterOpcao(args, "--para"));
  const pastaSaida = obterOpcao(args, "--saida");
  const escreverNaRaiz = possuiFlag(args, "--raiz");
  const alvo = entrada ? path.resolve(process.cwd(), entrada) : process.cwd();

  if (entrada && entrada.toLowerCase().endsWith(".sema")) {
    const contexto = await carregarContextoModuloIa(alvo);
    const resumoSemantico = coletarResumoSemanticoModulo(contexto);
    const guiaPorCapacidade = criarGuiaCapacidadeIa();
    const texto = tamanho === "medio"
      ? renderizarResumoModuloMarkdown(resumoSemantico, modo, guiaPorCapacidade)
      : renderizarResumoModuloTexto(resumoSemantico, tamanho, modo);

    let pastaResumo: string | undefined;
    let artefatosCompactos: string[] = [];
    if (pastaSaida) {
      pastaResumo = path.resolve(pastaSaida);
      await mkdir(pastaResumo, { recursive: true });
      const gerado = await gerarArquivosResumoModuloIa(contexto, pastaResumo);
      artefatosCompactos = gerado.artefatosCompactos;
    }

    if (emJson) {
      console.log(JSON.stringify({
        comando: "resumo",
        modo,
        tamanho,
        geradoEm: contexto.geradoEm,
        arquivo: contexto.arquivo,
        modulo: contexto.modulo,
        pastaSaida: pastaResumo ?? null,
        artefatosCompactos,
        guiaPorCapacidade,
        resumo: resumoSemantico,
        texto,
      }, null, 2));
      return 0;
    }

    if (pastaResumo) {
      console.log(`Resumo IA-first gerado em ${pastaResumo}`);
      console.log("");
    }
    console.log(texto);
    return 0;
  }

  const resumoProjeto = await gerarResumoProjetoIa(alvo, pastaSaida, escreverNaRaiz);
  const arquivoResumo = tamanho === "micro"
    ? "SEMA_BRIEF.micro.txt"
    : tamanho === "curto"
      ? "SEMA_BRIEF.curto.txt"
      : "SEMA_BRIEF.md";
  const texto = await readFile(path.join(resumoProjeto.pastaSaida, arquivoResumo), "utf8");

  if (emJson) {
    console.log(JSON.stringify({
      comando: "resumo",
      modo,
      tamanho,
      geradoEm: resumoProjeto.geradoEm,
      baseProjeto: resumoProjeto.baseProjeto,
      pastaSaida: resumoProjeto.pastaSaida,
      artefatos: resumoProjeto.artefatos,
      guiaPorCapacidade: resumoProjeto.guiaPorCapacidade,
      modulos: resumoProjeto.modulos,
      texto,
    }, null, 2));
    return 0;
  }

  console.log(`Resumo IA-first do projeto gerado em ${resumoProjeto.pastaSaida}`);
  console.log("");
  console.log(texto);
  return 0;
}

async function comandoPromptCurto(
  entrada: string | undefined,
  args: string[],
  emJson: boolean,
): Promise<number> {
  const tamanho = normalizarTamanhoResumo(args);
  const modo = normalizarModoResumo(obterOpcao(args, "--para"));
  const alvo = entrada ? path.resolve(process.cwd(), entrada) : process.cwd();

  if (entrada && entrada.toLowerCase().endsWith(".sema")) {
    const contexto = await carregarContextoModuloIa(alvo);
    const resumoSemantico = coletarResumoSemanticoModulo(contexto);
    const capacidade: CapacidadeIa = tamanho === "micro" ? "pequena" : tamanho === "curto" ? "media" : "grande";
    const prompt = criarPromptCurtoModulo(resumoSemantico, modo, tamanho, capacidade);

    if (emJson) {
      console.log(JSON.stringify({
        comando: "prompt-curto",
        modo,
        tamanho,
        capacidade,
        geradoEm: contexto.geradoEm,
        arquivo: contexto.arquivo,
        modulo: contexto.modulo,
        prompt,
      }, null, 2));
      return 0;
    }

    console.log(prompt);
    return 0;
  }

  const resumoProjeto = await gerarResumoProjetoIa(alvo);
  const arquivoResumo = tamanho === "micro"
    ? "SEMA_BRIEF.micro.txt"
    : tamanho === "curto"
      ? "SEMA_BRIEF.curto.txt"
      : "SEMA_BRIEF.md";
  const contextoProjeto = await readFile(path.join(resumoProjeto.pastaSaida, arquivoResumo), "utf8");
  const capacidade: CapacidadeIa = tamanho === "micro" ? "pequena" : tamanho === "curto" ? "media" : "grande";
  const prompt = `Voce esta operando Sema em modo IA-first.

Isto nao e material feito para humano; e contexto comprimido para IA.

Capacidade alvo: ${capacidade}
Modo da tarefa: ${modo}

Regras:
- comece pelo resumo compacto abaixo
- se a tarefa pedir mais contexto, abra \`SEMA_INDEX.json\`
- nao tente ler o repo inteiro se o resumo ja disser onde tocar
- preserve contrato, risco, lacuna e checks sugeridos

Contexto do projeto:
${contextoProjeto.trim()}
`;

  if (emJson) {
    console.log(JSON.stringify({
      comando: "prompt-curto",
      modo,
      tamanho,
      capacidade,
      geradoEm: resumoProjeto.geradoEm,
      baseProjeto: resumoProjeto.baseProjeto,
      pastaSaida: resumoProjeto.pastaSaida,
      prompt,
    }, null, 2));
    return 0;
  }

  console.log(prompt);
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
  const execucao = executarTestesGerados(alvo, saida, arquivos);
  if (execucao.codigoSaida !== 0) {
    if (execucao.saidaPadrao) {
      console.log(execucao.saidaPadrao);
    }
    if (execucao.saidaErro) {
      console.error(execucao.saidaErro);
    }
  }
  return execucao.codigoSaida;
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
  const comandoCru = process.argv[2];
  if (comandoCru === "--versao" || comandoCru === "--version" || comandoCru === "-v") {
    console.log(VERSAO_CLI);
    process.exit(0);
  }
  if (!comando || comandoCru === "--help" || comandoCru === "-h") {
    console.log(ajuda());
    process.exit(0);
  }

  const cwd = process.cwd();
  const posicionais = obterPosicionais(resto);
  let codigoSaida = 0;
  switch (comando) {
    case "iniciar":
      codigoSaida = await comandoIniciar(cwd, normalizarTemplateIniciar(obterOpcao(resto, "--template")));
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
      console.error("Uso: sema importar <nestjs|fastapi|flask|nextjs|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|firebase|dotnet|java|go|rust|cpp|typescript|python|dart|lua> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]");
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
    case "doctor":
      codigoSaida = await comandoDoctor();
      break;
    case "ajuda-ia":
      codigoSaida = await comandoAjudaIa();
      break;
    case "starter-ia":
      codigoSaida = await comandoStarterIa();
      break;
    case "sync-ai-entrypoints":
      codigoSaida = await comandoSyncAiEntrypoints(possuiFlag(resto, "--json"));
      break;
    case "resumo":
      codigoSaida = await comandoResumo(
        posicionais[0],
        resto,
        possuiFlag(resto, "--json"),
      );
      break;
    case "prompt-curto":
      codigoSaida = await comandoPromptCurto(
        posicionais[0],
        resto,
        possuiFlag(resto, "--json"),
      );
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
