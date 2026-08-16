// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: fornece primitivas confinadas para escrita atômica fora do workspace, somente em destinos globais permitidos.

import { constants, type BigIntStats } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type {
  CodigoDiagnosticoDistribuicaoGlobal,
  EstadoDistribuicaoGlobal,
} from "./tipos.js";
import { confirmarFencingLockDistribuicaoGlobal } from "./lockContextGlobal.js";

export class FalhaDistribuicaoGlobal extends Error {
  constructor(
    readonly estado: Extract<EstadoDistribuicaoGlobal, "BROKEN_TARGET" | "PERMISSION_DENIED">,
    readonly codigo: CodigoDiagnosticoDistribuicaoGlobal,
  ) {
    super(codigo);
    this.name = "FalhaDistribuicaoGlobal";
  }
}

interface IdentidadeFs {
  dev: bigint;
  ino: bigint;
}

export interface IdentidadeDiretorioSeguro {
  dev: bigint;
  ino: bigint;
}

function identidadeDe(info: BigIntStats): IdentidadeFs {
  return { dev: info.dev, ino: info.ino };
}

function mesmaIdentidade(a: IdentidadeFs, b: IdentidadeFs): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

export function mesmaIdentidadeDiretorio(
  a: IdentidadeDiretorioSeguro,
  b: IdentidadeDiretorioSeguro,
): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

export function erroEhPermissao(erro: unknown): boolean {
  return ["EACCES", "EPERM", "EROFS"].includes((erro as NodeJS.ErrnoException).code ?? "");
}

export function falhaParaResultado(erro: unknown): FalhaDistribuicaoGlobal {
  if (erro instanceof FalhaDistribuicaoGlobal) return erro;
  if (erroEhPermissao(erro)) {
    return new FalhaDistribuicaoGlobal("PERMISSION_DENIED", "ERRO_PERMISSAO");
  }
  return new FalhaDistribuicaoGlobal("BROKEN_TARGET", "AMBIENTE_INVALIDO");
}

export async function lstatOuNull(caminho: string): Promise<BigIntStats | null> {
  try {
    return await lstat(caminho, { bigint: true });
  } catch (erro) {
    if (["ENOENT", "ENOTDIR"].includes((erro as NodeJS.ErrnoException).code ?? "")) return null;
    throw erro;
  }
}

function caminhoComparavel(caminho: string): string {
  const normalizado = path.normalize(path.resolve(caminho));
  return process.platform === "win32" ? normalizado.toLocaleLowerCase("en-US") : normalizado;
}

export function caminhosIguais(a: string, b: string): boolean {
  return caminhoComparavel(a) === caminhoComparavel(b);
}

export function caminhoContido(base: string, alvo: string): boolean {
  const relativo = path.relative(path.resolve(base), path.resolve(alvo));
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

async function validarDiretorioReal(caminho: string): Promise<BigIntStats> {
  const info = await lstat(caminho, { bigint: true });
  if (info.isSymbolicLink()) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "SYMLINK_OU_JUNCTION");
  }
  if (!info.isDirectory()) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "COMPONENTE_NAO_DIRETORIO");
  }
  const real = await realpath(caminho);
  if (!caminhosIguais(real, caminho)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "SYMLINK_OU_JUNCTION");
  }
  return info;
}

export async function identidadeDiretorioSeguro(
  caminho: string,
): Promise<IdentidadeDiretorioSeguro> {
  const info = await validarDiretorioReal(caminho);
  return identidadeDe(info);
}

export async function resolverHomeReal(diretorioUsuario: string): Promise<string> {
  if (!path.isAbsolute(diretorioUsuario) || diretorioUsuario.includes("\0")) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "AMBIENTE_INVALIDO");
  }
  try {
    const absoluto = path.resolve(diretorioUsuario);
    await validarDiretorioReal(absoluto);
    return await realpath(absoluto);
  } catch (erro) {
    throw falhaParaResultado(erro);
  }
}

export function resolverDentroDaHome(homeReal: string, ...segmentos: string[]): string {
  if (segmentos.some((segmento) => (
    !segmento
    || segmento.includes("\0")
    || path.isAbsolute(segmento)
    || segmento === ".."
    || segmento.includes("/")
    || segmento.includes("\\")
  ))) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  const destino = path.resolve(homeReal, ...segmentos);
  if (!caminhoContido(homeReal, destino) || caminhosIguais(homeReal, destino)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  return destino;
}

export async function validarCadeiaExistente(
  homeReal: string,
  destino: string,
): Promise<"completa" | "ausente"> {
  if (!caminhoContido(homeReal, destino)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  let atual = homeReal;
  for (const segmento of path.relative(homeReal, destino).split(path.sep).filter(Boolean)) {
    atual = path.join(atual, segmento);
    const info = await lstatOuNull(atual);
    if (!info) return "ausente";
    await validarDiretorioReal(atual);
  }
  return "completa";
}

export async function garantirDiretoriosSeguros(
  homeReal: string,
  destino: string,
): Promise<void> {
  if (!caminhoContido(homeReal, destino)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  let atual = homeReal;
  for (const segmento of path.relative(homeReal, destino).split(path.sep).filter(Boolean)) {
    atual = path.join(atual, segmento);
    let info = await lstatOuNull(atual);
    if (!info) {
      await confirmarFencingLockDistribuicaoGlobal(homeReal);
      try {
        await mkdir(atual, { mode: 0o700 });
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
      }
      info = await lstatOuNull(atual);
    }
    if (!info) throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    await validarDiretorioReal(atual);
  }
}

export async function validarArquivoRegular(
  caminho: string,
  basePermitida?: string,
): Promise<BigIntStats> {
  if (basePermitida && !caminhoContido(basePermitida, caminho)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  const info = await lstat(caminho, { bigint: true });
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "SYMLINK_OU_JUNCTION");
  }
  const real = await realpath(caminho);
  if (!caminhosIguais(real, caminho)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "SYMLINK_OU_JUNCTION");
  }
  return info;
}

export async function identidadeArquivoSeguro(
  caminho: string,
  basePermitida?: string,
): Promise<{ dev: bigint; ino: bigint }> {
  return identidadeDe(await validarArquivoRegular(caminho, basePermitida));
}

export async function removerArquivoSeguro(
  homeReal: string,
  caminho: string,
  identidadeEsperada?: { dev: bigint; ino: bigint },
): Promise<void> {
  if (!caminhoContido(homeReal, caminho)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  const pai = path.dirname(caminho);
  const identidadePai = await identidadeDiretorioSeguro(pai);
  const identidadeInicial = await identidadeArquivoSeguro(caminho, homeReal);
  if (identidadeEsperada && !mesmaIdentidade(identidadeEsperada, identidadeInicial)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  const [arquivoAntes, paiAntes] = await Promise.all([
    identidadeArquivoSeguro(caminho, homeReal),
    identidadeDiretorioSeguro(pai),
  ]);
  if (!mesmaIdentidade(identidadeInicial, arquivoAntes)
    || !mesmaIdentidade(identidadePai, paiAntes)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  await confirmarFencingLockDistribuicaoGlobal(homeReal);
  await unlink(caminho);
  const paiDepois = await identidadeDiretorioSeguro(pai);
  if (!mesmaIdentidade(identidadePai, paiDepois)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
}

export async function lerArquivoSeguro(
  caminho: string,
  limiteBytes = 2 * 1024 * 1024,
  basePermitida?: string,
): Promise<Buffer> {
  const infoAntes = await validarArquivoRegular(caminho, basePermitida);
  if (infoAntes.size > BigInt(limiteBytes)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
  }
  const handle = await open(caminho, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const infoHandle = await handle.stat({ bigint: true });
    if (!mesmaIdentidade(identidadeDe(infoAntes), identidadeDe(infoHandle))) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    }
    const bytes = await handle.readFile();
    const infoDepois = await validarArquivoRegular(caminho, basePermitida);
    if (bytes.byteLength > limiteBytes
      || !mesmaIdentidade(identidadeDe(infoAntes), identidadeDe(infoDepois))) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    }
    return bytes;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function confirmarTemporario(
  caminho: string,
  handle: FileHandle,
  identidade: IdentidadeFs,
): Promise<void> {
  const [porCaminho, porHandle] = await Promise.all([
    lstat(caminho, { bigint: true }),
    handle.stat({ bigint: true }),
  ]);
  if (!porCaminho.isFile()
    || porCaminho.isSymbolicLink()
    || porCaminho.nlink !== 1n
    || porHandle.nlink !== 1n
    || !mesmaIdentidade(identidade, identidadeDe(porCaminho))
    || !mesmaIdentidade(identidade, identidadeDe(porHandle))) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
}

async function removerTemporarioSeMesmo(
  caminho: string,
  identidade: IdentidadeFs | undefined,
): Promise<void> {
  if (!identidade) return;
  try {
    const info = await lstat(caminho, { bigint: true });
    if (info.isFile()
      && !info.isSymbolicLink()
      && info.nlink === 1n
      && mesmaIdentidade(identidade, identidadeDe(info))) {
      await unlink(caminho);
    }
  } catch {
    // Limpeza best effort nunca remove um caminho cuja identidade mudou.
  }
}

export async function escreverArquivoAtomico(
  homeReal: string,
  destino: string,
  conteudo: string | Buffer,
  modo: number,
): Promise<void> {
  if (!caminhoContido(homeReal, destino)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  const diretorio = path.dirname(destino);
  await garantirDiretoriosSeguros(homeReal, diretorio);
  const identidadePai = await identidadeDiretorioSeguro(diretorio);
  const existenteAntes = await lstatOuNull(destino);
  if (existenteAntes) await validarArquivoRegular(destino, homeReal);
  const temporario = path.join(diretorio, `.${path.basename(destino)}.sema-${randomUUID()}.tmp`);
  let handle: FileHandle | undefined;
  let identidade: IdentidadeFs | undefined;
  let renomeado = false;
  try {
    await confirmarFencingLockDistribuicaoGlobal(homeReal);
    handle = await open(temporario, "wx", 0o600);
    const info = await handle.stat({ bigint: true });
    identidade = identidadeDe(info);
    await confirmarTemporario(temporario, handle, identidade);
    await handle.writeFile(conteudo);
    await handle.sync();
    await confirmarTemporario(temporario, handle, identidade);
    const existenteAgora = await lstatOuNull(destino);
    if ((existenteAntes === null) !== (existenteAgora === null)
      || (existenteAntes && existenteAgora
        && !mesmaIdentidade(identidadeDe(existenteAntes), identidadeDe(existenteAgora)))) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    }
    const paiAntesRename = await identidadeDiretorioSeguro(diretorio);
    if (!mesmaIdentidadeDiretorio(identidadePai, paiAntesRename)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    }
    await confirmarFencingLockDistribuicaoGlobal(homeReal);
    await rename(temporario, destino);
    renomeado = true;
    const paiDepoisRename = await identidadeDiretorioSeguro(diretorio);
    if (!mesmaIdentidadeDiretorio(identidadePai, paiDepoisRename)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    }
    if (process.platform !== "win32") {
      await confirmarFencingLockDistribuicaoGlobal(homeReal);
      await chmod(destino, modo);
    }
    await validarArquivoRegular(destino, homeReal);
  } finally {
    await handle?.close().catch(() => undefined);
    if (!renomeado) await removerTemporarioSeMesmo(temporario, identidade);
  }
}

export function nomeTemporarioDiretorio(prefixo: "stage" | "backup"): string {
  return `.sema-${prefixo}-${randomUUID()}`;
}

export async function removerDiretorioTemporarioGerenciado(
  homeReal: string,
  caminho: string,
  identidadeEsperada?: IdentidadeDiretorioSeguro,
): Promise<void> {
  const nome = path.basename(caminho);
  if (!caminhoContido(homeReal, caminho) || !/^\.sema-(?:stage|backup)-[a-f0-9-]{36}$/u.test(nome)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  const pai = path.dirname(caminho);
  const identidadePai = await identidadeDiretorioSeguro(pai);
  const identidadeInicial = await identidadeDiretorioSeguro(caminho);
  if (identidadeEsperada
    && !mesmaIdentidadeDiretorio(identidadeEsperada, identidadeInicial)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  await validarArvoreSemLinks(caminho);
  const [identidadeAntesRm, identidadePaiAntesRm] = await Promise.all([
    identidadeDiretorioSeguro(caminho),
    identidadeDiretorioSeguro(pai),
  ]);
  if (!mesmaIdentidadeDiretorio(identidadeInicial, identidadeAntesRm)
    || !mesmaIdentidadeDiretorio(identidadePai, identidadePaiAntesRm)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  await confirmarFencingLockDistribuicaoGlobal(homeReal);
  await rm(caminho, { recursive: true, force: true });
  const identidadePaiDepoisRm = await identidadeDiretorioSeguro(pai);
  if (!mesmaIdentidadeDiretorio(identidadePai, identidadePaiDepoisRm)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
}

async function validarArvoreSemLinks(caminho: string): Promise<void> {
  const info = await lstat(caminho, { bigint: true });
  if (info.isSymbolicLink()) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "SYMLINK_OU_JUNCTION");
  }
  if (info.isDirectory()) {
    await validarDiretorioReal(caminho);
    const entradas = await readdir(caminho);
    for (const entrada of entradas) {
      await validarArvoreSemLinks(path.join(caminho, entrada));
    }
    return;
  }
  if (!info.isFile() || info.nlink !== 1n) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "SYMLINK_OU_JUNCTION");
  }
  const real = await realpath(caminho);
  if (!caminhosIguais(real, caminho)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "SYMLINK_OU_JUNCTION");
  }
}

export async function moverDiretorioSeguro(
  homeReal: string,
  origem: string,
  destino: string,
  identidadeEsperada?: IdentidadeDiretorioSeguro,
): Promise<IdentidadeDiretorioSeguro> {
  if (!caminhoContido(homeReal, origem)
    || !caminhoContido(homeReal, destino)
    || !caminhosIguais(path.dirname(origem), path.dirname(destino))) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CAMINHO_FORA_DA_HOME");
  }
  const pai = path.dirname(origem);
  const identidadePai = await identidadeDiretorioSeguro(pai);
  const identidadeOrigem = await identidadeDiretorioSeguro(origem);
  if (identidadeEsperada
    && !mesmaIdentidadeDiretorio(identidadeEsperada, identidadeOrigem)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  if (await lstatOuNull(destino)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  const [origemAntesRename, paiAntesRename] = await Promise.all([
    identidadeDiretorioSeguro(origem),
    identidadeDiretorioSeguro(pai),
  ]);
  if (!mesmaIdentidadeDiretorio(identidadeOrigem, origemAntesRename)
    || !mesmaIdentidadeDiretorio(identidadePai, paiAntesRename)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  await confirmarFencingLockDistribuicaoGlobal(homeReal);
  await rename(origem, destino);
  const [destinoDepoisRename, paiDepoisRename] = await Promise.all([
    identidadeDiretorioSeguro(destino),
    identidadeDiretorioSeguro(pai),
  ]);
  if (!mesmaIdentidadeDiretorio(identidadeOrigem, destinoDepoisRename)
    || !mesmaIdentidadeDiretorio(identidadePai, paiDepoisRename)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  return destinoDepoisRename;
}

export async function diretorioExisteSeguro(caminho: string): Promise<boolean> {
  const info = await lstatOuNull(caminho);
  if (!info) return false;
  await validarDiretorioReal(caminho);
  return true;
}

export async function statDiretorioSeguro(caminho: string): Promise<BigIntStats> {
  const info = await stat(caminho, { bigint: true });
  if (!info.isDirectory()) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "COMPONENTE_NAO_DIRETORIO");
  }
  return validarDiretorioReal(caminho);
}

const JOURNAL_LAUNCHER = ".sema-launcher-journal";
const PADRAO_TEMP_TRANSACAO = /^\.sema-(stage|backup)-([a-f0-9-]{36})$/u;
const PADRAO_ARTEFATO_LAUNCHER = /^(?:sema|sema\.cmd|sema\.ps1|sema-managed\.ps1|sema-launcher\.receipt|\.sema-launcher-[a-f0-9]{64}\.ps1)$/u;
const LIMITE_TRANSACAO_BYTES = 512 * 1024;

interface ItemTransacaoArquivo {
  nome: string;
  conteudo: string | null;
}

interface PayloadTransacaoArquivo {
  schema: "sema.launcher.files/v1";
  tipo: "stage" | "backup";
  nonce: string;
  itens: ItemTransacaoArquivo[];
  receipt: string;
}

interface JournalTransacaoArquivo {
  schema: "sema.launcher.journal/v1";
  fase: "prepared" | "committed";
  nonce: string;
  stage: string;
  stageSha256: string;
  backup: string;
  backupSha256: string;
  receipt: string;
}

export interface ArtefatoTransacaoArquivo {
  nome: string;
  conteudoDepois: Buffer;
  modo: number;
}

export interface TransacaoArquivosDuravel {
  readonly homeReal: string;
  readonly diretorio: string;
  readonly journal: string;
  readonly stage: string;
  readonly backup: string;
  readonly journalPrepared: Buffer;
  readonly journalCommitted: Buffer;
  readonly stageBytes: Buffer;
  readonly backupBytes: Buffer;
}

function sha256Bytes(valor: string | Buffer): string {
  return createHash("sha256").update(valor).digest("hex");
}

function serializarReceitado<T extends object>(base: T): Buffer {
  const canonico = JSON.stringify(base);
  return Buffer.from(JSON.stringify({ ...base, receipt: sha256Bytes(canonico) }), "utf8");
}

function parseReceitado<T extends object>(bytes: Buffer): T & { receipt: string } {
  if (bytes.length > LIMITE_TRANSACAO_BYTES) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  let valor: Record<string, unknown>;
  try {
    valor = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  if (!valor || Array.isArray(valor) || typeof valor !== "object") {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  const { receipt, ...base } = valor;
  if (typeof receipt !== "string" || !/^[a-f0-9]{64}$/u.test(receipt)
    || sha256Bytes(JSON.stringify(base)) !== receipt) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  return valor as T & { receipt: string };
}

function validarNomeArtefatoLauncher(nome: string): void {
  if (!PADRAO_ARTEFATO_LAUNCHER.test(nome)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
}

function validarPayloadTransacao(
  bytes: Buffer,
  tipo: PayloadTransacaoArquivo["tipo"],
  nonce: string,
): PayloadTransacaoArquivo {
  const payload = parseReceitado<PayloadTransacaoArquivo>(bytes);
  if (payload.schema !== "sema.launcher.files/v1" || payload.tipo !== tipo
    || payload.nonce !== nonce || !Array.isArray(payload.itens)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  const nomes = new Set<string>();
  for (const item of payload.itens) {
    if (!item || typeof item.nome !== "string"
      || (item.conteudo !== null && typeof item.conteudo !== "string")) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
    }
    validarNomeArtefatoLauncher(item.nome);
    if (nomes.has(item.nome)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
    }
    nomes.add(item.nome);
    if (tipo === "stage" && item.conteudo === null) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
    }
    if (item.conteudo !== null) {
      const decodificado = Buffer.from(item.conteudo, "base64");
      if (decodificado.toString("base64") !== item.conteudo) {
        throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
      }
    }
  }
  return payload;
}

function validarJournalTransacao(bytes: Buffer): JournalTransacaoArquivo {
  const journal = parseReceitado<JournalTransacaoArquivo>(bytes);
  const stage = PADRAO_TEMP_TRANSACAO.exec(journal.stage ?? "");
  const backup = PADRAO_TEMP_TRANSACAO.exec(journal.backup ?? "");
  if (journal.schema !== "sema.launcher.journal/v1"
    || !["prepared", "committed"].includes(journal.fase)
    || !/^[a-f0-9-]{36}$/u.test(journal.nonce)
    || stage?.[1] !== "stage" || backup?.[1] !== "backup"
    || stage[2] !== journal.nonce || backup[2] !== journal.nonce
    || !/^[a-f0-9]{64}$/u.test(journal.stageSha256)
    || !/^[a-f0-9]{64}$/u.test(journal.backupSha256)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  return journal;
}

async function removerArquivoGerenciadoExato(
  homeReal: string,
  caminho: string,
  esperado: Buffer,
): Promise<boolean> {
  if (!await lstatOuNull(caminho)) return false;
  const atual = await lerArquivoSeguro(caminho, LIMITE_TRANSACAO_BYTES, homeReal);
  if (!atual.equals(esperado)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  await removerArquivoSeguro(homeReal, caminho, await identidadeArquivoSeguro(caminho, homeReal));
  return true;
}

async function limparTemporariosTransacaoOrfaos(
  homeReal: string,
  diretorio: string,
): Promise<boolean> {
  if (!await lstatOuNull(diretorio)) return false;
  let alterado = false;
  for (const entrada of await readdir(diretorio, { withFileTypes: true })) {
    const match = PADRAO_TEMP_TRANSACAO.exec(entrada.name);
    if (!match || !entrada.isFile()) continue;
    const caminho = path.join(diretorio, entrada.name);
    try {
      const bytes = await lerArquivoSeguro(caminho, LIMITE_TRANSACAO_BYTES, homeReal);
      validarPayloadTransacao(bytes, match[1] as "stage" | "backup", match[2] ?? "");
      await removerArquivoGerenciadoExato(homeReal, caminho, bytes);
      alterado = true;
    } catch {
      // Nome parecido sem recibo e identidade válidos pertence ao usuário e é preservado.
    }
  }
  return alterado;
}

export async function prepararTransacaoArquivosLauncher(
  homeReal: string,
  diretorio: string,
  artefatos: ArtefatoTransacaoArquivo[],
): Promise<TransacaoArquivosDuravel> {
  await garantirDiretoriosSeguros(homeReal, diretorio);
  const journal = path.join(diretorio, JOURNAL_LAUNCHER);
  if (await lstatOuNull(journal)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  const nonce = randomUUID();
  const stage = path.join(diretorio, `.sema-stage-${nonce}`);
  const backup = path.join(diretorio, `.sema-backup-${nonce}`);
  if (await lstatOuNull(stage) || await lstatOuNull(backup)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  const nomes = new Set<string>();
  for (const artefato of artefatos) {
    validarNomeArtefatoLauncher(artefato.nome);
    if (nomes.has(artefato.nome)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "AMBIENTE_INVALIDO");
    }
    nomes.add(artefato.nome);
  }
  const itensBackup: ItemTransacaoArquivo[] = [];
  for (const artefato of artefatos) {
    const destino = path.join(diretorio, artefato.nome);
    const antes = await lstatOuNull(destino)
      ? await lerArquivoSeguro(destino, LIMITE_TRANSACAO_BYTES, homeReal)
      : undefined;
    itensBackup.push({ nome: artefato.nome, conteudo: antes?.toString("base64") ?? null });
  }
  const stageBytes = serializarReceitado({
    schema: "sema.launcher.files/v1" as const,
    tipo: "stage" as const,
    nonce,
    itens: artefatos.map((item) => ({ nome: item.nome, conteudo: item.conteudoDepois.toString("base64") })),
  });
  const backupBytes = serializarReceitado({
    schema: "sema.launcher.files/v1" as const,
    tipo: "backup" as const,
    nonce,
    itens: itensBackup,
  });
  const baseJournal = {
    schema: "sema.launcher.journal/v1" as const,
    nonce,
    stage: path.basename(stage),
    stageSha256: sha256Bytes(stageBytes),
    backup: path.basename(backup),
    backupSha256: sha256Bytes(backupBytes),
  };
  const journalPrepared = serializarReceitado({ ...baseJournal, fase: "prepared" as const });
  const journalCommitted = serializarReceitado({ ...baseJournal, fase: "committed" as const });
  try {
    await escreverArquivoAtomico(homeReal, stage, stageBytes, 0o600);
    await escreverArquivoAtomico(homeReal, backup, backupBytes, 0o600);
    await escreverArquivoAtomico(homeReal, journal, journalPrepared, 0o600);
  } catch (erro) {
    await Promise.allSettled([
      removerArquivoGerenciadoExato(homeReal, stage, stageBytes),
      removerArquivoGerenciadoExato(homeReal, backup, backupBytes),
    ]);
    throw erro;
  }
  return { homeReal, diretorio, journal, stage, backup, journalPrepared, journalCommitted, stageBytes, backupBytes };
}

async function carregarTransacaoArquivosLauncher(
  homeReal: string,
  diretorio: string,
): Promise<{
  journal: JournalTransacaoArquivo;
  journalBytes: Buffer;
  stage: PayloadTransacaoArquivo;
  stageBytes: Buffer;
  backup: PayloadTransacaoArquivo;
  backupBytes: Buffer;
} | null> {
  const caminhoJournal = path.join(diretorio, JOURNAL_LAUNCHER);
  if (!await lstatOuNull(caminhoJournal)) return null;
  const journalBytes = await lerArquivoSeguro(caminhoJournal, LIMITE_TRANSACAO_BYTES, homeReal);
  const journal = validarJournalTransacao(journalBytes);
  const caminhoStage = path.join(diretorio, journal.stage);
  const caminhoBackup = path.join(diretorio, journal.backup);
  const [stageBytes, backupBytes] = await Promise.all([
    lerArquivoSeguro(caminhoStage, LIMITE_TRANSACAO_BYTES, homeReal),
    lerArquivoSeguro(caminhoBackup, LIMITE_TRANSACAO_BYTES, homeReal),
  ]);
  if (sha256Bytes(stageBytes) !== journal.stageSha256
    || sha256Bytes(backupBytes) !== journal.backupSha256) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  const stage = validarPayloadTransacao(stageBytes, "stage", journal.nonce);
  const backup = validarPayloadTransacao(backupBytes, "backup", journal.nonce);
  if (stage.itens.length !== backup.itens.length
    || stage.itens.some((item, indice) => item.nome !== backup.itens[indice]?.nome)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "RECIBO_INVALIDO");
  }
  return { journal, journalBytes, stage, stageBytes, backup, backupBytes };
}

async function restaurarItemTransacao(
  homeReal: string,
  diretorio: string,
  depois: ItemTransacaoArquivo,
  antes: ItemTransacaoArquivo,
): Promise<void> {
  const destino = path.join(diretorio, depois.nome);
  const esperadoDepois = Buffer.from(depois.conteudo ?? "", "base64");
  const esperadoAntes = antes.conteudo === null ? null : Buffer.from(antes.conteudo, "base64");
  const existe = await lstatOuNull(destino) !== null;
  if (!existe && esperadoAntes) {
    await escreverArquivoAtomico(homeReal, destino, esperadoAntes, depois.nome === "sema" ? 0o755 : 0o600);
    return;
  }
  if (!existe) return;
  const atual = await lerArquivoSeguro(destino, LIMITE_TRANSACAO_BYTES, homeReal);
  if (esperadoAntes?.equals(atual)) return;
  if (!atual.equals(esperadoDepois)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  if (esperadoAntes) {
    await escreverArquivoAtomico(homeReal, destino, esperadoAntes, depois.nome === "sema" ? 0o755 : 0o600);
  } else {
    await removerArquivoSeguro(homeReal, destino, await identidadeArquivoSeguro(destino, homeReal));
  }
}

async function confirmarItemRestaurado(
  homeReal: string,
  diretorio: string,
  antes: ItemTransacaoArquivo,
): Promise<void> {
  const destino = path.join(diretorio, antes.nome);
  const existe = await lstatOuNull(destino) !== null;
  if (antes.conteudo === null) {
    if (existe) throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
    return;
  }
  if (!existe || !(await lerArquivoSeguro(destino, LIMITE_TRANSACAO_BYTES, homeReal))
    .equals(Buffer.from(antes.conteudo, "base64"))) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
  }
}

async function limparArquivosDaTransacao(
  homeReal: string,
  diretorio: string,
  carregada: NonNullable<Awaited<ReturnType<typeof carregarTransacaoArquivosLauncher>>>,
): Promise<boolean> {
  const journal = path.join(diretorio, JOURNAL_LAUNCHER);
  const stage = path.join(diretorio, carregada.journal.stage);
  const backup = path.join(diretorio, carregada.journal.backup);
  try {
    await removerArquivoGerenciadoExato(homeReal, journal, carregada.journalBytes);
  } catch {
    return true;
  }
  const limpezas = await Promise.allSettled([
    removerArquivoGerenciadoExato(homeReal, stage, carregada.stageBytes),
    removerArquivoGerenciadoExato(homeReal, backup, carregada.backupBytes),
  ]);
  return limpezas.some((item) => item.status === "rejected");
}

export async function recuperarTransacaoArquivosLauncher(
  homeReal: string,
  diretorio: string,
): Promise<{ alterado: boolean; limpezaPendente: boolean }> {
  if (!await lstatOuNull(diretorio)) return { alterado: false, limpezaPendente: false };
  const carregada = await carregarTransacaoArquivosLauncher(homeReal, diretorio);
  if (!carregada) {
    const alterado = await limparTemporariosTransacaoOrfaos(homeReal, diretorio);
    return { alterado, limpezaPendente: false };
  }
  if (carregada.journal.fase === "prepared") {
    const restauracoes = await Promise.allSettled(carregada.stage.itens.map((item, indice) => (
      restaurarItemTransacao(homeReal, diretorio, item, carregada.backup.itens[indice] as ItemTransacaoArquivo)
    )));
    const verificacoes = await Promise.allSettled(carregada.backup.itens.map((item) => (
      confirmarItemRestaurado(homeReal, diretorio, item)
    )));
    if ([...restauracoes, ...verificacoes].some((item) => item.status === "rejected")) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
    }
  }
  const limpezaPendente = await limparArquivosDaTransacao(homeReal, diretorio, carregada);
  return { alterado: carregada.journal.fase === "prepared", limpezaPendente };
}

export async function concluirTransacaoArquivosLauncher(
  transacao: TransacaoArquivosDuravel,
): Promise<{ limpezaPendente: boolean }> {
  const atual = await lerArquivoSeguro(
    transacao.journal,
    LIMITE_TRANSACAO_BYTES,
    transacao.homeReal,
  );
  if (!atual.equals(transacao.journalPrepared)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  await escreverArquivoAtomico(
    transacao.homeReal,
    transacao.journal,
    transacao.journalCommitted,
    0o600,
  );
  const carregada = await carregarTransacaoArquivosLauncher(transacao.homeReal, transacao.diretorio);
  if (!carregada || carregada.journal.fase !== "committed") {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
  }
  return {
    limpezaPendente: await limparArquivosDaTransacao(
      transacao.homeReal,
      transacao.diretorio,
      carregada,
    ),
  };
}

export async function transacaoArquivosLauncherPendente(
  homeReal: string,
  diretorio: string,
): Promise<boolean> {
  if (!await lstatOuNull(diretorio)) return false;
  if (await lstatOuNull(path.join(diretorio, JOURNAL_LAUNCHER))) {
    await carregarTransacaoArquivosLauncher(homeReal, diretorio);
    return true;
  }
  for (const entrada of await readdir(diretorio, { withFileTypes: true })) {
    const match = PADRAO_TEMP_TRANSACAO.exec(entrada.name);
    if (!entrada.isFile() || !match) continue;
    try {
      const bytes = await lerArquivoSeguro(
        path.join(diretorio, entrada.name),
        LIMITE_TRANSACAO_BYTES,
        homeReal,
      );
      validarPayloadTransacao(bytes, match[1] as "stage" | "backup", match[2] ?? "");
      return true;
    } catch {
      // Falso padrão não gerenciado não influencia o estado público.
    }
  }
  return false;
}
