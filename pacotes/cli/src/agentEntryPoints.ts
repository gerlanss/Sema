// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.entrypoints, sema.produto.escrita_segura_workspace, sema.produto.governanca_ia.drift.cache.modos
// Descrição: sincroniza o protocolo Codex, incluindo a distinção entre contexto contratual e evidência fresh de drift.

import { readFile, rm, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  escreverArquivoWorkspaceSeguro,
  validarDestinosEscritaWorkspace,
} from './workspaceWrite.js';
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
} from './agentContextTipos.js';
import { LIMITE_CARACTERES_PAYLOAD_INLINE } from './agentContextPack.js';

const MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO = '<!-- sema:agent-entrypoint:start -->';
const MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM = '<!-- sema:agent-entrypoint:end -->';
const ENTRYPOINTS_LEGADOS_NAO_CODEX = [
  ".clinerules/00-sema.md",
  ".clinerules",
  ".github/copilot-instructions.md",
  ".roo/rules/00-sema.md",
  ".opencode/instructions.md",
  ".cursor/rules/sema.mdc",
  ".claude/CLAUDE.md",
  ".windsurf/rules.md",
] as const;

export function listarDestinosEntrypointCodex(entrypointCodex: string): string[] {
  return [
    entrypointCodex,
    "docs/syntax.md",
    "docs/ai-workflow.md",
    "docs/commands.md",
    ...ENTRYPOINTS_LEGADOS_NAO_CODEX,
  ];
}

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

function contemVestigioSemaLegado(conteudo: string): boolean {
  const marcadorIncompleto =
    conteudo.includes(MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO) !==
    conteudo.includes(MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM);
  return marcadorIncompleto ||
    pareceEntradaSemaLegada(conteudo) ||
    /\bsema\s+(?:preflight|sync-ai-entrypoints)\b|\buse_cli_local\b/i.test(conteudo);
}

function montarBlocoGerenciadoSema(conteudo: string): string {
  return `${MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO}\n${conteudo.trim()}\n${MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM}\n`;
}

type StatusArquivoGerenciado = "criado" | "atualizado" | "preservado" | "pendente";

function contarOcorrencias(conteudo: string, marcador: string): number {
  return conteudo.split(marcador).length - 1;
}

function removerBlocosGerenciadosCompletos(conteudo: string): {
  conteudoManual: string;
  blocosEncontrados: number;
  marcadorIncompleto: boolean;
} {
  const partesManuais: string[] = [];
  let blocosEncontrados = 0;
  let cursor = 0;
  while (true) {
    const inicio = conteudo.indexOf(MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO, cursor);
    const fimOrfao = conteudo.indexOf(MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM, cursor);
    if (inicio < 0 && fimOrfao < 0) {
      partesManuais.push(conteudo.slice(cursor));
      break;
    }
    if (inicio < 0 || (fimOrfao >= 0 && fimOrfao < inicio)) {
      return { conteudoManual: conteudo, blocosEncontrados: 0, marcadorIncompleto: true };
    }
    const proximoInicio = conteudo.indexOf(
      MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO,
      inicio + MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO.length,
    );
    const fimMarcador = conteudo.indexOf(
      MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM,
      inicio + MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO.length,
    );
    if (fimMarcador < 0 || (proximoInicio >= 0 && proximoInicio < fimMarcador)) {
      return { conteudoManual: conteudo, blocosEncontrados: 0, marcadorIncompleto: true };
    }
    partesManuais.push(conteudo.slice(cursor, inicio));
    cursor = fimMarcador + MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM.length;
    blocosEncontrados += 1;
  }

  return {
    conteudoManual: partesManuais.join(""),
    blocosEncontrados,
    marcadorIncompleto: false,
  };
}

async function escreverArquivoGerenciadoSema(
  baseProjeto: string,
  caminhoRelativo: string,
  conteudo: string,
  substituirLegadoSema = false,
): Promise<StatusArquivoGerenciado> {
  const caminho = path.join(baseProjeto, caminhoRelativo);
  const bloco = montarBlocoGerenciadoSema(conteudo);
  const atual = await statSeguro(caminho);
  if (!atual) {
    await escreverArquivoWorkspaceSeguro(baseProjeto, caminhoRelativo, bloco);
    return "criado";
  }
  if (!atual.isFile()) {
    return "preservado";
  }

  const textoAtual = await readFile(caminho, "utf8");
  const extraido = removerBlocosGerenciadosCompletos(textoAtual);
  if (extraido.marcadorIncompleto) {
    return "pendente";
  }

  const conteudoManual = extraido.conteudoManual.trim();
  const proximo = conteudoManual ? `${bloco}\n${conteudoManual}\n` : bloco;
  const legadoManualPendente =
    (substituirLegadoSema && extraido.blocosEncontrados === 0 && pareceEntradaSemaLegada(textoAtual)) ||
    contemVestigioSemaLegado(conteudoManual);

  if (proximo === textoAtual) {
    return legadoManualPendente ? "pendente" : "preservado";
  }
  await escreverArquivoWorkspaceSeguro(baseProjeto, caminhoRelativo, proximo, {
    sobrescrever: true,
  });
  return legadoManualPendente ? "pendente" : "atualizado";
}

async function limparEntrypointLegadoNaoCodex(
  baseProjeto: string,
  caminhoRelativo: string,
): Promise<"removido" | "atualizado" | "preservado" | "pendente" | null> {
  const caminho = path.join(baseProjeto, caminhoRelativo);
  const atual = await statSeguro(caminho);
  if (!atual || !atual.isFile()) {
    return null;
  }

  const textoAtual = await readFile(caminho, "utf8");
  const extraido = removerBlocosGerenciadosCompletos(textoAtual);
  if (extraido.marcadorIncompleto) {
    return "pendente";
  }
  if (extraido.blocosEncontrados === 0) {
    return contemVestigioSemaLegado(textoAtual) ? "pendente" : "preservado";
  }

  const conteudoManual = extraido.conteudoManual.trim();
  if (!conteudoManual) {
    await rm(caminho, { force: true });
    return "removido";
  }

  await escreverArquivoWorkspaceSeguro(baseProjeto, caminhoRelativo, `${conteudoManual}\n`, {
    sobrescrever: true,
  });
  return contemVestigioSemaLegado(conteudoManual) ? "pendente" : "atualizado";
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

1. Confirme \`AGENTS.md\` na raiz e rode \`sema --version\`. Se o shell não localizar o comando, use \`$HOME/.sema/bin/sema\` no macOS/Linux; no Windows, PowerShell usa \`sema.ps1\` no PATH, cmd.exe usa \`sema.cmd\`, e o fallback absoluto é \`& "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\\.sema\\bin\\sema-managed.ps1" --version\`. Só então declare a CLI indisponível.
2. Use a CLI local diretamente para ler o workspace: \`sema resumo --drift none\`, \`sema docs-impacto\`, \`sema inspecionar --drift none\`, \`sema drift --cache fresh\` e \`sema impacto\`.
3. Se não estiver claro qual profile, workflow, pipeline, gerador ou adapter usar, rode \`sema descobrir recomendar --intencao "<objetivo>" --json\`; não execute automaticamente uma recomendação ambígua.
4. Não use fonte externa de workspace para substituir a CLI local quando ela estiver operacional.
5. Este boot é para workspace local em disco; se não houver workspace local, pare bloqueado em vez de inventar caminho.
6. Antes de criar módulo, rota, task ou contrato, inspecione o contrato \`.sema\` aplicável.
7. Antes de editar código existente, rode \`sema drift --cache fresh\` e impacto pela CLI local.
8. Antes de criar ou corrigir \`.sema\`, use os exemplos oficiais na CLI local.
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
- Consultas honestas: \`resumo\` e \`inspecionar\` usam \`--drift none\` por padrão; score, confiança, implementação, rotas e superfícies não observadas ficam nulos/não avaliados.
- Se uma consulta executar drift explicitamente, \`analiseDrift.sucesso\` expõe o resultado e uma falha solicitada retorna exit code diferente de zero.
- Cache: \`sema drift\` usa \`fresh\` por padrão. \`--cache none\` ainda executa sem persistência; \`cache\` acelera extrações validadas, mas não é prova final.
- Fechamento governado: se \`sema drift --cache fresh --json\` retornar \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\` ou impls quebradas, não diga que passou limpo. Corrija e rode drift de novo.
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
2. Em workspace local, rode \`sema --version\`; se o shell falhar, use \`$HOME/.sema/bin/sema\` no macOS/Linux. No Windows, PowerShell usa \`sema.ps1\` no PATH e cmd.exe usa \`sema.cmd\`; o fallback absoluto é \`& "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\\.sema\\bin\\sema-managed.ps1" --version\`. Só então pare e peça instalação ou reparo.
3. Sema não contorna políticas da plataforma: ele governa contrato, escopo, drift, evidência e qualidade.
4. Se aparecer alerta de política: pare, explique de forma neutra e não tente burlar filtro.
5. Se não houver workspace local em disco: pare bloqueado e peça o fluxo apropriado; não invente leitura por caminho.
6. Se for escrever \`.sema\`: leia \`exemplos/\`; se a pasta estiver ausente, rode \`sema instalar-exemplos --json\` antes.
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
18. Para fechamento, rode \`sema drift --cache fresh --json\`; cache persistente só acelera navegação e não é prova final. Se retornar \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\` ou impl quebrada, não conclua.
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
- Se o projeto inteiro for lento, escopar para \`sema resumo <arquivo.sema> --micro --para mudanca --drift none\`.
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
    "# Codex Integration",
    "",
    "The official Sema agent integration is Codex through the repository-level",
    "`AGENTS.md`. Codex loads that file automatically and runs the local Sema CLI",
    "inside the project to read contracts, check drift, map impact, and close changes",
    "with evidence.",
    "",
    "Sema is an independent project and is not affiliated with or endorsed by OpenAI.",
    "Codex surfaces and `AGENTS.md` behavior are documented at",
    "https://learn.chatgpt.com/docs/agent-configuration/agents-md.",
    "",
    "## Before AGENTS.md Exists",
    "",
    "The official Sema skill is the first-contact bootstrap for a project that does",
    "not have Sema yet. A global CLI install bundles and synchronizes it:",
    "",
    "```bash",
    "npm install -g @semacode/cli",
    "sema skill status --json",
    "```",
    "",
    "The package creates an absolute launcher under `~/.sema/bin`, synchronizes the",
    "canonical skill under `~/.agents/skills/sema`, and mirrors Claude only when",
    "detected. Informational requests stay read-only; before implementation the skill asks",
    "for explicit project-adoption authorization, then generates `AGENTS.md` and delegates",
    "ongoing governance. Installing or updating the global CLI authorizes distribution only.",
    "Already-open tasks may need a reload. The distribution contains no",
    "MCP server, remote workspace bridge, login, license, billing, token, credit,",
    "panel, or runtime authorization gate.",
    "",
    `Supported capacity labels: ${supportedCapacities}.`,
    "",
    "## Local-Only Rule",
    "",
    "For a local workspace, use the local CLI:",
    "",
    "```bash",
    "sema --version",
    "sema resumo --drift none",
    "```",
    "",
    "If the shell cannot resolve `sema`, use `~/.sema/bin/sema` on macOS/Linux. On Windows, PowerShell uses `sema.ps1` from PATH and cmd.exe uses `sema.cmd`; use `& \"$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"$HOME\\.sema\\bin\\sema-managed.ps1\" --version` as the absolute fallback",
    "before declaring the CLI unavailable. A successful version check is enough. Local",
    "commands require no login, activation key, license check, token, credits, billing",
    "service, control panel, or external authorization request.",
    "",
    "## Before Editing",
    "",
    "```bash",
    "sema docs-impacto --intencao \"describe the change\" --json",
    "sema inspecionar contratos/example.sema --drift none --json",
    "sema drift contratos/example.sema --escopo modulo --cache fresh --json",
    "sema impacto contratos/example.sema --alvo app.example --mudanca \"describe the change\" --json",
    "```",
    "",
    "Read every document listed by `docs-impacto` before changing code, contracts,",
    "operational docs, generated artifacts, workflows, profiles, or release material.",
    "A cache hit is acceleration, not evidence: closing requires `--cache fresh`,",
    "while contract-only queries keep unobserved implementation fields null.",
    "",
    "## Codex Context Tiers",
    "",
    "Codex with a small context budget should start with `" + ARQUIVO_SEMA_BOOT + "`,",
    "`" + ARQUIVO_SEMA_SMALL_MODEL + "`, `SEMA_BRIEF.micro.txt`,",
    "`" + ARQUIVO_AGENT_CONTEXT_PACK + "`, and `SEMA_INDEX.json`. They should stop early",
    "when a gate is unclear.",
    "",
    "Codex with a medium context budget should start with `" + ARQUIVO_SEMA_BOOT + "`,",
    "`" + ARQUIVO_AGENT_CONTEXT_PACK + "`, `SEMA_BRIEF.curto.txt`,",
    "`SEMA_INDEX.json`, and `AGENTS.md`. They must run docs-impact, drift, and",
    "impact before edits.",
    "",
    "Codex with a large context budget may consume `" + ARQUIVO_AGENT_CONTEXT_PACK + "`, `SEMA_BRIEF.md`,",
    "`SEMA_INDEX.json`, AST, IR, drift, and impact outputs, but larger context does",
    "not remove the contract-first rule.",
    "",
    "## Governed Code",
    "",
    "Generated or governed code should keep a short `SEMA-GOVERNED` marker that",
    "points back to the applicable contract. The marker is not a substitute for",
    "validation, drift, impact, or finalization gates.",
    "",
    "Generated Lua tests preserve the contract's failure shape. A case whose only",
    "expectation is `sucesso: falso` may terminate without an output, while a case",
    "that also declares observable output fields must return a structured failure",
    "result. The generator keeps these paths distinct instead of forcing every",
    "failure into one representation.",
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
  ].join("\n") + "\n";
}

function renderizarInstrucaoCodexSema(agentContextPack: AgentContextPack): string {
  const capacidade = "media" as const;
  const guia = agentContextPack.guiaPorCapacidade[capacidade];
  const politicaTimeout = agentContextPack.politicaTimeoutResumo;
  const politicaDesign = agentContextPack.politicaDesignVisual;
  const politicaPlataforma = agentContextPack.politicaPlataforma;
  return `# Sema para Codex

Este workspace é governado por Sema. Antes de qualquer ação em código, contrato, documentação operacional, workflow, profile ou deploy:

1. Leia \`${ARQUIVO_SEMA_BOOT}\`.
2. Rode \`sema --version\`; se o shell falhar, use \`$HOME/.sema/bin/sema\` no macOS/Linux. No Windows, PowerShell usa \`sema.ps1\` no PATH e cmd.exe usa \`sema.cmd\`; use \`& "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\\.sema\\bin\\sema-managed.ps1" --version\` como fallback absoluto. Só então pare e peça instalação ou reparo.
3. Use diretamente a CLI local: \`sema resumo --drift none\`, \`sema docs-impacto\`, \`sema inspecionar --drift none\`, \`sema drift --cache fresh\` e \`sema impacto\`.
4. Quando a capacidade correta não estiver clara, use \`sema descobrir recomendar --intencao "<objetivo>" --json\`; não autoexecute resultado ambíguo.
5. Não use fonte externa de workspace para substituir a CLI local quando ela estiver operacional.
6. Chame docs-impacto com a intenção declarada antes de agir.
7. Chame inspecionar no contrato \`.sema\` aplicável.
8. Antes de editar código existente, rode \`sema drift --cache fresh\` e impacto.
9. Antes de criar ou editar \`.sema\`, use exemplos oficiais.
10. Ao concluir mudança de contrato, rode validar.
11. Antes de finalizar, use finalizar-mudanca com as docs lidas.

É proibido substituir esse fluxo por leitura manual de \`AGENTS.md\`, \`README.md\`, busca local por arquivos, inferência pelo nome do projeto, bom senso ou ferramenta não citada nesta lista.

Entrypoint oficial do Codex: \`${agentContextPack.entrypointCodex}\`.
Capacidade padrão do Codex: ${capacidade}.
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
- Se possível, reduza escopo para \`sema resumo <arquivo.sema> --micro --para mudanca --drift none\`.

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
- \`resumo\` e \`inspecionar\` usam \`--drift none\` por padrão; campos derivados nulos significam não avaliados, nunca zero.
- \`sema drift --cache fresh --json\` com \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\` ou impls quebradas bloqueia fechamento. Cache persistente é aceleração, não prova final.
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

function renderizarDocSintaxeSemaLocal(_agentContextPack: AgentContextPack): string {
  return `# Sema Syntax for Codex

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

The project can also generate TypeScript, Python, PHP, Dart, Lua, HTML, CSS, C#/.NET (\`dotnet\`), and C++ (\`cpp\`) when those targets are enabled in \`sema.config.json\`.

## Support Files

- \`AGENTS.md\`: official Codex repository rules, loaded automatically.
- \`${ARQUIVO_SEMA_BOOT}\`: first Sema read for Codex.
- \`${ARQUIVO_SEMA_SMALL_MODEL}\`: compact guidance for a small context budget.
- \`${ARQUIVO_AGENT_CONTEXT_PACK}\`: structured Codex context pack.
- \`SEMA_INDEX.json\`: project index.
- \`docs/commands.md\`: command catalog, gates, and \`--saida\` rule.
- \`exemplos/\`: official DSL examples.

If Codex does not know which shape to use, it must open \`exemplos/calculadora.sema\`, \`exemplos/crud_simples.sema\`, \`exemplos/pagamento.sema\`, or \`exemplos/tratamento_erro.sema\` before inventing syntax.

Platform policy: Sema governs project contracts, scope, drift, evidence, and quality. It never bypasses platform policies, permissions, security controls, terms, or laws.
`;
}

function renderizarDocFluxoPraticoSemaLocal(_agentContextPack: AgentContextPack): string {
  return `# Practical Codex + Sema Workflow

This is the minimum workflow for Codex in a local workspace.

1. Read \`${ARQUIVO_SEMA_BOOT}\`.
2. Run \`sema --version\`. If the shell cannot find it, use \`$HOME/.sema/bin/sema\` on macOS/Linux. On Windows, PowerShell resolves \`sema.ps1\` from PATH and cmd.exe resolves \`sema.cmd\`; use \`& "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\\.sema\\bin\\sema-managed.ps1" --version\` as the absolute fallback. Only then declare the CLI unavailable.
3. Run \`sema resumo --drift none\` for contract-only orientation; request \`--drift cache\` or \`--drift fresh\` only when code evidence is needed.
4. Run \`sema docs-impacto --intencao "<change>" --json\`.
5. Read every required document returned by the command.
6. Read \`docs/commands.md\` before selecting a command or interpreting \`--saida\`.
7. If the right capability is unclear, run \`sema descobrir recomendar --intencao "<goal>" --json\`; do not auto-run ambiguous recommendations.
8. Use \`exemplos/\` and \`docs/syntax.md\` before creating or editing a contract.
9. Run \`sema drift --cache fresh\` and \`sema impacto\` before editing existing code.
10. Run \`sema formatar\` and \`sema validar\` after changing a \`.sema\` contract.
11. Run \`sema finalizar-mudanca\` with the documents read before closure.

Contract edit rule: \`.sema\` has its own size budget. Above ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} lines, plan a split by domain/capability; above ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}, do not create or edit before splitting. Do not use parte_1/parte_2 and do not force a 1:1 contract-to-file relationship; several contracts can govern the same file through \`vinculos\`.

Closing rule: \`sema drift --cache fresh --json\` must return \`sucesso:true\`. If it reports \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\`, or broken impls, the task is still blocked. Passing unit tests or a cache hit do not replace fresh green drift.

Focused drift rule: file and module scopes plan their physical file set before cataloging. They never fall back to a whole-project walk when no safe anchor exists. All indexers and semantic-budget checks reuse the same in-memory source read; a global walk is reserved for explicit \`--escopo projeto\`. Code discovery is deferred until that plan exists, homonymous candidates fail as ambiguous, and configured contract origins or code roots resolving outside the workspace are rejected before enumeration. \`inspecionar\`, \`impacto\`, and \`renomear-semantico\` preserve the same directed boundary. Missing local dependencies make coverage partial and block success.

Cache rule: a closure gate should use \`sema drift <contrato> --escopo modulo --cache fresh --json\`. \`--cache none\` executes the same analysis without persistent-cache I/O, while \`--cache cache\` may reuse only extraction data whose schema, workspace identity, Git HEAD, plan, configuration, contracts, member paths, and strong content digests all match. Cache objects are stored in the operating system's user-cache directory, never below the workspace. A hit is acceleration, not evidence: final links, diagnostics, score, and success are always recalculated. Corruption or an unavailable cache degrades to an in-memory calculation.

Query honesty rule: \`resumo\` and \`inspecionar\` default to \`--drift none\`. When analysis is skipped, score, confidence, implementation, routes, and other unobserved code claims must be \`null\` or explicitly marked not evaluated; zero is not a substitute for absent evidence.

UI rule: if the task involves an interface, minimum evidence includes desktop and mobile. On a narrow viewport such as 390px, \`document.documentElement.scrollWidth <= document.documentElement.clientWidth\` must pass; horizontal scroll blocks closure.

## Codex Context Capacity

- Small context: \`${ARQUIVO_SEMA_SMALL_MODEL}\`, \`SEMA_BRIEF.micro.txt\`, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_INDEX.json\`.
- Medium context: \`${ARQUIVO_SEMA_BOOT}\`, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_BRIEF.curto.txt\`, \`SEMA_INDEX.json\`, \`AGENTS.md\`.
- Large context: \`${ARQUIVO_SEMA_BOOT}\`, \`${ARQUIVO_AGENT_CONTEXT_PACK}\`, \`SEMA_BRIEF.md\`, \`SEMA_INDEX.json\`, AST, IR, drift, and impact.

## When to Generate Code

If the delivery includes code derived from a contract, run \`sema compilar\`.

\`\`\`bash
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
\`\`\`

Replace \`javascript\` with \`typescript\`, \`python\`, \`php\`, \`dart\`, \`lua\`, \`html\`, \`css\`, \`dotnet\`, or \`cpp\` when appropriate.

## Fail Closed

- If the local CLI is unavailable, stop before editing governed code or contracts and ask for \`@semacode/cli\` installation.
- If the applicable contract or semantic link is missing, create or repair it before code.
- If validation or drift reports failure, broken links, divergent routes, or broken implementations, fix the evidence and run the gate again.
- A local timeout is not authorization to skip Sema; retry with a larger timeout or a narrower scope.
`;
}

function renderizarDocComandosSemaLocal(agentContextPack: AgentContextPack): string {
  return `# Sema Command Catalog

Use this file when Codex does not know which command to run. A Sema command is an operational gate; do not replace it with a Markdown report.

## Minimum Local Flow

\`\`\`bash
sema --version
sema resumo --drift none
sema docs-impacto --intencao "<acao>" --json
\`\`\`

If \`sema\` is absent from \`PATH\`, use \`$HOME/.sema/bin/sema\` on macOS/Linux. On Windows, PowerShell resolves \`sema.ps1\` from PATH, cmd.exe resolves \`sema.cmd\`, and the absolute fallback is \`& "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\\.sema\\bin\\sema-managed.ps1" --version\`. \`sema skill sync --json\` repairs launcher and skill without touching the workspace or plugin caches.

Then read every required doc returned by \`docs-impacto\`.

## Global Distribution

- \`sema skill status --json\`: diagnoses the managed launcher and bundled skill without writing.
- \`sema skill sync --json\`: repairs only Sema-managed launcher and skill destinations; it never writes into the workspace or plugin caches.

## Contract and Discovery

- \`sema iniciar --template <template> [--force]\`: creates a new Sema project and preserves existing files by default; \`--force\` is the only explicit overwrite path.
- \`sema validar <arquivo-ou-pasta> --json\`: validates \`.sema\` contracts.
- \`sema diagnosticos <arquivo.sema> --json\`: details errors and warnings.
- \`sema formatar <arquivo-ou-pasta>\`: formats contracts.
- \`sema inspecionar <arquivo-ou-pasta> [--drift <none|cache|fresh>] --json\`: shows the contract surface; drift is skipped by default.
- \`sema ast <arquivo.sema> --json\`: shows AST for syntax debugging.
- \`sema ir <arquivo.sema> --json\`: shows the IR used by gates and generators.
- \`sema descobrir catalogo --json\`: lists governance flows, profiles, specialized workflows, pipelines, generators, capability tokens, and adapters from their canonical registries.
- \`sema descobrir recomendar --intencao "<goal>" --json\`: ranks compatible capabilities deterministically without executing the selected command.
- \`sema descobrir explicar <id> --json\`: explains inputs, boundaries, reasons, and the command template for one capability.
- \`sema pipeline listar|descrever <id> --json\` and \`sema capabilities --json\`: compact projections of the same discovery catalog.

## Change and Closure

- \`sema docs-impacto --intencao "<acao>" --json\`: discovers required docs and documentary blockers.
- \`sema drift <arquivo-ou-pasta> --escopo modulo [--cache <none|cache|fresh>] --json\`: plans a safe physical scope, then compares contract and implementation without a global fallback.
- \`sema impacto <arquivo-ou-pasta> --alvo <token> --mudanca "<descricao>" --json\`: maps impact before changing behavior.
- \`sema verificar <arquivo-ou-pasta> --json\`: runs aggregated final verification.
- \`sema finalizar-mudanca --intencao "<acao>" --doc-lida <arquivo> --json\`: proves documentation reading before closure.

Honest closure: treat drift JSON as the source of truth. \`sucesso:false\`, \`vinculos_quebrados\`, \`rotas_divergentes\`, or broken impls mean the change is not complete yet. Do not report "clean drift" without green JSON.

Focused drift exposes its planned, declared, inferred, and missing files plus catalog visit/read metrics in \`escopo_aplicado\`. File and module scopes fail closed without a safe anchor, with homonymous implementation candidates, or with missing local dependencies; only \`--escopo projeto\` may walk every configured code root. Logical roots such as \`src\` are probed deterministically without a discovery walk. Configured contract origins and code roots are confined before enumeration, and \`inspecionar\`, \`impacto\`, and \`renomear-semantico\` reuse the same directed boundary without reopening arbitrary external paths.

Drift analysis and cache modes are explicit:

- \`sema drift\` defaults to \`--cache fresh\`. \`none\` still executes drift but performs zero persistent-cache I/O; \`cache\` reuses a fully validated extraction hit and publishes misses; \`fresh\` ignores hits, recalculates, and publishes the new extraction.
- \`sema resumo\` and \`sema inspecionar\` default to \`--drift none\`. In that mode they do not execute drift and return \`null\` for score, confidence, implementation, routes, or other code evidence that was not observed. Use \`--drift cache\` or \`--drift fresh\` when that evidence is required. \`--com-drift\` remains a temporary alias for \`--drift fresh\`.
- When a query explicitly runs drift, \`analiseDrift.sucesso\` exposes the result and a failed requested analysis returns a nonzero exit code.
- The value aliases \`off\`, \`auto\`, and \`refresh\` normalize to \`none\`, \`cache\`, and \`fresh\` for one compatibility release and emit a structured deprecation warning. Wrong flags, repeated flags, conflicts, and invalid values fail instead of falling back silently.
- Persistent cache objects live outside the workspace under the operating system's user-cache directory. Workspace identity is hashed; public JSON and events expose only an opaque key and \`$SEMA_CACHE/...\` paths. Corruption or cache unavailability becomes a miss and never changes the drift result. Only validated extraction data is reused; links, diagnostics, scores, and the final success decision are recalculated.

A cache hit is acceleration, not final evidence; closure still requires fresh drift.

## Sema Code

- \`sema compilar <arquivo-ou-pasta> --alvo <typescript|python|php|dart|lua|javascript|html|css|dotnet|cpp> --saida <diretorio>\`: generates starter/support artifacts from the contract.
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

## Codex and Context

- \`sema ajuda-ia\`: short guidance for Codex.
- \`sema starter-ia\`: operational starter.
- \`sema contexto-ia <arquivo.sema> --saida <dir> --json\`: AI context package.
- \`sema resumo <arquivo-ou-pasta> [--drift <none|cache|fresh>] --json\`: compact context; drift is not executed unless requested.
- \`sema prompt-curto <arquivo-ou-pasta> --json\`: compact prompt.
- \`sema sync-codex --json\`: synchronizes the official Codex entrypoint and local support docs.
- \`sema instalar-exemplos --json\`: installs official examples in the workspace.
- \`sema exemplos-prompt-ia\`: shows prompt examples, not \`.sema\` examples.

## Profiles and Author

- \`sema author iniciar|validar|briefing|revisar-cliches|validar-narrativa|validar-proibicoes\`: governs authorial writing.
- \`sema profile validar <software|workflow|ops|game|simulation|legal|research|redacao|propostas|conversas> <arquivo> --json\`: validates an artifact by profile.
- \`sema profile capabilities --json\`: lists profiles/capabilities.
- \`sema rule-packs --profile <profile> --json\`: lists rule packs.

\`author\` is a specialized \`sema author\` workflow, not a \`profile validar\` alias. Discovery exposes that distinction explicitly.

## AI-native Content Pipeline

- \`sema conteudo capabilities --json\`: lists generic producer, evaluator, and adapter capabilities without fixing a platform.
- \`sema conteudo validar <definition.json> --json\`: validates the content DAG, gates, and open adapters.
- \`sema conteudo planejar <definition.json> --alvos-arquivo <targets.json> --json\`: creates a declarative multi-target plan for an external runner.
- \`sema conteudo validar-envelope --envelope-arquivo <envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --payload-type <type> --json\`: verifies Ed25519 identity, authorization, freshness, scope, and the separately pinned trust root and current revocation overlay.
- \`sema conteudo registrar <ledger.ndjson> --envelope-arquivo <envelope.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-id <id> --expected-head <sha256:...> --json\`: appends a verified envelope under the signed run policy to the local replay ledger at an externally retained head.
- \`sema conteudo status <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --json\`: verifies the signed policy and its \`targetSetDigest\`, then derives verdicts, operational conditions, completion, and next actions from canonical events.
- \`sema conteudo projetar <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --saida <manifest.json> --json\`: regenerates a non-authoritative manifest bound to the ledger head.

The content command is an AI-native, multi-channel, multi-format control plane. It never runs producers, evaluators, creative tools, or publication adapters; those belong to an external runner. It has no native human-review transition. A signed policy binds \`runId\`, definition, ledger, trust root, gates, complete target set, and the full \`issuedAt\`/\`expiresAt\` authorization window; no event may be recorded outside it. Stages select \`adapterPolicy\` as \`NONE\`, \`CONSTRAINTS\`, or \`CONFIRMATION\`; definition v1 accepts one output per stage. Constraint results must come from independent signed observations, including independently observed media type, not artifact metadata or executor claims. Target metadata is an exact scalar allowlist from \`requiredMetadata + optionalMetadata\`; \`accountScope\` is a credential-free \`account:<alias>\` reference, and artifact metadata is prohibited in v1. Deterministic evidence and AI opinions have separate quorum fields. Evidence requires an exact \`content.evidence.attest:<evidenceType>\` capability; adapter evidence requires \`content.adapter.attest:<adapterId>@<version>:<evidenceType>\` plus signed adapter binding.

Verdicts such as \`APROVADO\`, \`REPROVADO\`, and \`INCONCLUSIVO\` remain separate from operational conditions such as \`AGUARDANDO_EVENTO_EXTERNO\` and \`FERRAMENTA_INDISPONIVEL\`. A generated manifest is only a projection and cannot alter canonical state.

Local NDJSON plus a hash chain is portable evidence for replay, not a strong append-only trust boundary. Retain \`expectedHead\`, the canonical trust-root digest, and the current revocation digest externally, or use protected storage for high assurance. The trust-root pin identifies the authority snapshot independently from the revocation overlay. A workspace-local trust file additionally requires \`--development-local-trust\`; the flag does not disable digest pinning. Append freshness uses the platform clock rather than caller-provided \`recordedAt\`, and an authority in the current revocation overlay cannot sign an accepted policy.

## AI-native Interactive Systems

- \`sema interativo capabilities --json\`: lists the canonical interactive capability vocabulary.
- \`sema interativo schema --json\`: exposes the stable read-only definition schema, enum matrix, constraints, extension-command and data-schema shapes, plus canonical example paths for AI clients.
- \`sema interativo pipelines --json\`: lists reusable game, simulation, and hybrid pipelines.
- \`sema interativo adapters [--spatial-model <NON_SPATIAL|TWO_D|TWO_POINT_FIVE_D|THREE_D>] [--render-mode <HEADLESS|TEXT|VISUAL|XR>] --json\`: lists compatible external adapter descriptors.
- \`sema interativo validar <definition.json> --json\`: validates independent kind, spatial model, render mode, visual profile, fidelity, control, time, world, budget, pipeline, and acceptance axes.
- \`sema interativo planejar <definition.json> --json\`: expands compatible stages and required evidence without running an engine.
- \`sema interativo validar-evidencias|status <definition.json> [--plano-arquivo <plan.json>] --bundle-arquivo <bundle.json> --json\`: validates a portable evidence bundle or derives non-authoritative status; \`--evidencias-arquivo\` is an alias and an omitted plan is recomputed deterministically.
- \`sema interativo validar-protocolo <adapter-run.json> --json\`: checks DETECT/PROBE/SNAPSHOT/PLAN/APPLY/VALIDATE/EVIDENCE/ROLLBACK ordering and stable target binding.
- Experience IR: \`validar-ir\`, \`indexar-ir\`, \`consultar-ir --semantic-id <id>\`, \`chunk-ir --semantic-id <id> [--raso]\`, and \`descrever-ir\`.
- Operational state: \`validar-engine-snapshot\`, \`diff-engine-snapshots\`, \`validar-asset-provenance\`, \`validar-editor-state\`, \`planejar-jobs\`, \`validar-acceptance\`, \`operar-acceptance --operation <VALIDATE|EVALUATE|INVALIDATE> --context-file <file>\`, and \`validar-multimodal\`.
- Temporal, autonomy, and testing: \`validar-temporal\`, \`validar-evidencia-temporal --bundle-arquivo <file>\`, \`validar-autonomia\`, \`validar-playtest-fuzz\`, and \`validar-multiplayer\`.
- Portability and workers: \`analisar-portabilidade\` and \`validar-workers\`.
- \`sema interativo validar-control-run <control-run.json> --definition-arquivo <definition.json> --plano-arquivo <plan.json> --contrato-arquivo <validation-contract.json> --entrada-arquivo <input.json> [--entrada-auxiliar-arquivo <supporting-input.json>] --evidencia-arquivo <evidence.json> --resultado-arquivo <result.json> --json\`: binds one advanced validation to its complete local digest chain instead of trusting a standalone result.

The control-run command recomputes the canonical plan and selected pure validator, then verifies the definition, pipeline descriptor, validation contract, schema-declared inputs, evidence, and result digests. Prefix advanced items with \`sema interativo\` and pass the documented JSON file as the positional argument; an agent does not have to infer the validator or payload shape from a filename or visual style. The machine-readable schema publishes command maps, input/output schema links, required top-level fields, \`outputTargets\` path segments from the payload root, at least one real output shape per command, and official fixtures for all 20 advanced commands. Validation-result shapes describe \`payload.resultado\`; projected IR values use \`indice\`, \`entry\`, \`chunk\`, or \`descriptor\`; operation projections such as \`engineDiff\` and \`jobOrchestrationPlan\` live under \`payload.resultado.value\`; the job plan's ordered \`queue\` is the assignment list and exposes kind, priority, adapter, dependencies, locks, budgets, heartbeat, checkpoint, and recovery data.

Spatial model and render mode are orthogonal: \`THREE_D + HEADLESS\` is valid, while XR requires \`THREE_D\`. \`PIXEL_8_BIT\` and \`PIXEL_16_BIT\` are independent visual profiles available to games and simulations. Every command above rejects unknown, duplicate, missing-value, or invalid-enum arguments, remains local, read-only, and non-authoritative, and leaves engine/editor execution, authorization, mutation, rollback, migration, rendering, playtest, and worker scheduling to external runners. Full local coverage is \`STRUCTURALLY_COMPLETE\`, never authoritative completion, and a local evidence bundle is never presented as authoritative trust.

## Operational

- \`sema doctor\`: diagnoses local installation.

## Forbidden

- Do not use an external workspace source to inspect a local workspace when \`sema --version\` or the managed launcher works.
- Do not search the entire disk for \`.sema\` syntax; use \`exemplos/\`, \`docs/syntax.md\`, and this catalog.
- Do not stop after \`sema compilar\` if the contract target files still do not exist.
- Do not replace \`sema compilar\` with \`sema testar\` when the contract requires generated code.
- Do not create a Markdown report to pretend a gate ran.
- Do not say drift passed when \`sema drift --cache fresh --json\` returned \`sucesso:false\`, broken link, divergent route, or broken impl.
- Do not declare a UI responsive without mobile/desktop proof; horizontal scroll at 390px blocks closure.

Governed code policy: keep the \`SEMA-GOVERNED\` marker, split large code by real responsibility, preserve contract links, and never treat a generated output directory as the final delivery.
`;
}

export async function sincronizarEntrypointCodex(
  baseProjeto: string,
  agentContextPack: AgentContextPack,
): Promise<{
  arquivos: Array<{ caminho: string; status: StatusArquivoGerenciado }>;
  criados: string[];
  atualizados: string[];
  preservados: string[];
  entrypointCodex: "AGENTS.md";
  codexNativo: true;
  cliLocalSemAutorizacao: true;
  skillBootstrapCodexDocumentada: true;
  launcherGlobalFallbackDocumentado: true;
  cliIndisponivelSomenteAposFallback: true;
  skillGlobalDelegaAgentsMd: true;
  idiomaHumanoPreservado: true;
  retryTimeoutProgressivo: true;
  politicaPlataformaExplicita: true;
  politicaSinalVsRitualExplicita: true;
  politicaModosDriftExplicita: true;
  docsComandos: true;
  divisaoPorResponsabilidadeExplicita: true;
  contextoLocalSemEspelho: true;
  destinosEntrypointPrevalidados: true;
  entrypointsLegados: Array<{
    caminho: string;
    status: "removido" | "atualizado" | "preservado" | "pendente";
  }>;
  entrypointsLegadosPendentes: string[];
  entrypointsLegadosLimpos: boolean;
}> {
  const resultados: Array<{ caminho: string; status: StatusArquivoGerenciado }> = [];
  await validarDestinosEscritaWorkspace(
    baseProjeto,
    listarDestinosEntrypointCodex(agentContextPack.entrypointCodex),
  );
  const registrar = async (relativo: string, conteudo: string, substituirLegadoSema = false): Promise<void> => {
    const status = await escreverArquivoGerenciadoSema(
      baseProjeto,
      relativo,
      conteudo,
      substituirLegadoSema,
    );
    resultados.push({ caminho: relativo, status });
  };

  await registrar(agentContextPack.entrypointCodex, renderizarInstrucaoCodexSema(agentContextPack), true);
  await registrar("docs/syntax.md", renderizarDocSintaxeSemaLocal(agentContextPack), true);
  await registrar("docs/ai-workflow.md", renderizarDocFluxoPraticoSemaLocal(agentContextPack), true);
  await registrar("docs/commands.md", renderizarDocComandosSemaLocal(agentContextPack), true);

  const entrypointsLegados: Array<{
    caminho: string;
    status: "removido" | "atualizado" | "preservado" | "pendente";
  }> = [];
  for (const relativo of ENTRYPOINTS_LEGADOS_NAO_CODEX) {
    const status = await limparEntrypointLegadoNaoCodex(baseProjeto, relativo);
    if (status) {
      entrypointsLegados.push({ caminho: relativo, status });
    }
  }
  await rmdir(path.join(baseProjeto, ".clinerules")).catch(() => undefined);

  const criados = resultados.filter((item) => item.status === "criado").map((item) => item.caminho);
  const atualizados = resultados.filter((item) => item.status === "atualizado").map((item) => item.caminho);
  const preservados = resultados.filter((item) => item.status === "preservado").map((item) => item.caminho);
  const entrypointsLegadosPendentes = [
    ...resultados.filter((item) => item.status === "pendente").map((item) => item.caminho),
    ...entrypointsLegados
    .filter((item) => item.status === "pendente")
    .map((item) => item.caminho),
  ];
  return {
    arquivos: resultados,
    criados,
    atualizados,
    preservados,
    entrypointCodex: agentContextPack.entrypointCodex,
    codexNativo: true,
    cliLocalSemAutorizacao: true,
    skillBootstrapCodexDocumentada: true,
    launcherGlobalFallbackDocumentado: true,
    cliIndisponivelSomenteAposFallback: true,
    skillGlobalDelegaAgentsMd: true,
    idiomaHumanoPreservado: true,
    retryTimeoutProgressivo: true,
    politicaPlataformaExplicita: true,
    politicaSinalVsRitualExplicita: true,
    politicaModosDriftExplicita: true,
    docsComandos: true,
    divisaoPorResponsabilidadeExplicita: true,
    contextoLocalSemEspelho: true,
    destinosEntrypointPrevalidados: true,
    entrypointsLegados,
    entrypointsLegadosPendentes,
    entrypointsLegadosLimpos: entrypointsLegadosPendentes.length === 0,
  };
}

