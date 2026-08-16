// SEMA-GOVERNED: sema.produto.governanca_ia.drift, sema.produto.governanca_ia.drift.cache.store
// Descrição: cataloga somente o plano físico do drift e compartilha uma leitura estável por arquivo.

import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export type TipoEventoOperacaoDrift =
  | "catalog.visit"
  | "content.open"
  | "content.read"
  | "ast.create"
  | "extractor.run"
  | "cache.hit"
  | "cache.miss"
  | "cache.corrupt"
  | "cache.write"
  | "cache.unavailable";

export interface EventoOperacaoDrift {
  tipo: TipoEventoOperacaoDrift;
  caminho?: string;
  raiz?: string;
  chave?: string;
  categoria?: "arquivo" | "diretorio";
  bytes?: number;
  digest?: string;
  motivo?: string;
}

export type ObservadorOperacaoDrift = (evento: EventoOperacaoDrift) => void;
export type ObservadorDrift = ObservadorOperacaoDrift;

export interface ArquivoCatalogadoDrift {
  caminho: string;
  extensao: string;
  explicito: boolean;
  raizes: string[];
}

export interface ConteudoArquivoDrift {
  caminho: string;
  bytes: Buffer;
  texto: string;
  digest: string;
}

export interface MetricasCatalogoDrift {
  diretoriosVisitados: number;
  arquivosCatalogados: number;
  leiturasConteudo: number;
  bytesLidos: number;
  acertosMemoriaConteudo: number;
  origem: "plano_explicito" | "caminhada";
}

export interface FiltroCatalogoDrift {
  extensoes?: readonly string[];
  raiz?: string;
}

export interface OpcoesCatalogoDrift {
  baseDiretorio?: string;
  arquivos?: readonly string[];
  raizes?: readonly string[];
  extensoes?: readonly string[];
  diretoriosIgnorados?: ReadonlySet<string> | readonly string[];
  concorrencia?: number;
  observador?: ObservadorOperacaoDrift;
}

export interface CatalogoDrift {
  readonly baseDiretorio: string;
  readonly raizes: readonly string[];
  listar(filtro?: FiltroCatalogoDrift): string[];
  listar(extensoes?: readonly string[], raizes?: readonly string[]): string[];
  listarEntradas(filtro?: FiltroCatalogoDrift): ArquivoCatalogadoDrift[];
  listarPorExtensoes(extensoes: readonly string[], raiz?: string): string[];
  listarPorRaiz(raiz: string, extensoes?: readonly string[]): string[];
  arquivosCatalogados(): string[];
  incluir(arquivos: readonly string[]): Promise<void>;
  contem(caminho: string): boolean;
  ler(caminho: string): Promise<ConteudoArquivoDrift>;
  lerTexto(caminho: string): Promise<string>;
  digest(caminho: string): Promise<string>;
  emitir(tipo: TipoEventoOperacaoDrift, arquivo?: string): void;
  metricas(): MetricasCatalogoDrift;
}

export type CatalogoArquivosDrift = CatalogoDrift;

interface RegistroArquivoCatalogado {
  caminho: string;
  extensao: string;
  explicito: boolean;
  raizes: Set<string>;
  aliases: Set<string>;
  identidade: IdentidadeArquivoCatalogado;
}

interface IdentidadeArquivoCatalogado {
  caminhoReal: string;
  dev: bigint;
  ino: bigint;
  nlink: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}

interface SondagemArquivoCatalogado {
  caminho: string;
  identidade: IdentidadeArquivoCatalogado;
}

interface AssinaturaDiretorio {
  mtimeNs: bigint;
  ctimeNs: bigint;
  dev: bigint;
  ino: bigint;
}

const CONCORRENCIA_PADRAO = 8;
const CONCORRENCIA_MAXIMA = 64;

function emitirEvento(
  observador: ObservadorOperacaoDrift | undefined,
  evento: EventoOperacaoDrift,
): void {
  try {
    observador?.(evento);
  } catch {
    // Observabilidade nunca altera o resultado funcional do drift.
  }
}

function normalizarConcorrencia(valor?: number): number {
  if (!Number.isFinite(valor)) {
    return CONCORRENCIA_PADRAO;
  }
  return Math.max(1, Math.min(CONCORRENCIA_MAXIMA, Math.trunc(valor!)));
}

function normalizarExtensao(extensao: string): string {
  const limpa = extensao.trim().toLowerCase();
  if (!limpa) {
    return limpa;
  }
  return limpa.startsWith(".") ? limpa : `.${limpa}`;
}

function ehFiltroCatalogoDrift(
  valor: readonly string[] | FiltroCatalogoDrift,
): valor is FiltroCatalogoDrift {
  return !Array.isArray(valor);
}

function chaveCaminho(caminho: string): string {
  const normalizado = path.normalize(path.resolve(caminho));
  return process.platform === "win32" ? normalizado.toLowerCase() : normalizado;
}

function caminhoEstaDentro(raiz: string, alvo: string): boolean {
  const relativo = path.relative(path.resolve(raiz), path.resolve(alvo));
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

function erroEhAusencia(erro: unknown): boolean {
  return ["ENOENT", "ENOTDIR"].includes((erro as NodeJS.ErrnoException).code ?? "");
}

function assinaturaDiretorio(info: BigIntStats): AssinaturaDiretorio {
  return {
    mtimeNs: info.mtimeNs,
    ctimeNs: info.ctimeNs,
    dev: info.dev,
    ino: info.ino,
  };
}

function assinaturasDiretorioIguais(a: AssinaturaDiretorio, b: AssinaturaDiretorio): boolean {
  return a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs
    && a.dev === b.dev
    && a.ino === b.ino;
}

function identidadeArquivoEstavel(a: BigIntStats, b: BigIntStats): boolean {
  return a.isFile()
    && b.isFile()
    && !a.isSymbolicLink()
    && !b.isSymbolicLink()
    && a.nlink === 1n
    && b.nlink === 1n
    && a.dev === b.dev
    && a.ino === b.ino
    && a.size === b.size
    && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs;
}

function criarIdentidadeArquivoCatalogado(
  caminhoReal: string,
  informacao: BigIntStats,
): IdentidadeArquivoCatalogado {
  return {
    caminhoReal: path.resolve(caminhoReal),
    dev: informacao.dev,
    ino: informacao.ino,
    nlink: informacao.nlink,
    size: informacao.size,
    mtimeNs: informacao.mtimeNs,
    ctimeNs: informacao.ctimeNs,
  };
}

function identidadeCatalogadaCorresponde(
  identidade: IdentidadeArquivoCatalogado,
  caminhoReal: string,
  informacao: BigIntStats,
): boolean {
  return chaveCaminho(identidade.caminhoReal) === chaveCaminho(caminhoReal)
    && informacao.isFile()
    && !informacao.isSymbolicLink()
    && identidade.nlink === 1n
    && informacao.nlink === 1n
    && identidade.dev === informacao.dev
    && identidade.ino === informacao.ino
    && identidade.size === informacao.size
    && identidade.mtimeNs === informacao.mtimeNs
    && identidade.ctimeNs === informacao.ctimeNs;
}

function chavesFisicasArquivo(identidade: IdentidadeArquivoCatalogado): string[] {
  const chaves = [`real:${chaveCaminho(identidade.caminhoReal)}`];
  if (identidade.dev !== 0n || identidade.ino !== 0n) {
    chaves.push(`id:${identidade.dev.toString()}:${identidade.ino.toString()}`);
  }
  return chaves;
}

function mesmoObjetoFisico(
  a: IdentidadeArquivoCatalogado,
  b: IdentidadeArquivoCatalogado,
): boolean {
  const possuiIdentidadeInode = (a.dev !== 0n || a.ino !== 0n) && (b.dev !== 0n || b.ino !== 0n);
  return possuiIdentidadeInode
    ? a.dev === b.dev && a.ino === b.ino
    : chaveCaminho(a.caminhoReal) === chaveCaminho(b.caminhoReal);
}

async function mapearComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  executar: (item: T) => Promise<R>,
): Promise<R[]> {
  if (itens.length === 0) {
    return [];
  }

  const resultados = new Array<R>(itens.length);
  let proximoIndice = 0;
  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const indice = proximoIndice;
      proximoIndice += 1;
      if (indice >= itens.length) {
        return;
      }
      resultados[indice] = await executar(itens[indice]!);
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(limite, itens.length) },
    () => trabalhador(),
  ));
  return resultados;
}

class CatalogoDriftImplementacao implements CatalogoDrift {
  readonly baseDiretorio: string;
  readonly raizes: readonly string[];

  private readonly registros = new Map<string, RegistroArquivoCatalogado>();
  private readonly registrosFisicos = new Map<string, RegistroArquivoCatalogado>();
  private readonly conteudos = new Map<RegistroArquivoCatalogado, Promise<ConteudoArquivoDrift>>();
  private readonly extensoesPermitidas?: ReadonlySet<string>;
  private readonly concorrencia: number;
  private readonly observador?: ObservadorOperacaoDrift;
  private readonly baseDiretorioReal: Promise<string>;
  private readonly contadores: MetricasCatalogoDrift = {
    diretoriosVisitados: 0,
    arquivosCatalogados: 0,
    leiturasConteudo: 0,
    bytesLidos: 0,
    acertosMemoriaConteudo: 0,
    origem: "plano_explicito",
  };

  constructor(opcoes: OpcoesCatalogoDrift) {
    this.baseDiretorio = path.resolve(opcoes.baseDiretorio ?? process.cwd());
    this.baseDiretorioReal = realpath(this.baseDiretorio);
    this.raizes = [...new Map(
      (opcoes.raizes ?? [])
        .map((raiz) => path.resolve(this.baseDiretorio, raiz))
        .filter((raiz) => caminhoEstaDentro(this.baseDiretorio, raiz))
        .map((raiz) => [chaveCaminho(raiz), raiz] as const),
    ).values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const extensoes = opcoes.extensoes
      ?.map(normalizarExtensao)
      .filter(Boolean);
    this.extensoesPermitidas = extensoes?.length
      ? new Set(extensoes)
      : undefined;
    this.concorrencia = normalizarConcorrencia(opcoes.concorrencia);
    this.observador = opcoes.observador;
  }

  async construir(
    arquivosExplicitos: readonly string[],
    diretoriosIgnorados: ReadonlySet<string>,
  ): Promise<void> {
    await this.baseDiretorioReal;
    if (this.raizes.length > 0) {
      this.contadores.origem = "caminhada";
      await this.caminharRaizes(diretoriosIgnorados);
    }
    await this.incluir(arquivosExplicitos);
  }

  async incluir(arquivosExplicitos: readonly string[]): Promise<void> {
    const explicitos = [...new Map(
      arquivosExplicitos
        .map((arquivo) => path.resolve(this.baseDiretorio, arquivo))
        .map((arquivo) => [chaveCaminho(arquivo), arquivo] as const),
    ).values()].sort((a, b) => a.localeCompare(b, "pt-BR"));

    const sondagens = await mapearComLimite(
      explicitos,
      this.concorrencia,
      async (arquivo) => this.sondarArquivoSeguro(arquivo),
    );
    for (const sondagem of sondagens
      .filter((item): item is SondagemArquivoCatalogado => Boolean(item))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"))) {
      this.adicionarArquivo(sondagem, true);
    }
  }

  listar(filtro?: FiltroCatalogoDrift): string[];
  listar(extensoes?: readonly string[], raizes?: readonly string[]): string[];
  listar(
    extensoesOuFiltro: readonly string[] | FiltroCatalogoDrift = [],
    raizes?: readonly string[],
  ): string[] {
    if (ehFiltroCatalogoDrift(extensoesOuFiltro)) {
      return this.listarEntradas(extensoesOuFiltro).map((arquivo) => arquivo.caminho);
    }
    const extensoes = extensoesOuFiltro.length ? extensoesOuFiltro : undefined;
    if (!raizes?.length) {
      return this.listarEntradas({ extensoes }).map((arquivo) => arquivo.caminho);
    }
    const raizesAbsolutas = raizes.map((raiz) => path.resolve(this.baseDiretorio, raiz));
    return [...new Map(
      raizesAbsolutas.flatMap((raiz) =>
        this.listarEntradas({ extensoes, raiz }).map((arquivo) => [chaveCaminho(arquivo.caminho), arquivo.caminho] as const),
      ),
    ).values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  listarEntradas(filtro: FiltroCatalogoDrift = {}): ArquivoCatalogadoDrift[] {
    const extensoes = filtro.extensoes
      ? new Set(filtro.extensoes.map(normalizarExtensao).filter(Boolean))
      : undefined;
    const raiz = filtro.raiz
      ? path.resolve(this.baseDiretorio, filtro.raiz)
      : undefined;

    return [...new Set(this.registros.values())]
      .filter((registro) => !extensoes || extensoes.has(registro.extensao))
      .filter((registro) => !raiz || [...registro.aliases].some((alias) => caminhoEstaDentro(raiz, alias)))
      .map((registro) => ({
        caminho: registro.caminho,
        extensao: registro.extensao,
        explicito: registro.explicito,
        raizes: [...registro.raizes].sort((a, b) => a.localeCompare(b, "pt-BR")),
      }))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"));
  }

  listarPorExtensoes(extensoes: readonly string[], raiz?: string): string[] {
    return raiz ? this.listar(extensoes, [raiz]) : this.listar(extensoes);
  }

  listarPorRaiz(raiz: string, extensoes?: readonly string[]): string[] {
    return this.listar(extensoes, [raiz]);
  }

  arquivosCatalogados(): string[] {
    return this.listar();
  }

  contem(caminho: string): boolean {
    return this.registros.has(chaveCaminho(path.resolve(this.baseDiretorio, caminho)));
  }

  ler(caminho: string): Promise<ConteudoArquivoDrift> {
    const absoluto = path.resolve(this.baseDiretorio, caminho);
    const chave = chaveCaminho(absoluto);
    const registro = this.registros.get(chave);
    if (!registro) {
      const descricao = caminhoEstaDentro(this.baseDiretorio, absoluto)
        ? absoluto
        : `[fora_do_workspace]/${path.basename(absoluto)}`;
      return Promise.reject(new Error(`Arquivo fora do plano explicito do drift: ${descricao}`));
    }

    const existente = this.conteudos.get(registro);
    if (existente) {
      this.contadores.acertosMemoriaConteudo += 1;
      return existente;
    }

    const leitura = this.lerFisicamente(registro);
    this.conteudos.set(registro, leitura);
    void leitura.catch(() => {
      if (this.conteudos.get(registro) === leitura) {
        this.conteudos.delete(registro);
      }
    });
    return leitura;
  }

  async lerTexto(caminho: string): Promise<string> {
    return (await this.ler(caminho)).texto;
  }

  async digest(caminho: string): Promise<string> {
    return (await this.ler(caminho)).digest;
  }

  emitir(tipo: TipoEventoOperacaoDrift, arquivo?: string): void {
    emitirEvento(this.observador, {
      tipo,
      caminho: arquivo ? path.resolve(this.baseDiretorio, arquivo) : undefined,
    });
  }

  metricas(): MetricasCatalogoDrift {
    return { ...this.contadores };
  }

  private async caminharRaizes(diretoriosIgnorados: ReadonlySet<string>): Promise<void> {
    let nivel = [...this.raizes];
    const visitados = new Set<string>();

    while (nivel.length > 0) {
      const nivelUnico = [...new Map(
        nivel.map((diretorio) => [chaveCaminho(diretorio), diretorio] as const),
      ).values()]
        .filter((diretorio) => {
          const chave = chaveCaminho(diretorio);
          if (visitados.has(chave)) {
            return false;
          }
          visitados.add(chave);
          return true;
        })
        .sort((a, b) => a.localeCompare(b, "pt-BR"));

      const proximos = await mapearComLimite(
        nivelUnico,
        this.concorrencia,
        async (diretorio) => this.visitarDiretorio(diretorio, diretoriosIgnorados),
      );
      nivel = proximos.flat();
    }
  }

  private async visitarDiretorio(
    diretorio: string,
    diretoriosIgnorados: ReadonlySet<string>,
  ): Promise<string[]> {
    if (!await this.caminhoPermaneceNoWorkspace(diretorio)) {
      return [];
    }
    let informacao: BigIntStats;
    try {
      informacao = await lstat(diretorio, { bigint: true });
    } catch (erro) {
      if (erroEhAusencia(erro)) {
        return [];
      }
      throw erro;
    }
    if (informacao.isSymbolicLink()) {
      return [];
    }
    if (informacao.isFile()) {
      const sondagem = await this.sondarArquivoSeguro(diretorio);
      if (sondagem) {
        this.adicionarArquivo(sondagem, false);
      }
      return [];
    }
    if (!informacao.isDirectory()) {
      return [];
    }

    const entradas = await readdir(diretorio, { withFileTypes: true });
    const informacaoDepois = await lstat(diretorio, { bigint: true });
    if (!informacaoDepois.isDirectory()
      || informacaoDepois.isSymbolicLink()
      || !assinaturasDiretorioIguais(
        assinaturaDiretorio(informacao),
        assinaturaDiretorio(informacaoDepois),
      )) {
      throw new Error(`catalogo_diretorio_instavel:${diretorio}`);
    }

    this.contadores.diretoriosVisitados += 1;
    emitirEvento(this.observador, {
      tipo: "catalog.visit",
      caminho: diretorio,
      categoria: "diretorio",
    });

    const proximos: string[] = [];
    const arquivos: string[] = [];
    for (const entrada of entradas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
      if (entrada.isSymbolicLink()) {
        continue;
      }
      const caminhoAtual = path.join(diretorio, entrada.name);
      if (entrada.isDirectory()) {
        if (!diretoriosIgnorados.has(entrada.name.toLowerCase())) {
          proximos.push(caminhoAtual);
        }
      } else if (entrada.isFile()) {
        arquivos.push(caminhoAtual);
      }
    }
    const sondagens = await mapearComLimite(
      arquivos,
      this.concorrencia,
      async (arquivo) => this.sondarArquivoSeguro(arquivo),
    );
    for (const sondagem of sondagens
      .filter((item): item is SondagemArquivoCatalogado => Boolean(item))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"))) {
      this.adicionarArquivo(sondagem, false);
    }
    return proximos;
  }

  private adicionarArquivo(sondagem: SondagemArquivoCatalogado, explicito: boolean): void {
    const absoluto = path.resolve(sondagem.caminho);
    const extensao = path.extname(absoluto).toLowerCase();
    if (!explicito && this.extensoesPermitidas && !this.extensoesPermitidas.has(extensao)) {
      return;
    }

    const chave = chaveCaminho(absoluto);
    const chavesFisicas = chavesFisicasArquivo(sondagem.identidade);
    const existentePorCaminho = this.registros.get(chave);
    if (existentePorCaminho && !mesmoObjetoFisico(existentePorCaminho.identidade, sondagem.identidade)) {
      throw new Error(`Arquivo catalogado mudou de identidade fisica: ${absoluto}`);
    }
    const existente = existentePorCaminho
      ?? chavesFisicas.map((chaveFisica) => this.registrosFisicos.get(chaveFisica)).find(Boolean);
    const raizes = this.raizes.filter((raiz) => caminhoEstaDentro(raiz, absoluto));
    if (existente) {
      existente.explicito = existente.explicito || explicito;
      existente.aliases.add(absoluto);
      this.registros.set(chave, existente);
      for (const raiz of raizes) {
        existente.raizes.add(raiz);
      }
      for (const chaveFisica of chavesFisicas) {
        this.registrosFisicos.set(chaveFisica, existente);
      }
      if (absoluto.localeCompare(existente.caminho, "pt-BR") < 0) {
        existente.caminho = absoluto;
        existente.extensao = extensao;
        existente.identidade = sondagem.identidade;
      }
      return;
    }

    const registro: RegistroArquivoCatalogado = {
      caminho: absoluto,
      extensao,
      explicito,
      raizes: new Set(raizes),
      aliases: new Set([absoluto]),
      identidade: sondagem.identidade,
    };
    this.registros.set(chave, registro);
    for (const chaveFisica of chavesFisicas) {
      this.registrosFisicos.set(chaveFisica, registro);
    }
    this.contadores.arquivosCatalogados += 1;
    emitirEvento(this.observador, {
      tipo: "catalog.visit",
      caminho: absoluto,
      categoria: "arquivo",
    });
  }

  private async sondarArquivoSeguro(caminho: string): Promise<SondagemArquivoCatalogado | undefined> {
    const absoluto = path.resolve(caminho);
    if (!caminhoEstaDentro(this.baseDiretorio, absoluto)) {
      return undefined;
    }
    try {
      const informacaoAntes = await lstat(absoluto, { bigint: true });
      if (!informacaoAntes.isFile() || informacaoAntes.isSymbolicLink() || informacaoAntes.nlink !== 1n) {
        return undefined;
      }
      const [baseReal, caminhoReal] = await Promise.all([
        this.baseDiretorioReal,
        realpath(absoluto),
      ]);
      const informacaoDepois = await lstat(absoluto, { bigint: true });
      if (!caminhoEstaDentro(baseReal, caminhoReal)
        || !identidadeArquivoEstavel(informacaoAntes, informacaoDepois)) {
        return undefined;
      }
      return {
        caminho: absoluto,
        identidade: criarIdentidadeArquivoCatalogado(caminhoReal, informacaoDepois),
      };
    } catch (erro) {
      if (erroEhAusencia(erro)) {
        return undefined;
      }
      throw erro;
    }
  }

  private async lerFisicamente(registro: RegistroArquivoCatalogado): Promise<ConteudoArquivoDrift> {
    const caminho = registro.caminho;
    const informacaoAntes = await lstat(caminho, { bigint: true });
    const [baseReal, caminhoRealAntes] = await Promise.all([
      this.baseDiretorioReal,
      realpath(caminho),
    ]);
    if (!caminhoEstaDentro(baseReal, caminhoRealAntes)
      || !identidadeCatalogadaCorresponde(registro.identidade, caminhoRealAntes, informacaoAntes)) {
      throw new Error(`Arquivo catalogado mudou entre catalogacao e primeira leitura: ${caminho}`);
    }
    const handle = await open(caminho, "r");
    let bytes: Buffer;
    try {
      const informacaoHandleAntes = await handle.stat({ bigint: true });
      emitirEvento(this.observador, {
        tipo: "content.open",
        caminho,
        categoria: "arquivo",
      });
      const [informacaoCaminhoAberto, caminhoRealAberto] = await Promise.all([
        lstat(caminho, { bigint: true }),
        realpath(caminho),
      ]);
      if (!caminhoEstaDentro(baseReal, caminhoRealAberto)
        || !identidadeCatalogadaCorresponde(registro.identidade, caminhoRealAberto, informacaoCaminhoAberto)
        || !identidadeArquivoEstavel(informacaoAntes, informacaoHandleAntes)
        || !identidadeArquivoEstavel(informacaoHandleAntes, informacaoCaminhoAberto)) {
        throw new Error(`Arquivo catalogado mudou durante abertura segura: ${caminho}`);
      }
      bytes = await handle.readFile();
      const [informacaoHandleDepois, informacaoCaminhoDepois, caminhoRealDepois] = await Promise.all([
        handle.stat({ bigint: true }),
        lstat(caminho, { bigint: true }),
        realpath(caminho),
      ]);
      if (!caminhoEstaDentro(baseReal, caminhoRealDepois)
        || !identidadeCatalogadaCorresponde(registro.identidade, caminhoRealDepois, informacaoCaminhoDepois)
        || !identidadeArquivoEstavel(informacaoHandleAntes, informacaoHandleDepois)
        || !identidadeArquivoEstavel(informacaoHandleDepois, informacaoCaminhoDepois)) {
        throw new Error(`Arquivo catalogado mudou durante leitura segura: ${caminho}`);
      }
    } finally {
      await handle.close().catch(() => undefined);
    }

    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    this.contadores.leiturasConteudo += 1;
    this.contadores.bytesLidos += bytes.byteLength;
    emitirEvento(this.observador, {
      tipo: "content.read",
      caminho,
      categoria: "arquivo",
      bytes: bytes.byteLength,
      digest,
    });
    return {
      caminho,
      bytes,
      texto: bytes.toString("utf8"),
      digest,
    };
  }

  private async caminhoPermaneceNoWorkspace(caminho: string): Promise<boolean> {
    const absoluto = path.resolve(caminho);
    if (!caminhoEstaDentro(this.baseDiretorio, absoluto)) {
      return false;
    }
    try {
      const [baseReal, caminhoReal] = await Promise.all([
        this.baseDiretorioReal,
        realpath(absoluto),
      ]);
      return caminhoEstaDentro(baseReal, caminhoReal);
    } catch (erro) {
      if (erroEhAusencia(erro)) {
        return false;
      }
      throw erro;
    }
  }
}

export async function criarCatalogoDrift(opcoes: OpcoesCatalogoDrift): Promise<CatalogoDrift> {
  const ignoradosOrigem = opcoes.diretoriosIgnorados ?? [];
  const ignorados = new Set(
    [...ignoradosOrigem]
      .map((diretorio) => diretorio.trim().toLowerCase())
      .filter(Boolean),
  );
  const catalogo = new CatalogoDriftImplementacao(opcoes);
  await catalogo.construir(opcoes.arquivos ?? [], ignorados);
  return catalogo;
}
