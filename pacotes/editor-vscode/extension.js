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

class ProvedorWebviewSema {
  constructor() {
    this._view = undefined;
  }

  resolveWebviewView(webviewView, context, token) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtmlCorpo();

    webviewView.webview.onDidReceiveMessage((mensagem) => {
      if (mensagem.command === 'sema.refreshView') {
        this.refresh();
      } else {
        vscode.commands.executeCommand(mensagem.command);
      }
    });

    this.refresh();
  }

  async refresh() {
    if (!this._view) return;
    const estadoCli = await resolverEstadoCli();
    const workspace = obterRaizWorkspace();
    const alvo = obterAlvoPreferencial();
    
    this._view.webview.postMessage({ 
      command: 'atualizar', 
      pronto: estadoCli?.pronto ?? false, 
      alvo: alvo, 
      workspace: workspace 
    });
  }

  getHtmlCorpo() {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sema Painel</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-editor-inactiveSelectionBackground);
      --text-main: var(--vscode-foreground);
      --text-muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-button-background);
      --accent-hover: var(--vscode-button-hoverBackground);
      --accent-fg: var(--vscode-button-foreground);
      --border: var(--vscode-widget-border);
      --success: var(--vscode-testing-iconPassed);
      --error: var(--vscode-testing-iconFailed);
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: var(--text-main);
      padding: 16px;
      margin: 0;
      background: var(--bg-primary);
    }
    .secao {
      margin-bottom: 28px;
      animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .titulo {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 14px;
      letter-spacing: 0.8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grade {
      display: grid;
      gap: 10px;
    }
    button {
      background-color: var(--bg-secondary);
      color: var(--text-main);
      border: 1px solid transparent;
      padding: 10px 14px;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    button:hover {
      background-color: var(--vscode-list-hoverBackground);
      border-color: var(--accent);
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    button:active {
      transform: translateY(0);
    }
    .destaque {
      background: linear-gradient(135deg, var(--accent), var(--vscode-textLink-activeForeground, #007acc));
      color: var(--accent-fg);
      border: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .destaque:hover {
      background: linear-gradient(135deg, var(--accent-hover), var(--accent));
      color: var(--accent-fg);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border-color: transparent;
    }
    .status-painel {
      padding: 14px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 8px;
      border: 1px solid var(--border);
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 1px 4px rgba(0,0,0,0.1);
    }
    .status-painel::before {
      content: '';
      position: absolute;
      top: 0; left: 0; bottom: 0; width: 4px;
      background: var(--accent);
    }
    .status-linha {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      align-items: center;
    }
    .status-linha:last-child {
      margin-bottom: 0;
    }
    .status-valor {
      color: var(--vscode-textPreformat-foreground);
      font-weight: 600;
      background: var(--bg-secondary);
      padding: 3px 8px;
      border-radius: 4px;
      max-width: 15rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
    }
    .status-valor.online { color: var(--success); }
    .status-valor.offline { color: var(--error); }
    .icon {
      font-size: 16px;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
    }
    .divider {
      height: 1px;
      background: var(--border);
      margin: 20px 0;
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div class="secao" style="animation-delay: 0s">
    <div class="titulo">🚀 Status do Motor</div>
    <div class="status-painel">
      <div class="status-linha"><span>CLI Sema:</span> <span class="status-valor" id="status-cli">Verificando...</span></div>
      <div class="status-linha"><span>Workspace:</span> <span class="status-valor" id="status-projeto">...</span></div>
      <div class="status-linha" style="margin-bottom:0"><span>Contrato:</span> <span class="status-valor" id="status-alvo">...</span></div>
    </div>
  </div>

  <div class="secao" style="animation-delay: 0.1s">
    <div class="titulo">🎯 Ações de Contrato</div>
    <div class="grade">
      <button class="destaque" onclick="enviar('sema.abrirPromptCurtoAlvoAtual')">
        <span class="icon">🔍</span> Inspecionar Módulo
      </button>
      <button onclick="enviar('sema.abrirDriftAlvoAtual')">
        <span class="icon">📈</span> Verificar Drift (Scanner)
      </button>
      <button onclick="enviar('sema.abrirResumoAlvoAtual')">
        <span class="icon">📑</span> Resumo Executivo
      </button>
      <button onclick="enviar('sema.formatarDocumento')">
        <span class="icon">✨</span> Auto-Formatar Módulo
      </button>
    </div>
  </div>

  <div class="divider"></div>

  <div class="secao" style="animation-delay: 0.2s">
    <div class="titulo">🧠 Integração de IA</div>
    <div class="grade" style="grid-template-columns: 1fr 1fr;">
      <button onclick="enviar('sema.configurarIaCursor')">Cursor</button>
      <button onclick="enviar('sema.configurarIaWindsurf')">Windsurf</button>
      <button onclick="enviar('sema.configurarIaClaude')">Claude</button>
      <button onclick="enviar('sema.configurarIaCline')">Cline</button>
      <button onclick="enviar('sema.configurarIaCopilot')">Copilot</button>
      <button onclick="enviar('sema.configurarIaOpenCode')">OpenCode</button>
    </div>
    <button style="margin-top: 10px; width: 100%; justify-content: center; background: var(--bg-secondary); opacity: 0.9;" onclick="enviar('sema.prepararContextoIaProjeto')">
      <span class="icon">🔄</span> Update All Context / Sync
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function enviar(comando) {
      vscode.postMessage({ command: comando });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'atualizar') {
        const cliEl = document.getElementById('status-cli');
        cliEl.textContent = message.pronto ? 'Online & Pronto' : 'Indisponível';
        cliEl.className = 'status-valor ' + (message.pronto ? 'online' : 'offline');
        
        document.getElementById('status-projeto').textContent = message.workspace ? 'Conectado' : 'Nenhum';
        
        const alvo = message.alvo ? message.alvo.split(/[\\\\/]/).pop() : 'Nenhum';
        const alvoEl = document.getElementById('status-alvo');
        alvoEl.textContent = alvo;
        alvoEl.title = message.alvo || '';
      }
    });

    // Instancia os valores iniciais
    enviar('sema.refreshView');
  </script>
</body>
</html>`;
  }
}

async function iniciarCliente(context) {
  const serverModule = context.asAbsolutePath("dist/server.js");
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

  provedorSidebar = new ProvedorWebviewSema();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("semaSidebar", provedorSidebar)
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
    vscode.commands.registerCommand("sema.configurarIa", configurarIaNoWorkspace),
    vscode.commands.registerCommand("sema.configurarIaClaude", () => configurarIaFerramenta("claude")),
    vscode.commands.registerCommand("sema.configurarIaCursor", () => configurarIaFerramenta("cursor")),
    vscode.commands.registerCommand("sema.configurarIaWindsurf", () => configurarIaFerramenta("windsurf")),
    vscode.commands.registerCommand("sema.configurarIaCline", () => configurarIaFerramenta("cline")),
    vscode.commands.registerCommand("sema.configurarIaCopilot", () => configurarIaFerramenta("copilot")),
    vscode.commands.registerCommand("sema.configurarIaOpenCode", () => configurarIaFerramenta("opencode")),
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

  // Notifica se o projeto nao tem configuracao de IA do Sema
  const raiz = obterRaizWorkspace();
  if (raiz) {
    const { access } = require("node:fs/promises");
    const path = require("node:path");
    const marcador = path.join(raiz, ".claude", "CLAUDE.md");
    try {
      await access(marcador);
    } catch {
      const acao = await vscode.window.showInformationMessage(
        "Sema: Este projeto nao tem instrucoes de IA configuradas. Deseja configurar agora?",
        "Configurar",
        "Ignorar"
      );
      if (acao === "Configurar") {
        await configurarIaNoWorkspace();
      }
    }
  }
}

const INSTRUCOES_SEMA = `# Sema — Regras obrigatorias para IA

O Sema e o protocolo de governanca de intencao deste projeto.
Toda IA deve consultar o Sema antes de qualquer acao sobre codigo ou contratos.

## Regras

1. Ao abrir o projeto, chame sema_resumo para entender o estado atual.
2. Antes de criar qualquer modulo, rota, task ou contrato, chame sema_inspecionar no arquivo .sema mais proximo.
3. Antes de editar codigo existente, chame sema_drift para verificar divergencias entre contrato e implementacao.
4. Ao criar ou editar um arquivo .sema, chame sema_validar ao final.
5. Nunca invente contratos — use o Sema para descobrir o que ja existe.
6. Se qualquer ferramenta Sema retornar erro, corrija o problema antes de prosseguir — nao avance com codigo enquanto houver erros Sema pendentes.

## MCP

O servidor MCP do Sema roda localmente via: npx -y @semacode/mcp@latest
Use as ferramentas: sema_resumo, sema_validar, sema_drift, sema_inspecionar, sema_ir, sema_verificar, sema_contexto_ia, sema_prompt_ia.

## Contratos e exemplos

- Sempre salve arquivos .sema na pasta \`contratos/\` do projeto.
- Crie um arquivo .sema por modulo ou contexto de negocio. Exemplo: \`contratos/pedido.sema\`, \`contratos/pagamento.sema\`, \`contratos/usuario.sema\`. Nunca coloque modulos de contextos diferentes no mesmo arquivo.
- Antes de criar qualquer arquivo .sema, leia todos os arquivos da pasta \`exemplos/\` para entender o formato correto da linguagem.
- Nunca edite os arquivos da pasta \`exemplos/\`.

## Quando o projeto nao tem .sema

Pergunte ao usuario se deseja semantizar o projeto e sugira: sema iniciar

## Exemplos de arquivos .sema (referencia de formato)

### 1. Task simples com testes
\`\`\`
module exemplos.calculadora {
  task somar {
    input {
      a: Numero required
      b: Numero required
    }
    output {
      resultado: Numero
    }
    rules {
      a deve_ser numero_valido
      b deve_ser numero_valido
    }
    effects {
      auditoria operacao soma
    }
    guarantees {
      resultado existe
    }
    error {
      entrada_invalida: "Os valores precisam ser numericos."
    }
    tests {
      caso "soma basica" {
        given { a: 2  b: 3 }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
\`\`\`

### 2. Entity + CRUD com route
\`\`\`
module exemplos.crud.simples {
  entity Produto {
    fields {
      id: Id
      nome: Texto
      preco: Decimal
      ativo: Booleano
    }
  }

  task criar_produto {
    input {
      nome: Texto required
      preco: Decimal required
    }
    output {
      produto: Produto
    }
    rules {
      nome deve_ser preenchido
      preco deve_ser positivo
    }
    effects {
      persistencia Produto
      auditoria produto_criado
    }
    guarantees {
      produto existe
    }
    tests {
      caso "cria produto" {
        given { nome: "Caneca"  preco: 39.9 }
        expect { sucesso: verdadeiro }
      }
    }
  }

  route produtos {
    metodo: POST
    caminho: /produtos
    task: criar_produto
    finalidade: cadastro_produto
    input { nome: Texto  preco: Decimal }
    output { produto: Produto }
  }
}
\`\`\`

### 3. Cadastro com validacoes e unicidade
\`\`\`
module exemplos.cadastro.usuario {
  entity Usuario {
    fields {
      id: Id
      nome: Texto
      email: Email
      ativo: Booleano
    }
  }

  task criar_usuario {
    input {
      nome: Texto required
      email: Email required
    }
    output {
      usuario: Usuario
    }
    rules {
      nome deve_ser preenchido
      email deve_ser email_valido
      email deve_ser unico em Usuario.email
    }
    effects {
      persistencia Usuario
      evento usuario_criado
      auditoria cadastro_usuario
    }
    guarantees {
      usuario existe
      persistencia concluida
    }
    error {
      email_duplicado: "Ja existe usuario com este email."
      entrada_invalida: "Os dados informados nao atendem as regras."
    }
    tests {
      caso "cria usuario valido" {
        given { nome: "Ana"  email: "ana@empresa.com" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
\`\`\`

### 4. Pagamento com state e flow
\`\`\`
module exemplos.pagamento {
  task processar_pagamento {
    input {
      pagamento_id: Id required
      valor: Decimal required
      token: Texto required
    }
    output {
      pagamento: Pagamento
      status: StatusPagamento
    }
    rules {
      valor > 0
      token deve_ser valido
    }
    effects {
      consulta gateway_pagamento criticidade = alta
      persistencia Pagamento criticidade = alta
      evento pagamento_autorizado criticidade = media
      auditoria pagamento criticidade = alta
    }
    state ciclo_pagamento {
      transitions {
        PENDENTE -> AUTORIZADO
        AUTORIZADO -> PROCESSADO
      }
    }
    guarantees {
      pagamento existe
      status em [AUTORIZADO, PROCESSADO]
    }
    error {
      autorizacao_negada: "Recusado pelo gateway."
      timeout_gateway: "Gateway nao respondeu."
    }
    tests {
      caso "pagamento autorizado" {
        given { pagamento_id: "pag_1"  valor: 199.9  token: "tok_ok" }
        expect { sucesso: verdadeiro }
      }
      caso "pagamento recusado" {
        given { pagamento_id: "pag_err"  valor: 10  token: "tok_recusado" }
        expect { sucesso: falso }
        error { tipo: "autorizacao_negada" }
      }
    }
  }

  flow orquestracao_pagamento {
    pagamento_id: Id
    valor: Decimal
    token: Texto
    etapa autorizar usa processar_pagamento com pagamento_id = pagamento_id, valor = valor, token = token em_sucesso confirmar em_erro registrar_falha
    etapa confirmar usa confirmar_pagamento com pagamento_id = pagamento_id depende_de autorizar
    etapa registrar_falha usa registrar_timeout_pagamento com pagamento_id = pagamento_id depende_de autorizar
  }
}
\`\`\`

### 5. Tratamento de erro com flow ramificado
\`\`\`
module exemplos.tratamento.erro {
  task executar_operacao_sensivel {
    input {
      chave: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      chave deve_ser preenchida
    }
    effects {
      consulta cofre
      auditoria falha_operacao_sensivel
    }
    guarantees {
      protocolo existe
    }
    error {
      acesso_negado: "A chave nao tem permissao."
      recurso_indisponivel: "Servico temporariamente indisponivel."
    }
    tests {
      caso "falha por acesso negado" {
        given { chave: "sem_permissao" }
        expect { sucesso: falso }
        error { tipo: "acesso_negado" }
      }
    }
  }

  flow resposta_segura {
    chave: Texto
    etapa tentar usa executar_operacao_sensivel com chave = chave em_sucesso concluir em_erro registrar_falha por_erro acesso_negado = tratar_acesso_negado, recurso_indisponivel = agendar_retentativa
    etapa tratar_acesso_negado usa responder_acesso_negado com chave = chave depende_de tentar
    etapa agendar_retentativa usa responder_retentativa com chave = chave depende_de tentar
    etapa registrar_falha usa registrar_auditoria_falha com chave = chave depende_de tentar
    etapa concluir usa registrar_sucesso com protocolo = tentar.protocolo depende_de tentar
  }
}
\`\`\`
`;

const EXEMPLOS_SEMA = {
  "calculadora.sema": `module exemplos.calculadora {
  docs {
    resumo: "Operacoes aritmeticas simples com garantias e testes."
  }

  task somar {
    input {
      a: Numero required
      b: Numero required
    }
    output {
      resultado: Numero
    }
    rules {
      a deve_ser numero_valido
      b deve_ser numero_valido
    }
    effects {
      auditoria operacao soma
    }
    guarantees {
      resultado existe
    }
    error {
      entrada_invalida: "Os valores precisam ser numericos."
    }
    tests {
      caso "soma basica" {
        given { a: 2  b: 3 }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task dividir {
    input {
      dividendo: Numero required
      divisor: Numero required
    }
    output {
      resultado: Numero
    }
    rules {
      divisor deve_ser diferente_de_zero
    }
    effects {
      auditoria operacao divisao
    }
    guarantees {
      resultado existe
    }
    error {
      divisor_zero: "Nao e permitido dividir por zero."
    }
    tests {
      caso "divisao valida" {
        given { dividendo: 10  divisor: 2 }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "crud_simples.sema": `module exemplos.crud.simples {
  entity Produto {
    fields {
      id: Id
      nome: Texto
      preco: Decimal
      ativo: Booleano
    }
  }

  task criar_produto {
    input {
      nome: Texto required
      preco: Decimal required
    }
    output {
      produto: Produto
    }
    rules {
      nome deve_ser preenchido
      preco deve_ser positivo
    }
    effects {
      persistencia Produto
      auditoria produto_criado
    }
    guarantees {
      produto existe
    }
    tests {
      caso "cria produto" {
        given { nome: "Caneca"  preco: 39.9 }
        expect { sucesso: verdadeiro }
      }
    }
  }

  route produtos {
    metodo: POST
    caminho: /produtos
    task: criar_produto
    finalidade: cadastro_produto
    input { nome: Texto  preco: Decimal }
    output { produto: Produto }
  }
}
`,
  "cadastro_usuario.sema": `module exemplos.cadastro.usuario {
  docs {
    resumo: "Cadastro de usuario com entidade, validacoes e persistencia declarada."
  }

  entity Usuario {
    fields {
      id: Id
      nome: Texto
      email: Email
      ativo: Booleano
    }
  }

  task criar_usuario {
    input {
      nome: Texto required
      email: Email required
    }
    output {
      usuario: Usuario
    }
    rules {
      nome deve_ser preenchido
      email deve_ser email_valido
      email deve_ser unico em Usuario.email
    }
    effects {
      persistencia Usuario
      evento usuario_criado
      auditoria cadastro_usuario
    }
    guarantees {
      usuario existe
      persistencia concluida
    }
    error {
      email_duplicado: "Ja existe usuario com este email."
      entrada_invalida: "Os dados informados nao atendem as regras."
    }
    tests {
      caso "cria usuario valido" {
        given { nome: "Ana"  email: "ana@empresa.com" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "pagamento.sema": `module exemplos.pagamento {
  task processar_pagamento {
    input {
      pagamento_id: Id required
      valor: Decimal required
      token: Texto required
    }
    output {
      pagamento: Pagamento
      status: StatusPagamento
    }
    rules {
      valor > 0
      token deve_ser valido
    }
    effects {
      consulta gateway_pagamento criticidade = alta
      persistencia Pagamento criticidade = alta
      evento pagamento_autorizado criticidade = media
      auditoria pagamento criticidade = alta
    }
    state ciclo_pagamento {
      transitions {
        PENDENTE -> AUTORIZADO
        AUTORIZADO -> PROCESSADO
      }
    }
    guarantees {
      pagamento existe
      status em [AUTORIZADO, PROCESSADO]
    }
    error {
      autorizacao_negada: "Recusado pelo gateway."
      timeout_gateway: "Gateway nao respondeu."
    }
    tests {
      caso "pagamento autorizado" {
        given { pagamento_id: "pag_1"  valor: 199.9  token: "tok_ok" }
        expect { sucesso: verdadeiro }
      }
      caso "pagamento recusado" {
        given { pagamento_id: "pag_err"  valor: 10  token: "tok_recusado" }
        expect { sucesso: falso }
        error { tipo: "autorizacao_negada" }
      }
    }
  }

  flow orquestracao_pagamento {
    pagamento_id: Id
    valor: Decimal
    token: Texto
    etapa autorizar usa processar_pagamento com pagamento_id = pagamento_id, valor = valor, token = token em_sucesso confirmar em_erro registrar_falha
    etapa confirmar usa confirmar_pagamento com pagamento_id = pagamento_id depende_de autorizar
    etapa registrar_falha usa registrar_timeout_pagamento com pagamento_id = pagamento_id depende_de autorizar
  }
}
`,
  "tratamento_erro.sema": `module exemplos.tratamento.erro {
  task executar_operacao_sensivel {
    input {
      chave: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      chave deve_ser preenchida
    }
    effects {
      consulta cofre
      auditoria falha_operacao_sensivel
    }
    guarantees {
      protocolo existe
    }
    error {
      acesso_negado: "A chave nao tem permissao."
      recurso_indisponivel: "Servico temporariamente indisponivel."
    }
    tests {
      caso "falha por acesso negado" {
        given { chave: "sem_permissao" }
        expect { sucesso: falso }
        error { tipo: "acesso_negado" }
      }
    }
  }

  flow resposta_segura {
    chave: Texto
    etapa tentar usa executar_operacao_sensivel com chave = chave em_sucesso concluir em_erro registrar_falha por_erro acesso_negado = tratar_acesso_negado, recurso_indisponivel = agendar_retentativa
    etapa tratar_acesso_negado usa responder_acesso_negado com chave = chave depende_de tentar
    etapa agendar_retentativa usa responder_retentativa com chave = chave depende_de tentar
    etapa registrar_falha usa registrar_auditoria_falha com chave = chave depende_de tentar
    etapa concluir usa registrar_sucesso com protocolo = tentar.protocolo depende_de tentar
  }
}
`,
  "autenticacao.sema": `module exemplos.autenticacao {
  docs {
    resumo: "Login, logout e renovacao de sessao com tokens."
  }

  entity Sessao {
    fields {
      id: Id
      usuario_id: Id
      token: Texto
      refresh_token: Texto
      expira_em: Timestamp
      ativo: Booleano
    }
  }

  task fazer_login {
    input {
      email: Email required
      senha: Texto required
    }
    output {
      token: Texto
      refresh_token: Texto
      expira_em: Timestamp
    }
    rules {
      email deve_ser email_valido
      senha deve_ser preenchida
    }
    effects {
      consulta Usuario por email
      persistencia Sessao
      auditoria login_realizado
      evento sessao_iniciada
    }
    state ciclo_sessao {
      transitions {
        INATIVA -> ATIVA
      }
    }
    guarantees {
      token existe
      refresh_token existe
    }
    error {
      credenciais_invalidas: "Email ou senha incorretos."
      conta_bloqueada: "Esta conta foi temporariamente bloqueada."
      conta_inativa: "Esta conta nao esta ativa."
    }
    tests {
      caso "login valido" {
        given { email: "user@app.com"  senha: "senha123" }
        expect { sucesso: verdadeiro }
      }
      caso "senha errada" {
        given { email: "user@app.com"  senha: "errada" }
        expect { sucesso: falso }
        error { tipo: "credenciais_invalidas" }
      }
    }
  }

  task renovar_token {
    input {
      refresh_token: Texto required
    }
    output {
      token: Texto
      expira_em: Timestamp
    }
    rules {
      refresh_token deve_ser valido
      refresh_token deve_ser nao_expirado
    }
    effects {
      consulta Sessao por refresh_token
      persistencia Sessao
      auditoria token_renovado
    }
    guarantees {
      token existe
    }
    error {
      refresh_invalido: "Token de renovacao invalido ou expirado."
    }
    tests {
      caso "renova com token valido" {
        given { refresh_token: "valid_refresh" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task fazer_logout {
    input {
      token: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      token deve_ser valido
    }
    effects {
      persistencia Sessao
      auditoria logout_realizado
      evento sessao_encerrada
    }
    state ciclo_sessao {
      transitions {
        ATIVA -> INATIVA
      }
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "logout valido" {
        given { token: "valid_token" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "notificacao.sema": `module exemplos.notificacao {
  docs {
    resumo: "Envio de notificacoes por email, SMS e push com rastreamento."
  }

  entity Notificacao {
    fields {
      id: Id
      destinatario_id: Id
      canal: Texto
      titulo: Texto
      corpo: Texto
      status: Texto
      enviada_em: Timestamp
    }
  }

  task enviar_email {
    input {
      destinatario: Email required
      titulo: Texto required
      corpo: Texto required
      template: Texto
    }
    output {
      notificacao_id: Id
    }
    rules {
      destinatario deve_ser email_valido
      titulo deve_ser preenchido
      corpo deve_ser preenchido
    }
    effects {
      consulta provedor_email criticidade = alta
      persistencia Notificacao
      auditoria email_enviado
    }
    guarantees {
      notificacao_id existe
    }
    error {
      destinatario_invalido: "Endereco de email invalido."
      provedor_indisponivel: "Servico de email temporariamente indisponivel."
      limite_excedido: "Limite de envios por hora atingido."
    }
    tests {
      caso "envia email valido" {
        given { destinatario: "user@app.com"  titulo: "Bem vindo"  corpo: "Ola!" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task enviar_push {
    input {
      device_token: Texto required
      titulo: Texto required
      corpo: Texto required
      dados: Objeto
    }
    output {
      notificacao_id: Id
    }
    rules {
      device_token deve_ser preenchido
      titulo deve_ser preenchido
    }
    effects {
      consulta provedor_push criticidade = media
      persistencia Notificacao
      auditoria push_enviado
    }
    guarantees {
      notificacao_id existe
    }
    error {
      token_invalido: "Token de dispositivo invalido ou expirado."
      provedor_indisponivel: "Servico push indisponivel."
    }
    tests {
      caso "envia push valido" {
        given { device_token: "tok_123"  titulo: "Alerta"  corpo: "Nova mensagem" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  flow notificar_multicanal {
    destinatario_id: Id
    titulo: Texto
    corpo: Texto
    etapa email usa enviar_email com destinatario = destinatario_id, titulo = titulo, corpo = corpo em_sucesso concluir em_erro registrar_falha_email
    etapa push usa enviar_push com device_token = destinatario_id, titulo = titulo, corpo = corpo em_sucesso concluir em_erro registrar_falha_push
    etapa registrar_falha_email usa registrar_falha_notificacao com canal = "email" depende_de email
    etapa registrar_falha_push usa registrar_falha_notificacao com canal = "push" depende_de push
    etapa concluir usa confirmar_notificacao com destinatario_id = destinatario_id depende_de email
  }
}
`,
  "estoque.sema": `module exemplos.estoque {
  docs {
    resumo: "Controle de estoque com reserva, entrada e saida de produtos."
  }

  entity ItemEstoque {
    fields {
      id: Id
      produto_id: Id
      quantidade: Inteiro
      quantidade_reservada: Inteiro
      localizacao: Texto
    }
  }

  entity MovimentacaoEstoque {
    fields {
      id: Id
      produto_id: Id
      tipo: Texto
      quantidade: Inteiro
      motivo: Texto
      realizada_em: Timestamp
    }
  }

  task reservar_estoque {
    input {
      produto_id: Id required
      quantidade: Inteiro required
      pedido_id: Id required
    }
    output {
      reserva_id: Id
    }
    rules {
      quantidade > 0
      produto_id deve_ser valido
    }
    effects {
      consulta ItemEstoque por produto_id criticidade = alta
      persistencia ItemEstoque
      persistencia MovimentacaoEstoque
      evento estoque_reservado criticidade = media
      auditoria reserva_estoque
    }
    guarantees {
      reserva_id existe
      ItemEstoque.quantidade_reservada >= quantidade
    }
    error {
      estoque_insuficiente: "Quantidade solicitada indisponivel em estoque."
      produto_nao_encontrado: "Produto nao localizado no estoque."
    }
    tests {
      caso "reserva com estoque disponivel" {
        given { produto_id: "prod_1"  quantidade: 5  pedido_id: "ped_1" }
        expect { sucesso: verdadeiro }
      }
      caso "reserva sem estoque" {
        given { produto_id: "prod_sem"  quantidade: 999  pedido_id: "ped_2" }
        expect { sucesso: falso }
        error { tipo: "estoque_insuficiente" }
      }
    }
  }

  task registrar_entrada {
    input {
      produto_id: Id required
      quantidade: Inteiro required
      motivo: Texto required
    }
    output {
      movimentacao_id: Id
    }
    rules {
      quantidade > 0
      motivo deve_ser preenchido
    }
    effects {
      persistencia ItemEstoque
      persistencia MovimentacaoEstoque
      evento estoque_reposto
      auditoria entrada_estoque
    }
    guarantees {
      movimentacao_id existe
    }
    tests {
      caso "entrada valida" {
        given { produto_id: "prod_1"  quantidade: 100  motivo: "Reposicao mensal" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task liberar_reserva {
    input {
      reserva_id: Id required
      motivo: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      reserva_id deve_ser valido
      motivo deve_ser preenchido
    }
    effects {
      persistencia ItemEstoque
      persistencia MovimentacaoEstoque
      evento reserva_liberada
      auditoria liberacao_reserva
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "libera reserva existente" {
        given { reserva_id: "res_1"  motivo: "Pedido cancelado" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "pedido.sema": `module exemplos.pedido {
  docs {
    resumo: "Ciclo completo de pedido com itens, aprovacao e entrega."
  }

  entity Pedido {
    fields {
      id: Id
      cliente_id: Id
      status: Texto
      total: Decimal
      criado_em: Timestamp
    }
  }

  entity ItemPedido {
    fields {
      id: Id
      pedido_id: Id
      produto_id: Id
      quantidade: Inteiro
      preco_unitario: Decimal
    }
  }

  task criar_pedido {
    input {
      cliente_id: Id required
      itens: Lista required
    }
    output {
      pedido: Pedido
    }
    rules {
      itens deve_ser nao_vazio
      cliente_id deve_ser valido
    }
    effects {
      consulta Cliente por cliente_id
      consulta Produto por cada item.produto_id
      persistencia Pedido
      persistencia ItemPedido
      evento pedido_criado criticidade = media
      auditoria criacao_pedido
    }
    state ciclo_pedido {
      transitions {
        RASCUNHO -> AGUARDANDO_PAGAMENTO
      }
    }
    guarantees {
      pedido existe
      pedido.total > 0
    }
    error {
      cliente_invalido: "Cliente nao encontrado."
      item_invalido: "Um ou mais produtos nao existem."
      carrinho_vazio: "O pedido deve ter ao menos um item."
    }
    tests {
      caso "cria pedido valido" {
        given { cliente_id: "cli_1"  itens: [{produto_id: "prod_1", quantidade: 2}] }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task cancelar_pedido {
    input {
      pedido_id: Id required
      motivo: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      pedido_id deve_ser valido
      pedido.status em [AGUARDANDO_PAGAMENTO, APROVADO]
      motivo deve_ser preenchido
    }
    effects {
      persistencia Pedido
      evento pedido_cancelado criticidade = alta
      notificacao cliente pedido_cancelado
      auditoria cancelamento_pedido criticidade = media
    }
    state ciclo_pedido {
      transitions {
        AGUARDANDO_PAGAMENTO -> CANCELADO
        APROVADO -> CANCELADO
      }
    }
    guarantees {
      protocolo existe
      pedido.status == CANCELADO
    }
    error {
      pedido_nao_cancelavel: "Pedido ja enviado ou entregue nao pode ser cancelado."
    }
    tests {
      caso "cancela pedido pendente" {
        given { pedido_id: "ped_1"  motivo: "Desistencia do cliente" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  flow aprovacao_pedido {
    pedido_id: Id
    token_pagamento: Texto
    etapa pagar usa processar_pagamento com pedido_id = pedido_id, token = token_pagamento em_sucesso reservar em_erro cancelar_por_pagamento
    etapa reservar usa reservar_estoque com pedido_id = pedido_id depende_de pagar em_erro cancelar_por_estoque
    etapa cancelar_por_pagamento usa cancelar_pedido com pedido_id = pedido_id, motivo = "Pagamento recusado" depende_de pagar
    etapa cancelar_por_estoque usa cancelar_pedido com pedido_id = pedido_id, motivo = "Estoque insuficiente" depende_de reservar
    effects {
      auditoria fluxo_aprovacao_pedido criticidade = alta
    }
  }
}
`,
  "relatorio.sema": `module exemplos.relatorio {
  docs {
    resumo: "Geracao assincrona de relatorios com download e notificacao."
  }

  entity Relatorio {
    fields {
      id: Id
      tipo: Texto
      parametros: Objeto
      status: Texto
      url_download: Texto
      solicitado_por: Id
      criado_em: Timestamp
      concluido_em: Timestamp
    }
  }

  task solicitar_relatorio {
    input {
      tipo: Texto required
      data_inicio: Data required
      data_fim: Data required
      formato: Texto
    }
    output {
      relatorio_id: Id
    }
    rules {
      tipo em [VENDAS, ESTOQUE, USUARIOS, FINANCEIRO]
      data_inicio deve_ser anterior_a data_fim
      formato em [PDF, CSV, XLSX]
    }
    effects {
      persistencia Relatorio
      evento relatorio_solicitado criticidade = baixa
      auditoria solicitacao_relatorio
    }
    state ciclo_relatorio {
      transitions {
        PENDENTE -> EM_PROCESSAMENTO
      }
    }
    guarantees {
      relatorio_id existe
    }
    error {
      tipo_invalido: "Tipo de relatorio nao suportado."
      periodo_invalido: "Data de inicio deve ser anterior a data de fim."
      limite_periodo: "Periodo maximo e de 12 meses."
    }
    tests {
      caso "solicita relatorio de vendas" {
        given { tipo: "VENDAS"  data_inicio: "2025-01-01"  data_fim: "2025-03-31"  formato: "PDF" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task concluir_relatorio {
    input {
      relatorio_id: Id required
      url_download: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      relatorio_id deve_ser valido
      url_download deve_ser preenchida
    }
    effects {
      persistencia Relatorio
      notificacao usuario relatorio_pronto criticidade = media
      evento relatorio_concluido
      auditoria conclusao_relatorio
    }
    state ciclo_relatorio {
      transitions {
        EM_PROCESSAMENTO -> CONCLUIDO
      }
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "conclui relatorio" {
        given { relatorio_id: "rel_1"  url_download: "https://storage/rel_1.pdf" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "upload_arquivo.sema": `module exemplos.upload.arquivo {
  docs {
    resumo: "Upload de arquivos com validacao de tipo, tamanho e processamento."
  }

  entity Arquivo {
    fields {
      id: Id
      nome: Texto
      tipo_mime: Texto
      tamanho_bytes: Inteiro
      url: Texto
      status: Texto
      enviado_por: Id
      criado_em: Timestamp
    }
  }

  task iniciar_upload {
    input {
      nome: Texto required
      tipo_mime: Texto required
      tamanho_bytes: Inteiro required
    }
    output {
      upload_id: Id
      url_upload: Texto
    }
    rules {
      tipo_mime em [image/jpeg, image/png, application/pdf, text/csv]
      tamanho_bytes <= 10485760
      nome deve_ser preenchido
    }
    effects {
      consulta storage criticidade = alta
      persistencia Arquivo
      auditoria upload_iniciado
    }
    guarantees {
      upload_id existe
      url_upload existe
    }
    error {
      tipo_nao_permitido: "Tipo de arquivo nao aceito."
      tamanho_excedido: "Arquivo excede o limite de 10MB."
      storage_indisponivel: "Servico de armazenamento indisponivel."
    }
    tests {
      caso "inicia upload de imagem" {
        given { nome: "foto.jpg"  tipo_mime: "image/jpeg"  tamanho_bytes: 512000 }
        expect { sucesso: verdadeiro }
      }
      caso "rejeita arquivo muito grande" {
        given { nome: "video.mp4"  tipo_mime: "video/mp4"  tamanho_bytes: 20971520 }
        expect { sucesso: falso }
        error { tipo: "tamanho_excedido" }
      }
    }
  }

  task confirmar_upload {
    input {
      upload_id: Id required
    }
    output {
      arquivo: Arquivo
    }
    rules {
      upload_id deve_ser valido
    }
    effects {
      consulta storage por upload_id criticidade = alta
      persistencia Arquivo
      evento arquivo_disponivel criticidade = baixa
      auditoria upload_confirmado
    }
    state ciclo_arquivo {
      transitions {
        PENDENTE -> DISPONIVEL
      }
    }
    guarantees {
      arquivo existe
      arquivo.url existe
    }
    tests {
      caso "confirma upload realizado" {
        given { upload_id: "upl_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "permissao.sema": `module exemplos.permissao {
  docs {
    resumo: "Controle de acesso baseado em papeis e permissoes granulares."
  }

  entity Papel {
    fields {
      id: Id
      nome: Texto
      descricao: Texto
    }
  }

  entity Permissao {
    fields {
      id: Id
      recurso: Texto
      acao: Texto
      descricao: Texto
    }
  }

  task atribuir_papel {
    input {
      usuario_id: Id required
      papel_id: Id required
    }
    output {
      atribuicao_id: Id
    }
    rules {
      usuario_id deve_ser valido
      papel_id deve_ser valido
    }
    effects {
      consulta Usuario por usuario_id
      consulta Papel por papel_id
      persistencia AtribuicaoPapel
      evento papel_atribuido criticidade = media
      auditoria atribuicao_papel criticidade = alta
    }
    guarantees {
      atribuicao_id existe
    }
    error {
      usuario_nao_encontrado: "Usuario nao localizado."
      papel_nao_encontrado: "Papel nao localizado."
      atribuicao_duplicada: "Usuario ja possui este papel."
    }
    tests {
      caso "atribui papel admin" {
        given { usuario_id: "usr_1"  papel_id: "papel_admin" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task verificar_permissao {
    input {
      usuario_id: Id required
      recurso: Texto required
      acao: Texto required
    }
    output {
      autorizado: Booleano
    }
    rules {
      usuario_id deve_ser valido
      recurso deve_ser preenchido
      acao deve_ser preenchida
    }
    effects {
      consulta AtribuicaoPapel por usuario_id
      consulta PermissaoPapel por papel_id
      auditoria verificacao_permissao
    }
    guarantees {
      autorizado existe
    }
    tests {
      caso "usuario autorizado" {
        given { usuario_id: "usr_admin"  recurso: "relatorios"  acao: "exportar" }
        expect { sucesso: verdadeiro }
      }
      caso "usuario sem permissao" {
        given { usuario_id: "usr_basico"  recurso: "admin"  acao: "deletar" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task revogar_papel {
    input {
      usuario_id: Id required
      papel_id: Id required
      motivo: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      usuario_id deve_ser valido
      papel_id deve_ser valido
      motivo deve_ser preenchido
    }
    effects {
      persistencia AtribuicaoPapel
      evento papel_revogado criticidade = alta
      auditoria revogacao_papel criticidade = alta
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "revoga papel" {
        given { usuario_id: "usr_1"  papel_id: "papel_admin"  motivo: "Saida da equipe" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "webhook.sema": `module exemplos.webhook {
  docs {
    resumo: "Recepcao, validacao e reenvio de eventos via webhook."
  }

  entity EventoWebhook {
    fields {
      id: Id
      origem: Texto
      tipo: Texto
      payload: Objeto
      status: Texto
      tentativas: Inteiro
      recebido_em: Timestamp
      processado_em: Timestamp
    }
  }

  task receber_webhook {
    input {
      origem: Texto required
      tipo: Texto required
      payload: Objeto required
      assinatura: Texto required
    }
    output {
      evento_id: Id
    }
    rules {
      assinatura deve_ser valida para payload
      origem deve_ser permitida
      tipo deve_ser preenchido
    }
    effects {
      persistencia EventoWebhook
      evento webhook_recebido criticidade = media
      auditoria recepcao_webhook
    }
    state ciclo_webhook {
      transitions {
        RECEBIDO -> EM_PROCESSAMENTO
      }
    }
    guarantees {
      evento_id existe
    }
    error {
      assinatura_invalida: "Assinatura do webhook nao confere."
      origem_nao_permitida: "Origem do webhook nao esta na lista de permitidos."
    }
    tests {
      caso "recebe webhook valido" {
        given { origem: "stripe"  tipo: "payment.succeeded"  payload: {}  assinatura: "sig_ok" }
        expect { sucesso: verdadeiro }
      }
      caso "rejeita assinatura invalida" {
        given { origem: "stripe"  tipo: "payment.succeeded"  payload: {}  assinatura: "sig_errada" }
        expect { sucesso: falso }
        error { tipo: "assinatura_invalida" }
      }
    }
  }

  task reenviar_webhook {
    input {
      evento_id: Id required
    }
    output {
      protocolo: Id
    }
    rules {
      evento_id deve_ser valido
      evento.tentativas < 5
      evento.status em [FALHOU, PENDENTE]
    }
    effects {
      consulta EventoWebhook por evento_id
      persistencia EventoWebhook
      evento webhook_reenviado
      auditoria reenvio_webhook
    }
    guarantees {
      protocolo existe
    }
    error {
      limite_tentativas: "Numero maximo de tentativas atingido."
      evento_ja_processado: "Este evento ja foi processado com sucesso."
    }
    tests {
      caso "reenvia evento falho" {
        given { evento_id: "evt_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "fila.sema": `module exemplos.fila {
  docs {
    resumo: "Processamento de jobs em fila com retentativa e dead letter."
  }

  entity Job {
    fields {
      id: Id
      tipo: Texto
      payload: Objeto
      status: Texto
      tentativas: Inteiro
      max_tentativas: Inteiro
      agendado_para: Timestamp
      processado_em: Timestamp
      erro: Texto
    }
  }

  task enfileirar_job {
    input {
      tipo: Texto required
      payload: Objeto required
      agendado_para: Timestamp
      max_tentativas: Inteiro
    }
    output {
      job_id: Id
    }
    rules {
      tipo deve_ser preenchido
      max_tentativas <= 10
    }
    effects {
      persistencia Job
      evento job_enfileirado criticidade = baixa
      auditoria enfileiramento_job
    }
    state ciclo_job {
      transitions {
        CRIADO -> PENDENTE
      }
    }
    guarantees {
      job_id existe
    }
    error {
      tipo_invalido: "Tipo de job nao registrado."
      fila_cheia: "Fila atingiu capacidade maxima."
    }
    tests {
      caso "enfileira job valido" {
        given { tipo: "envio_email"  payload: {destinatario: "a@b.com"} }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task processar_job {
    input {
      job_id: Id required
    }
    output {
      resultado: Objeto
    }
    rules {
      job_id deve_ser valido
      job.status == PENDENTE
    }
    effects {
      persistencia Job
      evento job_processado criticidade = baixa
      auditoria processamento_job
    }
    state ciclo_job {
      transitions {
        PENDENTE -> EM_EXECUCAO
        EM_EXECUCAO -> CONCLUIDO
        EM_EXECUCAO -> FALHOU
      }
    }
    guarantees {
      resultado existe
    }
    error {
      job_nao_encontrado: "Job nao localizado na fila."
      job_ja_processado: "Este job ja foi executado."
      execucao_falhou: "Falha durante a execucao do job."
    }
    tests {
      caso "processa job pendente" {
        given { job_id: "job_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task mover_para_dead_letter {
    input {
      job_id: Id required
      motivo: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      job_id deve_ser valido
      job.tentativas >= job.max_tentativas
    }
    effects {
      persistencia Job
      evento job_dead_letter criticidade = alta
      notificacao operacao falha_critica_job criticidade = alta
      auditoria dead_letter criticidade = alta
    }
    state ciclo_job {
      transitions {
        FALHOU -> DEAD_LETTER
      }
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "move job esgotado" {
        given { job_id: "job_esgotado"  motivo: "Timeout repetido" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "auditoria.sema": `module exemplos.auditoria {
  docs {
    resumo: "Registro imutavel de acoes criticas com rastreabilidade completa."
  }

  entity RegistroAuditoria {
    fields {
      id: Id
      ator_id: Id
      ator_tipo: Texto
      acao: Texto
      recurso: Texto
      recurso_id: Id
      dados_antes: Objeto
      dados_depois: Objeto
      ip_origem: Texto
      timestamp: Timestamp
      contexto: Objeto
    }
  }

  task registrar_acao {
    input {
      ator_id: Id required
      acao: Texto required
      recurso: Texto required
      recurso_id: Id required
      dados_antes: Objeto
      dados_depois: Objeto
      ip_origem: Texto
    }
    output {
      auditoria_id: Id
    }
    rules {
      acao deve_ser preenchida
      recurso deve_ser preenchido
      ator_id deve_ser valido
    }
    effects {
      persistencia RegistroAuditoria criticidade = alta
    }
    guarantees {
      auditoria_id existe
      RegistroAuditoria.imutavel == verdadeiro
    }
    error {
      falha_persistencia: "Nao foi possivel registrar a auditoria — operacao bloqueada."
    }
    tests {
      caso "registra acao critica" {
        given { ator_id: "usr_1"  acao: "deletar_usuario"  recurso: "Usuario"  recurso_id: "usr_2" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task consultar_historico {
    input {
      recurso: Texto required
      recurso_id: Id required
      data_inicio: Data
      data_fim: Data
    }
    output {
      registros: Lista
      total: Inteiro
    }
    rules {
      recurso deve_ser preenchido
      recurso_id deve_ser valido
    }
    effects {
      consulta RegistroAuditoria por recurso e recurso_id
      auditoria consulta_historico
    }
    guarantees {
      registros existe
      total >= 0
    }
    tests {
      caso "consulta historico de usuario" {
        given { recurso: "Usuario"  recurso_id: "usr_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "agendamento.sema": `module exemplos.agendamento {
  docs {
    resumo: "Agendamento de tarefas recorrentes e unicas com controle de execucao."
  }

  entity Agendamento {
    fields {
      id: Id
      nome: Texto
      tipo: Texto
      expressao_cron: Texto
      payload: Objeto
      ativo: Booleano
      ultima_execucao: Timestamp
      proxima_execucao: Timestamp
    }
  }

  entity ExecucaoAgendamento {
    fields {
      id: Id
      agendamento_id: Id
      status: Texto
      iniciado_em: Timestamp
      concluido_em: Timestamp
      erro: Texto
    }
  }

  task criar_agendamento {
    input {
      nome: Texto required
      tipo: Texto required
      expressao_cron: Texto required
      payload: Objeto
    }
    output {
      agendamento: Agendamento
    }
    rules {
      nome deve_ser preenchido
      expressao_cron deve_ser valida
      tipo deve_ser registrado
    }
    effects {
      persistencia Agendamento
      evento agendamento_criado criticidade = baixa
      auditoria criacao_agendamento
    }
    guarantees {
      agendamento existe
      agendamento.ativo == verdadeiro
    }
    error {
      cron_invalido: "Expressao cron invalida."
      tipo_nao_registrado: "Tipo de agendamento nao existe."
      nome_duplicado: "Ja existe agendamento com este nome."
    }
    tests {
      caso "cria agendamento diario" {
        given { nome: "relatorio_diario"  tipo: "gerar_relatorio"  expressao_cron: "0 8 * * *" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task executar_agendamento {
    input {
      agendamento_id: Id required
    }
    output {
      execucao_id: Id
    }
    rules {
      agendamento_id deve_ser valido
      agendamento.ativo == verdadeiro
    }
    effects {
      consulta Agendamento por agendamento_id
      persistencia ExecucaoAgendamento
      persistencia Agendamento
      evento agendamento_executado criticidade = baixa
      auditoria execucao_agendamento
    }
    state ciclo_execucao {
      transitions {
        PENDENTE -> EM_EXECUCAO
        EM_EXECUCAO -> CONCLUIDO
        EM_EXECUCAO -> FALHOU
      }
    }
    guarantees {
      execucao_id existe
    }
    error {
      agendamento_inativo: "Agendamento esta desativado."
      execucao_em_andamento: "Ja existe uma execucao em andamento para este agendamento."
    }
    tests {
      caso "executa agendamento ativo" {
        given { agendamento_id: "agd_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "integracao_externa.sema": `module exemplos.integracao.externa {
  docs {
    resumo: "Integracao com API externa com circuit breaker e fallback."
  }

  entity ChamadaExterna {
    fields {
      id: Id
      servico: Texto
      endpoint: Texto
      metodo: Texto
      status_http: Inteiro
      duracao_ms: Inteiro
      sucesso: Booleano
      realizada_em: Timestamp
    }
  }

  task consultar_cep {
    input {
      cep: Texto required
    }
    output {
      logradouro: Texto
      bairro: Texto
      cidade: Texto
      estado: Texto
    }
    rules {
      cep deve_ser formato_cep_valido
    }
    effects {
      consulta api_cep criticidade = media
      persistencia ChamadaExterna
      auditoria consulta_cep
    }
    guarantees {
      logradouro existe
      cidade existe
      estado existe
    }
    error {
      cep_nao_encontrado: "CEP nao localizado."
      servico_indisponivel: "API de CEP temporariamente indisponivel."
      formato_invalido: "CEP deve ter 8 digitos numericos."
    }
    tests {
      caso "consulta cep valido" {
        given { cep: "01310100" }
        expect { sucesso: verdadeiro }
      }
      caso "rejeita cep invalido" {
        given { cep: "00000000" }
        expect { sucesso: falso }
        error { tipo: "cep_nao_encontrado" }
      }
    }
  }

  task consultar_cnpj {
    input {
      cnpj: Texto required
    }
    output {
      razao_social: Texto
      situacao: Texto
      atividade_principal: Texto
    }
    rules {
      cnpj deve_ser formato_cnpj_valido
      cnpj deve_ser digitos_validos
    }
    effects {
      consulta api_receita criticidade = media
      persistencia ChamadaExterna
      auditoria consulta_cnpj
    }
    guarantees {
      razao_social existe
      situacao existe
    }
    error {
      cnpj_nao_encontrado: "CNPJ nao localizado na Receita Federal."
      servico_indisponivel: "Servico da Receita Federal indisponivel."
      formato_invalido: "CNPJ invalido."
    }
    tests {
      caso "consulta cnpj valido" {
        given { cnpj: "11222333000181" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "multi_tenant.sema": `module exemplos.multi.tenant {
  docs {
    resumo: "Isolamento de dados por tenant com provisionamento e controle de limites."
  }

  entity Tenant {
    fields {
      id: Id
      nome: Texto
      slug: Texto
      plano: Texto
      ativo: Booleano
      criado_em: Timestamp
    }
  }

  entity LimiteTenant {
    fields {
      tenant_id: Id
      recurso: Texto
      limite: Inteiro
      utilizado: Inteiro
    }
  }

  task provisionar_tenant {
    input {
      nome: Texto required
      slug: Texto required
      plano: Texto required
      email_admin: Email required
    }
    output {
      tenant: Tenant
    }
    rules {
      slug deve_ser unico em Tenant.slug
      slug deve_ser formato_slug_valido
      plano em [FREE, PRO, ENTERPRISE]
      email_admin deve_ser email_valido
    }
    effects {
      persistencia Tenant
      persistencia LimiteTenant
      persistencia Usuario
      evento tenant_provisionado criticidade = alta
      notificacao admin boas_vindas criticidade = media
      auditoria provisionamento_tenant criticidade = alta
    }
    guarantees {
      tenant existe
      tenant.ativo == verdadeiro
    }
    error {
      slug_duplicado: "Este slug ja esta em uso."
      plano_invalido: "Plano selecionado nao existe."
      email_invalido: "Email do administrador invalido."
    }
    tests {
      caso "provisiona tenant pro" {
        given { nome: "Empresa X"  slug: "empresa-x"  plano: "PRO"  email_admin: "admin@x.com" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task verificar_limite {
    input {
      tenant_id: Id required
      recurso: Texto required
      quantidade: Inteiro required
    }
    output {
      permitido: Booleano
      utilizado: Inteiro
      limite: Inteiro
    }
    rules {
      tenant_id deve_ser valido
      recurso deve_ser preenchido
      quantidade > 0
    }
    effects {
      consulta LimiteTenant por tenant_id e recurso
      auditoria verificacao_limite
    }
    guarantees {
      permitido existe
    }
    error {
      tenant_nao_encontrado: "Tenant nao localizado."
      recurso_desconhecido: "Recurso nao rastreado para este tenant."
    }
    tests {
      caso "dentro do limite" {
        given { tenant_id: "ten_1"  recurso: "usuarios"  quantidade: 5 }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task suspender_tenant {
    input {
      tenant_id: Id required
      motivo: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      tenant_id deve_ser valido
      motivo deve_ser preenchido
      tenant.ativo == verdadeiro
    }
    effects {
      persistencia Tenant
      evento tenant_suspenso criticidade = alta
      notificacao admin suspensao_tenant criticidade = alta
      auditoria suspensao_tenant criticidade = alta
    }
    state ciclo_tenant {
      transitions {
        ATIVO -> SUSPENSO
      }
    }
    guarantees {
      protocolo existe
      tenant.ativo == falso
    }
    error {
      tenant_ja_suspenso: "Tenant ja esta suspenso."
    }
    tests {
      caso "suspende tenant ativo" {
        given { tenant_id: "ten_1"  motivo: "Inadimplencia" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "exportacao.sema": `module exemplos.exportacao {
  docs {
    resumo: "Exportacao de dados em multiplos formatos com controle de acesso e rastreamento."
  }

  entity ExportacaoDados {
    fields {
      id: Id
      tipo: Texto
      formato: Texto
      filtros: Objeto
      total_registros: Inteiro
      url_arquivo: Texto
      status: Texto
      solicitado_por: Id
      expira_em: Timestamp
    }
  }

  task solicitar_exportacao {
    input {
      tipo: Texto required
      formato: Texto required
      filtros: Objeto
    }
    output {
      exportacao_id: Id
    }
    rules {
      tipo em [USUARIOS, PEDIDOS, FINANCEIRO, ESTOQUE]
      formato em [CSV, XLSX, JSON]
    }
    effects {
      persistencia ExportacaoDados
      evento exportacao_solicitada criticidade = media
      auditoria solicitacao_exportacao criticidade = media
    }
    state ciclo_exportacao {
      transitions {
        PENDENTE -> EM_PROCESSAMENTO
      }
    }
    guarantees {
      exportacao_id existe
    }
    error {
      tipo_invalido: "Tipo de exportacao nao suportado."
      formato_invalido: "Formato de arquivo nao suportado."
      permissao_negada: "Sem permissao para exportar este tipo de dado."
    }
    tests {
      caso "solicita exportacao de usuarios em csv" {
        given { tipo: "USUARIOS"  formato: "CSV" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task concluir_exportacao {
    input {
      exportacao_id: Id required
      url_arquivo: Texto required
      total_registros: Inteiro required
    }
    output {
      protocolo: Id
    }
    rules {
      exportacao_id deve_ser valido
      url_arquivo deve_ser preenchida
      total_registros >= 0
    }
    effects {
      persistencia ExportacaoDados
      notificacao usuario exportacao_pronta criticidade = media
      evento exportacao_concluida
      auditoria conclusao_exportacao
    }
    state ciclo_exportacao {
      transitions {
        EM_PROCESSAMENTO -> DISPONIVEL
      }
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "conclui exportacao" {
        given { exportacao_id: "exp_1"  url_arquivo: "https://storage/exp_1.csv"  total_registros: 1500 }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "assinatura.sema": `module exemplos.assinatura {
  docs {
    resumo: "Gestao de assinaturas recorrentes com upgrade, downgrade e cancelamento."
  }

  entity Assinatura {
    fields {
      id: Id
      cliente_id: Id
      plano_id: Id
      status: Texto
      inicio_em: Timestamp
      proximo_vencimento: Timestamp
      cancelada_em: Timestamp
    }
  }

  task criar_assinatura {
    input {
      cliente_id: Id required
      plano_id: Id required
      token_pagamento: Texto required
    }
    output {
      assinatura: Assinatura
    }
    rules {
      cliente_id deve_ser valido
      plano_id deve_ser valido
      token_pagamento deve_ser valido
    }
    effects {
      consulta Cliente por cliente_id
      consulta Plano por plano_id
      consulta gateway_pagamento criticidade = alta
      persistencia Assinatura
      evento assinatura_criada criticidade = alta
      notificacao cliente confirmacao_assinatura criticidade = media
      auditoria criacao_assinatura criticidade = alta
    }
    state ciclo_assinatura {
      transitions {
        PENDENTE -> ATIVA
      }
    }
    guarantees {
      assinatura existe
      assinatura.status == ATIVA
    }
    error {
      pagamento_recusado: "Pagamento inicial recusado."
      cliente_ja_assina: "Cliente ja possui assinatura ativa."
      plano_invalido: "Plano nao disponivel para assinatura."
    }
    tests {
      caso "cria assinatura pro" {
        given { cliente_id: "cli_1"  plano_id: "plano_pro"  token_pagamento: "tok_ok" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task cancelar_assinatura {
    input {
      assinatura_id: Id required
      motivo: Texto required
      imediato: Booleano
    }
    output {
      protocolo: Id
    }
    rules {
      assinatura_id deve_ser valido
      assinatura.status == ATIVA
      motivo deve_ser preenchido
    }
    effects {
      persistencia Assinatura
      consulta gateway_pagamento criticidade = alta
      evento assinatura_cancelada criticidade = alta
      notificacao cliente confirmacao_cancelamento criticidade = media
      auditoria cancelamento_assinatura criticidade = alta
    }
    state ciclo_assinatura {
      transitions {
        ATIVA -> CANCELADA
        ATIVA -> PENDENTE_CANCELAMENTO
      }
    }
    guarantees {
      protocolo existe
    }
    error {
      assinatura_ja_cancelada: "Assinatura ja foi cancelada."
    }
    tests {
      caso "cancela assinatura ativa" {
        given { assinatura_id: "asn_1"  motivo: "Nao preciso mais"  imediato: falso }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task renovar_assinatura {
    input {
      assinatura_id: Id required
    }
    output {
      protocolo_cobranca: Id
    }
    rules {
      assinatura_id deve_ser valido
      assinatura.status == ATIVA
      assinatura.proximo_vencimento <= hoje
    }
    effects {
      consulta gateway_pagamento criticidade = alta
      persistencia Assinatura
      evento assinatura_renovada criticidade = media
      auditoria renovacao_assinatura criticidade = alta
    }
    guarantees {
      protocolo_cobranca existe
    }
    error {
      pagamento_recusado: "Cobranca de renovacao recusada — assinatura sera suspensa."
      assinatura_cancelada: "Nao e possivel renovar assinatura cancelada."
    }
    tests {
      caso "renova assinatura no vencimento" {
        given { assinatura_id: "asn_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
  "dominio_compartilhado.sema": `module exemplos.dominio.compartilhado {
  docs {
    resumo: "Entidades, enums e states de dominio reutilizaveis entre modulos via use."
  }

  entity Endereco {
    fields {
      logradouro: Texto
      numero: Texto
      complemento: Texto
      bairro: Texto
      cidade: Texto
      estado: Texto
      cep: Texto
      pais: Texto
    }
  }

  entity Dinheiro {
    fields {
      valor: Decimal
      moeda: Texto
    }
  }

  enum StatusGeral {
    ATIVO,
    INATIVO,
    PENDENTE,
    CANCELADO,
    ARQUIVADO
  }

  enum Prioridade {
    BAIXA,
    MEDIA,
    ALTA,
    CRITICA
  }

  state ciclo_entidade {
    fields {
      status: StatusGeral
      atualizado_em: Timestamp
    }
    invariants {
      status existe
    }
    transitions {
      PENDENTE -> ATIVO
      ATIVO -> INATIVO
      ATIVO -> CANCELADO
      INATIVO -> ATIVO
      CANCELADO -> ARQUIVADO
    }
  }
}
`,
  "carrinho.sema": `module exemplos.web.carrinho {
  docs {
    resumo: "Carrinho de compras com adicao, remocao e calculo de totais."
  }

  entity Carrinho {
    fields {
      id: Id
      sessao_id: Texto
      usuario_id: Id
      itens: Lista
      subtotal: Decimal
      desconto: Decimal
      total: Decimal
      atualizado_em: Timestamp
    }
  }

  entity ItemCarrinho {
    fields {
      id: Id
      carrinho_id: Id
      produto_id: Id
      nome: Texto
      preco_unitario: Decimal
      quantidade: Inteiro
      subtotal: Decimal
    }
  }

  task adicionar_item {
    input {
      sessao_id: Texto required
      produto_id: Id required
      quantidade: Inteiro required
    }
    output {
      carrinho: Carrinho
    }
    rules {
      quantidade > 0
      quantidade <= 99
      produto_id deve_ser valido
    }
    effects {
      consulta Produto por produto_id
      consulta Carrinho por sessao_id
      persistencia Carrinho
      persistencia ItemCarrinho
      evento item_adicionado_carrinho criticidade = baixa
    }
    guarantees {
      carrinho existe
      carrinho.total >= 0
    }
    error {
      produto_nao_encontrado: "Produto nao encontrado."
      produto_indisponivel: "Produto fora de estoque."
      quantidade_invalida: "Quantidade deve ser entre 1 e 99."
    }
    tests {
      caso "adiciona item ao carrinho" {
        given { sessao_id: "sess_1"  produto_id: "prod_1"  quantidade: 2 }
        expect { sucesso: verdadeiro }
      }
      caso "rejeita quantidade zero" {
        given { sessao_id: "sess_1"  produto_id: "prod_1"  quantidade: 0 }
        expect { sucesso: falso }
        error { tipo: "quantidade_invalida" }
      }
    }
  }

  task remover_item {
    input {
      sessao_id: Texto required
      item_id: Id required
    }
    output {
      carrinho: Carrinho
    }
    rules {
      item_id deve_ser valido
    }
    effects {
      persistencia Carrinho
      persistencia ItemCarrinho
      evento item_removido_carrinho criticidade = baixa
    }
    guarantees {
      carrinho existe
    }
    error {
      item_nao_encontrado: "Item nao encontrado no carrinho."
    }
    tests {
      caso "remove item existente" {
        given { sessao_id: "sess_1"  item_id: "item_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task aplicar_cupom {
    input {
      sessao_id: Texto required
      cupom: Texto required
    }
    output {
      carrinho: Carrinho
      desconto_aplicado: Decimal
    }
    rules {
      cupom deve_ser preenchido
    }
    effects {
      consulta Cupom por cupom criticidade = media
      persistencia Carrinho
      auditoria uso_cupom
    }
    guarantees {
      carrinho existe
      desconto_aplicado >= 0
    }
    error {
      cupom_invalido: "Cupom nao encontrado ou expirado."
      cupom_ja_usado: "Este cupom ja foi utilizado."
      carrinho_vazio: "Adicione itens antes de aplicar um cupom."
    }
    tests {
      caso "aplica cupom valido" {
        given { sessao_id: "sess_1"  cupom: "PROMO10" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  route api_carrinho_adicionar {
    metodo: POST
    caminho: /api/carrinho/itens
    task: adicionar_item
    finalidade: adicao_item_carrinho
    input { sessao_id: Texto  produto_id: Id  quantidade: Inteiro }
    output { carrinho: Carrinho }
  }

  route api_carrinho_cupom {
    metodo: POST
    caminho: /api/carrinho/cupom
    task: aplicar_cupom
    finalidade: aplicacao_desconto
    input { sessao_id: Texto  cupom: Texto }
    output { carrinho: Carrinho  desconto_aplicado: Decimal }
  }
}
`,
  "pagina_catalogo.sema": `module exemplos.web.catalogo {
  docs {
    resumo: "Pagina de catalogo de produtos com listagem, busca e filtros."
  }

  entity ProdutoCatalogo {
    fields {
      id: Id
      nome: Texto
      preco: Decimal
      categoria: Texto
      imagem_url: Texto
      disponivel: Booleano
    }
  }

  task buscar_produtos {
    input {
      termo: Texto
      categoria: Texto
      preco_min: Decimal
      preco_max: Decimal
      pagina: Inteiro
    }
    output {
      produtos: Lista
      total: Inteiro
      paginas: Inteiro
    }
    rules {
      pagina >= 1
    }
    effects {
      consulta ProdutoCatalogo
      auditoria busca_catalogo
    }
    guarantees {
      produtos existe
      total >= 0
    }
    tests {
      caso "busca sem filtros" {
        given { pagina: 1 }
        expect { sucesso: verdadeiro }
      }
      caso "busca por termo" {
        given { termo: "camisa"  pagina: 1 }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task obter_produto {
    input {
      produto_id: Id required
    }
    output {
      produto: ProdutoCatalogo
    }
    rules {
      produto_id deve_ser valido
    }
    effects {
      consulta ProdutoCatalogo por produto_id
      auditoria visualizacao_produto
    }
    guarantees {
      produto existe
    }
    error {
      produto_nao_encontrado: "Produto nao localizado."
      produto_inativo: "Produto indisponivel no momento."
    }
    tests {
      caso "obtem produto existente" {
        given { produto_id: "prod_1" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  route api_catalogo {
    metodo: GET
    caminho: /api/catalogo
    task: buscar_produtos
    finalidade: listagem_publica
    input { termo: Texto  categoria: Texto  pagina: Inteiro }
    output { produtos: Lista  total: Inteiro  paginas: Inteiro }
  }

  route api_produto_detalhe {
    metodo: GET
    caminho: /api/catalogo/:produto_id
    task: obter_produto
    finalidade: detalhe_produto
    input { produto_id: Id }
    output { produto: ProdutoCatalogo }
  }
}
`,
  "preferencias_usuario.sema": `module exemplos.preferencias.usuario {
  docs {
    resumo: "Gerenciamento de preferencias, configuracoes e onboarding do usuario."
  }

  entity PreferenciasUsuario {
    fields {
      usuario_id: Id
      idioma: Texto
      tema: Texto
      notificacoes_email: Booleano
      notificacoes_push: Booleano
      fuso_horario: Texto
      onboarding_concluido: Booleano
      atualizado_em: Timestamp
    }
  }

  entity EtapaOnboarding {
    fields {
      usuario_id: Id
      etapa: Texto
      concluida: Booleano
      concluida_em: Timestamp
    }
  }

  task salvar_preferencias {
    input {
      usuario_id: Id required
      idioma: Texto
      tema: Texto
      notificacoes_email: Booleano
      notificacoes_push: Booleano
      fuso_horario: Texto
    }
    output {
      preferencias: PreferenciasUsuario
    }
    rules {
      usuario_id deve_ser valido
      idioma em [pt-BR, en-US, es-ES, fr-FR]
      tema em [claro, escuro, sistema]
    }
    effects {
      persistencia PreferenciasUsuario
      evento preferencias_atualizadas criticidade = baixa
      auditoria atualizacao_preferencias
    }
    guarantees {
      preferencias existe
    }
    error {
      idioma_invalido: "Idioma nao suportado."
      tema_invalido: "Tema nao disponivel."
    }
    tests {
      caso "salva preferencias validas" {
        given { usuario_id: "usr_1"  idioma: "pt-BR"  tema: "escuro" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task concluir_etapa_onboarding {
    input {
      usuario_id: Id required
      etapa: Texto required
    }
    output {
      onboarding_completo: Booleano
      proxima_etapa: Texto
    }
    rules {
      usuario_id deve_ser valido
      etapa em [perfil, preferencias, tutorial, primeiro_uso]
    }
    effects {
      persistencia EtapaOnboarding
      persistencia PreferenciasUsuario
      evento etapa_onboarding_concluida criticidade = baixa
      auditoria progresso_onboarding
    }
    guarantees {
      onboarding_completo existe
    }
    error {
      etapa_invalida: "Etapa de onboarding desconhecida."
      etapa_ja_concluida: "Esta etapa ja foi concluida."
    }
    tests {
      caso "conclui etapa perfil" {
        given { usuario_id: "usr_1"  etapa: "perfil" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  route api_preferencias {
    metodo: PUT
    caminho: /api/usuarios/:usuario_id/preferencias
    task: salvar_preferencias
    finalidade: atualizacao_preferencias
    input { idioma: Texto  tema: Texto  notificacoes_email: Booleano  fuso_horario: Texto }
    output { preferencias: PreferenciasUsuario }
  }
}
`,
  "formulario_contato.sema": `module exemplos.web.contato {
  docs {
    resumo: "Formulario de contato com validacao, anti-spam e notificacao."
  }

  entity MensagemContato {
    fields {
      id: Id
      nome: Texto
      email: Email
      assunto: Texto
      mensagem: Texto
      ip_origem: Texto
      respondida: Booleano
      criada_em: Timestamp
    }
  }

  task enviar_contato {
    input {
      nome: Texto required
      email: Email required
      assunto: Texto required
      mensagem: Texto required
      token_captcha: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      nome deve_ser preenchido
      email deve_ser email_valido
      assunto deve_ser preenchido
      mensagem deve_ser preenchida
      mensagem.tamanho <= 2000
      token_captcha deve_ser valido
    }
    effects {
      consulta servico_captcha criticidade = alta
      persistencia MensagemContato
      notificacao equipe nova_mensagem_contato criticidade = media
      notificacao remetente confirmacao_recebimento criticidade = baixa
      auditoria envio_contato
    }
    guarantees {
      protocolo existe
    }
    error {
      captcha_invalido: "Verificacao anti-spam falhou. Tente novamente."
      email_invalido: "Endereco de email invalido."
      mensagem_muito_longa: "Mensagem excede o limite de 2000 caracteres."
      limite_diario: "Limite de mensagens por dia atingido para este IP."
    }
    tests {
      caso "envia contato valido" {
        given { nome: "Maria"  email: "maria@email.com"  assunto: "Duvida"  mensagem: "Ola!"  token_captcha: "tok_ok" }
        expect { sucesso: verdadeiro }
      }
      caso "rejeita captcha invalido" {
        given { nome: "Bot"  email: "bot@spam.com"  assunto: "Spam"  mensagem: "Compre agora"  token_captcha: "tok_invalido" }
        expect { sucesso: falso }
        error { tipo: "captcha_invalido" }
      }
    }
  }

  route api_contato {
    metodo: POST
    caminho: /api/contato
    task: enviar_contato
    finalidade: recepcao_contato
    input { nome: Texto  email: Email  assunto: Texto  mensagem: Texto  token_captcha: Texto }
    output { protocolo: Id }
    error {
      captcha_invalido: "Verificacao de seguranca falhou."
      limite_diario: "Muitas mensagens enviadas hoje."
    }
  }
}
`,
  "persistencia_postgres.sema": `module exemplos.persistencia.postgres {
  docs {
    resumo: "Exemplo vendor-first para PostgreSQL com tabela, relacao e consulta SQL."
  }

  database principal_postgres {
    engine: postgres
    schema: public
    consistency: forte
    durability: alta
    transaction_model: mvcc
    query_model: sql
    capabilities {
      joins
      views
      foreign_keys
    }
    table pedidos {
      entity: Pedido
    }
    relationship pedido_cliente {
      from: Pedido
      to: Cliente
    }
    query buscar_pedidos {
      mode: sql
    }
  }
}
`,
  "persistencia_mysql.sema": `module exemplos.persistencia.mysql {
  docs {
    resumo: "Exemplo vendor-first para MySQL com tabela operacional e indice."
  }

  database principal_mysql {
    engine: mysql
    consistency: forte
    durability: alta
    transaction_model: bloqueio
    query_model: sql
    table faturamento {
      table: faturamento
    }
    index faturamento_status {
      table: faturamento
    }
    query buscar_faturas {
      mode: sql
    }
  }
}
`,
  "persistencia_sqlite.sema": `module exemplos.persistencia.sqlite {
  docs {
    resumo: "Exemplo vendor-first para SQLite com cache local e retencao curta."
  }

  database principal_sqlite {
    engine: sqlite
    consistency: snapshot
    durability: media
    transaction_model: single_thread
    query_model: sql
    table cache_local {
      table: cache_local
    }
    retention limpeza_local {
      retention: "7d"
    }
  }
}
`,
  "persistencia_mongodb.sema": `module exemplos.persistencia.mongodb {
  docs {
    resumo: "Exemplo vendor-first para MongoDB com colecao, documento e pipeline."
  }

  database principal_mongodb {
    engine: mongodb
    consistency: eventual
    durability: alta
    transaction_model: documento
    query_model: documento
    collection pedidos {
      collection: pedidos
    }
    document pedido_snapshot {
      entity: PedidoSnapshot
    }
    query pipeline_pedido {
      mode: pipeline
    }
  }
}
`,
  "persistencia_redis.sema": `module exemplos.persistencia.redis {
  docs {
    resumo: "Exemplo vendor-first para Redis com keyspace, stream e TTL."
  }

  database principal_redis {
    engine: redis
    consistency: eventual
    durability: media
    transaction_model: single_thread
    query_model: chave_valor
    keyspace cache_pedidos {
      ttl: "300s"
    }
    stream eventos_pedido {
      surface: fila
    }
    retention expurgo_cache {
      retention: "300s"
    }
  }
}
`,
};

async function criarExemplosSema(raiz) {
  const { mkdir, writeFile: wf, access } = require("node:fs/promises");
  const path = require("node:path");
  const pasta = path.join(raiz, "exemplos");
  await mkdir(pasta, { recursive: true });
  for (const [nome, conteudo] of Object.entries(EXEMPLOS_SEMA)) {
    const caminho = path.join(pasta, nome);
    try { await access(caminho); } catch {
      await wf(caminho, conteudo, "utf-8");
    }
  }
}

async function configurarIaNoWorkspace() {
  const raiz = obterRaizWorkspace();
  if (!raiz) {
    vscode.window.showWarningMessage("Sema: Nenhuma pasta aberta.");
    return;
  }

  const { mkdir, writeFile: wf, readFile: rf } = require("node:fs/promises");
  const path = require("node:path");

  const arquivos = [
    // Claude Code
    [path.join(raiz, ".claude", "CLAUDE.md"), INSTRUCOES_SEMA],
    // Cursor
    [path.join(raiz, ".cursor", "rules", "sema.mdc"), INSTRUCOES_SEMA],
    // Windsurf
    [path.join(raiz, ".windsurf", "rules.md"), INSTRUCOES_SEMA],
    // Cline
    [path.join(raiz, ".clinerules"), INSTRUCOES_SEMA],
    // OpenCode
    [path.join(raiz, ".opencode", "instructions.md"), INSTRUCOES_SEMA],
    // GitHub Copilot
    [path.join(raiz, ".github", "copilot-instructions.md"), INSTRUCOES_SEMA],
    // AGENTS.md — padrao geral
    [path.join(raiz, "AGENTS.md"), INSTRUCOES_SEMA],
  ];

  const home = require("node:os").homedir();
  const CLINE_AUTO_APPROVE = ["sema_validar", "sema_ir", "sema_drift", "sema_resumo", "sema_prompt_ia", "sema_contexto_ia", "sema_verificar", "sema_inspecionar"];
  const mcpConfigs = [
    // VS Code global
    [path.join(home, "AppData", "Roaming", "Code", "User", "mcp.json"), "vscode"],
    // Cursor global
    [path.join(home, ".cursor", "mcp.json"), "cursor"],
    // Windsurf global
    [path.join(home, ".codeium", "windsurf", "mcp_config.json"), "windsurf"],
    // Antigravity (Gemini) global
    [path.join(home, ".gemini", "antigravity", "mcp_config.json"), "windsurf"],
    // Cline global
    [path.join(home, "AppData", "Roaming", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"), "cline"],
  ];

  let criados = 0;

  for (const [caminho, conteudo] of arquivos) {
    try {
      await mkdir(path.dirname(caminho), { recursive: true });
      await wf(caminho, conteudo, "utf-8");
      criados++;
    } catch {}
  }

  for (const [caminho, tipo] of mcpConfigs) {
    try {
      await mkdir(path.dirname(caminho), { recursive: true });
      let config = {};
      try { config = JSON.parse(await rf(caminho, "utf-8")); } catch {}

      if (tipo === "cline") {
        config.mcpServers = config.mcpServers ?? {};
        config.mcpServers.sema = { command: "npx", args: ["-y", "@semacode/mcp@latest"], autoApprove: CLINE_AUTO_APPROVE, timeout: 3600 };
      } else if (tipo === "windsurf" || tipo === "cursor") {
        config.mcpServers = config.mcpServers ?? {};
        config.mcpServers.sema = { command: "npx", args: ["-y", "@semacode/mcp@latest"] };
      } else {
        config.servers = config.servers ?? {};
        config.servers.sema = { type: "stdio", command: "npx", args: ["-y", "@semacode/mcp@latest"] };
      }

      await wf(caminho, JSON.stringify(config, null, "\t"), "utf-8");
      criados++;
    } catch {}
  }

  await criarExemplosSema(raiz);

  vscode.window.showInformationMessage(
    `Sema: IA configurada no projeto (${criados} arquivos criados/atualizados).`
  );
}

async function configurarIaFerramenta(ferramenta) {
  const raiz = obterRaizWorkspace();
  if (!raiz) {
    vscode.window.showWarningMessage("Sema: Nenhuma pasta aberta.");
    return;
  }

  const { mkdir, writeFile: wf, readFile: rf } = require("node:fs/promises");
  const path = require("node:path");
  const home = require("node:os").homedir();

  const MCP_STDIO = { command: "npx", args: ["-y", "@semacode/mcp@latest"] };
  const CLINE_AUTO_APPROVE = ["sema_validar", "sema_ir", "sema_drift", "sema_resumo", "sema_prompt_ia", "sema_contexto_ia", "sema_verificar", "sema_inspecionar"];

  const configs = {
    claude: {
      label: "Claude Code",
      arquivos: [[path.join(raiz, ".claude", "CLAUDE.md"), INSTRUCOES_SEMA]],
      mcp: [[path.join(home, "AppData", "Roaming", "Code", "User", "mcp.json"), "vscode"]],
    },
    cursor: {
      label: "Cursor",
      arquivos: [[path.join(raiz, ".cursor", "rules", "sema.mdc"), INSTRUCOES_SEMA]],
      mcp: [[path.join(home, ".cursor", "mcp.json"), "cursor"]],
    },
    windsurf: {
      label: "Windsurf",
      arquivos: [[path.join(raiz, ".windsurf", "rules.md"), INSTRUCOES_SEMA]],
      mcp: [[path.join(home, ".codeium", "windsurf", "mcp_config.json"), "windsurf"]],
    },
    cline: {
      label: "Cline",
      arquivos: [[path.join(raiz, ".clinerules"), INSTRUCOES_SEMA]],
      mcp: [[path.join(home, "AppData", "Roaming", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"), "cline"]],
    },
    copilot: {
      label: "GitHub Copilot",
      arquivos: [[path.join(raiz, ".github", "copilot-instructions.md"), INSTRUCOES_SEMA]],
      mcp: [],
    },
    opencode: {
      label: "OpenCode",
      arquivos: [[path.join(raiz, ".opencode", "instructions.md"), INSTRUCOES_SEMA]],
      mcp: [],
    },
  };

  const cfg = configs[ferramenta];
  if (!cfg) return;

  let criados = 0;

  for (const [caminho, conteudo] of cfg.arquivos) {
    try {
      await mkdir(path.dirname(caminho), { recursive: true });
      await wf(caminho, conteudo, "utf-8");
      criados++;
    } catch {}
  }

  for (const [caminho, tipo] of cfg.mcp) {
    try {
      await mkdir(path.dirname(caminho), { recursive: true });
      let config = {};
      try { config = JSON.parse(await rf(caminho, "utf-8")); } catch {}

      if (tipo === "cline") {
        config.mcpServers = config.mcpServers ?? {};
        config.mcpServers.sema = { ...MCP_STDIO, autoApprove: CLINE_AUTO_APPROVE, timeout: 3600 };
      } else if (tipo === "windsurf" || tipo === "cursor") {
        config.mcpServers = config.mcpServers ?? {};
        config.mcpServers.sema = MCP_STDIO;
      } else {
        config.servers = config.servers ?? {};
        config.servers.sema = { type: "stdio", ...MCP_STDIO };
      }

      await wf(caminho, JSON.stringify(config, null, "\t"), "utf-8");
      criados++;
    } catch {}
  }

  await criarExemplosSema(raiz);

  vscode.window.showInformationMessage(
    `Sema: ${cfg.label} configurado (${criados} arquivo(s) criado(s)/atualizado(s)).`
  );
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
