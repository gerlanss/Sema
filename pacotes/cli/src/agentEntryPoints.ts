// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.entrypoints
// Descrição: renderiza e sincroniza instruções curtas para agentes de IDE e clientes com disciplina variável.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_AVISO_LINHAS_CONTRATO_SEMA,
  LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA,
} from './driftOrcamento.js';
import {
  ARQUIVO_AGENT_CONTEXT_PACK,
  ARQUIVO_SEMA_BOOT,
  ARQUIVO_SEMA_SMALL_MODEL,
  type AgentContextPack,
  type CapacidadeIa,
  type EntryPointClienteIa,
} from './agentContextTipos.js';
import { LIMITE_CARACTERES_PAYLOAD_INLINE } from './agentContextPack.js';

const MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO = '<!-- sema:agent-entrypoint:start -->';
const MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM = '<!-- sema:agent-entrypoint:end -->';

async function statSeguro(caminho: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(caminho);
  } catch {
    return null;
  }
}

function pareceEntradaSemaLegada(conteudo: string): boolean {
  return /Sema.*Regras obrigat[oó]rias para IA/is.test(conteudo) ||
    /Sema.*Regras obrigatorias para IA/is.test(conteudo) ||
    /Sema.*Regras obrigatórias para IA/is.test(conteudo);
}

function montarBlocoGerenciadoSema(conteudo: string): string {
  return `${MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO}\n${conteudo.trim()}\n${MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM}\n`;
}

async function escreverArquivoGerenciadoSema(
  caminho: string,
  conteudo: string,
  substituirLegadoSema = false,
): Promise<"criado" | "atualizado" | "preservado"> {
  const bloco = montarBlocoGerenciadoSema(conteudo);
  const atual = await statSeguro(caminho);
  if (!atual) {
    await mkdir(path.dirname(caminho), { recursive: true });
    await writeFile(caminho, bloco, "utf8");
    return "criado";
  }
  if (!atual.isFile()) {
    return "preservado";
  }

  const textoAtual = await readFile(caminho, "utf8");
  let proximo: string;
  if (textoAtual.includes(MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO) && textoAtual.includes(MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM)) {
    const inicio = textoAtual.indexOf(MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO);
    const fim = textoAtual.indexOf(MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM, inicio) + MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM.length;
    proximo = `${textoAtual.slice(0, inicio)}${bloco.trimEnd()}${textoAtual.slice(fim)}`;
  } else if (substituirLegadoSema && pareceEntradaSemaLegada(textoAtual)) {
    proximo = bloco;
  } else {
    proximo = `${bloco}\n${textoAtual.trimStart()}`;
  }

  if (proximo === textoAtual) {
    return "preservado";
  }
  await writeFile(caminho, proximo.endsWith("\n") ? proximo : `${proximo}\n`, "utf8");
  return "atualizado";
}

export function renderizarSemaBoot(agentContextPack: AgentContextPack): string {
  const politica = agentContextPack.politicaIdioma;
  const politicaCodigo = agentContextPack.politicaCodigoGovernado;
  const politicaTimeout = agentContextPack.politicaTimeoutResumo;
  const politicaDesign = agentContextPack.politicaDesignVisual;
  const politicaPlataforma = agentContextPack.politicaPlataforma;
  return `# SEMA_BOOT

Você está em um projeto governado por Sema. O contrato semântico vem antes de qualquer ação.

## Primeira ação

1. Em IDE local, confirme \`AGENTS.md\` na raiz e rode \`sema --version\`; se o comando não existir, pare. A IA não acessa o painel Sema: peça ao humano para instalar a CLI pelo painel.
2. Chame \`sema preflight resumo --json\`; se \`decisao\` não for \`use_cli_local\`, pare bloqueado.
3. Use a CLI local para ler o workspace: \`sema resumo\`, \`sema docs-impacto\`, \`sema inspecionar\`, \`sema drift\` e \`sema impacto\`.
4. Não use fonte externa de workspace para substituir a CLI local quando a CLI estiver operacional.
5. Este boot é para workspace local em disco; se não houver workspace local, pare bloqueado em vez de inventar caminho.
6. Antes de criar módulo, rota, task ou contrato, inspecione o contrato \`.sema\` aplicável.
7. Antes de editar código existente, rode drift e impacto pelo caminho autorizado da superfície atual.
8. Antes de criar ou corrigir \`.sema\`, use \`sema exemplos\` na CLI local.
9. Se qualquer etapa falhar, pare e diga que está bloqueado.

Não substitua esse fluxo por leitura manual de \`AGENTS.md\`, \`README.md\`, busca local, inferência pelo nome do projeto, bom senso ou ferramenta não citada aqui.

## Políticas da plataforma

${politicaPlataforma.regra}

- Escopo: ${politicaPlataforma.escopoGovernanca}
- Se houver alerta externo: ${politicaPlataforma.quandoHouverBloqueio}
- IA fraca: ${politicaPlataforma.porCapacidade.fraca}
- IA média: ${politicaPlataforma.porCapacidade.media}
- IA forte: ${politicaPlataforma.porCapacidade.forte}

## Capacidade do agente

- Fraca: leia \`${ARQUIVO_SEMA_SMALL_MODEL}\`, \`SEMA_BRIEF.micro.txt\`, \`${ARQUIVO_AGENT_CONTEXT_PACK}\` e só suba contexto se necessário.
- Média: leia este boot, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_BRIEF.curto.txt\`, \`SEMA_INDEX.json\` e a doc indicada pelo Sema.
- Forte: leia este boot, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_BRIEF.md\`, \`SEMA_INDEX.json\`, \`AGENTS.md\` e rode os gates completos.

## Código governado

${politicaCodigo.regra}

- Marcador: \`${politicaCodigo.marcador}\`.
- Orçamento de código: arquivo governado acima de ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO} linhas gera diagnóstico; acima de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO} bloqueia conclusão, geração e snapshot. Documentação Markdown não entra nesse limite de código.
- Orçamento de contrato .sema: até ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} linhas é saudável; ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA + 1}-${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} é diagnóstico; acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} bloqueia criação, edição, drift, finalização, geração e snapshot.
- Divida .sema por domínio/capacidade, nunca parte_1/parte_2. Um mesmo arquivo de código pode ter vários contratos governando via vinculos; preserve essa rastreabilidade no Sema Código.
- Payload inline: acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres em \`arquivos_codigo.conteudo\` ou \`conteudo\` não é timeout; divida por responsabilidade ou use anexo/caminho de servidor autorizado.
- Validação inline com score alto não substitui cabeçalho no arquivo físico: ela prova o payload enviado, não prepara a próxima IA que vai abrir o arquivo depois.
- Divisão correta é por responsabilidade real. Exemplo web: \`index.html\` para estrutura, \`styles/*.css\` para estilos, \`js/state.js\`, \`js/calc.js\`, \`js/render/*.js\` para comportamento, e \`data/*.json\` para dados.
- Proibido fatiar arquivo em \`index_p1.html\`, \`index_p2.html\` ou similares sem fronteira semântica só para passar no limite.
- IA fraca: ${politicaCodigo.porCapacidade.fraca}
- IA média: ${politicaCodigo.porCapacidade.media}
- IA forte: ${politicaCodigo.porCapacidade.forte}

## Sinal, evidência e ritual

Score composto, \`achados[]\` e \`decisaoAgente\` são sinais para guiar a próxima ação. Abaixo de 80 bloqueia; alvo evolui 0.5 ponto até 100; nada disso basta sozinho.

- Fraca: se o score passou, confira se cada achado tem evidência concreta; se não souber provar, pare.
- Média: conecte regra, arquivo, contrato e evidência antes de concluir aderência.
- Forte: não transforme regex, palavra-chave ou score 100 em ritual vazio; valide substância, risco e comportamento.
- Fechamento governado: se \`sema drift --json\` retornar \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\` ou impls quebradas, não diga que passou limpo. Corrija e rode drift de novo.
- Experiência governada: se a tarefa cria ou altera site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, prove acabamento moderno, contextual e não genérico. Em UI estreita (ex. 390px), \`document.documentElement.scrollWidth <= document.documentElement.clientWidth\` precisa ser verdadeiro.
- Caminho fora do workspace local aberto pelo usuário não substitui a pasta local.

## Acabamento visual e terminal

${politicaDesign.regra}

- Aplicar quando: ${politicaDesign.aplicarQuando}
- IA fraca: ${politicaDesign.porCapacidade.fraca}
- IA média: ${politicaDesign.porCapacidade.media}
- IA forte: ${politicaDesign.porCapacidade.forte}
- Proibido: ${politicaDesign.proibicoes.slice(0, 5).join(", ")}.

## Timeout e retry

${politicaTimeout.regra}

- Timeout inicial recomendado para projeto inteiro: ${politicaTimeout.timeoutInicialSegundos}s.
- Escalonamento: ${politicaTimeout.escalonamentoSegundos.map((segundos) => `${segundos}s`).join(" -> ")}.
- IA fraca: ${politicaTimeout.porCapacidade.fraca}
- IA média: ${politicaTimeout.porCapacidade.media}
- IA forte: ${politicaTimeout.porCapacidade.forte}
- ${politicaTimeout.ateQuandoTentar}

## Idioma humano

${politica.regra}

- Use o idioma falado pelo usuário.
- Em PT-BR, escreva com acentos, cedilha e pontuação normal.
- Use vocabulário Sema canônico para conceitos de produto: pontuação, desvio semântico, trava, pré-checagem, ambiente de execução e perfil.
- Não traduza comandos, rotas, nomes de arquivos, endpoints, variáveis, pacotes, marcas, símbolos de código nem palavras-chave da DSL.

## Falha fechada

${agentContextPack.failClosed.map((regra) => `- ${regra}`).join("\n")}
`;
}

export function renderizarSemaSmallModel(agentContextPack: AgentContextPack): string {
  const politicaTimeout = agentContextPack.politicaTimeoutResumo;
  const politicaDesign = agentContextPack.politicaDesignVisual;
  const politicaPlataforma = agentContextPack.politicaPlataforma;
  return `# SEMA_SMALL_MODEL

Leia isto primeiro se você tem pouco contexto, pouca memória, pouco tool use ou tendência a ignorar instruções longas.

1. Não edite nada antes de chamar Sema.
2. Em IDE local, rode \`sema --version\`; se falhar, pare. A IA não acessa o painel Sema: peça ao humano para instalar a CLI pelo painel. Depois rode \`sema preflight resumo --json\`; só continue com \`use_cli_local\`; não use fonte externa de workspace para substituir a CLI local.
3. Sema não contorna políticas da plataforma: ele governa contrato, escopo, drift, evidência e qualidade.
4. Se aparecer alerta de política: pare, explique de forma neutra e não tente burlar filtro.
5. Se não houver workspace local em disco: pare bloqueado e peça o fluxo apropriado; não invente leitura por caminho.
6. Se for escrever \`.sema\`: use \`sema_exemplos\` antes.
7. Se não houver contrato ou vínculo semântico do arquivo: inspecione o arquivo, crie ou edite o contrato aplicável e vincule antes do código.
8. Se não conseguir chamar Sema: pare e declare bloqueio.
9. Responda no idioma do usuário. Em PT-BR, use vocabulário Sema: pontuação, desvio semântico, pré-checagem, ambiente de execução e perfil; preserve comandos, endpoints e identificadores.
10. Se abrir código com \`${agentContextPack.politicaCodigoGovernado.marcador}\`: volte ao contrato, chame Sema e só então edite.
11. Score 100, achados atendidos ou validação inline são sinais; confira evidência real no contrato e no código.
12. Validação inline não dispensa cabeçalho \`${agentContextPack.politicaCodigoGovernado.marcador}\` no arquivo físico.
13. Não crie código governado acima de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO} linhas nem contrato .sema acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}; acima de ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO} em código ou ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} em .sema, planeje divisão por responsabilidade.
14. Divida por função real: HTML, CSS, estado, cálculo, renderização, dados. Não faça \`index_p1.html\` e \`index_p2.html\` sem sentido.
15. Payload inline acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres não é lentidão: divida por responsabilidade; não aumente timeout para tentar passar limite de transporte.
16. Se aparecer caminho que não pertence ao workspace local aberto pelo usuário, pare e confirme a fonte antes de agir.
17. Se Sema estourar por timeout local: aumente o timeout e tente de novo. Não trate isso como falha do Sema.
18. Se \`sema drift --json\` retornar \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\` ou impl quebrada, não conclua. Corrija contrato/código e rode drift de novo.
19. Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal: aplique acabamento moderno, contextual, responsivo/ergonômico, com hierarquia clara, estados e evidência. Em UI, valide mobile/desktop e prove \`scrollWidth <= clientWidth\` em viewport estreito como 390px.
20. Não substitua o contexto Sema por AGENTS.md, README.md, busca local, inferência por nome ou bom senso.

Ordem curta:

- \`${ARQUIVO_SEMA_BOOT}\`
- \`SEMA_BRIEF.micro.txt\`
- \`${ARQUIVO_AGENT_CONTEXT_PACK}\`
- \`SEMA_INDEX.json\`
- \`AGENTS.md\`

Políticas da plataforma:

- ${politicaPlataforma.regra}
- IA fraca: ${politicaPlataforma.porCapacidade.fraca}
- Se houver bloqueio externo: ${politicaPlataforma.quandoHouverBloqueio}

Timeout:

- Timeout local do agente não é falha do Sema.
- Projeto inteiro: comece com ${politicaTimeout.timeoutInicialSegundos}s ou mais.
- Escalonamento: ${politicaTimeout.escalonamentoSegundos.map((segundos) => `${segundos}s`).join(" -> ")}.
- Se o projeto inteiro for lento, escopar para \`sema resumo <arquivo.sema> --micro --para mudanca\`.
- ${politicaTimeout.ateQuandoTentar}

Acabamento visual e terminal:

- ${politicaDesign.regra}
- IA fraca: ${politicaDesign.porCapacidade.fraca}
- Evidência mínima: ${politicaDesign.evidencias.fraca.join(", ")}.
- Proibido: ${politicaDesign.proibicoes.slice(0, 5).join(", ")}.

Fail-closed:

${agentContextPack.failClosed.map((regra) => `- ${regra}`).join("\n")}
`;
}

export function renderizarDocumentoAgentesPorCapacidade(agentContextPack: AgentContextPack): string {
  const supportedCapacities = Object.keys(agentContextPack.guiaPorCapacidade).join(", ");
  return [
    "# AI Integration",
    "",
    "Sema is designed for AI agents with different context sizes and discipline",
    "levels. The public repository documents the local CLI flow only: agents run the",
    "CLI inside the project, read contracts, check drift, map impact, and close the",
    "change with evidence.",
    "",
    `Supported capacity labels: ${supportedCapacities}.`,
    "",
    "## Local-Only Rule",
    "",
    "For a local workspace, use the local CLI:",
    "",
    "```bash",
    "sema --version",
    "sema preflight resumo --json",
    "sema resumo",
    "```",
    "",
    "Continue only when preflight returns `use_cli_local`. Do not replace the local",
    "CLI with an external workspace source, external sync, or project-name guessing.",
    "",
    "## Before Editing",
    "",
    "```bash",
    "sema docs-impacto --intencao \"describe the change\" --json",
    "sema inspecionar contratos/example.sema --json",
    "sema drift contratos/example.sema --escopo modulo --json",
    "sema impacto contratos/example.sema --alvo app.example --mudanca \"describe the change\" --json",
    "```",
    "",
    "Read every document listed by `docs-impacto` before changing code, contracts,",
    "operational docs, generated artifacts, workflows, profiles, or release material.",
    "",
    "## Capacity Tiers",
    "",
    "Weak agents should start with `" + ARQUIVO_SEMA_BOOT + "`,",
    "`" + ARQUIVO_SEMA_SMALL_MODEL + "`, `SEMA_BRIEF.micro.txt`,",
    "`" + ARQUIVO_AGENT_CONTEXT_PACK + "`, and `SEMA_INDEX.json`. They should stop early",
    "when a gate is unclear.",
    "",
    "Medium agents should start with `" + ARQUIVO_SEMA_BOOT + "`,",
    "`" + ARQUIVO_AGENT_CONTEXT_PACK + "`, `SEMA_BRIEF.curto.txt`,",
    "`SEMA_INDEX.json`, and `AGENTS.md`. They must run docs-impact, drift, and",
    "impact before edits.",
    "",
    "Strong agents may consume `" + ARQUIVO_AGENT_CONTEXT_PACK + "`, `SEMA_BRIEF.md`,",
    "`SEMA_INDEX.json`, AST, IR, drift, and impact outputs, but larger context does",
    "not remove the contract-first rule.",
    "",
    "## Governed Code",
    "",
    "Generated or governed code should keep a short `SEMA-GOVERNED` marker that",
    "points back to the applicable contract. The marker is not a substitute for",
    "validation, drift, impact, or finalization gates.",
    "",
    `Governed code above ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO} lines requires a`,
    `split plan. Governed code above ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO}`,
    "lines blocks closure. Markdown documentation is not counted as governed code",
    "size, but it is still governed by documentation and publication checks.",
    "",
    "## Contract Size",
    "",
    "`.sema` contracts above " + LIMITE_AVISO_LINHAS_CONTRATO_SEMA + " lines require a",
    "split plan. Above " + LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA + " lines, do not keep",
    "editing the same contract before splitting it by real domain or capability.",
    "Never create artificial `parte_1` or `parte_2` files to hide a large contract.",
    "",
    "## Payload Size",
    "",
    "Inline payloads in `arquivos_codigo.conteudo` or `conteudo` are limited to",
    `${LIMITE_CARACTERES_PAYLOAD_INLINE} characters. That is a transport/input limit,`,
    "not an operational timeout. Split by responsibility or use an authorized file",
    "path/attachment strategy instead of increasing timeouts to push the same payload.",
    "",
    "## UI And Terminal Work",
    "",
    "When the task involves a site, app, dashboard, form, game, CLI, TUI, or any",
    "user-facing experience, closure requires evidence:",
    "",
    "- desktop and mobile validation for UI work;",
    "- no horizontal overflow on narrow mobile viewports such as 390px;",
    "- clear loading, empty, success, and error states when relevant;",
    "- structured terminal output, clear errors, help, and smoke checks for CLI/TUI",
    "  work.",
    "",
    "## Platform Policy",
    "",
    "Sema governs contract, scope, drift, evidence, and quality. It does not bypass",
    "platform policies, terms of use, permissions, security controls, or laws.",
  ].join("\n");
}

function renderizarInstrucaoClienteSema(
  cliente: EntryPointClienteIa["cliente"],
  capacidade: CapacidadeIa,
  agentContextPack: AgentContextPack,
): string {
  const guia = agentContextPack.guiaPorCapacidade[capacidade];
  const politicaTimeout = agentContextPack.politicaTimeoutResumo;
  const politicaDesign = agentContextPack.politicaDesignVisual;
  const politicaPlataforma = agentContextPack.politicaPlataforma;
  const tituloCliente = cliente === "generico" ? "agente" : cliente;
  return `# Sema para ${tituloCliente}

Este workspace é governado por Sema. Antes de qualquer ação em código, contrato, documentação operacional, workflow, profile ou deploy:

1. Leia \`${ARQUIVO_SEMA_BOOT}\`.
2. Em IDE local, rode \`sema --version\`; se falhar, pare. A IA não acessa o painel Sema: peça ao humano para instalar a CLI pelo painel. Depois rode \`sema preflight resumo --json\`; se \`decisao\` não for \`use_cli_local\`, pare.
3. Use CLI local: \`sema resumo\`, \`sema docs-impacto\`, \`sema inspecionar\`, \`sema drift\` e \`sema impacto\`.
4. Não use fonte externa de workspace para substituir a CLI local quando a CLI estiver operacional.
5. Chame docs-impacto com a intenção declarada antes de agir.
6. Chame inspecionar no contrato \`.sema\` aplicável.
7. Antes de editar código existente, rode drift e impacto.
8. Antes de criar ou editar \`.sema\`, use exemplos oficiais.
9. Ao concluir mudança de contrato, rode validar.
10. Antes de finalizar, use finalizar-mudanca com as docs lidas.

É proibido substituir esse fluxo por leitura manual de \`AGENTS.md\`, \`README.md\`, busca local por arquivos, inferência pelo nome do projeto, bom senso ou ferramenta não citada nesta lista.

Capacidade padrão deste cliente: ${capacidade}.
Ordem de leitura: ${guia.join(" -> ")}.

Políticas da plataforma:
- ${politicaPlataforma.regra}
- Capacidade ${capacidade}: ${politicaPlataforma.porCapacidade[capacidade]}
- Se houver alerta externo: ${politicaPlataforma.quandoHouverBloqueio}

Falha fechada:
${agentContextPack.failClosed.map((regra) => `- ${regra}`).join("\n")}

Timeout:
- Timeout local do agente não é falha do Sema.
- Se uma chamada Sema estourar, aumente o timeout e tente de novo antes de declarar bloqueio.
- Para projeto inteiro, comece com ${politicaTimeout.timeoutInicialSegundos}s ou mais; se for lento, escale ${politicaTimeout.escalonamentoSegundos.map((segundos) => `${segundos}s`).join(" -> ")}.
- Se possível, reduza escopo para \`sema resumo <arquivo.sema> --micro --para mudanca\`.

Código governado:
- Mantenha o marcador \`${agentContextPack.politicaCodigoGovernado.marcador}\` em código gerado ou governado.
- Ao encontrar esse marcador, volte ao contrato .sema aplicável e chame Sema antes de editar.
- Comentário de código é lembrete curto; não substitui drift, docs-impacto nem finalizar-mudanca.
- Validação inline prova o payload enviado; não dispensa o marcador no arquivo físico sincronizado.
- Payload inline acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres não deve virar retry de timeout: modularize por responsabilidade ou use anexo/caminho de servidor autorizado.
- Se um arquivo crescer, divida por responsabilidade real. Em web: \`index.html\`, \`styles/*.css\`, \`js/state.js\`, \`js/calc.js\`, \`js/render/*.js\`, \`data/*.json\`. Não fatie em p1/p2 sem fronteira semântica.

Sinal e evidência:
- Score composto, \`achados[]\` e \`decisaoAgente\` orientam a ação; abaixo de 80 bloqueia, alvo evolui 0.5 ponto até 100, e nada substitui evidência concreta.
- Palavra-chave ou regex passando não prova governança se contrato, código e comportamento não batem.
- \`sema drift --json\` com \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\` ou impls quebradas bloqueia fechamento. Não diga "drift limpo" até rodar de novo e ficar verde.
- Caminho fora do workspace local aberto pelo usuário não substitui a pasta local.

Acabamento visual e terminal:
- Se houver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, acabamento moderno, contextual e não genérico é requisito governado, não enfeite.
- Capacidade ${capacidade}: ${politicaDesign.porCapacidade[capacidade]}
- Evidências: ${politicaDesign.evidencias[capacidade].join(", ")}.
- Responsividade/ergonomia real: valide desktop/mobile e, em viewport estreito como 390px, confirme \`document.documentElement.scrollWidth <= document.documentElement.clientWidth\`; em terminal/CLI/TUI, rode smoke check de saída, erro e ajuda quando aplicável.
- Proibido: ${politicaDesign.proibicoes.slice(0, 5).join(", ")}.

Idioma:
- Responda no idioma do usuário.
- Em PT-BR, use vocabulário Sema canônico, acentos, cedilha, pontuação e símbolos normais.
- A DSL \`.sema\` pode ser ASCII; texto humano não precisa ser.
- Não traduza comandos, rotas, arquivos, endpoints, variáveis, pacotes, marcas, símbolos de código nem palavras-chave da DSL.
`;
}

function renderizarDocSintaxeSemaLocal(agentContextPack: AgentContextPack): string {
  return `# Sema Syntax for AI Agents

Use this file as a compact reference before creating or fixing \`.sema\` contracts.

## Golden Rule

Contract comes before code. Before writing \`.sema\`, read the local examples in \`exemplos/\`.

## Minimal Example

\`\`\`sema
module app.example {
  entity Item {
    fields {
      id: Id
      name: Texto
      active: Booleano
    }
  }

  task create_item {
    input {
      name: Texto required
    }
    output {
      item: Item
    }
    rules {
      name deve_ser preenchido
    }
    effects {
      persistencia Item
      auditoria item_created
    }
    guarantees {
      item existe
    }
    tests {
      caso "creates valid item" {
        given { name: "Item" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
\`\`\`

## Common Blocks

- \`docs\`: module summary and notes.
- \`entity\`: domain model.
- \`task\`: governed operation.
- \`input\` and \`output\`: input and output contracts.
- \`rules\`: validations and business rules.
- \`effects\`: persistence, reads, events, audit, and external calls.
- \`guarantees\`: what the task must provide after success.
- \`error\`: named errors and messages.
- \`tests\`: minimal behavior examples.
- \`route\`: public surface linked to a task.
- \`impl\` and \`vinculos\`: links between the contract and real code.

## Canonical \`use\` and \`impl\` Origins

Use these origins before inventing a new one:

- \`ts\` ou \`typescript\`
- \`js\` ou \`javascript\`
- \`py\` ou \`python\`
- \`dart\`
- \`lua\`
- \`cs\` ou \`dotnet\`
- \`java\`
- \`go\`
- \`rust\`
- \`cpp\`

Examples:

\`\`\`sema
use javascript app.web.expenses

impl {
  js: src.app.saveExpense
}
\`\`\`

\`sema compilar --alvo javascript\` defines a generation target. \`impl { js: ... }\` defines the live-code origin linked to the contract. They are different layers and both are valid.

## Small Canonical Lists

- \`effects\`: \`persistencia\`, \`consulta\`, \`evento\`, \`auditoria\`, \`db.write\`, \`queue.publish\`, \`fs.write\`, \`network.egress\`, \`secret.read\`, \`shell.exec\`.
- \`audit.motivo\`: \`obrigatorio\`, \`opcional\`, \`dispensado\`.

## Contract Size

- up to ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} lines: healthy
- ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA + 1}-${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} lines: diagnostic warning, plan a split
- above ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}: blocks creation, edits, drift, finalization, generation, and snapshots
- split by real domain/capability, such as \`expenses_entry.sema\`, \`expenses_totals.sema\`, \`expenses_persistence.sema\`
- never use \`parte_1\`, \`parte_2\`, \`part_3\`, or equivalent names
- do not remove \`guarantees\`, \`tests\`, \`authz\`, \`dados\`, or \`vinculos\` just to fit under the limit
- multiple \`.sema\` contracts may govern the same code file through \`vinculos\`; this is expected

## JavaScript Is Supported

The CLI supports JavaScript generation:

\`\`\`bash
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
\`\`\`

The project can also generate TypeScript, Python, Dart, Lua, HTML, and CSS when those targets are enabled in \`sema.config.json\`.

## Support Files

- \`AGENTS.md\`: required agent rules.
- \`${ARQUIVO_SEMA_BOOT}\`: first read for every AI agent.
- \`${ARQUIVO_SEMA_SMALL_MODEL}\`: short version for weaker agents.
- \`${ARQUIVO_AGENT_CONTEXT_PACK}\`: structured agent context pack.
- \`SEMA_INDEX.json\`: project index.
- \`docs/commands.md\`: command catalog, gates, and \`--saida\` rule.
- \`exemplos/\`: official DSL examples.

If an AI agent does not know which shape to use, it must open \`exemplos/calculadora.sema\`, \`exemplos/crud_simples.sema\`, \`exemplos/pagamento.sema\`, or \`exemplos/tratamento_erro.sema\` before inventing syntax.

Platform policy: ${agentContextPack.politicaPlataforma.regra}
`;
}

function renderizarDocFluxoPraticoSemaLocal(agentContextPack: AgentContextPack): string {
  return `# Practical AI + Sema Workflow

This is the minimum workflow for agents in a local workspace.

1. Leia \`${ARQUIVO_SEMA_BOOT}\`.
2. Rode \`sema --version\`.
3. Rode \`sema preflight resumo --json\` e continue apenas se retornar \`use_cli_local\`.
4. Rode \`sema resumo\`.
5. Rode \`sema docs-impacto --intencao "<acao>" --json\`.
6. Leia a documentacao obrigatoria retornada.
7. Antes de escolher comando ou interpretar \`--saida\`, leia \`docs/commands.md\`.
8. Antes de criar ou editar contrato, use \`exemplos/\` e \`docs/syntax.md\`.
9. Antes de editar codigo existente, rode \`sema drift\` e \`sema impacto\`.
10. Depois de alterar \`.sema\`, rode \`sema formatar\` e \`sema validar\`.
11. Antes de concluir, rode \`sema finalizar-mudanca\` com as docs lidas.

Contract edit rule: \`.sema\` has its own size budget. Above ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} lines, plan a split by domain/capability; above ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}, do not create or edit before splitting. Do not use parte_1/parte_2 and do not force a 1:1 contract-to-file relationship; several contracts can govern the same file through \`vinculos\`.

Closing rule: \`sema drift --json\` must return \`sucesso:true\`. If it reports \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\`, or broken impls, the task is still blocked. Passing unit tests do not replace green drift.

UI rule: if the task involves an interface, minimum evidence includes desktop and mobile. On a narrow viewport such as 390px, \`document.documentElement.scrollWidth <= document.documentElement.clientWidth\` must pass; horizontal scroll blocks closure.

## Agent Capacity

- Weak agent: \`${ARQUIVO_SEMA_SMALL_MODEL}\`, \`SEMA_BRIEF.micro.txt\`, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_INDEX.json\`.
- Medium agent: \`${ARQUIVO_SEMA_BOOT}\`, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_BRIEF.curto.txt\`, \`SEMA_INDEX.json\`, \`AGENTS.md\`.
- Strong agent: \`${ARQUIVO_SEMA_BOOT}\`, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_BRIEF.md\`, \`SEMA_INDEX.json\`, AST, IR, drift, and impact.

## When to Generate Code

If the delivery includes code derived from a contract, run \`sema compilar\`.

\`\`\`bash
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
\`\`\`

Replace \`javascript\` with \`typescript\`, \`python\`, \`dart\`, \`lua\`, \`html\`, or \`css\` when appropriate.

## Fail Closed

${agentContextPack.failClosed.map((regra) => `- ${regra}`).join("\n")}
`;
}

function renderizarDocComandosSemaLocal(agentContextPack: AgentContextPack): string {
  return `# Sema Command Catalog

Use this file when an AI agent does not know which command to run. A Sema command is an operational gate; do not replace it with a Markdown report.

## Minimum Local Flow

\`\`\`bash
sema --version
sema preflight resumo --json
sema resumo
sema docs-impacto --intencao "<acao>" --json
\`\`\`

Then read every required doc returned by \`docs-impacto\`.

## Contract and Discovery

- \`sema iniciar --template <template>\`: creates a new Sema project with a contract, docs, examples, and AI kit.
- \`sema validar <arquivo-ou-pasta> --json\`: validates \`.sema\` contracts.
- \`sema diagnosticos <arquivo.sema> --json\`: details errors and warnings.
- \`sema formatar <arquivo-ou-pasta>\`: formats contracts.
- \`sema inspecionar <arquivo-ou-pasta> --json\`: shows modules, tasks, routes, entities, links, and expected files.
- \`sema ast <arquivo.sema> --json\`: shows AST for syntax debugging.
- \`sema ir <arquivo.sema> --json\`: shows the IR used by gates and generators.

## Change and Closure

- \`sema docs-impacto --intencao "<acao>" --json\`: discovers required docs and documentary blockers.
- \`sema drift <arquivo-ou-pasta> --escopo modulo --json\`: compares contract and implementation.
- \`sema impacto <arquivo-ou-pasta> --alvo <token> --mudanca "<descricao>" --json\`: maps impact before changing behavior.
- \`sema verificar <arquivo-ou-pasta> --json\`: runs aggregated final verification.
- \`sema finalizar-mudanca --intencao "<acao>" --doc-lida <arquivo> --json\`: proves documentation reading before closure.

Honest closure: treat drift JSON as the source of truth. \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\`, or broken impls mean the change is not complete yet. Do not report "clean drift" without green JSON.

## Sema Code

- \`sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua|javascript|html|css> --saida <diretorio>\`: generates starter/support artifacts from the contract.
- \`sema testar <arquivo.sema> --alvo <alvo> --saida <diretorio-temporario>\`: generates and runs local tests when the target supports it.
- \`sema importar <fonte> <diretorio> --saida <diretorio> --json\`: imports a legacy project into initial contracts.
- \`sema renomear-semantico <arquivo-ou-pasta> --de <nome> --para <nome> --json\`: helps rename symbols semantically.

Rule for \`--saida\`: the folder passed to \`sema compilar --saida\` is generated output. It is not the final delivery by itself. The final delivery is the target files/links declared by the contract. If the contract asks for \`index.html\`, \`css/styles.css\`, and \`js/app.js\`, creating only \`saida/expense_control.ts\` does not complete the task.

Sema Code traceability rule: generated artifacts must point back to the source module/contract and preserve that the same final file may be governed by several \`.sema\` contracts through \`vinculos\`. Do not force a 1:1 contract-file relationship and do not treat \`saida/\` as the final project.

Ready UI rule: if the task generates an app, site, dashboard, form, or static HTML, run desktop/mobile visual validation when the surface allows it. On narrow mobile (for example 390px), \`scrollWidth <= clientWidth\` must pass; a layout that stacks but overflows horizontally is not responsive.

## Canonical Syntax Lists

- Origins for \`use\` and \`impl\`: \`ts/typescript\`, \`js/javascript\`, \`py/python\`, \`dart\`, \`lua\`, \`cs/dotnet\`, \`java\`, \`go\`, \`rust\`, \`cpp\`.
- Frequent \`effects\` categories: \`persistencia\`, \`consulta\`, \`evento\`, \`auditoria\`, \`db.write\`, \`queue.publish\`, \`fs.write\`, \`network.egress\`, \`secret.read\`, \`shell.exec\`.
- Accepted \`audit.motivo\` values: \`obrigatorio\`, \`opcional\`, \`dispensado\`.

\`sema compilar --alvo javascript\` is a generation target. \`impl { js: ... }\` is the live-code origin. Do not swap one for the other.

## AI and Context

- \`sema ajuda-ia\`: short guidance for agents.
- \`sema starter-ia\`: operational starter.
- \`sema contexto-ia <arquivo.sema> --saida <dir> --json\`: AI context package.
- \`sema prompt-curto <arquivo-ou-pasta> --json\`: compact prompt.
- \`sema sync-ai-entrypoints --json\`: synchronizes AGENTS, boot, pack, and local docs.
- \`sema instalar-exemplos --json\`: installs official examples in the workspace.
- \`sema exemplos-prompt-ia\`: shows prompt examples, not \`.sema\` examples.

## Profiles e Author

- \`sema author iniciar|validar|briefing|revisar-cliches|validar-narrativa|validar-proibicoes\`: governs authorial writing.
- \`sema profile validar <software|workflow|ops|game|legal|research|redacao|propostas|conversas> <arquivo> --json\`: validates an artifact by profile.
- \`sema profile capabilities --json\`: lists profiles/capabilities.
- \`sema rule-packs --profile <profile> --json\`: lists rule packs.

## Operational

- \`sema doctor\`: diagnoses local installation.

## Forbidden

- Do not use an external workspace source to inspect a local workspace when \`sema --version\` works.
- Do not search the entire disk for \`.sema\` syntax; use \`exemplos/\`, \`docs/syntax.md\`, and this catalog.
- Do not stop after \`sema compilar\` if the contract target files still do not exist.
- Do not replace \`sema compilar\` with \`sema testar\` when Guard asks for Sema Code.
- Do not create a Markdown report to pretend a gate ran.
- Do not say drift passed when \`sema drift --json\` returned \`sucesso:false\`, broken link, divergent route, or broken impl.
- Do not declare a UI responsive without mobile/desktop proof; horizontal scroll at 390px blocks closure.

Governed code policy: ${agentContextPack.politicaCodigoGovernado.regra}
`;
}

function renderizarAgentStarterLocal(agentContextPack: AgentContextPack): string {
  return `# Agent Starter

You are in a Sema-governed project.

Read in this order:

1. \`${ARQUIVO_SEMA_BOOT}\`
2. \`${ARQUIVO_AGENT_CONTEXT_PACK}\`
3. \`SEMA_INDEX.json\`
4. \`AGENTS.md\`
5. \`docs/commands.md\`
6. \`docs/syntax.md\`
7. \`exemplos/\`

Basic commands:

\`\`\`bash
sema --version
sema preflight resumo --json
sema resumo
sema docs-impacto --intencao "<acao>" --json
sema validar contratos/orders.sema --json
sema drift contratos/orders.sema --escopo modulo --json
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
\`\`\`

Do not replace these gates with local search, guessing from a filename, or random contract reading outside the project.

Closure is not an opinion: \`sema drift --json\` must be green. \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\`, or broken impls block closure.

Ready UI requires proof: desktop/mobile and a narrow viewport without horizontal overflow (\`scrollWidth <= clientWidth\`).

${agentContextPack.politicaCodigoGovernado.regra}
`;
}

export async function sincronizarEntryPointsAgentes(
  baseProjeto: string,
  agentContextPack: AgentContextPack,
): Promise<{
  arquivos: Array<{ caminho: string; status: "criado" | "atualizado" | "preservado" }>;
  criados: string[];
  atualizados: string[];
  preservados: string[];
}> {
  const resultados: Array<{ caminho: string; status: "criado" | "atualizado" | "preservado" }> = [];
  const registrar = async (relativo: string, conteudo: string, substituirLegadoSema = false): Promise<void> => {
    const destino = path.join(baseProjeto, relativo);
    const status = await escreverArquivoGerenciadoSema(destino, conteudo, substituirLegadoSema);
    resultados.push({ caminho: relativo, status });
  };

  await registrar("AGENTS.md", renderizarInstrucaoClienteSema("generico", "media", agentContextPack), true);
  await registrar("docs/syntax.md", renderizarDocSintaxeSemaLocal(agentContextPack), true);
  await registrar("docs/ai-workflow.md", renderizarDocFluxoPraticoSemaLocal(agentContextPack), true);
  await registrar("docs/commands.md", renderizarDocComandosSemaLocal(agentContextPack), true);

  await registrar(
    ".github/copilot-instructions.md",
    renderizarInstrucaoClienteSema("copilot", "media", agentContextPack),
    true,
  );

  const clinePath = path.join(baseProjeto, ".clinerules");
  const clineStat = await statSeguro(clinePath);
  if (clineStat?.isFile()) {
    await registrar(".clinerules", renderizarInstrucaoClienteSema("cline", "fraca", agentContextPack), true);
  } else {
    await registrar(".clinerules/00-sema.md", renderizarInstrucaoClienteSema("cline", "fraca", agentContextPack), true);
  }

  await registrar(".roo/rules/00-sema.md", renderizarInstrucaoClienteSema("roo", "fraca", agentContextPack), true);

  const opencodeDir = path.join(baseProjeto, ".opencode");
  const opencodeStat = await statSeguro(opencodeDir);
  if (opencodeStat?.isDirectory()) {
    await registrar(".opencode/instructions.md", renderizarInstrucaoClienteSema("opencode", "media", agentContextPack), true);
  }

  const cursorDir = path.join(baseProjeto, ".cursor");
  const cursorStat = await statSeguro(cursorDir);
  if (cursorStat?.isDirectory()) {
    await registrar(".cursor/rules/sema.mdc", renderizarInstrucaoClienteSema("cursor", "media", agentContextPack), true);
  }

  const claudeDir = path.join(baseProjeto, ".claude");
  const claudeStat = await statSeguro(claudeDir);
  if (claudeStat?.isDirectory()) {
    await registrar(".claude/CLAUDE.md", renderizarInstrucaoClienteSema("claude", "forte", agentContextPack), true);
  }

  const windsurfDir = path.join(baseProjeto, ".windsurf");
  const windsurfStat = await statSeguro(windsurfDir);
  if (windsurfStat?.isDirectory()) {
    await registrar(".windsurf/rules.md", renderizarInstrucaoClienteSema("windsurf", "media", agentContextPack), true);
  }

  const criados = resultados.filter((item) => item.status === "criado").map((item) => item.caminho);
  const atualizados = resultados.filter((item) => item.status === "atualizado").map((item) => item.caminho);
  const preservados = resultados.filter((item) => item.status === "preservado").map((item) => item.caminho);
  return { arquivos: resultados, criados, atualizados, preservados };
}

