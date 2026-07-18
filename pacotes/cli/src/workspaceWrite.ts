// SEMA-GOVERNED: sema.produto.escrita_segura_workspace
// Descrição: valida e executa escritas locais sem atravessar symlink, junction ou a base escolhida.

import { constants, type BigIntStats } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  stat,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const IDENTIDADE_DESTINO = Symbol("sema.identidade-destino-workspace");
const IDENTIDADE_BASE_DESTINO = Symbol("sema.identidade-base-workspace");

interface IdentidadeNoFilesystem {
  dev: bigint;
  ino: bigint;
}

interface GuardaDiretorio {
  caminho: string;
  handle: FileHandle;
  identidade: IdentidadeNoFilesystem;
}

export interface DestinoEscritaWorkspace {
  caminhoRelativo: string;
  caminhoAbsoluto: string;
  existe: boolean;
  [IDENTIDADE_DESTINO]?: IdentidadeNoFilesystem | null;
  [IDENTIDADE_BASE_DESTINO]?: IdentidadeNoFilesystem;
}

export interface OpcoesEscritaWorkspace {
  sobrescrever?: boolean;
}

class ErroIntegridadeWorkspace extends Error {
  readonly code = "SEMA_WORKSPACE_TOCTOU";

  constructor(mensagem: string) {
    super(`Integridade do workspace mudou durante a escrita (TOCTOU): ${mensagem}`);
    this.name = "ErroIntegridadeWorkspace";
  }
}

function caminhoEstaContido(base: string, alvo: string): boolean {
  const relativo = path.relative(base, alvo);
  return relativo === "" || (
    relativo !== ".." &&
    !relativo.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativo)
  );
}

function identidadeDe(info: BigIntStats): IdentidadeNoFilesystem {
  return { dev: info.dev, ino: info.ino };
}

function mesmaIdentidade(
  esquerda: IdentidadeNoFilesystem,
  direita: IdentidadeNoFilesystem,
): boolean {
  return esquerda.dev === direita.dev && esquerda.ino === direita.ino;
}

async function lstatSeguro(caminho: string): Promise<BigIntStats | null> {
  try {
    return await lstat(caminho, { bigint: true });
  } catch (erro) {
    if (["ENOENT", "ENOTDIR"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
      return null;
    }
    throw erro;
  }
}

function validarRelativo(caminhoRelativo: string): void {
  if (!caminhoRelativo.trim() || path.isAbsolute(caminhoRelativo)) {
    throw new Error(`Destino de workspace deve ser relativo: ${caminhoRelativo}`);
  }
  if (caminhoRelativo.includes("\0")) {
    throw new Error("Destino de workspace não pode conter byte nulo.");
  }
  if (caminhoRelativo.split(/[\\/]+/u).includes("..")) {
    throw new Error(`Destino de workspace não pode conter traversal: ${caminhoRelativo}`);
  }
}

async function resolverBaseReal(base: string): Promise<string> {
  const baseAbsoluta = path.resolve(base);
  const baseInfo = await stat(baseAbsoluta).catch(() => null);
  if (!baseInfo?.isDirectory()) {
    throw new Error(`Base de escrita não existe ou não é diretório: ${baseAbsoluta}`);
  }
  const baseReal = await realpath(baseAbsoluta);
  const baseRealInfo = await lstatSeguro(baseReal);
  if (!baseRealInfo?.isDirectory() || baseRealInfo.isSymbolicLink()) {
    throw new Error(`Base real de escrita não é diretório confiável: ${baseReal}`);
  }
  return baseReal;
}

function resolverDestino(baseReal: string, caminhoRelativo: string): string {
  validarRelativo(caminhoRelativo);
  const caminhoAbsoluto = path.resolve(baseReal, caminhoRelativo);
  if (!caminhoEstaContido(baseReal, caminhoAbsoluto)) {
    throw new Error(`Destino escapa da base de escrita: ${caminhoRelativo}`);
  }
  return caminhoAbsoluto;
}

async function revalidarGuardasDiretorio(guardas: GuardaDiretorio[]): Promise<void> {
  for (const guarda of guardas) {
    const [porCaminho, porHandle] = await Promise.all([
      lstatSeguro(guarda.caminho),
      guarda.handle.stat({ bigint: true }),
    ]);
    if (
      !porCaminho?.isDirectory() ||
      porCaminho.isSymbolicLink() ||
      !porHandle.isDirectory() ||
      !mesmaIdentidade(guarda.identidade, identidadeDe(porCaminho)) ||
      !mesmaIdentidade(guarda.identidade, identidadeDe(porHandle))
    ) {
      throw new ErroIntegridadeWorkspace(`diretório substituído: ${guarda.caminho}`);
    }
  }
}

async function abrirEGuardarDiretorio(
  caminho: string,
  guardasAnteriores: GuardaDiretorio[],
): Promise<GuardaDiretorio> {
  await revalidarGuardasDiretorio(guardasAnteriores);
  const antes = await lstatSeguro(caminho);
  if (!antes?.isDirectory() || antes.isSymbolicLink()) {
    throw new Error(`Destino atravessa symlink, junction ou não-diretório: ${caminho}`);
  }

  const handle = await open(caminho, constants.O_RDONLY);
  try {
    const [depois, porHandle] = await Promise.all([
      lstatSeguro(caminho),
      handle.stat({ bigint: true }),
    ]);
    const identidadeAntes = identidadeDe(antes);
    if (
      !depois?.isDirectory() ||
      depois.isSymbolicLink() ||
      !porHandle.isDirectory() ||
      !mesmaIdentidade(identidadeAntes, identidadeDe(depois)) ||
      !mesmaIdentidade(identidadeAntes, identidadeDe(porHandle))
    ) {
      throw new ErroIntegridadeWorkspace(`diretório mudou ao ser aberto: ${caminho}`);
    }
    await revalidarGuardasDiretorio(guardasAnteriores);
    return { caminho, handle, identidade: identidadeAntes };
  } catch (erro) {
    await handle.close().catch(() => undefined);
    throw erro;
  }
}

async function fecharGuardasDiretorio(guardas: GuardaDiretorio[]): Promise<void> {
  await Promise.all(guardas.map((guarda) => guarda.handle.close().catch(() => undefined)));
}

function segmentosEntre(baseReal: string, alvo: string): string[] {
  if (!caminhoEstaContido(baseReal, alvo)) {
    throw new Error(`Destino resolve fora da base de escrita: ${alvo}`);
  }
  return path.relative(baseReal, alvo).split(path.sep).filter(Boolean);
}

async function garantirDiretoriosDestino(
  baseReal: string,
  diretorioDestino: string,
  identidadeBaseEsperada: IdentidadeNoFilesystem,
): Promise<GuardaDiretorio[]> {
  const guardas: GuardaDiretorio[] = [];
  try {
    guardas.push(await abrirEGuardarDiretorio(baseReal, guardas));
    if (!mesmaIdentidade(guardas[0].identidade, identidadeBaseEsperada)) {
      throw new ErroIntegridadeWorkspace(`base substituída: ${baseReal}`);
    }
    let atual = baseReal;
    for (const segmento of segmentosEntre(baseReal, diretorioDestino)) {
      atual = path.join(atual, segmento);
      await revalidarGuardasDiretorio(guardas);
      let info = await lstatSeguro(atual);
      if (!info) {
        try {
          await mkdir(atual);
        } catch (erro) {
          if ((erro as NodeJS.ErrnoException).code !== "EEXIST") {
            throw erro;
          }
        }
        await revalidarGuardasDiretorio(guardas);
        info = await lstatSeguro(atual);
      }
      if (!info?.isDirectory() || info.isSymbolicLink()) {
        throw new Error(`Destino atravessa symlink, junction ou não-diretório: ${atual}`);
      }
      guardas.push(await abrirEGuardarDiretorio(atual, guardas));
    }
    await revalidarGuardasDiretorio(guardas);
    return guardas;
  } catch (erro) {
    await fecharGuardasDiretorio(guardas);
    throw erro;
  }
}

async function confirmarArquivoPorHandle(
  caminho: string,
  handle: FileHandle,
  guardas: GuardaDiretorio[],
): Promise<void> {
  await revalidarGuardasDiretorio(guardas);
  const [porCaminho, porHandle] = await Promise.all([
    lstatSeguro(caminho),
    handle.stat({ bigint: true }),
  ]);
  if (
    !porCaminho?.isFile() ||
    porCaminho.isSymbolicLink() ||
    !porHandle.isFile() ||
    !mesmaIdentidade(identidadeDe(porCaminho), identidadeDe(porHandle)) ||
    porHandle.nlink !== 1n
  ) {
    throw new ErroIntegridadeWorkspace(`arquivo substituído, ocultado ou ligado externamente: ${caminho}`);
  }
  await revalidarGuardasDiretorio(guardas);
}

async function confirmarEstadoInicialDestino(
  destino: DestinoEscritaWorkspace,
  guardas: GuardaDiretorio[],
): Promise<void> {
  await revalidarGuardasDiretorio(guardas);
  const atual = await lstatSeguro(destino.caminhoAbsoluto);
  const esperada = destino[IDENTIDADE_DESTINO] ?? null;
  if (atual?.isSymbolicLink()) {
    throw new ErroIntegridadeWorkspace(`destino virou symlink ou junction: ${destino.caminhoAbsoluto}`);
  }
  if (
    (esperada === null && atual !== null) ||
    (esperada !== null && (atual === null || !mesmaIdentidade(esperada, identidadeDe(atual))))
  ) {
    throw new ErroIntegridadeWorkspace(`destino mudou desde a validação: ${destino.caminhoAbsoluto}`);
  }
}

async function escreverConteudoConfirmado(
  caminho: string,
  handle: FileHandle,
  guardas: GuardaDiretorio[],
  conteudo: string,
): Promise<void> {
  await confirmarArquivoPorHandle(caminho, handle, guardas);
  await handle.writeFile(conteudo, { encoding: "utf8" });
  await handle.sync();
  await confirmarArquivoPorHandle(caminho, handle, guardas);
}

async function removerArquivoSeAindaForMesmo(
  caminho: string,
  handle: FileHandle,
  guardas: GuardaDiretorio[],
): Promise<void> {
  try {
    await confirmarArquivoPorHandle(caminho, handle, guardas);
    await unlink(caminho);
    await revalidarGuardasDiretorio(guardas);
  } catch {
    // Falha fechada: não removemos um caminho cuja identidade já não pode ser provada.
  }
}

export async function validarDestinosEscritaWorkspace(
  base: string,
  caminhosRelativos: string[],
): Promise<DestinoEscritaWorkspace[]> {
  const baseReal = await resolverBaseReal(base);
  const destinos: DestinoEscritaWorkspace[] = [];
  const guardaBase = await abrirEGuardarDiretorio(baseReal, []);
  try {
    for (const caminhoRelativo of [...new Set(caminhosRelativos)]) {
      const caminhoAbsoluto = resolverDestino(baseReal, caminhoRelativo);
      const segmentos = segmentosEntre(baseReal, caminhoAbsoluto);
      const guardas: GuardaDiretorio[] = [guardaBase];
      let atual = baseReal;
      let infoFinal: BigIntStats | null = null;
      try {
        for (let indice = 0; indice < segmentos.length; indice += 1) {
          atual = path.join(atual, segmentos[indice]);
          await revalidarGuardasDiretorio(guardas);
          const info = await lstatSeguro(atual);
          if (!info) {
            infoFinal = null;
            break;
          }
          if (info.isSymbolicLink()) {
            throw new Error(`Destino atravessa symlink ou junction: ${caminhoRelativo}`);
          }
          const ultimo = indice === segmentos.length - 1;
          if (ultimo) {
            infoFinal = info;
            break;
          }
          if (!info.isDirectory()) {
            // O validador também é usado por migrações que sondam caminhos
            // legados alternativos (arquivo único versus diretório). Um
            // componente regular torna o descendente inexistente; a escrita,
            // se tentada, continua bloqueada em garantirDiretoriosDestino.
            infoFinal = null;
            break;
          }
          guardas.push(await abrirEGuardarDiretorio(atual, guardas));
        }
        await revalidarGuardasDiretorio(guardas);
      } finally {
        await fecharGuardasDiretorio(guardas.slice(1));
      }

      const destino: DestinoEscritaWorkspace = {
        caminhoRelativo,
        caminhoAbsoluto,
        existe: infoFinal !== null,
      };
      destino[IDENTIDADE_DESTINO] = infoFinal ? identidadeDe(infoFinal) : null;
      destino[IDENTIDADE_BASE_DESTINO] = guardaBase.identidade;
      destinos.push(destino);
    }
  } finally {
    await fecharGuardasDiretorio([guardaBase]);
  }

  return destinos;
}

export async function escreverArquivoWorkspaceSeguro(
  base: string,
  caminhoRelativo: string,
  conteudo: string,
  opcoes: OpcoesEscritaWorkspace = {},
): Promise<{ status: "criado" | "atualizado" | "preservado"; caminho: string }> {
  const [destino] = await validarDestinosEscritaWorkspace(base, [caminhoRelativo]);
  if (destino.existe && !opcoes.sobrescrever) {
    return { status: "preservado", caminho: destino.caminhoAbsoluto };
  }

  const baseReal = await resolverBaseReal(base);
  const identidadeBaseEsperada = destino[IDENTIDADE_BASE_DESTINO];
  if (!identidadeBaseEsperada) {
    throw new ErroIntegridadeWorkspace("a validação inicial não registrou a identidade da base");
  }
  if (!caminhoEstaContido(baseReal, destino.caminhoAbsoluto)) {
    throw new ErroIntegridadeWorkspace("a base real mudou desde a validação inicial");
  }
  const guardas = await garantirDiretoriosDestino(
    baseReal,
    path.dirname(destino.caminhoAbsoluto),
    identidadeBaseEsperada,
  );
  try {
    await confirmarEstadoInicialDestino(destino, guardas);

    if (!opcoes.sobrescrever) {
      let handle: FileHandle;
      try {
        handle = await open(destino.caminhoAbsoluto, "wx", 0o600);
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === "EEXIST") {
          return { status: "preservado", caminho: destino.caminhoAbsoluto };
        }
        throw erro;
      }
      try {
        await escreverConteudoConfirmado(destino.caminhoAbsoluto, handle, guardas, conteudo);
      } catch (erro) {
        if (!(erro instanceof ErroIntegridadeWorkspace)) {
          await removerArquivoSeAindaForMesmo(destino.caminhoAbsoluto, handle, guardas);
        }
        throw erro;
      } finally {
        await handle.close().catch(() => undefined);
      }
    } else {
      const temporario = path.join(
        path.dirname(destino.caminhoAbsoluto),
        `.${path.basename(destino.caminhoAbsoluto)}.sema-${randomUUID()}.tmp`,
      );
      const handle = await open(temporario, "wx", 0o600);
      let renomeado = false;
      try {
        await escreverConteudoConfirmado(temporario, handle, guardas, conteudo);
        await confirmarEstadoInicialDestino(destino, guardas);
        await confirmarArquivoPorHandle(temporario, handle, guardas);
        await rename(temporario, destino.caminhoAbsoluto);
        renomeado = true;
        await confirmarArquivoPorHandle(destino.caminhoAbsoluto, handle, guardas);
      } catch (erro) {
        if (!renomeado && !(erro instanceof ErroIntegridadeWorkspace)) {
          await removerArquivoSeAindaForMesmo(temporario, handle, guardas);
        }
        throw erro;
      } finally {
        await handle.close().catch(() => undefined);
      }
    }
  } finally {
    await fecharGuardasDiretorio(guardas);
  }

  return {
    status: destino.existe ? "atualizado" : "criado",
    caminho: destino.caminhoAbsoluto,
  };
}
