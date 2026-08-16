// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.store
// Descrição: armazena objetos de cache de drift fora do workspace, com identidade opaca e validação integral.

import { constants } from "node:fs";
import {
  lstat,
  open,
  realpath,
  stat,
  type FileHandle,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import {
  adquirirLockPublicacao,
  capturarEstadoEntradaGuardado,
  confirmarLockPublicacao,
  FalhaCasCacheDrift,
  liberarLockPublicacao,
  limparTemporariosOrfaos,
  publicarObjetoExclusivo,
  removerArquivoGuardadoSeMesmo,
  type CodigoErroCasCacheDrift,
  type LockPublicacaoCache,
} from "./driftCacheCas.js";
import {
  aplicarPermissaoArquivo,
  caminhoContido,
  caminhosSobrepostos,
  capturarGuardaCadeia,
  confirmarGuardaCadeia,
  erroEhAusencia,
  estadoEntrada,
  FalhaFilesystemCacheDrift,
  garantirSubdiretorioSeguro,
  identidadeArquivoValida,
  identidadeDe,
  lerHandleLimitado,
  lstatOuNull,
  mesmaIdentidade,
  mesmoEstadoEntrada,
  prepararRaizCache,
  resolverRaizCacheSema,
  validarComponentesExistentesSemLink,
  type CodigoErroFilesystemCacheDrift,
  type GuardaCadeiaCache,
  type IdentidadeFilesystem,
  type OpcoesResolverRaizCacheSema,
  type OrigemRaizCacheSema,
  type ResolucaoRaizCacheSema,
} from "./driftCacheFilesystem.js";

export { resolverRaizCacheSema };
export type {
  OpcoesResolverRaizCacheSema,
  OrigemRaizCacheSema,
  ResolucaoRaizCacheSema,
};

export const SCHEMA_OBJETO_CACHE_DRIFT = "sema.drift-cache-object/v3" as const;
export const LIMITE_BYTES_OBJETO_CACHE_DRIFT = 64 * 1024 * 1024;

const PADRAO_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const PADRAO_HEAD_GIT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export type ValorJsonCacheDrift =
  | null
  | boolean
  | number
  | string
  | readonly ValorJsonCacheDrift[]
  | { readonly [chave: string]: ValorJsonCacheDrift };

export type ValidadorPayloadCacheDrift<T extends ValorJsonCacheDrift> = (
  valor: unknown,
) => valor is T;

export type CodigoErroStoreCacheDrift =
  | CodigoErroFilesystemCacheDrift
  | CodigoErroCasCacheDrift
  | "cache_home_invalido"
  | "cache_root_relativa"
  | "cache_workspace_invalido"
  | "cache_chave_invalida"
  | "cache_objeto_ausente"
  | "cache_objeto_corrupto"
  | "cache_objeto_grande"
  | "cache_objeto_hardlink"
  | "cache_objeto_conflitante"
  | "cache_io_indisponivel";

export type TipoEventoStoreCacheDrift =
  | "cache.store.ready"
  | "cache.store.unavailable"
  | "cache.read.hit"
  | "cache.read.miss"
  | "cache.read.corrupt"
  | "cache.write.published"
  | "cache.write.reused"
  | "cache.write.error";

export interface EventoStoreCacheDrift {
  tipo: TipoEventoStoreCacheDrift;
  workspaceId?: string;
  chave?: string;
  caminhoVirtual?: string;
  codigo?: CodigoErroStoreCacheDrift;
}

export interface MetricasStoreCacheDrift {
  leituras: number;
  hits: number;
  misses: number;
  corruptos: number;
  publicacoes: number;
  reutilizacoes: number;
  corridasValidadas: number;
  erros: number;
}

export interface OpcoesCriarStoreCacheDrift {
  baseProjeto: string;
  raizCache?: string;
  limiteBytes?: number;
  observador?: (evento: EventoStoreCacheDrift) => void;
  ambiente?: Readonly<Record<string, string | undefined>>;
  diretorioUsuario?: string;
}

export type ResultadoLeituraStoreCacheDrift<T> =
  | {
    estado: "hit";
    chave: string;
    valor: T;
    payloadDigest: string;
    caminhoVirtual: string;
  }
  | {
    estado: "miss";
    chave: string;
    codigo: "cache_objeto_ausente";
    caminhoVirtual: string;
  }
  | {
    estado: "corrupto";
    chave: string;
    codigo: CodigoErroStoreCacheDrift;
    caminhoVirtual: string;
  }
  | {
    estado: "indisponivel";
    chave: string;
    codigo: CodigoErroStoreCacheDrift;
  };

export type ResultadoPublicacaoStoreCacheDrift =
  | {
    estado: "publicado" | "existente";
    chave: string;
    payloadDigest: string;
    caminhoVirtual: string;
  }
  | {
    estado: "indisponivel" | "erro";
    chave: string;
    codigo: CodigoErroStoreCacheDrift;
  };

export interface StoreCacheDrift {
  readonly disponivel: boolean;
  readonly workspaceId: string | null;
  readonly gitHead: string | null;
  readonly erroDisponibilidade: CodigoErroStoreCacheDrift | null;
  ler<T extends ValorJsonCacheDrift>(
    chave: string,
    validar?: ValidadorPayloadCacheDrift<T>,
  ): Promise<ResultadoLeituraStoreCacheDrift<T>>;
  publicar<T extends ValorJsonCacheDrift>(
    chave: string,
    payload: T,
    validarExistente?: ValidadorPayloadCacheDrift<T>,
  ): Promise<ResultadoPublicacaoStoreCacheDrift>;
  metricas(): MetricasStoreCacheDrift;
}

interface EnvelopeObjetoCacheDrift<T extends ValorJsonCacheDrift> {
  schema: typeof SCHEMA_OBJETO_CACHE_DRIFT;
  key: string;
  workspaceId: string;
  gitHead: string | null;
  payload: T;
  payloadDigest: string;
}

class FalhaStoreCacheDrift extends Error {
  constructor(readonly codigo: CodigoErroStoreCacheDrift) {
    super(codigo);
    this.name = "FalhaStoreCacheDrift";
  }
}

function emitirEvento(
  observador: ((evento: EventoStoreCacheDrift) => void) | undefined,
  evento: EventoStoreCacheDrift,
): void {
  try {
    observador?.(evento);
  } catch {
    // Observabilidade nao altera o comportamento do cache.
  }
}

function falharJsonCanonico(motivo: string): never {
  throw new TypeError(`json_cache_drift_invalido:${motivo}`);
}

function serializarCanonico(
  valor: unknown,
  visitados: Set<object>,
): string {
  if (valor === null) return "null";
  if (typeof valor === "string" || typeof valor === "boolean") return JSON.stringify(valor);
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return falharJsonCanonico("numero_nao_finito");
    return Object.is(valor, -0) ? "0" : JSON.stringify(valor);
  }
  if (typeof valor !== "object") return falharJsonCanonico(`tipo_${typeof valor}`);
  if (visitados.has(valor)) return falharJsonCanonico("referencia_ciclica");
  visitados.add(valor);
  try {
    if (Array.isArray(valor)) {
      const itens: string[] = [];
      for (let indice = 0; indice < valor.length; indice += 1) {
        if (!Object.hasOwn(valor, indice)) return falharJsonCanonico("array_esparso");
        itens.push(serializarCanonico(valor[indice], visitados));
      }
      return `[${itens.join(",")}]`;
    }
    const prototipo = Object.getPrototypeOf(valor);
    if (prototipo !== Object.prototype && prototipo !== null) {
      return falharJsonCanonico("objeto_nao_plano");
    }
    const objeto = valor as Record<string, unknown>;
    const campos = Object.keys(objeto)
      .sort()
      .map((chave) => `${JSON.stringify(chave)}:${serializarCanonico(objeto[chave], visitados)}`);
    return `{${campos.join(",")}}`;
  } finally {
    visitados.delete(valor);
  }
}

export function serializarJsonCanonicoCacheDrift(valor: unknown): string {
  return serializarCanonico(valor, new Set<object>());
}

export function digestJsonCanonicoCacheDrift(valor: unknown): string {
  return `sha256:${createHash("sha256")
    .update(serializarJsonCanonicoCacheDrift(valor))
    .digest("hex")}`;
}

function codigoErro(erro: unknown): CodigoErroStoreCacheDrift {
  if (erro instanceof FalhaStoreCacheDrift
    || erro instanceof FalhaFilesystemCacheDrift
    || erro instanceof FalhaCasCacheDrift) {
    return erro.codigo;
  }
  return "cache_io_indisponivel";
}

async function lerArquivoGitNormal(caminho: string, limite = 1024 * 1024): Promise<string | null> {
  const infoAntes = await lstatOuNull(caminho);
  if (!infoAntes?.isFile()
    || infoAntes.isSymbolicLink()
    || infoAntes.nlink !== 1n
    || infoAntes.size > BigInt(limite)) return null;
  const handle = await open(caminho, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const infoHandle = await handle.stat({ bigint: true });
    if (!identidadeArquivoValida(caminho, infoAntes, infoHandle)) return null;
    const bytes = await lerHandleLimitado(handle, limite);
    const [infoHandleFinal, infoFinal] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(caminho, { bigint: true }),
    ]);
    if (bytes.byteLength > limite
      || !identidadeArquivoValida(caminho, infoFinal, infoHandleFinal)
      || !mesmaIdentidade(identidadeDe(infoAntes), identidadeDe(infoFinal))) return null;
    return bytes.toString("utf8");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function refGitSegura(ref: string): boolean {
  return ref.startsWith("refs/")
    && !ref.includes("\\")
    && !ref.includes("\0")
    && ref.split("/").every((segmento) => segmento.length > 0 && segmento !== "." && segmento !== "..");
}

async function lerGitHeadSeguro(baseProjetoReal: string): Promise<string | null> {
  try {
    const pastaGit = path.join(baseProjetoReal, ".git");
    const infoGit = await lstatOuNull(pastaGit);
    if (!infoGit?.isDirectory() || infoGit.isSymbolicLink()) return null;
    const gitReal = await realpath(pastaGit);
    if (!caminhoContido(baseProjetoReal, gitReal)) return null;
    const head = (await lerArquivoGitNormal(path.join(gitReal, "HEAD"), 4096))?.trim();
    if (!head) return null;
    if (PADRAO_HEAD_GIT.test(head.toLowerCase())) return head.toLowerCase();
    if (!head.startsWith("ref: ")) return null;
    const ref = head.slice("ref: ".length).trim();
    if (!refGitSegura(ref)) return null;
    const caminhoRef = path.resolve(gitReal, ...ref.split("/"));
    if (!caminhoContido(gitReal, caminhoRef)) return null;
    await validarComponentesExistentesSemLink(path.dirname(caminhoRef));
    const valorRef = (await lerArquivoGitNormal(caminhoRef, 4096))?.trim().toLowerCase();
    if (valorRef && PADRAO_HEAD_GIT.test(valorRef)) return valorRef;
    const packed = await lerArquivoGitNormal(path.join(gitReal, "packed-refs"));
    if (!packed) return null;
    for (const linha of packed.split(/\r?\n/u)) {
      if (!linha || linha.startsWith("#") || linha.startsWith("^")) continue;
      const [digest, nomeRef, ...resto] = linha.trim().split(/\s+/u);
      if (resto.length === 0 && nomeRef === ref && digest && PADRAO_HEAD_GIT.test(digest.toLowerCase())) {
        return digest.toLowerCase();
      }
    }
    return null;
  } catch {
    return null;
  }
}

function metricasVazias(): MetricasStoreCacheDrift {
  return {
    leituras: 0,
    hits: 0,
    misses: 0,
    corruptos: 0,
    publicacoes: 0,
    reutilizacoes: 0,
    corridasValidadas: 0,
    erros: 0,
  };
}

function validarChave(chave: string): boolean {
  return PADRAO_DIGEST.test(chave);
}

function registroObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function validarPayloadSeguro<T extends ValorJsonCacheDrift>(
  validar: ValidadorPayloadCacheDrift<T> | undefined,
  valor: unknown,
): boolean {
  if (!validar) return true;
  try {
    return validar(valor);
  } catch {
    return false;
  }
}

class StoreCacheDriftIndisponivel implements StoreCacheDrift {
  readonly disponivel = false;
  readonly workspaceId: string | null;
  readonly gitHead: string | null;
  readonly erroDisponibilidade: CodigoErroStoreCacheDrift;
  private readonly metricasAtuais = metricasVazias();
  private readonly observador?: (evento: EventoStoreCacheDrift) => void;

  constructor(
    codigo: CodigoErroStoreCacheDrift,
    observador?: (evento: EventoStoreCacheDrift) => void,
    workspaceId: string | null = null,
    gitHead: string | null = null,
  ) {
    this.erroDisponibilidade = codigo;
    this.observador = observador;
    this.workspaceId = workspaceId;
    this.gitHead = gitHead;
    emitirEvento(this.observador, {
      tipo: "cache.store.unavailable",
      ...(workspaceId ? { workspaceId } : {}),
      codigo,
    });
  }

  async ler<T extends ValorJsonCacheDrift>(chave: string): Promise<ResultadoLeituraStoreCacheDrift<T>> {
    this.metricasAtuais.erros += 1;
    return { estado: "indisponivel", chave, codigo: this.erroDisponibilidade };
  }

  async publicar<T extends ValorJsonCacheDrift>(
    chave: string,
    _payload: T,
    _validarExistente?: ValidadorPayloadCacheDrift<T>,
  ): Promise<ResultadoPublicacaoStoreCacheDrift> {
    this.metricasAtuais.erros += 1;
    return { estado: "indisponivel", chave, codigo: this.erroDisponibilidade };
  }

  metricas(): MetricasStoreCacheDrift {
    return { ...this.metricasAtuais };
  }
}

class StoreCacheDriftDisponivel implements StoreCacheDrift {
  readonly disponivel = true;
  readonly erroDisponibilidade = null;
  private readonly metricasAtuais = metricasVazias();

  constructor(
    readonly workspaceId: string,
    readonly gitHead: string | null,
    private readonly raiz: string,
    private readonly identidadeRaiz: IdentidadeFilesystem,
    private readonly pastaWorkspace: string,
    private readonly limiteBytes: number,
    private readonly observador?: (evento: EventoStoreCacheDrift) => void,
  ) {
    emitirEvento(this.observador, {
      tipo: "cache.store.ready",
      workspaceId: this.workspaceId,
    });
  }

  metricas(): MetricasStoreCacheDrift {
    return { ...this.metricasAtuais };
  }

  async ler<T extends ValorJsonCacheDrift>(
    chave: string,
    validar?: ValidadorPayloadCacheDrift<T>,
  ): Promise<ResultadoLeituraStoreCacheDrift<T>> {
    return this.lerInterno(chave, validar, true);
  }

  async publicar<T extends ValorJsonCacheDrift>(
    chave: string,
    payload: T,
    validarExistente?: ValidadorPayloadCacheDrift<T>,
  ): Promise<ResultadoPublicacaoStoreCacheDrift> {
    if (!validarChave(chave)) return this.erroPublicacao(chave, "cache_chave_invalida");
    if (!validarPayloadSeguro(validarExistente, payload)) {
      return this.erroPublicacao(chave, "cache_objeto_corrupto");
    }
    const caminhoVirtual = this.caminhoVirtual(chave);
    let payloadDigest: string;
    let conteudo: string;
    try {
      payloadDigest = digestJsonCanonicoCacheDrift(payload);
      const envelope: EnvelopeObjetoCacheDrift<T> = {
        schema: SCHEMA_OBJETO_CACHE_DRIFT,
        key: chave,
        workspaceId: this.workspaceId,
        gitHead: this.gitHead,
        payload,
        payloadDigest,
      };
      conteudo = serializarJsonCanonicoCacheDrift(envelope);
      if (Buffer.byteLength(conteudo, "utf8") > this.limiteBytes) {
        return this.erroPublicacao(chave, "cache_objeto_grande");
      }
    } catch {
      return this.erroPublicacao(chave, "cache_objeto_corrupto");
    }

    const destino = this.caminhoObjeto(chave);
    const pasta = path.dirname(destino);
    const temporario = path.join(pasta, `.${chave.slice(7)}.${randomUUID()}.tmp`);
    let handle: FileHandle | undefined;
    let identidadeTemporario: IdentidadeFilesystem | undefined;
    let guarda: GuardaCadeiaCache | undefined;
    let lock: LockPublicacaoCache | undefined;
    try {
      guarda = await garantirSubdiretorioSeguro(this.raiz, this.identidadeRaiz, pasta);
      lock = await adquirirLockPublicacao({
        chave,
        pasta,
        guardaInicial: guarda,
        raiz: this.raiz,
        identidadeRaiz: this.identidadeRaiz,
      });
      await confirmarLockPublicacao(lock);
      await limparTemporariosOrfaos(chave, pasta, guarda);
      await confirmarLockPublicacao(lock);

      const estadoAntes = await capturarEstadoEntradaGuardado(destino, guarda);
      const existente = await this.lerInterno<T>(chave, validarExistente, false);
      const estadoDepois = await capturarEstadoEntradaGuardado(destino, guarda);
      if (!mesmoEstadoEntrada(estadoAntes, estadoDepois)) {
        throw new FalhaStoreCacheDrift("cache_objeto_conflitante");
      }
      if (existente.estado === "hit") {
        if (existente.payloadDigest !== payloadDigest) {
          throw new FalhaStoreCacheDrift("cache_objeto_conflitante");
        }
        return this.resultadoObjetoExistente(chave, payloadDigest, caminhoVirtual, lock.contendido);
      }

      await confirmarGuardaCadeia(guarda);
      handle = await open(temporario, "wx", 0o600);
      await confirmarGuardaCadeia(guarda);
      await aplicarPermissaoArquivo(handle);
      const infoInicial = await handle.stat({ bigint: true });
      const infoInicialCaminho = await lstat(temporario, { bigint: true });
      if (!identidadeArquivoValida(temporario, infoInicialCaminho, infoInicial)) {
        throw new FalhaStoreCacheDrift("cache_objeto_hardlink");
      }
      identidadeTemporario = identidadeDe(infoInicial);
      await confirmarGuardaCadeia(guarda);
      await handle.writeFile(conteudo, "utf8");
      await handle.sync();
      const infoFinal = await handle.stat({ bigint: true });
      const infoFinalCaminho = await lstat(temporario, { bigint: true });
      if (!identidadeArquivoValida(temporario, infoFinalCaminho, infoFinal)
        || !mesmaIdentidade(identidadeTemporario, identidadeDe(infoFinal))) {
        throw new FalhaStoreCacheDrift("cache_objeto_corrupto");
      }
      await confirmarGuardaCadeia(guarda);
      await handle.close();
      handle = undefined;

      const estadoImediato = await capturarEstadoEntradaGuardado(destino, guarda);
      if (!mesmoEstadoEntrada(estadoDepois, estadoImediato)) {
        throw new FalhaStoreCacheDrift("cache_objeto_conflitante");
      }
      await confirmarLockPublicacao(lock);
      const resultadoCas = await publicarObjetoExclusivo({
        temporario,
        destino,
        guarda,
        identidadeTemporario,
        estadoDestinoSubstituivel: existente.estado === "corrupto" ? estadoDepois : null,
      });
      if (resultadoCas.estado === "conflito") {
        throw new FalhaStoreCacheDrift("cache_objeto_conflitante");
      }
      if (resultadoCas.estado === "existente") {
        const vencedor = await this.lerInterno<T>(chave, validarExistente, false);
        if (vencedor.estado === "hit" && vencedor.payloadDigest === payloadDigest) {
          return this.resultadoObjetoExistente(chave, payloadDigest, caminhoVirtual, true);
        }
        throw new FalhaStoreCacheDrift("cache_objeto_conflitante");
      }
      identidadeTemporario = undefined;
      await confirmarLockPublicacao(lock);
      const publicado = await this.lerInterno<T>(chave, validarExistente, false);
      if (publicado.estado !== "hit" || publicado.payloadDigest !== payloadDigest) {
        throw new FalhaStoreCacheDrift("cache_objeto_conflitante");
      }
      this.metricasAtuais.publicacoes += 1;
      emitirEvento(this.observador, {
        tipo: "cache.write.published",
        workspaceId: this.workspaceId,
        chave,
        caminhoVirtual,
      });
      return { estado: "publicado", chave, payloadDigest, caminhoVirtual };
    } catch (erro) {
      await handle?.close().catch(() => undefined);
      const codigo = codigoErro(erro);
      if (codigo === "cache_io_indisponivel") {
        const vencedor = await this.lerInterno<T>(chave, validarExistente, false);
        if (vencedor.estado === "hit") {
          if (vencedor.payloadDigest === payloadDigest) {
            return this.resultadoObjetoExistente(chave, payloadDigest, caminhoVirtual, true);
          }
          return this.erroPublicacao(chave, "cache_objeto_conflitante");
        }
      }
      return this.erroPublicacao(chave, codigo);
    } finally {
      if (identidadeTemporario && guarda) {
        await removerArquivoGuardadoSeMesmo(temporario, identidadeTemporario, guarda);
      }
      if (lock) await liberarLockPublicacao(lock);
    }
  }

  private resultadoObjetoExistente(
    chave: string,
    payloadDigest: string,
    caminhoVirtual: string,
    corrida: boolean,
  ): ResultadoPublicacaoStoreCacheDrift {
    this.metricasAtuais.reutilizacoes += 1;
    if (corrida) this.metricasAtuais.corridasValidadas += 1;
    emitirEvento(this.observador, {
      tipo: "cache.write.reused",
      workspaceId: this.workspaceId,
      chave,
      caminhoVirtual,
    });
    return { estado: "existente", chave, payloadDigest, caminhoVirtual };
  }

  private async lerInterno<T extends ValorJsonCacheDrift>(
    chave: string,
    validar: ValidadorPayloadCacheDrift<T> | undefined,
    contabilizar: boolean,
  ): Promise<ResultadoLeituraStoreCacheDrift<T>> {
    if (contabilizar) this.metricasAtuais.leituras += 1;
    if (!validarChave(chave)) return this.resultadoCorrupto(chave, "cache_chave_invalida", contabilizar);
    const caminhoVirtual = this.caminhoVirtual(chave);
    const caminho = this.caminhoObjeto(chave);
    try {
      const infoAntes = await lstatOuNull(caminho);
      if (!infoAntes) {
        if (contabilizar) {
          this.metricasAtuais.misses += 1;
          emitirEvento(this.observador, {
            tipo: "cache.read.miss",
            workspaceId: this.workspaceId,
            chave,
            caminhoVirtual,
            codigo: "cache_objeto_ausente",
          });
        }
        return { estado: "miss", chave, codigo: "cache_objeto_ausente", caminhoVirtual };
      }
      const guarda = await capturarGuardaCadeia(
        this.raiz,
        this.identidadeRaiz,
        path.dirname(caminho),
      );
      const infoGuardado = await lstat(caminho, { bigint: true });
      if (!mesmoEstadoEntrada(estadoEntrada(infoAntes), estadoEntrada(infoGuardado))) {
        return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
      }
      if (!infoAntes.isFile() || infoAntes.isSymbolicLink()) {
        return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
      }
      if (infoAntes.nlink !== 1n) {
        return this.resultadoCorrupto(chave, "cache_objeto_hardlink", contabilizar);
      }
      if (infoAntes.size > BigInt(this.limiteBytes)) {
        return this.resultadoCorrupto(chave, "cache_objeto_grande", contabilizar);
      }

      const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
      await confirmarGuardaCadeia(guarda);
      const handle = await open(caminho, flags);
      let bytes: Buffer;
      try {
        await confirmarGuardaCadeia(guarda);
        const infoHandleAntes = await handle.stat({ bigint: true });
        if (!identidadeArquivoValida(caminho, infoAntes, infoHandleAntes)) {
          return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
        }
        bytes = await lerHandleLimitado(handle, this.limiteBytes);
        if (bytes.byteLength > this.limiteBytes) {
          return this.resultadoCorrupto(chave, "cache_objeto_grande", contabilizar);
        }
        const [infoHandleDepois, infoDepois] = await Promise.all([
          handle.stat({ bigint: true }),
          lstat(caminho, { bigint: true }),
        ]);
        await confirmarGuardaCadeia(guarda);
        if (!identidadeArquivoValida(caminho, infoDepois, infoHandleDepois)
          || !mesmaIdentidade(identidadeDe(infoAntes), identidadeDe(infoDepois))) {
          return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
        }
      } finally {
        await handle.close().catch(() => undefined);
      }

      let bruto: unknown;
      try {
        bruto = JSON.parse(bytes.toString("utf8"));
      } catch {
        return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
      }
      if (!registroObjeto(bruto)
        || bruto.schema !== SCHEMA_OBJETO_CACHE_DRIFT
        || bruto.key !== chave
        || bruto.workspaceId !== this.workspaceId
        || bruto.gitHead !== this.gitHead
        || typeof bruto.payloadDigest !== "string"
        || !PADRAO_DIGEST.test(bruto.payloadDigest)) {
        return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
      }
      const campos = Object.keys(bruto).sort();
      if (campos.join("\0") !== ["gitHead", "key", "payload", "payloadDigest", "schema", "workspaceId"].join("\0")) {
        return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
      }
      let digest: string;
      try {
        digest = digestJsonCanonicoCacheDrift(bruto.payload);
      } catch {
        return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
      }
      if (digest !== bruto.payloadDigest || !validarPayloadSeguro(validar, bruto.payload)) {
        return this.resultadoCorrupto(chave, "cache_objeto_corrupto", contabilizar);
      }
      if (contabilizar) {
        this.metricasAtuais.hits += 1;
        emitirEvento(this.observador, {
          tipo: "cache.read.hit",
          workspaceId: this.workspaceId,
          chave,
          caminhoVirtual,
        });
      }
      return {
        estado: "hit",
        chave,
        valor: bruto.payload as T,
        payloadDigest: digest,
        caminhoVirtual,
      };
    } catch (erro) {
      if (erroEhAusencia(erro)) {
        if (contabilizar) this.metricasAtuais.misses += 1;
        return { estado: "miss", chave, codigo: "cache_objeto_ausente", caminhoVirtual };
      }
      return this.resultadoCorrupto(chave, codigoErro(erro), contabilizar);
    }
  }

  private resultadoCorrupto<T extends ValorJsonCacheDrift>(
    chave: string,
    codigo: CodigoErroStoreCacheDrift,
    contabilizar: boolean,
  ): ResultadoLeituraStoreCacheDrift<T> {
    const caminhoVirtual = validarChave(chave) ? this.caminhoVirtual(chave) : "$SEMA_CACHE/invalid";
    if (contabilizar) {
      this.metricasAtuais.corruptos += 1;
      emitirEvento(this.observador, {
        tipo: "cache.read.corrupt",
        workspaceId: this.workspaceId,
        ...(validarChave(chave) ? { chave } : {}),
        caminhoVirtual,
        codigo,
      });
    }
    return { estado: "corrupto", chave, codigo, caminhoVirtual };
  }

  private erroPublicacao(
    chave: string,
    codigo: CodigoErroStoreCacheDrift,
  ): ResultadoPublicacaoStoreCacheDrift {
    this.metricasAtuais.erros += 1;
    emitirEvento(this.observador, {
      tipo: "cache.write.error",
      workspaceId: this.workspaceId,
      ...(validarChave(chave) ? { chave, caminhoVirtual: this.caminhoVirtual(chave) } : {}),
      codigo,
    });
    return { estado: "erro", chave, codigo };
  }

  private caminhoObjeto(chave: string): string {
    const digest = chave.slice("sha256:".length);
    return path.join(
      this.pastaWorkspace,
      "objects",
      "sha256",
      digest.slice(0, 2),
      `${digest}.json`,
    );
  }

  private caminhoVirtual(chave: string): string {
    const digest = chave.slice("sha256:".length);
    return `$SEMA_CACHE/drift/v3/workspaces/${this.workspaceId.slice(7)}/objects/sha256/${digest.slice(0, 2)}/${digest}.json`;
  }
}

function normalizarLimiteBytes(valor: number | undefined): number {
  return Number.isSafeInteger(valor) && valor! > 0
    ? valor!
    : LIMITE_BYTES_OBJETO_CACHE_DRIFT;
}

export async function criarStoreCacheDrift(
  opcoes: OpcoesCriarStoreCacheDrift,
): Promise<StoreCacheDrift> {
  const resolucao = resolverRaizCacheSema({
    plataforma: process.platform,
    ambiente: opcoes.ambiente,
    diretorioUsuario: opcoes.diretorioUsuario,
    raizCache: opcoes.raizCache,
  });
  if (!resolucao.disponivel) {
    return new StoreCacheDriftIndisponivel(resolucao.codigo, opcoes.observador);
  }

  let workspaceId: string | null = null;
  let gitHead: string | null = null;
  try {
    const baseProjetoReal = await realpath(path.resolve(opcoes.baseProjeto));
    const infoProjeto = await stat(baseProjetoReal, { bigint: true });
    if (!infoProjeto.isDirectory()) throw new FalhaStoreCacheDrift("cache_workspace_invalido");
    const raizLogica = path.resolve(resolucao.raiz);
    if (caminhosSobrepostos(baseProjetoReal, raizLogica)) {
      throw new FalhaStoreCacheDrift("cache_root_sobrepoe_workspace");
    }
    const raizPreparada = await prepararRaizCache(raizLogica);
    if (caminhosSobrepostos(baseProjetoReal, raizPreparada.real)) {
      throw new FalhaStoreCacheDrift("cache_root_sobrepoe_workspace");
    }

    const caminhoCanonico = process.platform === "win32"
      ? baseProjetoReal.toLocaleLowerCase("en-US")
      : baseProjetoReal;
    workspaceId = digestJsonCanonicoCacheDrift({
      schema: "sema.workspace-cache-identity/v1",
      realpath: caminhoCanonico,
      dev: infoProjeto.dev.toString(),
      ino: infoProjeto.ino.toString(),
    });
    gitHead = await lerGitHeadSeguro(baseProjetoReal);
    const pastaWorkspace = path.join(
      raizPreparada.real,
      "drift",
      "v3",
      "workspaces",
      workspaceId.slice("sha256:".length),
    );
    await garantirSubdiretorioSeguro(
      raizPreparada.real,
      raizPreparada.identidade,
      pastaWorkspace,
    );
    return new StoreCacheDriftDisponivel(
      workspaceId,
      gitHead,
      raizPreparada.real,
      raizPreparada.identidade,
      pastaWorkspace,
      normalizarLimiteBytes(opcoes.limiteBytes),
      opcoes.observador,
    );
  } catch (erro) {
    return new StoreCacheDriftIndisponivel(
      codigoErro(erro),
      opcoes.observador,
      workspaceId,
      gitHead,
    );
  }
}
