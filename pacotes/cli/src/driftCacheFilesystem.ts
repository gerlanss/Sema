// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.store
// Descrição: confina a árvore externa de cache por identidade física e realpath antes e depois de cada I/O.

import { constants, type BigIntStats } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  type FileHandle,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type CodigoErroFilesystemCacheDrift =
  | "cache_root_sobrepoe_workspace"
  | "cache_root_link"
  | "cache_root_hardlink"
  | "cache_root_nao_diretorio"
  | "cache_root_indisponivel";

export type OrigemRaizCacheSema =
  | "explicita"
  | "localappdata"
  | "windows_fallback"
  | "macos_cache"
  | "xdg_cache"
  | "unix_fallback";

export interface OpcoesResolverRaizCacheSema {
  plataforma?: NodeJS.Platform;
  ambiente?: Readonly<Record<string, string | undefined>>;
  diretorioUsuario?: string;
  raizCache?: string;
}

export type ResolucaoRaizCacheSema =
  | {
    disponivel: true;
    raiz: string;
    origem: OrigemRaizCacheSema;
  }
  | {
    disponivel: false;
    codigo: "cache_home_invalido" | "cache_root_relativa";
  };

export interface IdentidadeFilesystem {
  dev: bigint;
  ino: bigint;
}

export interface ComponenteGuardadoCache {
  caminho: string;
  identidade: IdentidadeFilesystem;
}

export interface GuardaCadeiaCache {
  raiz: string;
  destino: string;
  componentes: readonly ComponenteGuardadoCache[];
}

export interface EstadoEntradaCache {
  dev: bigint;
  ino: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
  nlink: bigint;
  tipo: "arquivo" | "diretorio" | "link" | "outro";
}

export class FalhaFilesystemCacheDrift extends Error {
  constructor(readonly codigo: CodigoErroFilesystemCacheDrift) {
    super(codigo);
    this.name = "FalhaFilesystemCacheDrift";
  }
}

function apiPath(plataforma: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return plataforma === "win32" ? path.win32 : path.posix;
}

export function resolverRaizCacheSema(
  opcoes: OpcoesResolverRaizCacheSema = {},
): ResolucaoRaizCacheSema {
  const plataforma = opcoes.plataforma ?? process.platform;
  const caminhos = apiPath(plataforma);
  const ambiente = opcoes.ambiente ?? process.env;
  const diretorioUsuario = opcoes.diretorioUsuario ?? os.homedir();

  if (opcoes.raizCache !== undefined) {
    if (!caminhos.isAbsolute(opcoes.raizCache)) {
      return { disponivel: false, codigo: "cache_root_relativa" };
    }
    return {
      disponivel: true,
      raiz: caminhos.normalize(opcoes.raizCache),
      origem: "explicita",
    };
  }

  if (!caminhos.isAbsolute(diretorioUsuario)) {
    return { disponivel: false, codigo: "cache_home_invalido" };
  }

  if (plataforma === "win32") {
    const localAppData = ambiente.LOCALAPPDATA;
    if (localAppData && caminhos.isAbsolute(localAppData)) {
      return {
        disponivel: true,
        raiz: caminhos.join(localAppData, "Sema", "Cache"),
        origem: "localappdata",
      };
    }
    return {
      disponivel: true,
      raiz: caminhos.join(diretorioUsuario, "AppData", "Local", "Sema", "Cache"),
      origem: "windows_fallback",
    };
  }

  if (plataforma === "darwin") {
    return {
      disponivel: true,
      raiz: caminhos.join(diretorioUsuario, "Library", "Caches", "Sema"),
      origem: "macos_cache",
    };
  }

  const xdg = ambiente.XDG_CACHE_HOME;
  if (xdg && caminhos.isAbsolute(xdg)) {
    return {
      disponivel: true,
      raiz: caminhos.join(xdg, "sema"),
      origem: "xdg_cache",
    };
  }
  return {
    disponivel: true,
    raiz: caminhos.join(diretorioUsuario, ".cache", "sema"),
    origem: "unix_fallback",
  };
}

export function caminhoContido(base: string, alvo: string): boolean {
  const relativo = path.relative(base, alvo);
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

export function caminhosSobrepostos(a: string, b: string): boolean {
  return caminhoContido(a, b) || caminhoContido(b, a);
}

export function identidadeDe(info: BigIntStats): IdentidadeFilesystem {
  return { dev: info.dev, ino: info.ino };
}

export function mesmaIdentidade(a: IdentidadeFilesystem, b: IdentidadeFilesystem): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

export function erroEhAusencia(erro: unknown): boolean {
  return ["ENOENT", "ENOTDIR"].includes((erro as NodeJS.ErrnoException).code ?? "");
}

export async function lstatOuNull(caminho: string): Promise<BigIntStats | null> {
  try {
    return await lstat(caminho, { bigint: true });
  } catch (erro) {
    if (erroEhAusencia(erro)) return null;
    throw erro;
  }
}

function caminhoComparavel(caminho: string): string {
  const normalizado = path.normalize(path.resolve(caminho));
  return process.platform === "win32" ? normalizado.toLocaleLowerCase("en-US") : normalizado;
}

function caminhosIguais(a: string, b: string): boolean {
  return caminhoComparavel(a) === caminhoComparavel(b);
}

function tipoEntrada(info: BigIntStats): EstadoEntradaCache["tipo"] {
  if (info.isSymbolicLink()) return "link";
  if (info.isFile()) return "arquivo";
  if (info.isDirectory()) return "diretorio";
  return "outro";
}

export function estadoEntrada(info: BigIntStats): EstadoEntradaCache {
  return {
    dev: info.dev,
    ino: info.ino,
    size: info.size,
    mtimeNs: info.mtimeNs,
    ctimeNs: info.ctimeNs,
    nlink: info.nlink,
    tipo: tipoEntrada(info),
  };
}

export function mesmoEstadoEntrada(
  a: EstadoEntradaCache | null,
  b: EstadoEntradaCache | null,
): boolean {
  if (!a || !b) return a === b;
  return a.dev === b.dev
    && a.ino === b.ino
    && a.size === b.size
    && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs
    && a.nlink === b.nlink
    && a.tipo === b.tipo;
}

async function validarComponenteDiretorio(
  caminho: string,
  identidadeEsperada?: IdentidadeFilesystem,
): Promise<ComponenteGuardadoCache> {
  const info = await lstat(caminho, { bigint: true });
  if (info.isSymbolicLink()) throw new FalhaFilesystemCacheDrift("cache_root_link");
  if (!info.isDirectory()) {
    if (info.nlink > 1n) throw new FalhaFilesystemCacheDrift("cache_root_hardlink");
    throw new FalhaFilesystemCacheDrift("cache_root_nao_diretorio");
  }
  const identidade = identidadeDe(info);
  if (identidadeEsperada && !mesmaIdentidade(identidadeEsperada, identidade)) {
    throw new FalhaFilesystemCacheDrift("cache_root_link");
  }
  const caminhoReal = await realpath(caminho);
  if (!caminhosIguais(caminhoReal, caminho)) {
    throw new FalhaFilesystemCacheDrift("cache_root_link");
  }
  return { caminho: path.resolve(caminho), identidade };
}

export async function capturarGuardaCadeia(
  raiz: string,
  identidadeRaiz: IdentidadeFilesystem,
  destino: string,
): Promise<GuardaCadeiaCache> {
  const raizAbsoluta = path.resolve(raiz);
  const destinoAbsoluto = path.resolve(destino);
  if (!caminhoContido(raizAbsoluta, destinoAbsoluto)) {
    throw new FalhaFilesystemCacheDrift("cache_root_indisponivel");
  }
  const segmentos = path.relative(raizAbsoluta, destinoAbsoluto).split(path.sep).filter(Boolean);
  const caminhos = [
    raizAbsoluta,
    ...segmentos.map((_, indice) => path.join(raizAbsoluta, ...segmentos.slice(0, indice + 1))),
  ];
  const componentes: ComponenteGuardadoCache[] = [];
  for (let indice = 0; indice < caminhos.length; indice += 1) {
    componentes.push(await validarComponenteDiretorio(
      caminhos[indice]!,
      indice === 0 ? identidadeRaiz : undefined,
    ));
  }
  return { raiz: raizAbsoluta, destino: destinoAbsoluto, componentes };
}

export async function confirmarGuardaCadeia(guarda: GuardaCadeiaCache): Promise<void> {
  for (const componente of guarda.componentes) {
    await validarComponenteDiretorio(componente.caminho, componente.identidade);
  }
}

async function aplicarPermissaoDiretorio(caminho: string): Promise<void> {
  if (process.platform === "win32") return;
  const infoAntes = await lstat(caminho, { bigint: true });
  if (!infoAntes.isDirectory() || infoAntes.isSymbolicLink()) {
    throw new FalhaFilesystemCacheDrift("cache_root_link");
  }
  const flags = constants.O_RDONLY
    | (constants.O_DIRECTORY ?? 0)
    | (constants.O_NOFOLLOW ?? 0);
  const handle = await open(caminho, flags);
  try {
    const infoHandle = await handle.stat({ bigint: true });
    if (!infoHandle.isDirectory()
      || !mesmaIdentidade(identidadeDe(infoAntes), identidadeDe(infoHandle))) {
      throw new FalhaFilesystemCacheDrift("cache_root_link");
    }
    await handle.chmod(0o700);
    const infoDepois = await lstat(caminho, { bigint: true });
    if (!infoDepois.isDirectory()
      || infoDepois.isSymbolicLink()
      || !mesmaIdentidade(identidadeDe(infoHandle), identidadeDe(infoDepois))) {
      throw new FalhaFilesystemCacheDrift("cache_root_link");
    }
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export async function aplicarPermissaoArquivo(handle: FileHandle): Promise<void> {
  if (process.platform !== "win32") await handle.chmod(0o600);
}

export async function lerHandleLimitado(
  handle: FileHandle,
  limiteBytes: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(limiteBytes) || limiteBytes < 0) {
    throw new RangeError("limite_cache_invalido");
  }
  const capacidade = limiteBytes + 1;
  const buffer = Buffer.allocUnsafe(capacidade);
  let total = 0;
  while (total < capacidade) {
    const { bytesRead } = await handle.read(buffer, total, capacidade - total, null);
    if (bytesRead === 0) break;
    total += bytesRead;
  }
  return buffer.subarray(0, total);
}

async function garantirCadeiaDiretoriosSegura(
  raiz: string,
  identidadeRaiz: IdentidadeFilesystem,
  destino: string,
  permissaoPrivada: boolean,
): Promise<GuardaCadeiaCache> {
  const raizAbsoluta = path.resolve(raiz);
  const destinoAbsoluto = path.resolve(destino);
  if (!caminhoContido(raizAbsoluta, destinoAbsoluto)) {
    throw new FalhaFilesystemCacheDrift("cache_root_indisponivel");
  }
  let guarda = await capturarGuardaCadeia(raizAbsoluta, identidadeRaiz, raizAbsoluta);
  const segmentos = path.relative(raizAbsoluta, destinoAbsoluto).split(path.sep).filter(Boolean);
  let atual = raizAbsoluta;
  for (const segmento of segmentos) {
    atual = path.join(atual, segmento);
    await confirmarGuardaCadeia(guarda);
    if (!await lstatOuNull(atual)) {
      await confirmarGuardaCadeia(guarda);
      try {
        await mkdir(atual, { mode: 0o700 });
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
      }
      await confirmarGuardaCadeia(guarda);
    }
    const componente = await validarComponenteDiretorio(atual);
    guarda = {
      raiz: raizAbsoluta,
      destino: path.resolve(atual),
      componentes: [...guarda.componentes, componente],
    };
    await confirmarGuardaCadeia(guarda);
    if (permissaoPrivada) {
      await aplicarPermissaoDiretorio(atual);
      await confirmarGuardaCadeia(guarda);
    }
  }
  return guarda;
}

export async function validarComponentesExistentesSemLink(alvo: string): Promise<void> {
  const absoluto = path.resolve(alvo);
  const raiz = path.parse(absoluto).root;
  const raizGuardada = await validarComponenteDiretorio(raiz);
  let guarda: GuardaCadeiaCache = { raiz, destino: raiz, componentes: [raizGuardada] };
  let atual = raiz;
  for (const segmento of path.relative(raiz, absoluto).split(path.sep).filter(Boolean)) {
    atual = path.join(atual, segmento);
    if (!await lstatOuNull(atual)) return;
    const componente = await validarComponenteDiretorio(atual);
    guarda = { raiz, destino: atual, componentes: [...guarda.componentes, componente] };
    await confirmarGuardaCadeia(guarda);
  }
}

export async function prepararRaizCache(
  caminho: string,
): Promise<{ real: string; identidade: IdentidadeFilesystem }> {
  const absoluto = path.resolve(caminho);
  const raizSistema = path.parse(absoluto).root;
  if (caminhosIguais(absoluto, raizSistema)) {
    throw new FalhaFilesystemCacheDrift("cache_root_indisponivel");
  }
  const componenteRaiz = await validarComponenteDiretorio(raizSistema);
  const guarda = await garantirCadeiaDiretoriosSegura(
    raizSistema,
    componenteRaiz.identidade,
    absoluto,
    false,
  );
  await confirmarGuardaCadeia(guarda);
  await aplicarPermissaoDiretorio(absoluto);
  await confirmarGuardaCadeia(guarda);
  const info = await lstat(absoluto, { bigint: true });
  const real = await realpath(absoluto);
  const componenteFinal = guarda.componentes.at(-1);
  if (!componenteFinal
    || !mesmaIdentidade(componenteFinal.identidade, identidadeDe(info))
    || !caminhosIguais(real, absoluto)) {
    throw new FalhaFilesystemCacheDrift("cache_root_link");
  }
  await confirmarGuardaCadeia(guarda);
  return { real, identidade: identidadeDe(info) };
}

export async function garantirSubdiretorioSeguro(
  raiz: string,
  identidadeRaiz: IdentidadeFilesystem,
  destino: string,
): Promise<GuardaCadeiaCache> {
  return garantirCadeiaDiretoriosSegura(raiz, identidadeRaiz, destino, true);
}

export function identidadeArquivoValida(
  caminho: string,
  infoCaminho: BigIntStats,
  infoHandle: BigIntStats,
): boolean {
  return infoCaminho.isFile()
    && !infoCaminho.isSymbolicLink()
    && infoHandle.isFile()
    && infoCaminho.nlink === 1n
    && infoHandle.nlink === 1n
    && mesmaIdentidade(identidadeDe(infoCaminho), identidadeDe(infoHandle))
    && caminho.length > 0;
}
