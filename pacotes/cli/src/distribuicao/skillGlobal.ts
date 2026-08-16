// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: instala somente a allowlist empacotada da skill Sema em destinos globais explicitamente permitidos.

import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, realpath } from "node:fs/promises";
import {
  FalhaDistribuicaoGlobal,
  caminhoContido,
  escreverArquivoAtomico,
  falhaParaResultado,
  garantirDiretoriosSeguros,
  identidadeDiretorioSeguro,
  lerArquivoSeguro,
  lstatOuNull,
  moverDiretorioSeguro,
  nomeTemporarioDiretorio,
  removerDiretorioTemporarioGerenciado,
  resolverDentroDaHome,
  resolverHomeReal,
  statDiretorioSeguro,
  validarArquivoRegular,
  validarCadeiaExistente,
  type IdentidadeDiretorioSeguro,
} from "./filesystemGlobal.js";
import { comLockDistribuicaoGlobal } from "./lockGlobal.js";
import type {
  CodigoDiagnosticoDistribuicaoGlobal,
  EstadoDistribuicaoGlobal,
  IdentificadorDestinoSkillGlobal,
  OpcoesAmbienteDistribuicaoGlobal,
  ResultadoDestinoSkillGlobal,
  ResultadoSkillGlobal,
} from "./tipos.js";
import { versaoSemanticaValida } from "./versaoSemantica.js";

export const ARQUIVOS_SKILL_SEMA_GERENCIADOS = [
  "SKILL.md",
  "agents/openai.yaml",
] as const;
export const NOME_RECIBO_SKILL_SEMA = ".sema-managed.json";

const ESQUEMA_RECIBO = "sema.skill-install-receipt/v1";
const GERENCIADOR_RECIBO = "@semacode/cli";
const RAIZ_PACOTE_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIMITE_ARQUIVO_SKILL = 2 * 1024 * 1024;
const LIMITE_RECIBO = 32 * 1024;

interface ReciboSkill {
  schema: typeof ESQUEMA_RECIBO;
  manager: typeof GERENCIADOR_RECIBO;
  skill: "sema";
  packageVersion: string;
  files: Record<(typeof ARQUIVOS_SKILL_SEMA_GERENCIADOS)[number], string>;
}

interface SnapshotSkill {
  raizPacote: string;
  origem: string;
  arquivos: Map<(typeof ARQUIVOS_SKILL_SEMA_GERENCIADOS)[number], Buffer>;
  recibo: ReciboSkill;
  reciboTexto: string;
}

interface DestinoSkillInterno {
  id: IdentificadorDestinoSkillGlobal;
  caminho: string;
  virtual: ResultadoDestinoSkillGlobal["destino_simbolico"];
}

interface AmbienteSkill {
  homeReal: string;
  snapshot: SnapshotSkill;
  espelhoClaudeDetectado: boolean;
  destinos: DestinoSkillInterno[];
}

interface DiagnosticoDestino {
  resultado: ResultadoDestinoSkillGlobal;
  identidade?: IdentidadeDiretorioSeguro;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function chavesExatas(valor: object, esperadas: string[]): boolean {
  const atuais = Object.keys(valor).sort();
  return atuais.length === esperadas.length
    && atuais.every((chave, indice) => chave === [...esperadas].sort()[indice]);
}

function resultadoDestino(
  destino: DestinoSkillInterno,
  estado: EstadoDistribuicaoGlobal,
  codigo: CodigoDiagnosticoDistribuicaoGlobal,
  alterado = false,
): ResultadoDestinoSkillGlobal {
  return {
    id: destino.id,
    estado,
    alterado,
    destino_simbolico: destino.virtual,
    codigo,
  };
}

function destinoCanonico(homeReal: string): DestinoSkillInterno {
  return {
    id: "agents",
    caminho: resolverDentroDaHome(homeReal, ".agents", "skills", "sema"),
    virtual: "$HOME/.agents/skills/sema",
  };
}

function destinoClaude(homeReal: string): DestinoSkillInterno {
  return {
    id: "claude",
    caminho: resolverDentroDaHome(homeReal, ".claude", "skills", "sema"),
    virtual: "$HOME/.claude/skills/sema",
  };
}

function prioridadeEstado(estado: EstadoDistribuicaoGlobal): number {
  return {
    READY: 0,
    MISSING: 1,
    STALE: 2,
    BROKEN_TARGET: 3,
    PERMISSION_DENIED: 4,
  }[estado];
}

function agregar(
  destinos: ResultadoDestinoSkillGlobal[],
  espelhoClaudeDetectado: boolean,
): ResultadoSkillGlobal {
  const estado = destinos.reduce<EstadoDistribuicaoGlobal>(
    (pior, atual) => prioridadeEstado(atual.estado) > prioridadeEstado(pior)
      ? atual.estado
      : pior,
    "READY",
  );
  const agents = destinos.find((destino) => destino.id === "agents");
  const claude = destinos.find((destino) => destino.id === "claude");
  return {
    estado,
    alterado: destinos.some((destino) => destino.alterado),
    origem_simbolica: "$PACKAGE_ROOT/skills/sema",
    destino_agents: agents?.estado ?? "BROKEN_TARGET",
    destino_claude: claude?.estado ?? "NOT_DETECTED",
    espelho_claude_detectado: espelhoClaudeDetectado,
    ownership_valido: destinos.every((destino) => (
      destino.estado === "READY" || destino.estado === "STALE"
    )),
    digest_alinhado: destinos.every((destino) => destino.estado === "READY"),
    cache_plugin_intocado: true,
    destinos,
  };
}

function resultadoBloqueiaMutacao(resultado: ResultadoSkillGlobal): boolean {
  return resultado.destinos.some((destino) => (
    destino.estado === "BROKEN_TARGET"
    || destino.estado === "PERMISSION_DENIED"
  ));
}

function resultadoInteiramenteReady(resultado: ResultadoSkillGlobal): boolean {
  return resultado.estado === "READY"
    && resultado.destinos.length > 0
    && resultado.destinos.every((destino) => destino.estado === "READY");
}

function semAlteracao(resultado: ResultadoSkillGlobal): ResultadoSkillGlobal {
  return {
    ...resultado,
    alterado: false,
    destinos: resultado.destinos.map((destino) => ({ ...destino, alterado: false })),
  };
}

function comAlteracoesConfirmadas(
  final: ResultadoSkillGlobal,
  sincronizado: ResultadoSkillGlobal,
): ResultadoSkillGlobal {
  const alteracoes = new Map(sincronizado.destinos.map((destino) => [
    destino.id,
    destino.alterado,
  ]));
  const destinos = final.destinos.map((destino) => ({
    ...destino,
    alterado: alteracoes.get(destino.id) ?? false,
  }));
  return {
    ...final,
    alterado: destinos.some((destino) => destino.alterado),
    destinos,
  };
}

function falhaRollback(resultadoAtual: ResultadoSkillGlobal): ResultadoSkillGlobal {
  return {
    ...resultadoAtual,
    estado: "BROKEN_TARGET",
    alterado: true,
    destino_agents: "BROKEN_TARGET",
    destino_claude: resultadoAtual.espelho_claude_detectado
      ? "BROKEN_TARGET"
      : "NOT_DETECTED",
    ownership_valido: false,
    digest_alinhado: false,
    destinos: resultadoAtual.destinos.map((destino) => ({
      ...destino,
      estado: "BROKEN_TARGET",
      alterado: true,
      codigo: "ROLLBACK_FALHOU",
    })),
  };
}

function validarVersaoPacote(valor: unknown): string {
  if (!versaoSemanticaValida(valor)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
  }
  return valor;
}

async function carregarSnapshot(
  opcoes: OpcoesAmbienteDistribuicaoGlobal,
): Promise<SnapshotSkill> {
  const raizInformada = opcoes.raizPacote ?? RAIZ_PACOTE_PADRAO;
  if (!path.isAbsolute(raizInformada) || raizInformada.includes("\0")) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
  }
  try {
    const raizPacote = await realpath(path.resolve(raizInformada));
    await statDiretorioSeguro(raizPacote);
    const origem = path.resolve(raizPacote, "skills", "sema");
    if (!caminhoContido(raizPacote, origem)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
    }
    await statDiretorioSeguro(path.join(raizPacote, "skills"));
    await statDiretorioSeguro(origem);
    await statDiretorioSeguro(path.join(origem, "agents"));
    const pacoteJson = JSON.parse((await lerArquivoSeguro(
      path.join(raizPacote, "package.json"),
      LIMITE_RECIBO,
      raizPacote,
    )).toString("utf8")) as { name?: unknown; version?: unknown };
    if (pacoteJson.name !== GERENCIADOR_RECIBO) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
    }
    const packageVersion = validarVersaoPacote(pacoteJson.version);
    const arquivos = new Map<(typeof ARQUIVOS_SKILL_SEMA_GERENCIADOS)[number], Buffer>();
    const hashes = {} as ReciboSkill["files"];
    for (const relativo of ARQUIVOS_SKILL_SEMA_GERENCIADOS) {
      const absoluto = path.resolve(origem, ...relativo.split("/"));
      if (!caminhoContido(origem, absoluto)) {
        throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
      }
      const bytes = await lerArquivoSeguro(absoluto, LIMITE_ARQUIVO_SKILL, origem);
      arquivos.set(relativo, bytes);
      hashes[relativo] = sha256(bytes);
    }
    const recibo: ReciboSkill = {
      schema: ESQUEMA_RECIBO,
      manager: GERENCIADOR_RECIBO,
      skill: "sema",
      packageVersion,
      files: hashes,
    };
    return {
      raizPacote,
      origem,
      arquivos,
      recibo,
      reciboTexto: `${JSON.stringify(recibo, null, 2)}\n`,
    };
  } catch (erro) {
    const falha = falhaParaResultado(erro);
    if (falha.estado === "PERMISSION_DENIED") throw falha;
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
  }
}

async function resolverAmbiente(
  opcoes: OpcoesAmbienteDistribuicaoGlobal,
): Promise<AmbienteSkill> {
  const homeReal = await resolverHomeReal(opcoes.diretorioUsuario ?? os.homedir());
  const claudeRaiz = resolverDentroDaHome(homeReal, ".claude");
  const espelhoClaudeDetectado = (await lstatOuNull(claudeRaiz)) !== null;
  return {
    homeReal,
    snapshot: await carregarSnapshot(opcoes),
    espelhoClaudeDetectado,
    destinos: [
      destinoCanonico(homeReal),
      ...(espelhoClaudeDetectado ? [destinoClaude(homeReal)] : []),
    ],
  };
}

function reciboValido(valor: unknown): valor is ReciboSkill {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const candidato = valor as Partial<ReciboSkill>;
  if (!chavesExatas(candidato, ["schema", "manager", "skill", "packageVersion", "files"])
    || candidato.schema !== ESQUEMA_RECIBO
    || candidato.manager !== GERENCIADOR_RECIBO
    || candidato.skill !== "sema") return false;
  try {
    validarVersaoPacote(candidato.packageVersion);
  } catch {
    return false;
  }
  if (!candidato.files || typeof candidato.files !== "object" || Array.isArray(candidato.files)
    || !chavesExatas(candidato.files, [...ARQUIVOS_SKILL_SEMA_GERENCIADOS])) return false;
  return ARQUIVOS_SKILL_SEMA_GERENCIADOS.every((arquivo) => (
    typeof candidato.files?.[arquivo] === "string"
    && /^[a-f0-9]{64}$/u.test(candidato.files[arquivo])
  ));
}

async function estruturaDestinoPermitida(destino: string): Promise<boolean> {
  const topo = await readdir(destino, { withFileTypes: true });
  if (topo.length === 0) return true;
  if (!chavesExatas(
    Object.fromEntries(topo.map((entrada) => [entrada.name, true])),
    ["SKILL.md", "agents", NOME_RECIBO_SKILL_SEMA],
  )) return false;
  const agents = path.join(destino, "agents");
  await statDiretorioSeguro(agents);
  const entradasAgents = await readdir(agents, { withFileTypes: true });
  if (entradasAgents.length !== 1 || entradasAgents[0]?.name !== "openai.yaml") return false;
  await validarArquivoRegular(path.join(destino, "SKILL.md"), destino);
  await validarArquivoRegular(path.join(agents, "openai.yaml"), destino);
  await validarArquivoRegular(path.join(destino, NOME_RECIBO_SKILL_SEMA), destino);
  return true;
}

async function diagnosticarDestino(
  ambiente: AmbienteSkill,
  destino: DestinoSkillInterno,
): Promise<DiagnosticoDestino> {
  try {
    const cadeia = await validarCadeiaExistente(ambiente.homeReal, path.dirname(destino.caminho));
    if (cadeia === "ausente") {
      return { resultado: resultadoDestino(destino, "MISSING", "DESTINO_AUSENTE") };
    }
    const info = await lstatOuNull(destino.caminho);
    if (!info) return { resultado: resultadoDestino(destino, "MISSING", "DESTINO_AUSENTE") };
    await validarCadeiaExistente(ambiente.homeReal, destino.caminho);
    const identidade = await identidadeDiretorioSeguro(destino.caminho);
    const entradas = await readdir(destino.caminho);
    if (entradas.length === 0) {
      return {
        resultado: resultadoDestino(destino, "MISSING", "DESTINO_AUSENTE"),
        identidade,
      };
    }
    if (!await estruturaDestinoPermitida(destino.caminho)) {
      return {
        resultado: resultadoDestino(destino, "BROKEN_TARGET", "CONTEUDO_NAO_GERENCIADO"),
        identidade,
      };
    }
    let reciboDesconhecido: unknown;
    try {
      reciboDesconhecido = JSON.parse((await lerArquivoSeguro(
        path.join(destino.caminho, NOME_RECIBO_SKILL_SEMA),
        LIMITE_RECIBO,
        ambiente.homeReal,
      )).toString("utf8"));
    } catch (erro) {
      const falha = falhaParaResultado(erro);
      if (falha.estado === "PERMISSION_DENIED") {
        return {
          resultado: resultadoDestino(destino, falha.estado, falha.codigo),
          identidade,
        };
      }
      return {
        resultado: resultadoDestino(destino, "BROKEN_TARGET", "RECIBO_INVALIDO"),
        identidade,
      };
    }
    if (!reciboValido(reciboDesconhecido)) {
      return {
        resultado: resultadoDestino(destino, "BROKEN_TARGET", "RECIBO_INVALIDO"),
        identidade,
      };
    }
    for (const relativo of ARQUIVOS_SKILL_SEMA_GERENCIADOS) {
      const absoluto = path.resolve(destino.caminho, ...relativo.split("/"));
      const bytes = await lerArquivoSeguro(absoluto, LIMITE_ARQUIVO_SKILL, ambiente.homeReal);
      if (sha256(bytes) !== reciboDesconhecido.files[relativo]) {
        return {
          resultado: resultadoDestino(destino, "BROKEN_TARGET", "DESTINO_ALTERADO"),
          identidade,
        };
      }
    }
    const atualizado = reciboDesconhecido.packageVersion === ambiente.snapshot.recibo.packageVersion
      && ARQUIVOS_SKILL_SEMA_GERENCIADOS.every((arquivo) => (
        reciboDesconhecido.files[arquivo] === ambiente.snapshot.recibo.files[arquivo]
      ));
    return {
      resultado: resultadoDestino(
        destino,
        atualizado ? "READY" : "STALE",
        atualizado
          ? "DESTINO_PRONTO"
          : "DESTINO_DESATUALIZADO",
      ),
      identidade,
    };
  } catch (erro) {
    const falha = falhaParaResultado(erro);
    return { resultado: resultadoDestino(destino, falha.estado, falha.codigo) };
  }
}

async function criarStage(
  ambiente: AmbienteSkill,
  destino: DestinoSkillInterno,
  arquivos: ReadonlyMap<(typeof ARQUIVOS_SKILL_SEMA_GERENCIADOS)[number], Buffer>
    = ambiente.snapshot.arquivos,
  reciboTexto = ambiente.snapshot.reciboTexto,
): Promise<{ caminho: string; identidade: IdentidadeDiretorioSeguro }> {
  const pai = path.dirname(destino.caminho);
  await garantirDiretoriosSeguros(ambiente.homeReal, pai);
  const caminho = path.join(pai, nomeTemporarioDiretorio("stage"));
  if (!caminhoContido(ambiente.homeReal, caminho) || await lstatOuNull(caminho)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  await garantirDiretoriosSeguros(ambiente.homeReal, caminho);
  const identidade = await identidadeDiretorioSeguro(caminho);
  try {
    if ((await readdir(caminho)).length !== 0) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    }
    await garantirDiretoriosSeguros(ambiente.homeReal, path.join(caminho, "agents"));
    for (const relativo of ARQUIVOS_SKILL_SEMA_GERENCIADOS) {
      const bytes = arquivos.get(relativo);
      if (!bytes) throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "PACOTE_INVALIDO");
      await escreverArquivoAtomico(
        ambiente.homeReal,
        path.resolve(caminho, ...relativo.split("/")),
        bytes,
        0o600,
      );
    }
    await escreverArquivoAtomico(
      ambiente.homeReal,
      path.join(caminho, NOME_RECIBO_SKILL_SEMA),
      reciboTexto,
      0o600,
    );
    return { caminho, identidade };
  } catch (erro) {
    try {
      if (await lstatOuNull(caminho)) {
        await removerDiretorioTemporarioGerenciado(
          ambiente.homeReal,
          caminho,
          identidade,
        );
      }
    } catch {
      if (erro instanceof FalhaDistribuicaoGlobal && erro.codigo === "LOCK_PERDIDO") {
        throw erro;
      }
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
    }
    throw erro;
  }
}

async function removerTemporarioSeExiste(
  ambiente: AmbienteSkill,
  caminho: string,
  identidade: IdentidadeDiretorioSeguro,
): Promise<void> {
  if (await lstatOuNull(caminho)) {
    await removerDiretorioTemporarioGerenciado(ambiente.homeReal, caminho, identidade);
  }
}

interface BackupDestinoPendente {
  caminho: string;
  identidade: IdentidadeDiretorioSeguro;
}

async function compensarBackupAposPublicacao(
  ambiente: AmbienteSkill,
  destino: DestinoSkillInterno,
  backup: BackupDestinoPendente,
): Promise<void> {
  const atual = await diagnosticarDestino(ambiente, destino);
  const backupVirtual: DestinoSkillInterno = { ...destino, caminho: backup.caminho };
  const original = await diagnosticarDestino(ambiente, backupVirtual);
  if (atual.resultado.estado !== "READY" || !atual.identidade
    || !(["READY", "STALE", "MISSING"] as EstadoDistribuicaoGlobal[])
      .includes(original.resultado.estado)
    || !original.identidade
    || original.identidade.dev !== backup.identidade.dev
    || original.identidade.ino !== backup.identidade.ino) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
  }
  const descarte = path.join(
    path.dirname(destino.caminho),
    nomeTemporarioDiretorio("backup"),
  );
  const identidadeDescarte = await moverDiretorioSeguro(
    ambiente.homeReal,
    destino.caminho,
    descarte,
    atual.identidade,
  );
  try {
    await moverDiretorioSeguro(
      ambiente.homeReal,
      backup.caminho,
      destino.caminho,
      backup.identidade,
    );
  } catch (erro) {
    if (!await lstatOuNull(destino.caminho)) {
      await moverDiretorioSeguro(
        ambiente.homeReal,
        descarte,
        destino.caminho,
        identidadeDescarte,
      ).catch(() => undefined);
    }
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
  }
  try {
    await removerDiretorioTemporarioGerenciado(
      ambiente.homeReal,
      descarte,
      identidadeDescarte,
    );
  } catch {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
  }
}

async function sincronizarDestino(
  ambiente: AmbienteSkill,
  destino: DestinoSkillInterno,
): Promise<ResultadoDestinoSkillGlobal> {
  const antes = await diagnosticarDestino(ambiente, destino);
  if (!(["MISSING", "STALE"] as EstadoDistribuicaoGlobal[]).includes(antes.resultado.estado)) {
    return antes.resultado;
  }
  let stage: Awaited<ReturnType<typeof criarStage>> | undefined;
  let backupPendente: BackupDestinoPendente | undefined;
  let destinoPublicado = false;
  try {
    stage = await criarStage(ambiente, destino);
    const stageDestino: DestinoSkillInterno = { ...destino, caminho: stage.caminho };
    const stageValidado = await diagnosticarDestino(ambiente, stageDestino);
    if (stageValidado.resultado.estado !== "READY") {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
    }
    const imediatamenteAntes = await diagnosticarDestino(ambiente, destino);
    if (imediatamenteAntes.resultado.estado === "READY") {
      await removerTemporarioSeExiste(ambiente, stage.caminho, stage.identidade);
      return imediatamenteAntes.resultado;
    }
    if (!(["MISSING", "STALE"] as EstadoDistribuicaoGlobal[])
      .includes(imediatamenteAntes.resultado.estado)) {
      await removerTemporarioSeExiste(ambiente, stage.caminho, stage.identidade);
      return imediatamenteAntes.resultado;
    }
    const alvoExiste = await lstatOuNull(destino.caminho) !== null;
    const backup = path.join(path.dirname(destino.caminho), nomeTemporarioDiretorio("backup"));
    if (alvoExiste) {
      if (!imediatamenteAntes.identidade) {
        throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
      }
      const identidadeBackup = await moverDiretorioSeguro(
        ambiente.homeReal,
        destino.caminho,
        backup,
        imediatamenteAntes.identidade,
      );
      backupPendente = { caminho: backup, identidade: identidadeBackup };
    }
    try {
      await moverDiretorioSeguro(
        ambiente.homeReal,
        stage.caminho,
        destino.caminho,
        stage.identidade,
      );
      destinoPublicado = true;
    } catch (erro) {
      if (backupPendente && !await lstatOuNull(destino.caminho)) {
        await moverDiretorioSeguro(
          ambiente.homeReal,
          backupPendente.caminho,
          destino.caminho,
          backupPendente.identidade,
        );
        backupPendente = undefined;
      }
      throw erro;
    }
    if (backupPendente) {
      await removerDiretorioTemporarioGerenciado(
        ambiente.homeReal,
        backupPendente.caminho,
        backupPendente.identidade,
      );
      backupPendente = undefined;
    }
    const depois = await diagnosticarDestino(ambiente, destino);
    return {
      ...depois.resultado,
      alterado: depois.resultado.estado === "READY",
    };
  } catch (erro) {
    if (backupPendente && destinoPublicado) {
      try {
        await compensarBackupAposPublicacao(ambiente, destino, backupPendente);
        backupPendente = undefined;
      } catch {
        throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
      }
    }
    const falha = falhaParaResultado(erro);
    return resultadoDestino(destino, falha.estado, falha.codigo);
  } finally {
    if (stage) {
      try {
        await removerTemporarioSeExiste(ambiente, stage.caminho, stage.identidade);
      } catch {
        throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
      }
    }
  }
}

function fallback(
  opcoes: OpcoesAmbienteDistribuicaoGlobal,
  erro: unknown,
): ResultadoSkillGlobal {
  const falha = falhaParaResultado(erro);
  const virtual: ResultadoDestinoSkillGlobal = {
    id: "agents",
    estado: falha.estado,
    alterado: falha.codigo === "LOCK_PERDIDO" || falha.codigo === "ROLLBACK_FALHOU",
    destino_simbolico: "$HOME/.agents/skills/sema",
    codigo: falha.codigo,
  };
  void opcoes;
  return agregar([virtual], false);
}

export async function statusSkillGlobal(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoSkillGlobal> {
  try {
    const ambiente = await resolverAmbiente(opcoes);
    const destinos = await Promise.all(ambiente.destinos.map(async (destino) => (
      (await diagnosticarDestino(ambiente, destino)).resultado
    )));
    return agregar(destinos, ambiente.espelhoClaudeDetectado);
  } catch (erro) {
    return fallback(opcoes, erro);
  }
}

async function sincronizarSkillGlobalSemLock(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoSkillGlobal> {
  const diagnosticoInicial = await statusSkillGlobal(opcoes);
  if (resultadoBloqueiaMutacao(diagnosticoInicial)) return semAlteracao(diagnosticoInicial);

  let snapshot: SnapshotSkillGlobalTransacao;
  try {
    snapshot = await capturarSnapshotSkillGlobalTransacao(opcoes);
  } catch {
    return semAlteracao(await statusSkillGlobal(opcoes));
  }

  const sincronizado = await sincronizarSkillGlobalTransacional(snapshot);
  const final = sincronizado.estado === "READY"
    ? await statusSkillGlobal(opcoes)
    : sincronizado;
  if (resultadoInteiramenteReady(final)) {
    return comAlteracoesConfirmadas(final, sincronizado);
  }

  try {
    await restaurarSnapshotSkillGlobalTransacao(snapshot);
  } catch {
    return falhaRollback(await statusSkillGlobal(opcoes));
  }
  return semAlteracao(await statusSkillGlobal(opcoes));
}

export async function sincronizarSkillGlobal(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoSkillGlobal> {
  try {
    return await comLockDistribuicaoGlobal(opcoes, async ({ diretorioUsuario }) => (
      sincronizarSkillGlobalSemLock({ ...opcoes, diretorioUsuario })
    ));
  } catch (erro) {
    return fallback(opcoes, erro);
  }
}

interface SnapshotDestinoSkillGlobal {
  destino: DestinoSkillInterno;
  existente: boolean;
  vazio: boolean;
  arquivos?: Map<(typeof ARQUIVOS_SKILL_SEMA_GERENCIADOS)[number], Buffer>;
  recibo?: Buffer;
}

/** Snapshot opaco usado somente pelo coordenador para compensação local. */
export interface SnapshotSkillGlobalTransacao {
  readonly ambiente: AmbienteSkill;
  readonly destinos: SnapshotDestinoSkillGlobal[];
}

export async function capturarSnapshotSkillGlobalTransacao(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<SnapshotSkillGlobalTransacao> {
  const ambiente = await resolverAmbiente(opcoes);
  const destinos: SnapshotDestinoSkillGlobal[] = [];
  for (const destino of ambiente.destinos) {
    const diagnostico = await diagnosticarDestino(ambiente, destino);
    if (diagnostico.resultado.estado === "BROKEN_TARGET"
      || diagnostico.resultado.estado === "PERMISSION_DENIED") {
      throw new FalhaDistribuicaoGlobal(
        diagnostico.resultado.estado === "PERMISSION_DENIED"
          ? "PERMISSION_DENIED"
          : "BROKEN_TARGET",
        diagnostico.resultado.codigo,
      );
    }
    const existente = await lstatOuNull(destino.caminho) !== null;
    if (!existente) {
      destinos.push({ destino, existente: false, vazio: false });
      continue;
    }
    const entradas = await readdir(destino.caminho);
    if (entradas.length === 0) {
      destinos.push({ destino, existente: true, vazio: true });
      continue;
    }
    const arquivos = new Map<(typeof ARQUIVOS_SKILL_SEMA_GERENCIADOS)[number], Buffer>();
    for (const relativo of ARQUIVOS_SKILL_SEMA_GERENCIADOS) {
      arquivos.set(relativo, await lerArquivoSeguro(
        path.resolve(destino.caminho, ...relativo.split("/")),
        LIMITE_ARQUIVO_SKILL,
        ambiente.homeReal,
      ));
    }
    destinos.push({
      destino,
      existente: true,
      vazio: false,
      arquivos,
      recibo: await lerArquivoSeguro(
        path.join(destino.caminho, NOME_RECIBO_SKILL_SEMA),
        LIMITE_RECIBO,
        ambiente.homeReal,
      ),
    });
  }
  return { ambiente, destinos };
}

async function destinoIgualSnapshot(
  ambiente: AmbienteSkill,
  snapshot: SnapshotDestinoSkillGlobal,
): Promise<boolean> {
  const existente = await lstatOuNull(snapshot.destino.caminho) !== null;
  if (!snapshot.existente) return !existente;
  if (!existente) return false;
  await validarCadeiaExistente(ambiente.homeReal, snapshot.destino.caminho);
  if (snapshot.vazio) return (await readdir(snapshot.destino.caminho)).length === 0;
  if (!snapshot.arquivos || !snapshot.recibo
    || !await estruturaDestinoPermitida(snapshot.destino.caminho)) return false;
  for (const relativo of ARQUIVOS_SKILL_SEMA_GERENCIADOS) {
    const atual = await lerArquivoSeguro(
      path.resolve(snapshot.destino.caminho, ...relativo.split("/")),
      LIMITE_ARQUIVO_SKILL,
      ambiente.homeReal,
    );
    if (!atual.equals(snapshot.arquivos.get(relativo) ?? Buffer.alloc(0))) return false;
  }
  const reciboAtual = await lerArquivoSeguro(
    path.join(snapshot.destino.caminho, NOME_RECIBO_SKILL_SEMA),
    LIMITE_RECIBO,
    ambiente.homeReal,
  );
  return reciboAtual.equals(snapshot.recibo);
}

async function restaurarDestinoSnapshot(
  ambiente: AmbienteSkill,
  snapshot: SnapshotDestinoSkillGlobal,
): Promise<void> {
  if (await destinoIgualSnapshot(ambiente, snapshot)) return;
  const atual = await diagnosticarDestino(ambiente, snapshot.destino);
  if (atual.resultado.estado !== "READY") {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "DESTINO_ALTERADO");
  }
  const pai = path.dirname(snapshot.destino.caminho);
  let stage: Awaited<ReturnType<typeof criarStage>> | undefined;
  try {
    if (snapshot.arquivos && snapshot.recibo) {
      stage = await criarStage(
        ambiente,
        snapshot.destino,
        snapshot.arquivos,
        snapshot.recibo.toString("utf8"),
      );
    }
    const backup = path.join(pai, nomeTemporarioDiretorio("backup"));
    const identidadeAtual = atual.identidade
      ?? await identidadeDiretorioSeguro(snapshot.destino.caminho);
    const identidadeBackup = await moverDiretorioSeguro(
      ambiente.homeReal,
      snapshot.destino.caminho,
      backup,
      identidadeAtual,
    );
    try {
      if (stage) {
        await moverDiretorioSeguro(
          ambiente.homeReal,
          stage.caminho,
          snapshot.destino.caminho,
          stage.identidade,
        );
      } else if (snapshot.existente && snapshot.vazio) {
        await garantirDiretoriosSeguros(ambiente.homeReal, snapshot.destino.caminho);
      }
    } catch (erro) {
      if (!await lstatOuNull(snapshot.destino.caminho)) {
        await moverDiretorioSeguro(
          ambiente.homeReal,
          backup,
          snapshot.destino.caminho,
          identidadeBackup,
        );
      }
      throw erro;
    }
    await removerDiretorioTemporarioGerenciado(
      ambiente.homeReal,
      backup,
      identidadeBackup,
    );
    if (!await destinoIgualSnapshot(ambiente, snapshot)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "ROLLBACK_FALHOU");
    }
  } finally {
    if (stage) {
      await removerTemporarioSeExiste(
        ambiente,
        stage.caminho,
        stage.identidade,
      );
    }
  }
}

async function sincronizarSkillGlobalTransacionalSemLock(
  snapshot: SnapshotSkillGlobalTransacao,
): Promise<ResultadoSkillGlobal> {
  const destinos: ResultadoDestinoSkillGlobal[] = [];
  for (let indice = 0; indice < snapshot.destinos.length; indice += 1) {
    const item = snapshot.destinos[indice];
    if (!item) continue;
    const resultadoAtual = await sincronizarDestino(snapshot.ambiente, item.destino);
    destinos.push(resultadoAtual);
    if (resultadoAtual.estado !== "READY") {
      for (const restante of snapshot.destinos.slice(indice + 1)) {
        destinos.push((await diagnosticarDestino(snapshot.ambiente, restante.destino)).resultado);
      }
      break;
    }
  }
  return agregar(destinos, snapshot.ambiente.espelhoClaudeDetectado);
}

export async function sincronizarSkillGlobalTransacional(
  snapshot: SnapshotSkillGlobalTransacao,
): Promise<ResultadoSkillGlobal> {
  return comLockDistribuicaoGlobal(
    { diretorioUsuario: snapshot.ambiente.homeReal },
    async () => sincronizarSkillGlobalTransacionalSemLock(snapshot),
  );
}

async function restaurarSnapshotSkillGlobalTransacaoSemLock(
  snapshot: SnapshotSkillGlobalTransacao,
): Promise<void> {
  const falhas: unknown[] = [];
  for (const destino of [...snapshot.destinos].reverse()) {
    try {
      await restaurarDestinoSnapshot(snapshot.ambiente, destino);
    } catch (erro) {
      falhas.push(erro);
    }
  }
  if (falhas.length > 0) throw new AggregateError(falhas, "ROLLBACK_FALHOU");
}

export async function restaurarSnapshotSkillGlobalTransacao(
  snapshot: SnapshotSkillGlobalTransacao,
): Promise<void> {
  return comLockDistribuicaoGlobal(
    { diretorioUsuario: snapshot.ambiente.homeReal },
    async () => restaurarSnapshotSkillGlobalTransacaoSemLock(snapshot),
  );
}
