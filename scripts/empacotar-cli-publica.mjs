// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento
// Consulte contratos/sema/fronteira_repositorios_empacotamento.sema antes de editar.
// Descrição: fabrica a CLI pública em stage privado por execução e publica o tarball sem sobrescrever.
import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = process.cwd();
const pastaTemporaria = path.join(raiz, ".tmp");
const saidaPadrao = path.join(pastaTemporaria, "pacotes-instalador-npm");
const origemCli = path.join(raiz, "pacotes", "cli");
const FLAGS_ORIGEM = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);

const DOCS_PUBLICOS = [
  "README.md", "ai-integration.md", "ai-onboarding.md", "ai-workflow.md", "auth.md",
  "cli.md", "commands.md", "database.md", "descoberta-capacidades.md", "deploy.md",
  "documentation.md", "drift-cache.md", "env.md", "frontend.md", "getting-started.md",
  "i18n.md", "pipeline-conteudo.md", "profiles.md", "repositories.md", "rollback.md",
  "security.md", "sistemas-interativos.md", "support.md", "syntax.md", "testing.md",
  "vocabulary.md",
];

export const PACOTES_RUNTIME = [
  "nucleo", "padroes", "gerador-lua", "gerador-typescript", "gerador-python",
  "gerador-dart", "gerador-javascript", "gerador-html", "gerador-css", "gerador-php",
  "gerador-dotnet", "gerador-cpp",
];

const DIST_NAO_PUBLICAVEL = [
  /(?:^|[/\\])[^/\\]*\.(?:map|pem|key|p12|pfx)$/i,
  /(?:^|[/\\])\.env(?:\.|$)/i,
  /(?:^|[/\\])billing(?:[/\\]|\.|$)/i,
];
const MARCADORES_PORTEIRO_LEGADO = [
  { regex: /\bpreflight\b/i, motivo: "terminologia preflight legada" },
  { regex: /\bsema\s+preflight\b/i, motivo: "comando de autorizacao legado" },
  { regex: /\b(?:comando|executar)PreflightCli\b/, motivo: "handler de autorizacao legado" },
  { regex: /\buse_cli_local\b/, motivo: "decisao de autorizacao legada" },
  { regex: /\borigemCobranca\b/, motivo: "marcador de billing legado" },
  { regex: /\boperationCode\b/, motivo: "codigo de operacao do porteiro legado" },
];
const MARCADOR_NOME_TOOL_MCP_LEGADO = /\bsema_(?:docs_impacto|finalizar_mudanca|inspecionar|drift|impacto|exemplos)\b/i;
const MARCADOR_MOJIBAKE_VISIVEL = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|Ã¢Å¡|Ã¯Â¸/u;
const ARQUIVO_RUNTIME_VISIVEL = /^dist\/(?:(?:discovery|sistemasInterativos)\/[^/]+|(?:agentContext|agentContextPack|agentContextTipos|agentEntryPoints|doctorCommand|docs\.part01|exemplosOficiais|fsGovernado|index\.part0[1-8]|initCommand|initTemplatesBase|workspaceWrite))\.(?:js|d\.ts|json)$/i;

function caminhoDentro(raizPermitida, candidato, permitirRaiz = false) {
  const relativo = path.relative(path.resolve(raizPermitida), path.resolve(candidato));
  if (relativo === "") return permitirRaiz;
  return relativo !== ".." && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo);
}

function identidade(estado) {
  return { dev: estado.dev.toString(), ino: estado.ino.toString() };
}

function mesmaIdentidade(a, b) {
  return a.dev.toString() === b.dev.toString() && a.ino.toString() === b.ino.toString();
}

function mesmoSnapshot(a, b) {
  return mesmaIdentidade(a, b)
    && a.size === b.size
    && a.mtimeNs === b.mtimeNs
    && a.mode === b.mode;
}

function mesmoSnapshotHandle(a, b) {
  return mesmoSnapshot(a, b) && a.ctimeNs === b.ctimeNs;
}

function caminhoCanonicoIgual(a, b) {
  const normalizar = (valor) => process.platform === "win32"
    ? path.resolve(valor).toLowerCase()
    : path.resolve(valor);
  return normalizar(a) === normalizar(b);
}

async function lstatOuNull(caminho) {
  try {
    return await lstat(caminho, { bigint: true });
  } catch (erro) {
    if (erro?.code === "ENOENT") return null;
    throw erro;
  }
}

async function exigirCadeiaFonteSemReparse(raizPermitida, caminho) {
  const raizResolvida = path.resolve(raizPermitida);
  const candidato = path.resolve(caminho);
  if (!caminhoDentro(raizResolvida, candidato, true)) {
    throw new Error(`FONTE_FORA_DA_RAIZ: ${caminho}`);
  }
  const estadoRaiz = await lstat(raizResolvida, { bigint: true });
  if (!estadoRaiz.isDirectory() || estadoRaiz.isSymbolicLink()) {
    throw new Error(`FONTE_RAIZ_REPARSE: ${raizPermitida}`);
  }
  let cursor = raizResolvida;
  let estado = estadoRaiz;
  const relativo = path.relative(raizResolvida, candidato);
  for (const parte of relativo ? relativo.split(path.sep) : []) {
    cursor = path.join(cursor, parte);
    estado = await lstat(cursor, { bigint: true });
    if (estado.isSymbolicLink()) throw new Error(`FONTE_REPARSE_POINT: ${cursor}`);
  }
  const raizReal = await realpath(raizResolvida);
  const candidatoReal = await realpath(candidato);
  if (!caminhoDentro(raizReal, candidatoReal, true)) {
    throw new Error(`FONTE_REAL_FORA_DA_RAIZ: ${caminho}`);
  }
  return estado;
}

async function lerArquivoFonteSeguro(caminho, raizPermitida = raiz) {
  const antes = await exigirCadeiaFonteSemReparse(raizPermitida, caminho);
  if (!antes.isFile()) throw new Error(`FONTE_NAO_ARQUIVO: ${caminho}`);
  let arquivo;
  try {
    arquivo = await open(caminho, FLAGS_ORIGEM);
    const handleAntes = await arquivo.stat({ bigint: true });
    if (!handleAntes.isFile() || !mesmoSnapshot(antes, handleAntes)) {
      throw new Error(`FONTE_DIVERGIU_AO_ABRIR: ${caminho}`);
    }
    const bytes = await arquivo.readFile();
    const handleDepois = await arquivo.stat({ bigint: true });
    const depois = await exigirCadeiaFonteSemReparse(raizPermitida, caminho);
    if (!mesmoSnapshotHandle(handleAntes, handleDepois) || !mesmoSnapshot(antes, depois)
      || handleDepois.size !== BigInt(bytes.length)) {
      throw new Error(`FONTE_DIVERGIU_DURANTE_LEITURA: ${caminho}`);
    }
    return { bytes, estado: depois };
  } finally {
    await arquivo?.close().catch(() => undefined);
  }
}

async function validarDiretorioFisicoExistente(caminho) {
  const absoluto = path.resolve(caminho);
  const raizVolume = path.parse(absoluto).root;
  let cursor = raizVolume;
  let estado = await lstat(cursor, { bigint: true });
  if (!estado.isDirectory() || estado.isSymbolicLink()) {
    throw new Error(`DIRETORIO_DESTINO_INSEGURO: ${cursor}`);
  }
  const relativo = path.relative(raizVolume, absoluto);
  for (const parte of relativo ? relativo.split(path.sep) : []) {
    cursor = path.join(cursor, parte);
    estado = await lstat(cursor, { bigint: true });
    if (!estado.isDirectory() || estado.isSymbolicLink()) {
      throw new Error(`DIRETORIO_DESTINO_INSEGURO: ${cursor}`);
    }
  }
  const canonico = await realpath(absoluto);
  if (!caminhoCanonicoIgual(absoluto, canonico)) {
    throw new Error(`DIRETORIO_DESTINO_REPARSE: ${absoluto}`);
  }
  return estado;
}

export async function garantirDiretorioFisico(caminho) {
  const absoluto = path.resolve(caminho);
  const raizVolume = path.parse(absoluto).root;
  let cursor = raizVolume;
  await validarDiretorioFisicoExistente(cursor);
  const relativo = path.relative(raizVolume, absoluto);
  for (const parte of relativo ? relativo.split(path.sep) : []) {
    const paiAntes = await validarDiretorioFisicoExistente(cursor);
    const proximo = path.join(cursor, parte);
    if (!await lstatOuNull(proximo)) {
      try {
        await mkdir(proximo);
      } catch (erro) {
        if (erro?.code !== "EEXIST") throw erro;
      }
    }
    const paiDepois = await validarDiretorioFisicoExistente(cursor);
    if (!mesmaIdentidade(paiAntes, paiDepois)) {
      throw new Error(`DIRETORIO_DESTINO_PAI_DIVERGIU: ${cursor}`);
    }
    await validarDiretorioFisicoExistente(proximo);
    cursor = proximo;
  }
  return capturarControleDestinoSeguro(absoluto);
}

export async function capturarControleDestinoSeguro(caminho) {
  const raizDestino = path.resolve(caminho);
  const estado = await validarDiretorioFisicoExistente(raizDestino);
  return {
    raiz: raizDestino,
    raizReal: await realpath(raizDestino),
    raizIdentity: identidade(estado),
  };
}

async function validarControleDestino(controle) {
  if (!controle?.raiz || !controle?.raizReal || !controle?.raizIdentity) {
    throw new Error("DESTINO_SEM_CONTROLE_CANONICO");
  }
  const estado = await validarDiretorioFisicoExistente(controle.raiz);
  const canonico = await realpath(controle.raiz);
  if (estado.dev.toString() !== controle.raizIdentity.dev
    || estado.ino.toString() !== controle.raizIdentity.ino
    || !caminhoCanonicoIgual(canonico, controle.raizReal)) {
    throw new Error(`DESTINO_RAIZ_DIVERGIU: ${controle.raiz}`);
  }
  return estado;
}

async function exigirPaiDestinoSeguro(controle, caminho) {
  const candidato = path.resolve(caminho);
  if (!caminhoDentro(controle.raiz, candidato)) throw new Error(`DESTINO_FORA_DA_RAIZ: ${caminho}`);
  await validarControleDestino(controle);
  const pai = path.dirname(candidato);
  const estadoPai = await validarDiretorioFisicoExistente(pai);
  const paiReal = await realpath(pai);
  if (!caminhoDentro(controle.raizReal, paiReal, true)) {
    throw new Error(`DESTINO_PAI_FORA_DA_RAIZ: ${pai}`);
  }
  await validarControleDestino(controle);
  return { pai, estadoPai };
}

async function exigirEntradaDestinoSeguro(controle, caminho) {
  const { estadoPai } = await exigirPaiDestinoSeguro(controle, caminho);
  const estado = await lstat(caminho, { bigint: true });
  if (estado.isSymbolicLink()) throw new Error(`DESTINO_REPARSE_POINT: ${caminho}`);
  const canonico = await realpath(caminho);
  if (!caminhoDentro(controle.raizReal, canonico)) {
    throw new Error(`DESTINO_REAL_FORA_DA_RAIZ: ${caminho}`);
  }
  const paiDepois = await validarDiretorioFisicoExistente(path.dirname(caminho));
  if (!mesmaIdentidade(estadoPai, paiDepois)) throw new Error(`DESTINO_PAI_DIVERGIU: ${caminho}`);
  await validarControleDestino(controle);
  return estado;
}

async function criarDiretorioDestinoSeguro(controle, caminho, modo = 0o755) {
  const { pai, estadoPai } = await exigirPaiDestinoSeguro(controle, caminho);
  if (await lstatOuNull(caminho)) throw new Error(`DESTINO_JA_EXISTE: ${caminho}`);
  // Node não expõe mkdirat/openat por dirfd. Validamos o pai imediatamente antes/depois e falhamos fechado.
  await mkdir(caminho, { mode: modo });
  const paiDepois = await validarDiretorioFisicoExistente(pai);
  if (!mesmaIdentidade(estadoPai, paiDepois)) throw new Error(`DESTINO_PAI_DIVERGIU: ${caminho}`);
  const estado = await exigirEntradaDestinoSeguro(controle, caminho);
  if (!estado.isDirectory()) throw new Error(`DESTINO_NAO_DIRETORIO: ${caminho}`);
  return estado;
}

async function criarArquivoDestinoSeguro(controle, caminho, bytes, modo = 0o600) {
  const { pai, estadoPai } = await exigirPaiDestinoSeguro(controle, caminho);
  if (await lstatOuNull(caminho)) throw new Error(`DESTINO_JA_EXISTE: ${caminho}`);
  let arquivo;
  try {
    arquivo = await open(caminho, "wx", modo);
    const paiAberto = await validarDiretorioFisicoExistente(pai);
    if (!mesmaIdentidade(estadoPai, paiAberto)) throw new Error(`DESTINO_PAI_DIVERGIU: ${caminho}`);
    await arquivo.writeFile(bytes);
    await arquivo.sync();
    const handle = await arquivo.stat({ bigint: true });
    const paiDepois = await validarDiretorioFisicoExistente(pai);
    const estado = await exigirEntradaDestinoSeguro(controle, caminho);
    if (!handle.isFile() || !mesmaIdentidade(handle, estado) || !mesmaIdentidade(estadoPai, paiDepois)) {
      throw new Error(`DESTINO_ARQUIVO_DIVERGIU: ${caminho}`);
    }
    return estado;
  } finally {
    await arquivo?.close().catch(() => undefined);
  }
}

export async function copiarArquivoFonteSeguro(origem, destino, raizPermitida = raiz, controleDestino) {
  const { bytes, estado } = await lerArquivoFonteSeguro(origem, raizPermitida);
  await criarArquivoDestinoSeguro(controleDestino, destino, bytes, Number(estado.mode & 0o777n));
}

export async function copiarArvoreFonteSegura(origem, destino, raizPermitida = raiz, controleDestino) {
  const antes = await exigirCadeiaFonteSemReparse(raizPermitida, origem);
  if (!antes.isDirectory()) throw new Error(`FONTE_NAO_DIRETORIO: ${origem}`);
  await criarDiretorioDestinoSeguro(controleDestino, destino, Number(antes.mode & 0o777n));
  const entradas = await readdir(origem, { withFileTypes: true });
  entradas.sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const entrada of entradas) {
    const fonte = path.join(origem, entrada.name);
    const alvo = path.join(destino, entrada.name);
    const estado = await exigirCadeiaFonteSemReparse(raizPermitida, fonte);
    if (estado.isDirectory()) await copiarArvoreFonteSegura(fonte, alvo, raizPermitida, controleDestino);
    else if (estado.isFile()) await copiarArquivoFonteSeguro(fonte, alvo, raizPermitida, controleDestino);
    else throw new Error(`FONTE_TIPO_NAO_SUPORTADO: ${fonte}`);
  }
  const depois = await exigirCadeiaFonteSemReparse(raizPermitida, origem);
  if (!mesmoSnapshot(antes, depois)) throw new Error(`FONTE_DIVERGIU_DURANTE_ENUMERACAO: ${origem}`);
}

function removerDetectorMigracaoLegada(arquivo, conteudo) {
  if (!/^dist\/agentEntryPoints\.js$/i.test(arquivo)) return conteudo;
  return conteudo.replace(/function contemVestigioSemaLegado\([^)]*\) \{[\s\S]*?\n\}/u, "");
}

function executarNpm(argumentos, cwd, cacheNpm) {
  const npmExecpath = process.env.npm_execpath?.trim();
  if (!npmExecpath || !path.isAbsolute(npmExecpath)) {
    throw new Error("npm_execpath absoluto é obrigatório para empacotar a CLI pública.");
  }
  execFileSync(process.execPath, [npmExecpath, ...argumentos, "--cache", cacheNpm], {
    cwd,
    stdio: "inherit",
  });
}

async function criarContexto(saidaDir) {
  const temporarioControle = await garantirDiretorioFisico(pastaTemporaria);
  const saidaControle = await garantirDiretorioFisico(saidaDir);
  let contextoParcial;
  try {
    await validarControleDestino(temporarioControle);
    const runRoot = await mkdtemp(path.join(pastaTemporaria, "cli-npm-stage-"));
    await validarControleDestino(temporarioControle);
    const estadoRunRoot = await lstat(runRoot, { bigint: true });
    if (!estadoRunRoot.isDirectory() || estadoRunRoot.isSymbolicLink()) {
      throw new Error(`STAGE_PRIVADO_INVALIDO: ${runRoot}`);
    }
    contextoParcial = {
      runRoot,
      runRootIdentity: identidade(estadoRunRoot),
      temporarioControle,
    };
    const runControle = await capturarControleDestinoSeguro(runRoot);
    contextoParcial.runControle = runControle;
    const stageDir = path.join(runRoot, "package");
    const packDir = path.join(runRoot, "pack-output");
    const cacheNpm = path.join(runRoot, "npm-cache");
    if (process.env.SEMA_PUBLIC_PACK_FAULT === "context-package-collision") {
      await criarDiretorioDestinoSeguro(runControle, stageDir, 0o700);
    }
    await criarDiretorioDestinoSeguro(runControle, stageDir, 0o700);
    await criarDiretorioDestinoSeguro(runControle, packDir, 0o700);
    await criarDiretorioDestinoSeguro(runControle, cacheNpm, 0o700);
    return {
      ...contextoParcial,
      stageDir,
      stageControle: await capturarControleDestinoSeguro(stageDir),
      packDir,
      packControle: await capturarControleDestinoSeguro(packDir),
      cacheNpm,
      saidaDir,
      saidaControle,
    };
  } catch (erroCriacao) {
    if (!contextoParcial) throw erroCriacao;
    try {
      await limparContexto(contextoParcial);
    } catch (erroCleanup) {
      throw new AggregateError(
        [erroCriacao, erroCleanup],
        "Falha ao criar e limpar o contexto parcial de empacotamento",
      );
    }
    throw erroCriacao;
  }
}

async function limparContexto(contexto) {
  const estado = await lstatOuNull(contexto.runRoot);
  if (!estado) return;
  const parentAntes = await validarControleDestino(contexto.temporarioControle);
  if (!estado.isDirectory() || estado.isSymbolicLink()
    || estado.dev.toString() !== contexto.runRootIdentity.dev
    || estado.ino.toString() !== contexto.runRootIdentity.ino) {
    throw new Error(`STAGE_PRIVADO_DIVERGIU: ${contexto.runRoot}`);
  }
  if (!caminhoCanonicoIgual(path.dirname(contexto.runRoot), contexto.temporarioControle.raiz)
    || !path.basename(contexto.runRoot).startsWith("cli-npm-stage-")) {
    throw new Error(`STAGE_PRIVADO_FORA_DA_RAIZ: ${contexto.runRoot}`);
  }
  const runRootReal = await realpath(contexto.runRoot);
  if (!caminhoDentro(contexto.temporarioControle.raizReal, runRootReal)) {
    throw new Error(`STAGE_PRIVADO_REAL_FORA_DA_RAIZ: ${contexto.runRoot}`);
  }
  if (contexto.runControle) await validarControleDestino(contexto.runControle);
  await rm(contexto.runRoot, { recursive: true });
  const parentDepois = await validarControleDestino(contexto.temporarioControle);
  if (!mesmaIdentidade(parentAntes, parentDepois) || await lstatOuNull(contexto.runRoot)) {
    throw new Error(`STAGE_PRIVADO_CLEANUP_DIVERGIU: ${contexto.runRoot}`);
  }
}

async function prepararStageBase(contexto) {
  const { stageDir } = contexto;
  const controle = contexto.stageControle;
  await copiarArvoreFonteSegura(path.join(origemCli, "dist"), path.join(stageDir, "dist"), raiz, controle);
  await validarDistLocalDireto(stageDir);
  await copiarArquivoFonteSeguro(path.join(raiz, "logo.png"), path.join(stageDir, "logo.png"), raiz, controle);
  await copiarArquivoFonteSeguro(path.join(raiz, "LICENSE"), path.join(stageDir, "LICENSE"), raiz, controle);
  await criarDiretorioDestinoSeguro(controle, path.join(stageDir, "docs"));
  for (const nomeDoc of DOCS_PUBLICOS) {
    await copiarArquivoFonteSeguro(
      path.join(raiz, "docs", nomeDoc),
      path.join(stageDir, "docs", nomeDoc),
      raiz,
      controle,
    );
  }
  await copiarArvoreFonteSegura(path.join(raiz, "exemplos"), path.join(stageDir, "exemplos"), raiz, controle);
  await criarDiretorioDestinoSeguro(controle, path.join(stageDir, "skills"));
  await copiarArvoreFonteSegura(
    path.join(raiz, "plugins", "sema", "skills", "sema"),
    path.join(stageDir, "skills", "sema"),
    raiz,
    controle,
  );
  await criarDiretorioDestinoSeguro(controle, path.join(stageDir, "scripts"));
  await copiarArquivoFonteSeguro(
    path.join(origemCli, "scripts", "postinstall.mjs"),
    path.join(stageDir, "scripts", "postinstall.mjs"),
    raiz,
    controle,
  );
}

async function removerEntradaDestinoPropria(controle, caminho, reciboEsperado) {
  const estado = await lstatOuNull(caminho);
  if (!estado) return;
  if (estado.isSymbolicLink()
    || estado.dev.toString() !== reciboEsperado.dev
    || estado.ino.toString() !== reciboEsperado.ino) {
    throw new Error(`DESTINO_OWNERSHIP_DIVERGIU: ${caminho}`);
  }
  const { pai, estadoPai } = await exigirPaiDestinoSeguro(controle, caminho);
  await rm(caminho, { recursive: estado.isDirectory() });
  const paiDepois = await validarDiretorioFisicoExistente(pai);
  if (!mesmaIdentidade(estadoPai, paiDepois) || await lstatOuNull(caminho)) {
    throw new Error(`DESTINO_REMOCAO_DIVERGIU: ${caminho}`);
  }
  await validarControleDestino(controle);
}

async function removerArquivosNaoPublicaveis(dir, stageDir, controle) {
  await validarControleDestino(controle);
  const arquivos = await readdir(dir);
  arquivos.sort((a, b) => a.localeCompare(b, "en"));
  for (const arquivo of arquivos) {
    const caminho = path.join(dir, arquivo);
    const relativo = path.relative(stageDir, caminho).replaceAll(path.sep, "/");
    const estado = await exigirEntradaDestinoSeguro(controle, caminho);
    if (DIST_NAO_PUBLICAVEL.some((padrao) => padrao.test(relativo))) {
      await removerEntradaDestinoPropria(controle, caminho, identidade(estado));
      continue;
    }
    if (estado.isDirectory()) await removerArquivosNaoPublicaveis(caminho, stageDir, controle);
  }
  await validarControleDestino(controle);
}

async function validarDistLocalDireto(stageDir, dir = path.join(stageDir, "dist")) {
  const entradas = await readdir(dir, { withFileTypes: true });
  let arquivosAnalisados = 0;
  for (const entrada of entradas) {
    const caminho = path.join(dir, entrada.name);
    const relativo = path.relative(stageDir, caminho).replaceAll(path.sep, "/");
    if (/(?:^|\/)billing(?:\/|\.|$)/i.test(relativo)) {
      throw new Error(`Public package stage still contains removed billing artifact: ${relativo}`);
    }
    if (entrada.isDirectory()) {
      arquivosAnalisados += await validarDistLocalDireto(stageDir, caminho);
      continue;
    }
    if (!/\.(?:js|d\.ts|json)$/i.test(entrada.name)) continue;
    const conteudo = removerDetectorMigracaoLegada(relativo, await readFile(caminho, "utf8"));
    const marcador = MARCADORES_PORTEIRO_LEGADO.find(({ regex }) => regex.test(conteudo));
    if (marcador) throw new Error(`Public package stage contains ${marcador.motivo} in ${relativo}.`);
    if (MARCADOR_NOME_TOOL_MCP_LEGADO.test(conteudo)) {
      throw new Error(`Public package stage contains a legacy Sema MCP tool name in ${relativo}.`);
    }
    if (ARQUIVO_RUNTIME_VISIVEL.test(relativo) && MARCADOR_MOJIBAKE_VISIVEL.test(conteudo)) {
      throw new Error(`Public package stage contains visible mojibake in ${relativo}.`);
    }
    arquivosAnalisados += 1;
  }
  return arquivosAnalisados;
}

function conjuntosIguais(a, b) {
  const esquerda = [...a].sort();
  const direita = [...b].sort();
  return esquerda.length === direita.length && esquerda.every((valor, indice) => valor === direita[indice]);
}

function validarInventarioRuntime(manifestCli) {
  const esperado = PACOTES_RUNTIME.map((nome) => `@sema/${nome}`);
  const dependencias = Object.keys(manifestCli.dependencies ?? {}).filter((nome) => nome.startsWith("@sema/"));
  const bundled = manifestCli.bundleDependencies ?? [];
  if (!conjuntosIguais(esperado, dependencias) || !conjuntosIguais(esperado, bundled)) {
    throw new Error("INVENTARIO_RUNTIME_PUBLICO_DIVERGIU");
  }
}

async function prepararPacotesRuntime(contexto) {
  const controle = contexto.stageControle;
  const nodeModules = path.join(contexto.stageDir, "node_modules");
  const baseNodeModules = path.join(nodeModules, "@sema");
  await criarDiretorioDestinoSeguro(controle, nodeModules);
  await criarDiretorioDestinoSeguro(controle, baseNodeModules);
  for (const pacote of PACOTES_RUNTIME) {
    const origemPacote = path.join(raiz, "pacotes", pacote);
    const destinoPacote = path.join(baseNodeModules, pacote);
    const manifest = JSON.parse((await lerArquivoFonteSeguro(path.join(origemPacote, "package.json"))).bytes);
    await criarDiretorioDestinoSeguro(controle, destinoPacote);
    await copiarArvoreFonteSegura(
      path.join(origemPacote, "dist"),
      path.join(destinoPacote, "dist"),
      raiz,
      controle,
    );
    await criarArquivoDestinoSeguro(controle, path.join(destinoPacote, "package.json"), Buffer.from(`${JSON.stringify({
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      main: manifest.main,
      types: manifest.types,
    }, null, 2)}\n`, "utf8"));
  }
}

async function prepararManifestPublico(contexto) {
  const manifestCli = JSON.parse((await lerArquivoFonteSeguro(path.join(origemCli, "package.json"))).bytes);
  validarInventarioRuntime(manifestCli);
  const versoesRuntime = new Map();
  for (const pacote of PACOTES_RUNTIME) {
    const manifest = JSON.parse((await lerArquivoFonteSeguro(
      path.join(raiz, "pacotes", pacote, "package.json"),
    )).bytes);
    versoesRuntime.set(manifest.name, manifest.version);
  }
  const dependencias = Object.fromEntries(Object.entries(manifestCli.dependencies ?? {}).map(([nome, versao]) => [
    nome,
    nome.startsWith("@sema/") ? versoesRuntime.get(nome) : versao,
  ]));
  if (Object.entries(dependencias).some(([nome, versao]) => nome.startsWith("@sema/") && !versao)) {
    throw new Error("Missing runtime package version.");
  }
  const dependenciasInternas = Object.keys(dependencias).filter((nome) => nome.startsWith("@sema/"));
  const manifestPublico = {
    name: manifestCli.name,
    version: manifestCli.version,
    description: manifestCli.description,
    type: manifestCli.type,
    icon: manifestCli.icon,
    license: manifestCli.license ?? "SEE LICENSE IN LICENSE",
    repository: manifestCli.repository,
    homepage: manifestCli.homepage ?? "https://otimitare.online",
    bugs: manifestCli.bugs ?? { url: "https://otimitare.online", email: "suporte@otimitare.online" },
    keywords: manifestCli.keywords ?? ["sema", "ai", "contracts", "governance", "local-cli", "drift", "dsl"],
    engines: manifestCli.engines ?? { node: ">=20" },
    publishConfig: { access: "public", ...(manifestCli.publishConfig ?? {}) },
    bin: manifestCli.bin,
    main: manifestCli.main,
    types: manifestCli.types,
    exports: manifestCli.exports,
    scripts: { postinstall: "node scripts/postinstall.mjs" },
    files: ["dist", "docs", "exemplos", "skills", "scripts/postinstall.mjs", "logo.png", "README.md", "LICENSE"],
    dependencies: dependencias,
    bundledDependencies: dependenciasInternas,
  };
  await criarArquivoDestinoSeguro(
    contexto.stageControle,
    path.join(contexto.stageDir, "package.json"),
    Buffer.from(`${JSON.stringify(manifestPublico, null, 2)}\n`, "utf8"),
  );
  return manifestPublico;
}

async function prepararReadmePublico(contexto, manifest) {
  const modelo = (await lerArquivoFonteSeguro(path.join(origemCli, "README.md"))).bytes.toString("utf8");
  const conteudo = modelo.replaceAll("{{TGZ_ARQUIVO}}", `semacode-cli-${manifest.version}.tgz`);
  await criarArquivoDestinoSeguro(
    contexto.stageControle,
    path.join(contexto.stageDir, "README.md"),
    Buffer.from(conteudo, "utf8"),
  );
}

async function arquivoRegular(caminho) {
  const estado = await lstatOuNull(caminho);
  return Boolean(estado?.isFile() && !estado.isSymbolicLink());
}

async function reciboArquivo(caminho) {
  const antes = await lstat(caminho, { bigint: true });
  if (!antes.isFile() || antes.isSymbolicLink()) throw new Error(`PACOTE_CANDIDATO_INVALIDO: ${caminho}`);
  let arquivo;
  try {
    arquivo = await open(caminho, FLAGS_ORIGEM);
    const handleAntes = await arquivo.stat({ bigint: true });
    if (!handleAntes.isFile() || !mesmoSnapshot(antes, handleAntes)) {
      throw new Error(`PACOTE_CANDIDATO_DIVERGIU_AO_ABRIR: ${caminho}`);
    }
    const bytes = await arquivo.readFile();
    const handleDepois = await arquivo.stat({ bigint: true });
    const depois = await lstat(caminho, { bigint: true });
    if (!mesmoSnapshotHandle(handleAntes, handleDepois) || !mesmoSnapshot(antes, depois)
      || depois.size !== BigInt(bytes.length)) {
      throw new Error(`PACOTE_CANDIDATO_DIVERGIU: ${caminho}`);
    }
    return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), ...identidade(depois) };
  } finally {
    await arquivo?.close().catch(() => undefined);
  }
}

async function reciboArquivoDestinoSeguro(controle, caminho) {
  const antes = await exigirEntradaDestinoSeguro(controle, caminho);
  if (!antes.isFile()) throw new Error(`DESTINO_NAO_ARQUIVO: ${caminho}`);
  const recibo = await reciboArquivo(caminho);
  const depois = await exigirEntradaDestinoSeguro(controle, caminho);
  if (!mesmaIdentidade(antes, depois)
    || recibo.dev !== depois.dev.toString()
    || recibo.ino !== depois.ino.toString()) {
    throw new Error(`DESTINO_ARQUIVO_DIVERGIU: ${caminho}`);
  }
  return recibo;
}

async function materializarTemporarioPublicacao(controle, caminho, bytes) {
  const { pai, estadoPai } = await exigirPaiDestinoSeguro(controle, caminho);
  if (await lstatOuNull(caminho)) throw new Error(`DESTINO_JA_EXISTE: ${caminho}`);
  let arquivo;
  let reciboProprio;
  try {
    arquivo = await open(caminho, "wx", 0o600);
    const aberto = await arquivo.stat({ bigint: true });
    reciboProprio = identidade(aberto);
    const paiAberto = await validarDiretorioFisicoExistente(pai);
    if (!aberto.isFile() || !mesmaIdentidade(estadoPai, paiAberto)) {
      throw new Error(`DESTINO_TEMPORARIO_DIVERGIU: ${caminho}`);
    }
    await arquivo.writeFile(bytes);
    await arquivo.sync();
    const handleDepois = await arquivo.stat({ bigint: true });
    const estadoDepois = await exigirEntradaDestinoSeguro(controle, caminho);
    if (!mesmaIdentidade(aberto, handleDepois) || !mesmaIdentidade(aberto, estadoDepois)
      || estadoDepois.size !== BigInt(bytes.length)) {
      throw new Error(`DESTINO_TEMPORARIO_DIVERGIU: ${caminho}`);
    }
    return { ...reciboProprio, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
  } catch (erroMaterializacao) {
    await arquivo?.close().catch(() => undefined);
    arquivo = undefined;
    if (!reciboProprio) throw erroMaterializacao;
    try {
      await removerEntradaDestinoPropria(controle, caminho, reciboProprio);
    } catch (erroCleanup) {
      throw new AggregateError(
        [erroMaterializacao, erroCleanup],
        "Falha ao materializar e limpar o temporario de publicacao",
      );
    }
    throw erroMaterializacao;
  } finally {
    await arquivo?.close().catch(() => undefined);
  }
}

export async function publicarTarballNoReplace(candidato, destino, controleSaida) {
  await validarControleDestino(controleSaida);
  const esperado = await reciboArquivo(candidato);
  const nomeTemporario = `.${path.basename(destino)}.sema-publish-${randomUUID()}.tmp`;
  const temporario = path.join(path.dirname(destino), nomeTemporario);
  let reciboTemporario;
  let finalCriado = false;
  let resultado;
  try {
    reciboTemporario = await materializarTemporarioPublicacao(controleSaida, temporario, esperado.bytes);
    if (reciboTemporario.sha256 !== esperado.sha256) {
      throw new Error(`PACOTE_TEMPORARIO_DIVERGIU: ${temporario}`);
    }
    if (process.env.SEMA_PUBLIC_PACK_FAULT === "publish-temp-before-link") {
      throw new Error("SEMA_PUBLIC_PACK_FAULT_PUBLISH_TEMP_BEFORE_LINK");
    }

    const { pai, estadoPai } = await exigirPaiDestinoSeguro(controleSaida, destino);
    await reciboArquivoDestinoSeguro(controleSaida, temporario);
    try {
      // Node não oferece linkat/openat por dirfd. A cadeia é revalidada imediatamente
      // antes/depois; um swap ativo na janela falha fechado quando detectável.
      await link(temporario, destino);
      finalCriado = true;
    } catch (erro) {
      if (erro?.code !== "EEXIST") throw erro;
      const existente = await reciboArquivoDestinoSeguro(controleSaida, destino);
      if (existente.sha256 !== esperado.sha256 || !existente.bytes.equals(esperado.bytes)) {
        throw new Error(`PACOTE_FINAL_JA_EXISTE_DIVERGENTE: ${destino}`);
      }
      resultado = "existente-identico";
    }
    const paiDepois = await validarDiretorioFisicoExistente(pai);
    if (!mesmaIdentidade(estadoPai, paiDepois)) throw new Error(`DESTINO_PAI_DIVERGIU: ${destino}`);
    await validarControleDestino(controleSaida);
    if (finalCriado) {
      const publicado = await reciboArquivoDestinoSeguro(controleSaida, destino);
      if (publicado.dev !== reciboTemporario.dev || publicado.ino !== reciboTemporario.ino
        || publicado.sha256 !== esperado.sha256 || !publicado.bytes.equals(esperado.bytes)) {
        throw new Error(`PACOTE_FINAL_DIVERGIU: ${destino}`);
      }
      resultado = "publicado";
    }
  } catch (erroPublicacao) {
    const falhas = [erroPublicacao];
    if (finalCriado && reciboTemporario) {
      try {
        await removerEntradaDestinoPropria(controleSaida, destino, reciboTemporario);
      } catch (erroCleanupFinal) {
        falhas.push(erroCleanupFinal);
      }
    }
    if (reciboTemporario) {
      try {
        await removerEntradaDestinoPropria(controleSaida, temporario, reciboTemporario);
      } catch (erroCleanupTemporario) {
        falhas.push(erroCleanupTemporario);
      }
    }
    if (falhas.length > 1) throw new AggregateError(falhas, "Falha na publicacao atomica e no cleanup");
    throw erroPublicacao;
  }
  await removerEntradaDestinoPropria(controleSaida, temporario, reciboTemporario);
  return resultado;
}

async function executarEmpacotamento(contexto) {
  console.log("Preparing the public local-only Sema CLI package...");
  await prepararStageBase(contexto);
  await prepararPacotesRuntime(contexto);
  const manifest = await prepararManifestPublico(contexto);
  await prepararReadmePublico(contexto, manifest);
  await removerArquivosNaoPublicaveis(contexto.stageDir, contexto.stageDir, contexto.stageControle);

  console.log("Packing the CLI tarball...");
  await validarControleDestino(contexto.stageControle);
  await validarControleDestino(contexto.packControle);
  executarNpm(["pack", "--ignore-scripts", "--pack-destination", contexto.packDir], contexto.stageDir, contexto.cacheNpm);
  await validarControleDestino(contexto.stageControle);
  await validarControleDestino(contexto.packControle);
  const nomePacote = `semacode-cli-${manifest.version}.tgz`;
  const candidato = path.join(contexto.packDir, nomePacote);
  const entradasPack = (await readdir(contexto.packDir)).filter((nome) => nome.endsWith(".tgz"));
  if (entradasPack.length !== 1 || entradasPack[0] !== nomePacote
    || !(await exigirEntradaDestinoSeguro(contexto.packControle, candidato)).isFile()) {
    throw new Error("PACOTE_PRIVADO_INCOMPLETO");
  }

  const readme = await readFile(path.join(contexto.stageDir, "README.md"), "utf8");
  const license = await readFile(path.join(contexto.stageDir, "LICENSE"), "utf8");
  const [skill, skillOrigem, agenteSkill, agenteSkillOrigem, postinstall, postinstallOrigem] = await Promise.all([
    readFile(path.join(contexto.stageDir, "skills", "sema", "SKILL.md"), "utf8"),
    lerArquivoFonteSeguro(path.join(raiz, "plugins", "sema", "skills", "sema", "SKILL.md")),
    readFile(path.join(contexto.stageDir, "skills", "sema", "agents", "openai.yaml"), "utf8"),
    lerArquivoFonteSeguro(path.join(raiz, "plugins", "sema", "skills", "sema", "agents", "openai.yaml")),
    readFile(path.join(contexto.stageDir, "scripts", "postinstall.mjs"), "utf8"),
    lerArquivoFonteSeguro(path.join(origemCli, "scripts", "postinstall.mjs")),
  ]);
  const arquivosRuntimeAnalisados = await validarDistLocalDireto(contexto.stageDir);
  const arquivosLauncherEmpacotados = await Promise.all([
    "dist/index.js", "dist/distribuicao/index.js", "dist/distribuicao/filesystemGlobal.js",
    "dist/distribuicao/launcherGlobal.js", "dist/distribuicao/launcherWindows.js",
  ].map((arquivo) => arquivoRegular(path.join(contexto.stageDir, arquivo))));
  const resultado = {
    pacote_gerado: true,
    dependencias_file_removidas: Object.values(manifest.dependencies ?? {})
      .every((versao) => typeof versao !== "string" || !versao.startsWith("file:")),
    metadados_suporte_email: manifest.bugs?.email === "suporte@otimitare.online" && readme.includes("suporte@otimitare.online"),
    licenca_nao_comercial_incluida: license.includes("commercial replica") && license.includes("resale permission"),
    produto_codex_native: String(manifest.description ?? "").includes("Codex-native") && readme.includes("AGENTS.md"),
    cli_sem_autorizacao_local: arquivosRuntimeAnalisados > 0,
    launcher_absoluto_empacotado: manifest.bin?.sema === "dist/index.js"
      && manifest.files?.includes("dist")
      && manifest.files?.includes("scripts/postinstall.mjs")
      && postinstall === postinstallOrigem.bytes.toString("utf8")
      && arquivosLauncherEmpacotados.every(Boolean),
    skill_sema_empacotada: skill === skillOrigem.bytes.toString("utf8")
      && agenteSkill === agenteSkillOrigem.bytes.toString("utf8")
      && postinstall === postinstallOrigem.bytes.toString("utf8")
      && manifest.scripts?.postinstall === "node scripts/postinstall.mjs",
  };
  if (Object.values(resultado).some((valor) => valor !== true)) {
    throw new Error(`Public package evidence failed: ${JSON.stringify(resultado)}`);
  }
  if (process.env.SEMA_PUBLIC_PACK_FAULT === "before-publish") {
    throw new Error("SEMA_PUBLIC_PACK_FAULT_BEFORE_PUBLISH");
  }
  await publicarTarballNoReplace(candidato, path.join(contexto.saidaDir, nomePacote), contexto.saidaControle);
  console.log(`CLI package generated in ${contexto.saidaDir}`);
  return resultado;
}

function resolverSaidaConfigurada() {
  const configurada = process.env.SEMA_PUBLIC_PACK_OUTPUT_DIR?.trim();
  if (!configurada) return saidaPadrao;
  if (!path.isAbsolute(configurada)) throw new Error("SEMA_PUBLIC_PACK_OUTPUT_DIR precisa ser absoluto.");
  return path.resolve(configurada);
}

export async function main({ saidaDir = resolverSaidaConfigurada() } = {}) {
  const contexto = await criarContexto(saidaDir);
  let resultado;
  try {
    resultado = await executarEmpacotamento(contexto);
  } catch (erroEmpacotamento) {
    try {
      await limparContexto(contexto);
    } catch (erroCleanup) {
      throw new AggregateError([erroEmpacotamento, erroCleanup], "Falha no empacotamento e no cleanup do stage privado");
    }
    throw erroEmpacotamento;
  }
  await limparContexto(contexto);
  return resultado;
}

const executadoDiretamente = Boolean(process.argv[1])
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  main().then((resultado) => {
    if (process.argv.includes("--json")) console.log(JSON.stringify(resultado, null, 2));
  }).catch((erro) => {
    console.error("Failed to package the public local-only Sema CLI.");
    console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
    process.exit(1);
  });
}
