const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");
const { execFile } = require("node:child_process");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { basename, dirname, parse, resolve } = require("node:path");
const { promisify } = require("node:util");
const {
  executarCandidato,
  obterCandidatosCli,
} = require("./cli-helpers");

const executarArquivo = promisify(execFile);
const TAMANHO_BUFFER_PADRAO = 8 * 1024 * 1024;
const TTL_CACHE_CLI_MS = 5000;
const NOME_ARQUIVO_CONTEXTO_IA = "SEMA_CONTEXT.md";

let clienteLinguagem = undefined;
let canalSaida = undefined;
let provedorSidebar = undefined;
let cacheEstadoCli = undefined;

function obterRaizWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function obterNomeWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.name ?? "Nenhuma pasta aberta";
}

function obterDocumentoAtivo() {
  return vscode.window.activeTextEditor?.document;
}

function obterAlvoAtual() {
  const documento = obterDocumentoAtivo();
  if (!documento || documento.isUntitled || documento.uri.scheme !== "file") {
    return undefined;
  }
  return documento.uri.fsPath;
}

function obterAlvoSemaAtual() {
  const documento = obterDocumentoAtivo();
  if (!documento || documento.isUntitled || documento.uri.scheme !== "file") {
    return undefined;
  }
  if (documento.languageId === "sema" || documento.uri.fsPath.toLowerCase().endsWith(".sema")) {
    return documento.uri.fsPath;
  }
  return undefined;
}

function obterAlvoPreferencial() {
  return obterAlvoSemaAtual() ?? obterRaizWorkspace() ?? obterAlvoAtual();
}

function invalidarCacheCli() {
  cacheEstadoCli = undefined;
}

function escreverNoCanalSaida(titulo, texto) {
  if (!canalSaida) {
    return;
  }
  canalSaida.appendLine(`=== ${titulo} ===`);
  canalSaida.appendLine(texto);
  canalSaida.appendLine("");
}

async function descobrirShellResolvedPath() {
  try {
    if (process.platform === "win32") {
      const resultado = await executarArquivo("where.exe", ["sema"], {
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      return String(resultado.stdout ?? "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .find(Boolean);
    }

    const resultado = await executarArquivo("which", ["sema"], {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    return String(resultado.stdout ?? "").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function descobrirPrefixoGlobalNpm() {
  try {
    const resultado = await executarArquivo("npm", ["prefix", "-g"], {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    return String(resultado.stdout ?? "").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function obterCandidatosCliResolvidos() {
  const configuracao = vscode.workspace.getConfiguration("sema");
  const cliConfigurada = configuracao.get("cliPath");
  const raizWorkspace = obterRaizWorkspace();
  const [shellResolvedPath, globalPrefix] = await Promise.all([
    descobrirShellResolvedPath(),
    descobrirPrefixoGlobalNpm(),
  ]);

  return obterCandidatosCli({
    cliConfigurada,
    workspaceRoot: raizWorkspace,
    shellResolvedPath,
    globalPrefix,
  });
}

async function resolverEstadoCli(forcar = false) {
  if (!forcar && cacheEstadoCli && Date.now() - cacheEstadoCli.geradoEm < TTL_CACHE_CLI_MS) {
    return cacheEstadoCli;
  }

  const candidatos = await obterCandidatosCliResolvidos();
  const erros = [];

  for (const candidato of candidatos) {
    try {
      const resultado = await executarCandidato(candidato, ["--version"], {
        cwd: obterRaizWorkspace(),
        windowsHide: true,
        timeout: 15000,
        encoding: "utf8",
        maxBuffer: TAMANHO_BUFFER_PADRAO,
      });

      cacheEstadoCli = {
        geradoEm: Date.now(),
        pronto: true,
        versao: String(resultado.stdout ?? "").trim() || "desconhecida",
        origem: candidato.origem,
        candidato,
        candidatos,
        erros,
      };
      return cacheEstadoCli;
    } catch (erro) {
      erros.push({ candidato, erro });
    }
  }

  cacheEstadoCli = {
    geradoEm: Date.now(),
    pronto: false,
    versao: null,
    origem: null,
    candidato: null,
    candidatos,
    erros,
  };
  return cacheEstadoCli;
}

async function executarCliSema(argumentos, opcoes = {}) {
  const raizWorkspace = obterRaizWorkspace();
  const erros = [];

  for (const candidato of await obterCandidatosCliResolvidos()) {
    try {
      return await executarCandidato(candidato, argumentos, {
        cwd: raizWorkspace,
        windowsHide: true,
        maxBuffer: TAMANHO_BUFFER_PADRAO,
        encoding: "utf8",
        ...opcoes,
      });
    } catch (erro) {
      erros.push({ candidato, erro });
    }
  }

  const detalhes = erros
    .map(({ candidato, erro }) => {
      const mensagem = erro && typeof erro === "object" && "message" in erro ? erro.message : String(erro);
      return `- ${candidato.origem}: ${mensagem}`;
    })
    .join("\n");

  throw new Error(`Nao foi possivel executar a CLI da Sema.\n${detalhes}`);
}

async function executarCliSemaJson(argumentos, opcoes = {}) {
  const resultado = await executarCliSema(argumentos, opcoes);
  const stdout = String(resultado.stdout ?? "").trim();

  if (!stdout) {
    throw new Error("A CLI da Sema nao retornou conteudo JSON.");
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`A CLI da Sema retornou uma saida invalida para JSON.\n${stdout.slice(0, 2000)}`);
  }
}

async function executarCliSemaTexto(argumentos, opcoes = {}) {
  const resultado = await executarCliSema(argumentos, opcoes);
  return String(resultado.stdout ?? "").trim();
}

async function abrirConteudoTemporario(conteudo, linguagem = "plaintext") {
  const documento = await vscode.workspace.openTextDocument({ content: conteudo, language: linguagem });
  await vscode.window.showTextDocument(documento, { preview: false });
}

async function abrirArquivoPersistido(caminho) {
  const documento = await vscode.workspace.openTextDocument(caminho);
  await vscode.window.showTextDocument(documento, { preview: false });
}

async function lerArquivoSeExistir(caminho) {
  try {
    return await readFile(caminho, "utf8");
  } catch {
    return undefined;
  }
}

function alinharPromptIaParaContextoProjeto(prompt) {
  if (!prompt || typeof prompt !== "string") {
    return prompt;
  }

  const trechosOriginais = [[
    "Fontes de verdade, em ordem:",
    "1. README do projeto",
    "2. gramatica e documentacao de sintaxe da Sema",
    "3. especificacao semantica da linguagem",
    "4. exemplos oficiais, com prioridade para o vertical de pagamento",
    "5. `sema resumo` e `briefing.min.json` quando a IA for pequena",
    "6. AST, IR e diagnosticos exportados pela CLI em JSON quando a capacidade aguentar",
  ].join("\n"), [
    "Fontes de verdade, em ordem:",
    "1. se o projeto expuser `SEMA_CONTEXT.md`, comece por ele",
    "2. `SEMA_BRIEF.md`",
    "3. `SEMA_INDEX.json`",
    "4. README do projeto",
    "5. gramatica e documentacao de sintaxe da Sema",
    "6. especificacao semantica da linguagem",
    "7. exemplos oficiais, com prioridade para o vertical de pagamento",
    "8. `sema resumo` e `briefing.min.json` quando a IA for pequena",
    "9. AST, IR e diagnosticos exportados pela CLI em JSON quando a capacidade aguentar",
  ].join("\n")];

  const trechoProjeto = [
    "Fontes de verdade, em ordem:",
    "1. SEMA_CONTEXT.md",
    "2. SEMA_BRIEF.md",
    "3. SEMA_INDEX.json",
    "4. README do projeto",
    "5. gramatica e documentacao de sintaxe da Sema",
    "6. especificacao semantica da linguagem",
    "7. exemplos oficiais, com prioridade para o vertical de pagamento",
    "8. `sema resumo` e `briefing.min.json` quando a IA for pequena",
    "9. AST, IR e diagnosticos exportados pela CLI em JSON quando a capacidade aguentar",
  ].join("\n");

  for (const trechoOriginal of trechosOriginais) {
    if (prompt.includes(trechoOriginal)) {
      return prompt.replace(trechoOriginal, trechoProjeto);
    }
  }

  return prompt;
}

function descreverCaminhoProjeto(caminho) {
  const relativo = vscode.workspace.asRelativePath(caminho, false);
  return relativo && relativo !== caminho ? relativo : caminho;
}

function resolverCwdPreferencial(entrada) {
  const raizWorkspace = obterRaizWorkspace();
  if (raizWorkspace) {
    return raizWorkspace;
  }

  if (!entrada) {
    return undefined;
  }

  return entrada.toLowerCase().endsWith(".sema") ? dirname(entrada) : entrada;
}

async function resolverBaseProjeto(alvo = obterAlvoPreferencial()) {
  const entrada = alvo ?? obterRaizWorkspace() ?? obterAlvoAtual();
  if (!entrada) {
    return undefined;
  }

  const fallback = obterRaizWorkspace() ?? (entrada.toLowerCase().endsWith(".sema") ? dirname(entrada) : entrada);

  try {
    const payload = await executarCliSemaJson(["inspecionar", entrada, "--json"], {
      cwd: resolverCwdPreferencial(entrada),
    });
    const baseProjeto = payload?.configuracao?.baseProjeto;
    if (typeof baseProjeto === "string" && baseProjeto.trim()) {
      return baseProjeto;
    }
  } catch {
    // Cai no fallback para nao travar a UX quando a descoberta da base falhar.
  }

  return fallback;
}

async function materializarContextoIaNaRaiz(baseProjeto, alvo, pastaTemporaria, payload = {}, contextoProjeto = {}) {
  const caminhoContexto = resolve(baseProjeto, NOME_ARQUIVO_CONTEXTO_IA);
  const caminhoReadme = pastaTemporaria ? resolve(pastaTemporaria, "README.md") : undefined;
  const caminhoResumo = pastaTemporaria ? resolve(pastaTemporaria, "resumo.curto.txt") : undefined;
  const caminhoBriefingMin = pastaTemporaria ? resolve(pastaTemporaria, "briefing.min.json") : undefined;
  const caminhoPromptCurto = pastaTemporaria ? resolve(pastaTemporaria, "prompt-curto.txt") : undefined;

  const [readmePacote, resumoCurto, briefingMin, promptCurtoAlvo] = await Promise.all([
    caminhoReadme ? lerArquivoSeExistir(caminhoReadme) : undefined,
    caminhoResumo ? lerArquivoSeExistir(caminhoResumo) : undefined,
    caminhoBriefingMin ? lerArquivoSeExistir(caminhoBriefingMin) : undefined,
    caminhoPromptCurto ? lerArquivoSeExistir(caminhoPromptCurto) : undefined,
  ]);

  const modulo = typeof payload?.modulo === "string" && payload.modulo.trim()
    ? payload.modulo.trim()
    : alvo
      ? parse(alvo).name
      : "projeto";
  const geradoEm = typeof payload?.geradoEm === "string" && payload.geradoEm.trim()
    ? payload.geradoEm.trim()
    : new Date().toISOString();
  const linhas = [
    "# SEMA_CONTEXT",
    "",
    "Este arquivo e a entrada explicita e obrigatoria para IA neste projeto.",
    "Toda IA deve comecar por aqui antes de abrir codigo cru ou tentar mexer no projeto.",
    "Se a IA ignorar este arquivo, ela ja esta comecando errado.",
    "",
    `- Gerado em: \`${geradoEm}\``,
    `- Escopo: \`${alvo ? "projeto + modulo ativo" : "projeto"}\``,
    `- Base do projeto: \`${baseProjeto}\``,
    "",
    "## Ordem minima para IA",
    "",
    `1. Ler \`${NOME_ARQUIVO_CONTEXTO_IA}\`.`,
    "2. Ler `SEMA_BRIEF.md`.",
    "3. Ler `SEMA_INDEX.json`.",
    "4. Usar a CLI `sema` como interface publica principal do projeto.",
    "5. So depois subir para o contrato alvo e para o codigo vivo.",
  ];

  if (alvo) {
    linhas.push(`6. Quando ja existir alvo ativo, usar o contexto detalhado do modulo \`${modulo}\` como aprofundamento.`);
  }

  linhas.push(
    "",
    "## Papel deste arquivo",
    "",
    "- Este arquivo ja e valido como guia inicial do projeto mesmo sem contrato ativo.",
    "- Quando houver um arquivo `.sema` ativo, a preparacao pode incorporar contexto detalhado do modulo sem perder esta base.",
    "- Se algum bloco embutido abaixo entrar em conflito com esta abertura, a abertura deste arquivo prevalece.",
  );

  if (contextoProjeto.resumoProjeto && contextoProjeto.resumoProjeto.trim()) {
    linhas.push("", "## Resumo do projeto", "", "```txt", contextoProjeto.resumoProjeto.trim(), "```");
  }

  if (contextoProjeto.promptCurtoProjeto && contextoProjeto.promptCurtoProjeto.trim()) {
    linhas.push("", "## Prompt curto do projeto", "", "```txt", contextoProjeto.promptCurtoProjeto.trim(), "```");
  }

  if (contextoProjeto.starterIa && contextoProjeto.starterIa.trim()) {
    linhas.push("", "## Starter IA", "", "```txt", contextoProjeto.starterIa.trim(), "```");
  }

  if (contextoProjeto.promptIa && contextoProjeto.promptIa.trim()) {
    linhas.push("", "## Prompt IA", "", "```txt", alinharPromptIaParaContextoProjeto(contextoProjeto.promptIa).trim(), "```");
  }

  if (readmePacote && readmePacote.trim()) {
    linhas.push("", "## Pacote de contexto do alvo", "", readmePacote.trim());
  }

  if (resumoCurto && resumoCurto.trim()) {
    linhas.push("", "## Resumo curto do alvo", "", "```txt", resumoCurto.trim(), "```");
  }

  if (briefingMin && briefingMin.trim()) {
    linhas.push("", "## Briefing minimo", "", "```json", briefingMin.trim(), "```");
  }

  if (promptCurtoAlvo && promptCurtoAlvo.trim()) {
    linhas.push("", "## Prompt curto do alvo", "", "```txt", promptCurtoAlvo.trim(), "```");
  }

  linhas.push(
    "",
    "## Como regenerar",
    "",
    "- Rode `Preparar Contexto IA do Projeto` na extensao para atualizar este arquivo e os entrypoints da raiz.",
    alvo
      ? `- Opcionalmente, o contexto detalhado do modulo ativo pode ser regenerado com \`sema contexto-ia "${alvo}" --json\`.`
      : "- Opcionalmente, com um arquivo `.sema` aberto, a preparacao incorpora contexto detalhado do modulo ativo.",
    "- `sema sync-ai-entrypoints --json`",
  );

  await writeFile(caminhoContexto, `${linhas.join("\n")}\n`, "utf8");
  return caminhoContexto;
}

async function coletarContextoIaProjeto(baseProjeto) {
  const [starterIa, promptIa, resumoProjeto, promptCurtoProjeto] = await Promise.all([
    executarCliSemaTexto(["starter-ia"], { cwd: baseProjeto }),
    executarCliSemaTexto(["prompt-ia"], { cwd: baseProjeto }),
    executarCliSemaTexto(["resumo", baseProjeto, "--micro", "--para", "mudanca"], { cwd: baseProjeto }),
    executarCliSemaTexto(["prompt-curto", baseProjeto, "--curto", "--para", "mudanca"], { cwd: baseProjeto }),
  ]);

  return {
    starterIa,
    promptIa,
    resumoProjeto,
    promptCurtoProjeto,
  };
}

async function prepararContextoPromptIaProjeto(opcoes = {}) {
  const { sincronizarEntrypoints = true } = opcoes;
  const baseProjeto = await resolverBaseProjeto();
  if (!baseProjeto) {
    return undefined;
  }

  const alvo = obterAlvoSemaAtual();
  const caminhoContexto = await prepararContextoIaProjetoNaRaiz(baseProjeto, alvo, {
    sincronizarEntrypoints,
  });
  const conteudo = await lerArquivoSeExistir(caminhoContexto);
  return {
    alvo,
    baseProjeto,
    caminhoContexto,
    conteudo,
  };
}

async function prepararContextoIaProjetoNaRaiz(baseProjeto, alvo, opcoes = {}) {
  const { sincronizarEntrypoints = true } = opcoes;
  const contextoProjeto = await coletarContextoIaProjeto(baseProjeto);
  let pastaSaida;
  let payload = {};

  try {
    if (sincronizarEntrypoints) {
      await executarCliSemaJson(["sync-ai-entrypoints", "--json"], {
        cwd: baseProjeto,
      });
    }

    if (alvo) {
      pastaSaida = await mkdtemp(resolve(tmpdir(), "sema-contexto-ia-"));
      payload = await executarCliSemaJson(["contexto-ia", alvo, "--saida", pastaSaida, "--json"], {
        cwd: baseProjeto,
      });
    }

    return await materializarContextoIaNaRaiz(baseProjeto, alvo, pastaSaida, payload, contextoProjeto);
  } finally {
    if (pastaSaida) {
      await rm(pastaSaida, { recursive: true, force: true });
    }
  }
}

async function executarEExibir(argumentos, opcoes = {}) {
  const { linguagem = "plaintext", copiar = false, tituloErro = "Falha ao executar a CLI da Sema." } = opcoes;
  try {
    const resultado = await executarCliSema(argumentos);
    const stdout = String(resultado.stdout ?? "");
    if (copiar) {
      await vscode.env.clipboard.writeText(stdout);
      vscode.window.showInformationMessage("Conteudo copiado para a area de transferencia.");
      return;
    }
    await abrirConteudoTemporario(stdout, linguagem);
    return;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : tituloErro;
    escreverNoCanalSaida(tituloErro, mensagem);
    vscode.window.showErrorMessage(mensagem);
  }
}

async function formatarDocumentoAtivo() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Nenhum documento ativo para formatar.");
    return;
  }

  if (editor.document.languageId !== "sema") {
    vscode.window.showWarningMessage("O documento ativo nao e um arquivo Sema.");
    return;
  }

  await editor.document.save();

  try {
    await executarCliSema(["formatar", editor.document.uri.fsPath]);
    await vscode.commands.executeCommand("workbench.action.files.revert");
    vscode.window.showInformationMessage("Documento Sema formatado com sucesso.");
  } catch (erro) {
    try {
      await vscode.commands.executeCommand("editor.action.formatDocument");
      vscode.window.showWarningMessage("CLI da Sema nao encontrada. Foi usado o formatador do servidor de linguagem.");
    } catch {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao formatar o documento com a Sema.";
      escreverNoCanalSaida("Falha ao formatar documento", mensagem);
      vscode.window.showErrorMessage(mensagem);
    }
  }
}

function exigirAlvoAtual() {
  const alvo = obterAlvoPreferencial();
  if (!alvo) {
    vscode.window.showWarningMessage("Abra um arquivo .sema ou uma pasta de projeto para a Sema conseguir montar contexto.");
    return undefined;
  }
  return alvo;
}

async function comandoAbrirStarterIa() {
  await executarEExibir(["starter-ia"]);
}

async function comandoAbrirPromptIa() {
  try {
    const contextoProjeto = await prepararContextoPromptIaProjeto();
    if (contextoProjeto?.caminhoContexto && contextoProjeto.conteudo?.trim()) {
      await abrirArquivoPersistido(contextoProjeto.caminhoContexto);
      return;
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao preparar o contexto IA do projeto.";
    escreverNoCanalSaida("Falha ao abrir contexto IA do projeto", mensagem);
  }

  try {
    const promptBase = await executarCliSemaTexto(["prompt-ia"]);
    await abrirConteudoTemporario(alinharPromptIaParaContextoProjeto(promptBase), "plaintext");
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao abrir o prompt base da Sema.";
    escreverNoCanalSaida("Falha ao abrir prompt IA", mensagem);
    vscode.window.showErrorMessage(mensagem);
  }
}

async function comandoCopiarPromptIa() {
  try {
    const contextoProjeto = await prepararContextoPromptIaProjeto();
    if (contextoProjeto?.conteudo?.trim()) {
      await vscode.env.clipboard.writeText(contextoProjeto.conteudo);
      vscode.window.showInformationMessage(
        `Contexto IA do projeto copiado de ${descreverCaminhoProjeto(contextoProjeto.caminhoContexto)}.`,
      );
      return;
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao preparar o contexto IA do projeto.";
    escreverNoCanalSaida("Falha ao copiar contexto IA do projeto", mensagem);
  }

  try {
    const promptBase = await executarCliSemaTexto(["prompt-ia"]);
    await vscode.env.clipboard.writeText(alinharPromptIaParaContextoProjeto(promptBase));
    vscode.window.showInformationMessage("Prompt base da Sema copiado para a area de transferencia.");
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao copiar o prompt base da Sema.";
    escreverNoCanalSaida("Falha ao copiar prompt IA", mensagem);
    vscode.window.showErrorMessage(mensagem);
  }
}

async function comandoAbrirPromptCurtoAlvoAtual() {
  const alvo = exigirAlvoAtual();
  if (!alvo) {
    return;
  }
  await executarEExibir(["prompt-curto", alvo, "--curto", "--para", "mudanca"]);
}

async function comandoAbrirResumoAlvoAtual() {
  const alvo = exigirAlvoAtual();
  if (!alvo) {
    return;
  }
  await executarEExibir(["resumo", alvo, "--micro", "--para", "mudanca"]);
}

async function comandoAbrirDriftAlvoAtual() {
  const alvo = exigirAlvoAtual();
  if (!alvo) {
    return;
  }
  await executarEExibir(["drift", alvo, "--json"], { linguagem: "json" });
}

async function comandoGerarContextoIaAlvoAtual() {
  const alvo = obterAlvoSemaAtual();
  if (!alvo) {
    vscode.window.showWarningMessage("Abra um arquivo .sema para salvar o contexto IA dentro da pasta do projeto.");
    return;
  }

  const baseProjeto = await resolverBaseProjeto(alvo);
  if (!baseProjeto) {
    vscode.window.showWarningMessage("Nao foi possivel descobrir a base do projeto para salvar o contexto IA.");
    return;
  }

  try {
    const arquivoPrincipal = await prepararContextoIaProjetoNaRaiz(baseProjeto, alvo, {
      sincronizarEntrypoints: false,
    });

    await abrirArquivoPersistido(arquivoPrincipal);
    vscode.window.showInformationMessage(
      `Contexto IA salvo em ${descreverCaminhoProjeto(arquivoPrincipal)}.`,
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao salvar o contexto IA do alvo atual.";
    escreverNoCanalSaida("Falha ao gerar contexto IA", mensagem);
    vscode.window.showErrorMessage(mensagem);
  }
}

async function comandoSincronizarEntrypointsIaProjeto() {
  const baseProjeto = await resolverBaseProjeto();
  if (!baseProjeto) {
    vscode.window.showWarningMessage("Abra um workspace de projeto para sincronizar os entrypoints IA na raiz.");
    return;
  }

  try {
    const payload = await executarCliSemaJson(["sync-ai-entrypoints", "--json"], {
      cwd: baseProjeto,
    });
    const artefatos = Array.isArray(payload?.artefatos) ? payload.artefatos : [];
    const arquivoPrincipal = artefatos.includes("SEMA_BRIEF.md")
      ? resolve(baseProjeto, "SEMA_BRIEF.md")
      : resolve(baseProjeto, "README.md");

    await abrirArquivoPersistido(arquivoPrincipal);
    vscode.window.showInformationMessage(
      `Entrypoints IA sincronizados em ${descreverCaminhoProjeto(baseProjeto)}.`,
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao sincronizar os entrypoints IA do projeto.";
    escreverNoCanalSaida("Falha ao sincronizar entrypoints IA", mensagem);
    vscode.window.showErrorMessage(mensagem);
  }
}

async function comandoPrepararContextoIaProjeto() {
  const baseProjeto = await resolverBaseProjeto();
  if (!baseProjeto) {
    vscode.window.showWarningMessage("Abra um workspace de projeto para preparar o contexto IA na raiz.");
    return;
  }

  const alvo = obterAlvoSemaAtual();

  try {
    const arquivoPrincipal = await prepararContextoIaProjetoNaRaiz(baseProjeto, alvo, {
      sincronizarEntrypoints: true,
    });
    await abrirArquivoPersistido(arquivoPrincipal);
    vscode.window.showInformationMessage(
      `Contexto IA completo preparado em ${descreverCaminhoProjeto(arquivoPrincipal)}.`,
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao preparar o contexto IA completo do projeto.";
    escreverNoCanalSaida("Falha ao preparar contexto IA do projeto", mensagem);
    vscode.window.showErrorMessage(mensagem);
  }
}

async function criarTextoDiagnosticoCli() {
  const configuracao = vscode.workspace.getConfiguration("sema");
  const cliConfigurada = configuracao.get("cliPath");
  const estadoCli = await resolverEstadoCli(true);
  const alvoAtual = obterAlvoPreferencial();
  const linhas = [
    "# Diagnostico da CLI da Sema",
    "",
    `workspace: ${obterRaizWorkspace() ?? "nenhum"}`,
    `workspace_nome: ${obterNomeWorkspace()}`,
    `alvo_preferencial: ${alvoAtual ?? "nenhum"}`,
    `sema.cliPath: ${typeof cliConfigurada === "string" && cliConfigurada.trim() ? cliConfigurada.trim() : "(vazio)"}`,
    `cli_pronta: ${estadoCli.pronto ? "sim" : "nao"}`,
    `cli_origem: ${estadoCli.origem ?? "nenhuma"}`,
    estadoCli.versao ? `cli_versao: ${estadoCli.versao}` : "cli_versao: indisponivel",
    "",
    "## Candidatos testados",
  ];

  for (const candidato of estadoCli.candidatos) {
    const falha = estadoCli.erros.find((item) => item.candidato.origem === candidato.origem && item.candidato.comando === candidato.comando);
    if (!falha) {
      linhas.push(`- ${candidato.origem}: ok (${candidato.comando})`);
      continue;
    }
    const mensagem = falha.erro && typeof falha.erro === "object" && "message" in falha.erro
      ? falha.erro.message
      : String(falha.erro);
    linhas.push(`- ${candidato.origem}: falhou (${candidato.comando}) -> ${mensagem}`);
  }

  if (estadoCli.candidatos.length === 0) {
    linhas.push("- nenhum candidato encontrado");
  }

  return linhas.join("\n");
}

async function comandoDiagnosticarCli() {
  const conteudo = await criarTextoDiagnosticoCli();
  await abrirConteudoTemporario(conteudo, "markdown");
}

class ItemSidebarSema extends vscode.TreeItem {
  constructor(label, options = {}) {
    super(label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.description = options.description;
    this.tooltip = options.tooltip;
    this.command = options.command;
    this.contextValue = options.contextValue;
    this.iconPath = options.iconPath;
  }
}

class ProvedorSidebarSema {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      return [
        new ItemSidebarSema("Projeto", {
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          contextValue: "sema.grupo.projeto",
          iconPath: new vscode.ThemeIcon("root-folder"),
        }),
        new ItemSidebarSema("Acoes Rapidas", {
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          contextValue: "sema.grupo.acoes",
          iconPath: new vscode.ThemeIcon("rocket"),
        }),
      ];
    }

    if (element.contextValue === "sema.grupo.projeto") {
      const estadoCli = await resolverEstadoCli();
      const alvoAtual = obterAlvoPreferencial();
      return [
        new ItemSidebarSema(`Workspace: ${obterNomeWorkspace()}`, {
          description: obterRaizWorkspace() ? "aberto" : "nenhum",
          tooltip: obterRaizWorkspace() ?? "Nenhuma pasta aberta no VS Code.",
          iconPath: new vscode.ThemeIcon("folder-library"),
        }),
        new ItemSidebarSema(estadoCli.pronto ? "CLI: pronta" : "CLI: indisponivel", {
          description: estadoCli.pronto ? estadoCli.origem ?? "detectada" : "rode Diagnosticar CLI",
          tooltip: estadoCli.pronto
            ? `CLI da Sema pronta via ${estadoCli.origem}${estadoCli.versao ? ` (${estadoCli.versao})` : ""}.`
            : "A extensao nao conseguiu executar a CLI da Sema.",
          iconPath: new vscode.ThemeIcon(estadoCli.pronto ? "check" : "warning"),
        }),
        new ItemSidebarSema(`Alvo: ${alvoAtual ? basename(alvoAtual) : "nenhum"}`, {
          description: alvoAtual ? "ativo" : "abra um .sema ou workspace",
          tooltip: alvoAtual ?? "Nenhum alvo ativo ou workspace aberto.",
          iconPath: new vscode.ThemeIcon("file"),
        }),
      ];
    }

    if (element.contextValue === "sema.grupo.acoes") {
      return [
        new ItemSidebarSema("Preparar Contexto IA do Projeto", {
          description: `grava tudo em ${NOME_ARQUIVO_CONTEXTO_IA}`,
          command: { command: "sema.prepararContextoIaProjeto", title: "Preparar Contexto IA do Projeto" },
          iconPath: new vscode.ThemeIcon("archive"),
        }),
        new ItemSidebarSema("Abrir Starter IA", {
          description: "prompt de onboarding",
          command: { command: "sema.abrirStarterIa", title: "Abrir Starter IA" },
          iconPath: new vscode.ThemeIcon("book"),
        }),
        new ItemSidebarSema("Abrir Prompt IA", {
          description: `abre ${NOME_ARQUIVO_CONTEXTO_IA} atualizado`,
          command: { command: "sema.abrirPromptIa", title: "Abrir Prompt IA" },
          iconPath: new vscode.ThemeIcon("sparkle"),
        }),
        new ItemSidebarSema("Copiar Prompt IA", {
          description: `copia ${NOME_ARQUIVO_CONTEXTO_IA} atualizado`,
          command: { command: "sema.copiarPromptIa", title: "Copiar Prompt IA" },
          iconPath: new vscode.ThemeIcon("copy"),
        }),
        new ItemSidebarSema("Prompt Curto do Alvo Atual", {
          description: "contexto resumido",
          command: { command: "sema.abrirPromptCurtoAlvoAtual", title: "Abrir Prompt Curto do Alvo Atual" },
          iconPath: new vscode.ThemeIcon("comment-discussion"),
        }),
        new ItemSidebarSema("Resumo do Alvo Atual", {
          description: "micro resumo",
          command: { command: "sema.abrirResumoAlvoAtual", title: "Abrir Resumo do Alvo Atual" },
          iconPath: new vscode.ThemeIcon("list-unordered"),
        }),
        new ItemSidebarSema("Drift do Alvo Atual", {
          description: "medicao em JSON",
          command: { command: "sema.abrirDriftAlvoAtual", title: "Abrir Drift do Alvo Atual" },
          iconPath: new vscode.ThemeIcon("graph"),
        }),
        new ItemSidebarSema("Sincronizar EntryPoints IA", {
          description: "salva na raiz do projeto",
          command: { command: "sema.sincronizarEntrypointsIaProjeto", title: "Sincronizar EntryPoints IA do Projeto" },
          iconPath: new vscode.ThemeIcon("sync"),
        }),
        new ItemSidebarSema("Diagnosticar CLI", {
          description: "ve o que a extensao tentou",
          command: { command: "sema.diagnosticarCli", title: "Diagnosticar CLI" },
          iconPath: new vscode.ThemeIcon("tools"),
        }),
      ];
    }

    return [];
  }
}

async function iniciarCliente(context) {
  const serverModule = context.asAbsolutePath("server.js");
  const serverOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6010"],
      },
    },
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "sema" }],
    synchronize: {
      configurationSection: "sema",
    },
    initializationOptions: {
      workspaceFolders: vscode.workspace.workspaceFolders?.map((item) => item.uri.fsPath) ?? [],
    },
  };

  clienteLinguagem = new LanguageClient(
    "semaLanguageServer",
    "Sema Language Server",
    serverOptions,
    clientOptions,
  );

  const resultadoStart = clienteLinguagem.start();
  context.subscriptions.push(resultadoStart);
  if (typeof clienteLinguagem.onReady === "function") {
    await clienteLinguagem.onReady();
    return;
  }
  await Promise.resolve(resultadoStart);
}

async function reiniciarCliente(context) {
  if (clienteLinguagem) {
    await clienteLinguagem.stop();
    clienteLinguagem = undefined;
  }

  await iniciarCliente(context);
  vscode.window.showInformationMessage("Servidor de linguagem da Sema reiniciado.");
}

async function activate(context) {
  canalSaida = vscode.window.createOutputChannel("Sema");
  context.subscriptions.push(canalSaida);

  provedorSidebar = new ProvedorSidebarSema();
  context.subscriptions.push(
    vscode.window.createTreeView("semaSidebar", {
      treeDataProvider: provedorSidebar,
      showCollapseAll: false,
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sema.formatarDocumento", formatarDocumentoAtivo),
    vscode.commands.registerCommand("sema.reiniciarServidor", async () => {
      await reiniciarCliente(context);
    }),
    vscode.commands.registerCommand("sema.abrirStarterIa", comandoAbrirStarterIa),
    vscode.commands.registerCommand("sema.abrirPromptIa", comandoAbrirPromptIa),
    vscode.commands.registerCommand("sema.copiarPromptIa", comandoCopiarPromptIa),
    vscode.commands.registerCommand("sema.abrirPromptCurtoAlvoAtual", comandoAbrirPromptCurtoAlvoAtual),
    vscode.commands.registerCommand("sema.abrirResumoAlvoAtual", comandoAbrirResumoAlvoAtual),
    vscode.commands.registerCommand("sema.abrirDriftAlvoAtual", comandoAbrirDriftAlvoAtual),
    vscode.commands.registerCommand("sema.prepararContextoIaProjeto", comandoPrepararContextoIaProjeto),
    vscode.commands.registerCommand("sema.gerarContextoIaAlvoAtual", comandoGerarContextoIaAlvoAtual),
    vscode.commands.registerCommand("sema.sincronizarEntrypointsIaProjeto", comandoSincronizarEntrypointsIaProjeto),
    vscode.commands.registerCommand("sema.diagnosticarCli", comandoDiagnosticarCli),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (evento) => {
      if (evento.affectsConfiguration("sema.cliPath") || evento.affectsConfiguration("sema.diagnosticosAoDigitar")) {
        invalidarCacheCli();
        provedorSidebar?.refresh();
        await reiniciarCliente(context);
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      invalidarCacheCli();
      provedorSidebar?.refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      provedorSidebar?.refresh();
    }),
  );

  await iniciarCliente(context);
}

async function deactivate() {
  if (clienteLinguagem) {
    await clienteLinguagem.stop();
    clienteLinguagem = undefined;
  }
}

module.exports = {
  activate,
  deactivate,
  __testables: {
    descobrirPrefixoGlobalNpm,
    descobrirShellResolvedPath,
    obterCandidatosCliResolvidos,
  },
};
