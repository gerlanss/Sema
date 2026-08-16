// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: diagnostica e sincroniza um launcher global confinado, versionado e independente de PATH.

import { createHash } from "node:crypto";
import { constants, type Dirent } from "node:fs";
import { access, readdir, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ArtefatoTransacaoArquivo,
  FalhaDistribuicaoGlobal,
  caminhoContido,
  concluirTransacaoArquivosLauncher,
  diretorioExisteSeguro,
  escreverArquivoAtomico,
  falhaParaResultado,
  identidadeArquivoSeguro,
  lerArquivoSeguro,
  lstatOuNull,
  prepararTransacaoArquivosLauncher,
  recuperarTransacaoArquivosLauncher,
  removerArquivoSeguro,
  resolverDentroDaHome,
  resolverHomeReal,
  statDiretorioSeguro,
  transacaoArquivosLauncherPendente,
  validarArquivoRegular,
  validarCadeiaExistente,
} from "./filesystemGlobal.js";
import {
  extrairNomeCompanionLauncherWindows,
  gerarArtefatosLauncherWindows,
  nomeAncoraLauncherWindows,
  nomeLauncherPowerShellWindows,
  nomeWrapperLauncherWindows,
  validarAncoraLauncherWindows,
  validarArtefatosLauncherWindows,
  validarCompanionLauncherWindows,
  validarReciboAncoraLauncherWindows,
  validarWrapperLauncherWindows,
  type ArtefatosLauncherWindows,
  type ReciboLauncherWindows,
} from "./launcherWindows.js";
import { comLockDistribuicaoGlobal } from "./lockGlobal.js";
import type {
  OpcoesAmbienteDistribuicaoGlobal,
  ResultadoLauncherGlobal,
} from "./tipos.js";
import { versaoSemanticaValida } from "./versaoSemantica.js";

const MARCADOR_LAUNCHER_POSIX = "SEMA-MANAGED-LAUNCHER v2";
const MARCADOR_RECIBO = "SEMA-LAUNCHER-RECEIPT sha256:";
const MARCADOR_VERSAO = "SEMA-LAUNCHER-VERSION ";
const LIMITE_LAUNCHER_BYTES = 64 * 1024;
const LIMITE_PACKAGE_JSON = 32 * 1024;
const PADRAO_COMPANION_WINDOWS = /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u;
const RAIZ_PACOTE_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

interface CompanionAtual {
  caminho: string;
  identidade: { dev: bigint; ino: bigint };
  conteudo: Buffer;
}

interface ReciboLauncherAtual {
  versaoPacote: string;
  executavelNode: string;
  entrypoint: string;
  nomeCompanion?: string;
}

interface AmbienteLauncher {
  plataforma: NodeJS.Platform;
  homeReal: string;
  executavelNode: string;
  raizPacote: string;
  versaoPacote: string;
  targetCli: string;
  destino: string;
  destinoPowerShell?: string;
  destinoWrapper?: string;
  destinoAnchor?: string;
  destinoVirtual: ResultadoLauncherGlobal["destino_simbolico"];
  conteudo: string;
  windows?: ArtefatosLauncherWindows;
}

interface DiagnosticoLauncherInterno {
  resultado: ResultadoLauncherGlobal;
  recibo?: ReciboLauncherAtual;
  companionAtual?: CompanionAtual;
}

function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

function resultado(
  ambiente: Pick<AmbienteLauncher, "destinoVirtual" | "plataforma">,
  estado: ResultadoLauncherGlobal["estado"],
  codigo: ResultadoLauncherGlobal["codigo"],
  alterado = false,
): ResultadoLauncherGlobal {
  const reciboValido = estado === "READY" || estado === "STALE";
  return {
    estado,
    alterado,
    destino_simbolico: ambiente.destinoVirtual,
    codigo,
    node_absoluto: true,
    entrypoint_absoluto: true,
    recibo_valido: reciboValido,
    independente_path: estado === "READY",
    fallback_simbolico: ambiente.plataforma === "win32"
      ? "$HOME/.sema/bin/sema-managed.ps1"
      : null,
  };
}

function destinoVirtual(plataforma: NodeJS.Platform): ResultadoLauncherGlobal["destino_simbolico"] {
  return plataforma === "win32"
    ? "$HOME/.sema/bin/sema.cmd"
    : "$HOME/.sema/bin/sema";
}

function validarCaminhoEmbutido(caminho: string, plataforma: NodeJS.Platform): void {
  const absoluto = plataforma === "win32"
    ? path.win32.isAbsolute(caminho)
    : path.posix.isAbsolute(caminho);
  if (!absoluto || /[\0\r\n]/u.test(caminho)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "AMBIENTE_INVALIDO");
  }
}

function escaparShell(caminho: string): string {
  return `'${caminho.replaceAll("'", `'"'"'`)}'`;
}

function gerarLauncherPosix(
  executavelNode: string,
  targetCli: string,
  versaoPacote: string,
): string {
  const base = [
    "#!/bin/sh",
    `# ${MARCADOR_LAUNCHER_POSIX}`,
    `# ${MARCADOR_VERSAO}${versaoPacote}`,
    `exec ${escaparShell(executavelNode)} ${escaparShell(targetCli)} "$@"`,
    "",
  ];
  const baseTexto = base.join("\n");
  base.splice(3, 0, `# ${MARCADOR_RECIBO}${sha256(baseTexto)}`);
  return base.join("\n");
}

function validarReciboPosix(conteudo: string): ReciboLauncherAtual | null {
  const linhas = conteudo.split("\n");
  if (linhas.length !== 6
    || linhas[0] !== "#!/bin/sh"
    || linhas[1] !== `# ${MARCADOR_LAUNCHER_POSIX}`
    || linhas[5] !== "") return null;
  const versao = linhas[2]?.slice(`# ${MARCADOR_VERSAO}`.length) ?? "";
  const recibo = linhas[3]?.match(new RegExp(`^# ${MARCADOR_RECIBO}([a-f0-9]{64})$`, "u"));
  const token = "'(?:[^']|'\"'\"')*'";
  const comando = linhas[4]?.match(new RegExp(`^exec (${token}) (${token}) "\\$@"$`, "u"));
  if (!versaoSemanticaValida(versao) || !recibo || !comando) return null;
  const executavelNode = comando[1]?.slice(1, -1).replaceAll(`'"'"'`, "'") ?? "";
  const entrypoint = comando[2]?.slice(1, -1).replaceAll(`'"'"'`, "'") ?? "";
  if (!path.posix.isAbsolute(executavelNode) || !path.posix.isAbsolute(entrypoint)) return null;
  const base = [...linhas];
  base.splice(3, 1);
  if (sha256(base.join("\n")) !== recibo[1]) return null;
  return { versaoPacote: versao, executavelNode, entrypoint };
}

async function carregarVersaoPacote(raizPacote: string): Promise<string> {
  const pacote = JSON.parse((await lerArquivoSeguro(
    path.join(raizPacote, "package.json"),
    LIMITE_PACKAGE_JSON,
    raizPacote,
  )).toString("utf8")) as { name?: unknown; version?: unknown };
  if (pacote.name !== "@semacode/cli" || !versaoSemanticaValida(pacote.version)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
  }
  return pacote.version;
}

async function resolverAmbiente(
  opcoes: OpcoesAmbienteDistribuicaoGlobal,
): Promise<AmbienteLauncher> {
  const plataforma = opcoes.plataforma ?? process.platform;
  const homeReal = await resolverHomeReal(opcoes.diretorioUsuario ?? os.homedir());
  const nodeInformado = opcoes.executavelNode ?? process.execPath;
  const raizInformada = opcoes.raizPacote ?? RAIZ_PACOTE_PADRAO;
  if (!path.isAbsolute(nodeInformado)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "EXECUTAVEL_NODE_INVALIDO");
  }
  if (!path.isAbsolute(raizInformada)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
  }
  let executavelNode: string;
  let raizPacote: string;
  try {
    raizPacote = await realpath(path.resolve(raizInformada));
    await statDiretorioSeguro(raizPacote);
  } catch (erro) {
    const falha = falhaParaResultado(erro);
    if (falha.estado === "PERMISSION_DENIED") throw falha;
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
  }
  try {
    executavelNode = await realpath(path.resolve(nodeInformado));
    await validarArquivoRegular(executavelNode);
    if (plataforma !== "win32") await access(executavelNode, constants.X_OK);
  } catch (erro) {
    const falha = falhaParaResultado(erro);
    if (falha.estado === "PERMISSION_DENIED") throw falha;
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "EXECUTAVEL_NODE_INVALIDO");
  }
  const targetCli = path.resolve(raizPacote, "dist", "bin.js");
  try {
    if (!await diretorioExisteSeguro(path.join(raizPacote, "dist"))) throw new Error("dist ausente");
    await validarArquivoRegular(targetCli, raizPacote);
  } catch (erro) {
    const falha = falhaParaResultado(erro);
    if (falha.estado === "PERMISSION_DENIED") throw falha;
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "TARGET_CLI_INVALIDO");
  }
  const versaoPacote = await carregarVersaoPacote(raizPacote);
  validarCaminhoEmbutido(executavelNode, plataforma);
  validarCaminhoEmbutido(targetCli, plataforma);
  const nomeLauncher = plataforma === "win32" ? "sema.cmd" : "sema";
  const destino = resolverDentroDaHome(homeReal, ".sema", "bin", nomeLauncher);
  const destinoWrapper = plataforma === "win32"
    ? resolverDentroDaHome(homeReal, ".sema", "bin", nomeWrapperLauncherWindows())
    : undefined;
  const destinoPowerShell = plataforma === "win32"
    ? resolverDentroDaHome(homeReal, ".sema", "bin", nomeLauncherPowerShellWindows())
    : undefined;
  const destinoAnchor = plataforma === "win32"
    ? resolverDentroDaHome(homeReal, ".sema", "bin", nomeAncoraLauncherWindows())
    : undefined;
  const windows = plataforma === "win32"
    ? gerarArtefatosLauncherWindows(executavelNode, targetCli, versaoPacote)
    : undefined;
  return {
    plataforma,
    homeReal,
    executavelNode,
    raizPacote,
    versaoPacote,
    targetCli,
    destino,
    destinoPowerShell,
    destinoWrapper,
    destinoAnchor,
    destinoVirtual: destinoVirtual(plataforma),
    conteudo: windows?.launcher ?? gerarLauncherPosix(executavelNode, targetCli, versaoPacote),
    windows,
  };
}

async function validarReciboAtual(
  ambiente: AmbienteLauncher,
  launcher: string,
): Promise<{ recibo: ReciboLauncherAtual; companionAtual?: CompanionAtual } | null> {
  if (ambiente.plataforma !== "win32") {
    const recibo = validarReciboPosix(launcher);
    return recibo ? { recibo } : null;
  }
  const nomeCompanion = extrairNomeCompanionLauncherWindows(launcher);
  if (!nomeCompanion) return null;
  const caminhoCompanion = path.join(path.dirname(ambiente.destino), nomeCompanion);
  if (!caminhoContido(ambiente.homeReal, caminhoCompanion)) return null;
  if (!await lstatOuNull(caminhoCompanion)) return null;
  const identidade = await identidadeArquivoSeguro(caminhoCompanion, ambiente.homeReal);
  const companion = await lerArquivoSeguro(
    caminhoCompanion,
    LIMITE_LAUNCHER_BYTES,
    ambiente.homeReal,
  );
  const reciboWindows: ReciboLauncherWindows | null = validarArtefatosLauncherWindows(
    launcher,
    companion,
  );
  if (!reciboWindows) return null;
  return {
    recibo: {
      versaoPacote: reciboWindows.versaoPacote,
      executavelNode: reciboWindows.executavelNode,
      entrypoint: reciboWindows.entrypoint,
      nomeCompanion: reciboWindows.nomeCompanion,
    },
    companionAtual: { caminho: caminhoCompanion, identidade, conteudo: companion },
  };
}

async function listarCompanionsGerenciadosInativos(
  ambiente: AmbienteLauncher,
  nomeAtivo: string | undefined,
): Promise<CompanionAtual[]> {
  if (ambiente.plataforma !== "win32") return [];
  const diretorio = path.dirname(ambiente.destino);
  let entradas: Dirent[];
  try {
    entradas = await readdir(diretorio, { withFileTypes: true });
  } catch {
    return [];
  }
  const companions: CompanionAtual[] = [];
  for (const entrada of entradas) {
    if (entrada.name === nomeAtivo
      || !PADRAO_COMPANION_WINDOWS.test(entrada.name)
      || !entrada.isFile()) continue;
    const caminho = path.join(diretorio, entrada.name);
    try {
      const identidade = await identidadeArquivoSeguro(caminho, ambiente.homeReal);
      const conteudo = await lerArquivoSeguro(
        caminho,
        LIMITE_LAUNCHER_BYTES,
        ambiente.homeReal,
      );
      if (!validarCompanionLauncherWindows(conteudo, entrada.name)) continue;
      companions.push({ caminho, identidade, conteudo });
    } catch {
      // Arquivo não comprovadamente gerenciado é preservado, inclusive em erro de leitura.
    }
  }
  return companions;
}

async function limparCompanionsGerenciadosInativos(
  ambiente: AmbienteLauncher,
  nomeAtivo: string | undefined,
): Promise<{ alterado: boolean; pendente: boolean }> {
  let alterado = false;
  for (const companion of await listarCompanionsGerenciadosInativos(ambiente, nomeAtivo)) {
    try {
      await removerArquivoSeguro(
        ambiente.homeReal,
        companion.caminho,
        companion.identidade,
      );
      alterado = true;
    } catch {
      if (!await lstatOuNull(companion.caminho)) alterado = true;
    }
  }
  return {
    alterado,
    pendente: (await listarCompanionsGerenciadosInativos(ambiente, nomeAtivo)).length > 0,
  };
}

interface DiagnosticoWrapperWindows {
  estado: "ausente" | "valido" | "invalido";
  codigo?: ResultadoLauncherGlobal["codigo"];
}

async function diagnosticarWrapperWindows(
  ambiente: AmbienteLauncher,
): Promise<DiagnosticoWrapperWindows> {
  if (ambiente.plataforma !== "win32"
    || !ambiente.destinoPowerShell
    || !ambiente.destinoWrapper
    || !ambiente.destinoAnchor) {
    return { estado: "valido" };
  }
  let ausente = false;
  for (const destino of [ambiente.destinoPowerShell, ambiente.destinoWrapper]) {
    if (!await lstatOuNull(destino)) {
      ausente = true;
      continue;
    }
    await validarArquivoRegular(destino, ambiente.homeReal);
    const conteudo = await lerArquivoSeguro(
      destino,
      LIMITE_LAUNCHER_BYTES,
      ambiente.homeReal,
    );
    if (!validarWrapperLauncherWindows(conteudo)) {
      return {
        estado: "invalido",
        codigo: conteudo.toString("utf8").includes("SEMA-MANAGED-LAUNCHER-WRAPPER")
          ? "RECIBO_INVALIDO"
          : "CONTEUDO_NAO_GERENCIADO",
      };
    }
  }
  if (!await lstatOuNull(ambiente.destinoAnchor)) {
    ausente = true;
  } else {
    await validarArquivoRegular(ambiente.destinoAnchor, ambiente.homeReal);
    const ancora = await lerArquivoSeguro(
      ambiente.destinoAnchor,
      LIMITE_LAUNCHER_BYTES,
      ambiente.homeReal,
    );
    if (!validarReciboAncoraLauncherWindows(ancora)) {
      return {
        estado: "invalido",
        codigo: ancora.toString("ascii").includes("SEMA-MANAGED-LAUNCHER-ANCHOR")
          ? "RECIBO_INVALIDO"
          : "CONTEUDO_NAO_GERENCIADO",
      };
    }
  }
  return { estado: ausente ? "ausente" : "valido" };
}

async function diagnosticar(ambiente: AmbienteLauncher): Promise<DiagnosticoLauncherInterno> {
  const cadeia = await validarCadeiaExistente(ambiente.homeReal, path.dirname(ambiente.destino));
  if (cadeia === "ausente") {
    return { resultado: resultado(ambiente, "MISSING", "DESTINO_AUSENTE") };
  }
  const wrapper = await diagnosticarWrapperWindows(ambiente);
  if (wrapper.estado === "invalido") {
    return {
      resultado: resultado(
        ambiente,
        "BROKEN_TARGET",
        wrapper.codigo ?? "RECIBO_INVALIDO",
      ),
    };
  }
  if (!await lstatOuNull(ambiente.destino)) {
    return { resultado: resultado(ambiente, "MISSING", "DESTINO_AUSENTE") };
  }
  await validarArquivoRegular(ambiente.destino, ambiente.homeReal);
  const atual = (await lerArquivoSeguro(
    ambiente.destino,
    LIMITE_LAUNCHER_BYTES,
    ambiente.homeReal,
  )).toString("utf8");
  const validado = await validarReciboAtual(ambiente, atual);
  if (!validado) {
    return {
      resultado: resultado(ambiente, "BROKEN_TARGET", atual.includes("SEMA-MANAGED-LAUNCHER")
        ? "RECIBO_INVALIDO"
        : "CONTEUDO_NAO_GERENCIADO"),
    };
  }
  if (ambiente.plataforma === "win32" && wrapper.estado === "valido") {
    if (!ambiente.destinoAnchor || !ambiente.windows || !validado.companionAtual) {
      return { resultado: resultado(ambiente, "BROKEN_TARGET", "RECIBO_INVALIDO") };
    }
    const ancora = await lerArquivoSeguro(
      ambiente.destinoAnchor,
      LIMITE_LAUNCHER_BYTES,
      ambiente.homeReal,
    );
    if (!validarAncoraLauncherWindows(
      ancora,
      atual,
      validado.companionAtual.conteudo,
      validado.recibo.nomeCompanion ?? "",
      ambiente.windows.wrapper,
    )) {
      return { resultado: resultado(ambiente, "BROKEN_TARGET", "RECIBO_INVALIDO") };
    }
  }
  if (ambiente.plataforma !== "win32") {
    try {
      await access(ambiente.destino, constants.X_OK);
    } catch {
      return {
        resultado: resultado(ambiente, "STALE", "PERMISSAO_EXECUCAO_INVALIDA"),
        recibo: validado.recibo,
      };
    }
  }
  const exato = wrapper.estado === "valido"
    && atual === ambiente.conteudo
    && validado.recibo.executavelNode === ambiente.executavelNode
    && validado.recibo.entrypoint === ambiente.targetCli;
  const limpezaPendente = exato && (
    (await listarCompanionsGerenciadosInativos(
      ambiente,
      validado.recibo.nomeCompanion,
    )).length > 0
    || await transacaoArquivosLauncherPendente(
      ambiente.homeReal,
      path.dirname(ambiente.destino),
    )
  );
  return {
    resultado: resultado(
      ambiente,
      exato ? "READY" : "STALE",
      exato
        ? limpezaPendente ? "LIMPEZA_PENDENTE" : "DESTINO_PRONTO"
        : "DESTINO_DESATUALIZADO",
    ),
    recibo: validado.recibo,
    companionAtual: validado.companionAtual,
  };
}

function fallback(
  opcoes: OpcoesAmbienteDistribuicaoGlobal,
  erro: unknown,
): ResultadoLauncherGlobal {
  const falha = falhaParaResultado(erro);
  const alterado = falha.codigo === "LOCK_PERDIDO" || falha.codigo === "ROLLBACK_FALHOU";
  return {
    estado: falha.estado,
    alterado,
    destino_simbolico: destinoVirtual(opcoes.plataforma ?? process.platform),
    codigo: falha.codigo,
    node_absoluto: false,
    entrypoint_absoluto: false,
    recibo_valido: false,
    independente_path: false,
    fallback_simbolico: (opcoes.plataforma ?? process.platform) === "win32"
      ? "$HOME/.sema/bin/sema-managed.ps1"
      : null,
  };
}

export async function statusLauncherGlobal(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoLauncherGlobal> {
  try {
    return (await diagnosticar(await resolverAmbiente(opcoes))).resultado;
  } catch (erro) {
    return fallback(opcoes, erro);
  }
}

async function garantirCompanionDesejado(
  ambiente: AmbienteLauncher,
): Promise<{ criado: boolean; caminho?: string; identidade?: { dev: bigint; ino: bigint } }> {
  if (!ambiente.windows) return { criado: false };
  const caminho = path.join(path.dirname(ambiente.destino), ambiente.windows.nomeCompanion);
  const existente = await lstatOuNull(caminho);
  if (existente) {
    const atual = await lerArquivoSeguro(caminho, LIMITE_LAUNCHER_BYTES, ambiente.homeReal);
    if (!atual.equals(ambiente.windows.companion)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CONTEUDO_NAO_GERENCIADO");
    }
    return { criado: false, caminho, identidade: await identidadeArquivoSeguro(caminho) };
  }
  await escreverArquivoAtomico(
    ambiente.homeReal,
    caminho,
    ambiente.windows.companion,
    0o600,
  );
  return { criado: true, caminho, identidade: await identidadeArquivoSeguro(caminho) };
}

async function garantirWrapperDesejado(
  ambiente: AmbienteLauncher,
  destino: string | undefined,
): Promise<{ criado: boolean; caminho?: string; identidade?: { dev: bigint; ino: bigint } }> {
  if (!ambiente.windows || !destino) return { criado: false };
  const existente = await lstatOuNull(destino);
  if (existente) {
    const atual = await lerArquivoSeguro(
      destino,
      LIMITE_LAUNCHER_BYTES,
      ambiente.homeReal,
    );
    if (!validarWrapperLauncherWindows(atual)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CONTEUDO_NAO_GERENCIADO");
    }
    return {
      criado: false,
      caminho: destino,
      identidade: await identidadeArquivoSeguro(destino, ambiente.homeReal),
    };
  }
  await escreverArquivoAtomico(
    ambiente.homeReal,
    destino,
    ambiente.windows.wrapper,
    0o600,
  );
  return {
    criado: true,
    caminho: destino,
    identidade: await identidadeArquivoSeguro(destino, ambiente.homeReal),
  };
}

async function garantirAncoraDesejada(
  ambiente: AmbienteLauncher,
): Promise<{ criado: boolean; caminho?: string; identidade?: { dev: bigint; ino: bigint } }> {
  if (!ambiente.windows || !ambiente.destinoAnchor) return { criado: false };
  const existente = await lstatOuNull(ambiente.destinoAnchor);
  if (existente) {
    const atual = await lerArquivoSeguro(
      ambiente.destinoAnchor,
      LIMITE_LAUNCHER_BYTES,
      ambiente.homeReal,
    );
    if (atual.equals(ambiente.windows.anchor)) {
      return {
        criado: false,
        caminho: ambiente.destinoAnchor,
        identidade: await identidadeArquivoSeguro(ambiente.destinoAnchor, ambiente.homeReal),
      };
    }
    if (!validarReciboAncoraLauncherWindows(atual)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CONTEUDO_NAO_GERENCIADO");
    }
  }
  await escreverArquivoAtomico(
    ambiente.homeReal,
    ambiente.destinoAnchor,
    ambiente.windows.anchor,
    0o600,
  );
  return {
    criado: !existente,
    caminho: ambiente.destinoAnchor,
    identidade: await identidadeArquivoSeguro(ambiente.destinoAnchor, ambiente.homeReal),
  };
}

function artefatosDesejadosLauncher(ambiente: AmbienteLauncher): ArtefatoTransacaoArquivo[] {
  const artefatos: ArtefatoTransacaoArquivo[] = [{
    nome: path.basename(ambiente.destino),
    conteudoDepois: Buffer.from(ambiente.conteudo, "utf8"),
    modo: 0o755,
  }];
  if (ambiente.windows) {
    artefatos.push(
      { nome: ambiente.windows.nomeCompanion, conteudoDepois: ambiente.windows.companion, modo: 0o600 },
      { nome: path.basename(ambiente.destinoPowerShell ?? ""), conteudoDepois: ambiente.windows.wrapper, modo: 0o600 },
      { nome: path.basename(ambiente.destinoWrapper ?? ""), conteudoDepois: ambiente.windows.wrapper, modo: 0o600 },
      { nome: path.basename(ambiente.destinoAnchor ?? ""), conteudoDepois: ambiente.windows.anchor, modo: 0o600 },
    );
  }
  return artefatos;
}

async function sincronizarAmbiente(
  ambiente: AmbienteLauncher,
  preservarCompanionAnterior: boolean,
): Promise<ResultadoLauncherGlobal> {
  let transacao: Awaited<ReturnType<typeof prepararTransacaoArquivosLauncher>> | undefined;
  try {
    const diretorio = path.dirname(ambiente.destino);
    const recuperacaoInicial = await recuperarTransacaoArquivosLauncher(
      ambiente.homeReal,
      diretorio,
    );
    const antes = await diagnosticar(ambiente);
    if (antes.resultado.estado === "BROKEN_TARGET"
      || antes.resultado.estado === "PERMISSION_DENIED") return antes.resultado;
    if (antes.resultado.estado === "READY") {
      if (preservarCompanionAnterior) {
        return { ...antes.resultado, alterado: recuperacaoInicial.alterado };
      }
      const limpeza = await limparCompanionsGerenciadosInativos(
        ambiente,
        antes.recibo?.nomeCompanion,
      );
      const depoisLimpeza = await diagnosticar(ambiente);
      return {
        ...depoisLimpeza.resultado,
        alterado: limpeza.alterado || recuperacaoInicial.alterado,
      };
    }
    transacao = await prepararTransacaoArquivosLauncher(
      ambiente.homeReal,
      diretorio,
      artefatosDesejadosLauncher(ambiente),
    );
    await garantirCompanionDesejado(ambiente);
    await garantirWrapperDesejado(ambiente, ambiente.destinoPowerShell);
    await garantirWrapperDesejado(ambiente, ambiente.destinoWrapper);
    await garantirAncoraDesejada(ambiente);
    await escreverArquivoAtomico(
      ambiente.homeReal,
      ambiente.destino,
      ambiente.conteudo,
      0o755,
    );
    let depois = await diagnosticar(ambiente);
    if (depois.resultado.estado !== "READY") {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", depois.resultado.codigo);
    }
    const conclusao = await concluirTransacaoArquivosLauncher(transacao);
    transacao = undefined;
    if (!preservarCompanionAnterior) {
      await limparCompanionsGerenciadosInativos(
        ambiente,
        depois.recibo?.nomeCompanion,
      );
      depois = await diagnosticar(ambiente);
    }
    const limpezaPendente = conclusao.limpezaPendente
      || await transacaoArquivosLauncherPendente(ambiente.homeReal, diretorio);
    return {
      ...depois.resultado,
      codigo: depois.resultado.estado === "READY" && limpezaPendente
        ? "LIMPEZA_PENDENTE"
        : depois.resultado.codigo,
      alterado: true,
    };
  } catch (erro) {
    if (transacao) {
      try {
        await recuperarTransacaoArquivosLauncher(
          ambiente.homeReal,
          path.dirname(ambiente.destino),
        );
        return { ...(await diagnosticar(ambiente)).resultado, alterado: false };
      } catch {
        return resultado(ambiente, "BROKEN_TARGET", "ROLLBACK_FALHOU", true);
      }
    }
    const falha = falhaParaResultado(erro);
    return resultado(ambiente, falha.estado, falha.codigo);
  }
}

async function sincronizarLauncherGlobalSemLock(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoLauncherGlobal> {
  try {
    return await sincronizarAmbiente(await resolverAmbiente(opcoes), false);
  } catch (erro) {
    return fallback(opcoes, erro);
  }
}

export async function sincronizarLauncherGlobal(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoLauncherGlobal> {
  try {
    return await comLockDistribuicaoGlobal(opcoes, async ({ diretorioUsuario }) => (
      sincronizarLauncherGlobalSemLock({ ...opcoes, diretorioUsuario })
    ));
  } catch (erro) {
    return fallback(opcoes, erro);
  }
}

/** Snapshot opaco usado somente pelo coordenador para compensação local. */
export interface SnapshotLauncherGlobalTransacao {
  readonly ambiente: AmbienteLauncher;
  readonly diagnosticoAntes: DiagnosticoLauncherInterno;
  readonly launcherAntes?: Buffer;
  readonly powerShellAntes?: Buffer;
  readonly wrapperAntes?: Buffer;
  readonly anchorAntes?: Buffer;
  readonly companionDesejadoExistia: boolean;
}

export async function capturarSnapshotLauncherGlobalTransacao(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<SnapshotLauncherGlobalTransacao> {
  const ambiente = await resolverAmbiente(opcoes);
  const diagnosticoAntes = await diagnosticar(ambiente);
  if (diagnosticoAntes.resultado.estado === "BROKEN_TARGET"
    || diagnosticoAntes.resultado.estado === "PERMISSION_DENIED") {
    throw new FalhaDistribuicaoGlobal(
      diagnosticoAntes.resultado.estado === "PERMISSION_DENIED"
        ? "PERMISSION_DENIED"
        : "BROKEN_TARGET",
      diagnosticoAntes.resultado.codigo,
    );
  }
  const launcherAntes = await lstatOuNull(ambiente.destino)
    ? await lerArquivoSeguro(ambiente.destino, LIMITE_LAUNCHER_BYTES, ambiente.homeReal)
    : undefined;
  const powerShellAntes = ambiente.destinoPowerShell && await lstatOuNull(ambiente.destinoPowerShell)
    ? await lerArquivoSeguro(ambiente.destinoPowerShell, LIMITE_LAUNCHER_BYTES, ambiente.homeReal)
    : undefined;
  const wrapperAntes = ambiente.destinoWrapper && await lstatOuNull(ambiente.destinoWrapper)
    ? await lerArquivoSeguro(ambiente.destinoWrapper, LIMITE_LAUNCHER_BYTES, ambiente.homeReal)
    : undefined;
  const anchorAntes = ambiente.destinoAnchor && await lstatOuNull(ambiente.destinoAnchor)
    ? await lerArquivoSeguro(ambiente.destinoAnchor, LIMITE_LAUNCHER_BYTES, ambiente.homeReal)
    : undefined;
  const companionDesejado = ambiente.windows
    ? path.join(path.dirname(ambiente.destino), ambiente.windows.nomeCompanion)
    : undefined;
  return {
    ambiente,
    diagnosticoAntes,
    launcherAntes,
    powerShellAntes,
    wrapperAntes,
    anchorAntes,
    companionDesejadoExistia: companionDesejado
      ? await lstatOuNull(companionDesejado) !== null
      : false,
  };
}

async function sincronizarLauncherGlobalTransacionalSemLock(
  snapshot: SnapshotLauncherGlobalTransacao,
): Promise<ResultadoLauncherGlobal> {
  return sincronizarAmbiente(snapshot.ambiente, true);
}

export async function sincronizarLauncherGlobalTransacional(
  snapshot: SnapshotLauncherGlobalTransacao,
): Promise<ResultadoLauncherGlobal> {
  return comLockDistribuicaoGlobal(
    { diretorioUsuario: snapshot.ambiente.homeReal },
    async () => sincronizarLauncherGlobalTransacionalSemLock(snapshot),
  );
}

interface ArtefatoRollbackLauncher {
  destino?: string;
  antes?: Buffer;
  esperado?: Buffer;
  modo: number;
}

function artefatosRollbackLauncher(
  snapshot: SnapshotLauncherGlobalTransacao,
): ArtefatoRollbackLauncher[] {
  const { ambiente } = snapshot;
  const companion = ambiente.windows
    ? path.join(path.dirname(ambiente.destino), ambiente.windows.nomeCompanion)
    : undefined;
  return [
    { destino: ambiente.destino, antes: snapshot.launcherAntes, esperado: Buffer.from(ambiente.conteudo), modo: 0o755 },
    { destino: ambiente.destinoPowerShell, antes: snapshot.powerShellAntes, esperado: ambiente.windows?.wrapper, modo: 0o600 },
    { destino: ambiente.destinoWrapper, antes: snapshot.wrapperAntes, esperado: ambiente.windows?.wrapper, modo: 0o600 },
    { destino: ambiente.destinoAnchor, antes: snapshot.anchorAntes, esperado: ambiente.windows?.anchor, modo: 0o600 },
    {
      destino: companion,
      antes: snapshot.companionDesejadoExistia ? ambiente.windows?.companion : undefined,
      esperado: ambiente.windows?.companion,
      modo: 0o600,
    },
  ];
}

async function restaurarArtefatoRollback(
  ambiente: AmbienteLauncher,
  artefato: ArtefatoRollbackLauncher,
): Promise<void> {
  if (!artefato.destino || !artefato.esperado) return;
  const existe = await lstatOuNull(artefato.destino) !== null;
  if (!existe && artefato.antes) {
    await escreverArquivoAtomico(ambiente.homeReal, artefato.destino, artefato.antes, artefato.modo);
    return;
  }
  if (!existe) return;
  const atual = await lerArquivoSeguro(artefato.destino, LIMITE_LAUNCHER_BYTES, ambiente.homeReal);
  if (artefato.antes && atual.equals(artefato.antes)) return;
  if (!atual.equals(artefato.esperado)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  if (artefato.antes) {
    await escreverArquivoAtomico(ambiente.homeReal, artefato.destino, artefato.antes, artefato.modo);
  } else {
    await removerArquivoSeguro(
      ambiente.homeReal,
      artefato.destino,
      await identidadeArquivoSeguro(artefato.destino, ambiente.homeReal),
    );
  }
}

async function confirmarArtefatoRollback(
  ambiente: AmbienteLauncher,
  artefato: ArtefatoRollbackLauncher,
): Promise<void> {
  if (!artefato.destino || !artefato.esperado) return;
  const existe = await lstatOuNull(artefato.destino) !== null;
  if (!artefato.antes) {
    if (existe) throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
    return;
  }
  if (!existe || !(await lerArquivoSeguro(
    artefato.destino,
    LIMITE_LAUNCHER_BYTES,
    ambiente.homeReal,
  )).equals(artefato.antes)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
  }
}

async function restaurarSnapshotLauncherGlobalTransacaoSemLock(
  snapshot: SnapshotLauncherGlobalTransacao,
): Promise<void> {
  const artefatos = artefatosRollbackLauncher(snapshot);
  const restauracoes = await Promise.allSettled(
    artefatos.map((artefato) => restaurarArtefatoRollback(snapshot.ambiente, artefato)),
  );
  const verificacoes = await Promise.allSettled(
    artefatos.map((artefato) => confirmarArtefatoRollback(snapshot.ambiente, artefato)),
  );
  if ([...restauracoes, ...verificacoes].some((item) => item.status === "rejected")) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
  }
}

export async function restaurarSnapshotLauncherGlobalTransacao(
  snapshot: SnapshotLauncherGlobalTransacao,
): Promise<void> {
  return comLockDistribuicaoGlobal(
    { diretorioUsuario: snapshot.ambiente.homeReal },
    async () => restaurarSnapshotLauncherGlobalTransacaoSemLock(snapshot),
  );
}

async function confirmarSnapshotLauncherGlobalTransacaoSemLock(
  snapshot: SnapshotLauncherGlobalTransacao,
): Promise<ResultadoLauncherGlobal> {
  const atual = await diagnosticar(snapshot.ambiente);
  if (atual.resultado.estado !== "READY") return atual.resultado;
  const limpeza = await limparCompanionsGerenciadosInativos(
    snapshot.ambiente,
    atual.recibo?.nomeCompanion,
  );
  const final = await diagnosticar(snapshot.ambiente);
  return { ...final.resultado, alterado: limpeza.alterado };
}

export async function confirmarSnapshotLauncherGlobalTransacao(
  snapshot: SnapshotLauncherGlobalTransacao,
): Promise<ResultadoLauncherGlobal> {
  return comLockDistribuicaoGlobal(
    { diretorioUsuario: snapshot.ambiente.homeReal },
    async () => confirmarSnapshotLauncherGlobalTransacaoSemLock(snapshot),
  );
}
