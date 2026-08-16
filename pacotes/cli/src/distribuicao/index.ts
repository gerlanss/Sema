// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: expõe status e sincronização separados ou combinados da distribuição global local.

import {
  capturarSnapshotLauncherGlobalTransacao,
  confirmarSnapshotLauncherGlobalTransacao,
  restaurarSnapshotLauncherGlobalTransacao,
  sincronizarLauncherGlobal,
  sincronizarLauncherGlobalTransacional,
  statusLauncherGlobal,
} from "./launcherGlobal.js";
import {
  capturarSnapshotSkillGlobalTransacao,
  restaurarSnapshotSkillGlobalTransacao,
  sincronizarSkillGlobal,
  sincronizarSkillGlobalTransacional,
  statusSkillGlobal,
} from "./skillGlobal.js";
import { comLockDistribuicaoGlobal } from "./lockGlobal.js";
import { falhaParaResultado } from "./filesystemGlobal.js";
import type {
  EstadoDistribuicaoGlobal,
  OpcoesAmbienteDistribuicaoGlobal,
  ResultadoDistribuicaoGlobal,
} from "./tipos.js";

export {
  sincronizarLauncherGlobal,
  statusLauncherGlobal,
} from "./launcherGlobal.js";
export {
  ARQUIVOS_SKILL_SEMA_GERENCIADOS,
  NOME_RECIBO_SKILL_SEMA,
  sincronizarSkillGlobal,
  statusSkillGlobal,
} from "./skillGlobal.js";
export {
  ESTADOS_DISTRIBUICAO_GLOBAL,
} from "./tipos.js";
export type {
  CodigoDiagnosticoDistribuicaoGlobal,
  EstadoDistribuicaoGlobal,
  IdentificadorDestinoSkillGlobal,
  OpcoesAmbienteDistribuicaoGlobal,
  ResultadoDestinoSkillGlobal,
  ResultadoDistribuicaoGlobal,
  ResultadoLauncherGlobal,
  ResultadoSkillGlobal,
} from "./tipos.js";

function prioridadeEstado(estado: EstadoDistribuicaoGlobal): number {
  return {
    READY: 0,
    MISSING: 1,
    STALE: 2,
    BROKEN_TARGET: 3,
    PERMISSION_DENIED: 4,
  }[estado];
}

function combinar(
  launcher: ResultadoDistribuicaoGlobal["launcher"],
  skill: ResultadoDistribuicaoGlobal["skill"],
): ResultadoDistribuicaoGlobal {
  return {
    estado: prioridadeEstado(launcher.estado) >= prioridadeEstado(skill.estado)
      ? launcher.estado
      : skill.estado,
    alterado: launcher.alterado || skill.alterado,
    launcher,
    skill,
  };
}

function resultadoBloqueiaMutacao(resultado: ResultadoDistribuicaoGlobal): boolean {
  return resultado.launcher.estado === "BROKEN_TARGET"
    || resultado.launcher.estado === "PERMISSION_DENIED"
    || resultado.skill.destinos.some((destino) => (
      destino.estado === "BROKEN_TARGET"
      || destino.estado === "PERMISSION_DENIED"
    ));
}

function semAlteracao(resultado: ResultadoDistribuicaoGlobal): ResultadoDistribuicaoGlobal {
  return {
    ...resultado,
    alterado: false,
    launcher: { ...resultado.launcher, alterado: false },
    skill: {
      ...resultado.skill,
      alterado: false,
      destinos: resultado.skill.destinos.map((destino) => ({ ...destino, alterado: false })),
    },
  };
}

function falhaLock(
  atual: ResultadoDistribuicaoGlobal,
  codigo: ResultadoDistribuicaoGlobal["launcher"]["codigo"],
  alterado: boolean,
): ResultadoDistribuicaoGlobal {
  return {
    estado: "BROKEN_TARGET",
    alterado,
    launcher: {
      ...atual.launcher,
      estado: "BROKEN_TARGET",
      alterado,
      codigo,
      recibo_valido: false,
      independente_path: false,
    },
    skill: {
      ...atual.skill,
      estado: "BROKEN_TARGET",
      alterado,
      destino_agents: "BROKEN_TARGET",
      destino_claude: atual.skill.espelho_claude_detectado
        ? "BROKEN_TARGET"
        : "NOT_DETECTED",
      ownership_valido: false,
      digest_alinhado: false,
      destinos: atual.skill.destinos.map((destino) => ({
        ...destino,
        estado: "BROKEN_TARGET",
        alterado,
        codigo,
      })),
    },
  };
}

function resultadoInteiramenteReady(resultado: ResultadoDistribuicaoGlobal): boolean {
  return resultado.estado === "READY"
    && resultado.launcher.estado === "READY"
    && resultado.skill.estado === "READY"
    && resultado.skill.destinos.length > 0
    && resultado.skill.destinos.every((destino) => destino.estado === "READY");
}

function comAlteracoesConfirmadas(
  final: ResultadoDistribuicaoGlobal,
  launcherSincronizado: ResultadoDistribuicaoGlobal["launcher"],
  skillSincronizada: ResultadoDistribuicaoGlobal["skill"],
): ResultadoDistribuicaoGlobal {
  const alteracoesSkill = new Map(skillSincronizada.destinos.map((destino) => [
    destino.id,
    destino.alterado,
  ]));
  return combinar({
    ...final.launcher,
    alterado: launcherSincronizado.alterado,
  }, {
    ...final.skill,
    alterado: skillSincronizada.alterado,
    destinos: final.skill.destinos.map((destino) => ({
      ...destino,
      alterado: alteracoesSkill.get(destino.id) ?? false,
    })),
  });
}

type ComponenteRollback = "launcher" | "skill";

function falhaRollback(
  anterior: ResultadoDistribuicaoGlobal,
  componentes: readonly ComponenteRollback[],
): ResultadoDistribuicaoGlobal {
  const launcher: ResultadoDistribuicaoGlobal["launcher"] = componentes.includes("launcher")
    ? {
      ...anterior.launcher,
      estado: "BROKEN_TARGET",
      alterado: true,
      codigo: "ROLLBACK_FALHOU",
      recibo_valido: false,
      independente_path: false,
    }
    : { ...anterior.launcher, alterado: false };
  const skill: ResultadoDistribuicaoGlobal["skill"] = componentes.includes("skill")
    ? {
      ...anterior.skill,
      estado: "BROKEN_TARGET",
      alterado: true,
      destino_agents: "BROKEN_TARGET",
      destino_claude: anterior.skill.espelho_claude_detectado
        ? "BROKEN_TARGET"
        : "NOT_DETECTED",
      ownership_valido: false,
      digest_alinhado: false,
      destinos: anterior.skill.destinos.map((destino) => ({
        ...destino,
        estado: "BROKEN_TARGET",
        alterado: true,
        codigo: "ROLLBACK_FALHOU",
      })),
    }
    : {
      ...anterior.skill,
      alterado: false,
      destinos: anterior.skill.destinos.map((destino) => ({ ...destino, alterado: false })),
    };
  return combinar(launcher, skill);
}

type SnapshotLauncher = Awaited<ReturnType<typeof capturarSnapshotLauncherGlobalTransacao>>;
type SnapshotSkill = Awaited<ReturnType<typeof capturarSnapshotSkillGlobalTransacao>>;

async function tentarRollback(
  snapshotLauncher?: SnapshotLauncher,
  snapshotSkill?: SnapshotSkill,
): Promise<ComponenteRollback[]> {
  const falhas: ComponenteRollback[] = [];
  if (snapshotLauncher) {
    try {
      await restaurarSnapshotLauncherGlobalTransacao(snapshotLauncher);
    } catch {
      falhas.push("launcher");
    }
  }
  if (snapshotSkill) {
    try {
      await restaurarSnapshotSkillGlobalTransacao(snapshotSkill);
    } catch {
      falhas.push("skill");
    }
  }
  return falhas;
}

export async function statusDistribuicaoGlobal(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoDistribuicaoGlobal> {
  const [launcher, skill] = await Promise.all([
    statusLauncherGlobal(opcoes),
    statusSkillGlobal(opcoes),
  ]);
  return combinar(launcher, skill);
}

async function sincronizarDistribuicaoGlobalSemLock(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoDistribuicaoGlobal> {
  const diagnosticoInicial = await statusDistribuicaoGlobal(opcoes);
  if (resultadoBloqueiaMutacao(diagnosticoInicial)) return semAlteracao(diagnosticoInicial);

  let snapshotLauncher: Awaited<ReturnType<typeof capturarSnapshotLauncherGlobalTransacao>>;
  let snapshotSkill: Awaited<ReturnType<typeof capturarSnapshotSkillGlobalTransacao>>;
  try {
    [snapshotLauncher, snapshotSkill] = await Promise.all([
      capturarSnapshotLauncherGlobalTransacao(opcoes),
      capturarSnapshotSkillGlobalTransacao(opcoes),
    ]);
  } catch {
    return semAlteracao(await statusDistribuicaoGlobal(opcoes));
  }

  const skill = await sincronizarSkillGlobalTransacional(snapshotSkill);
  if (skill.estado !== "READY") {
    const falhasRollback = await tentarRollback(undefined, snapshotSkill);
    if (falhasRollback.length > 0) {
      return falhaRollback(await statusDistribuicaoGlobal(opcoes), falhasRollback);
    }
    return semAlteracao(await statusDistribuicaoGlobal(opcoes));
  }

  const launcher = await sincronizarLauncherGlobalTransacional(snapshotLauncher);
  if (launcher.estado !== "READY") {
    const falhasRollback = await tentarRollback(snapshotLauncher, snapshotSkill);
    if (falhasRollback.length > 0) {
      return falhaRollback(await statusDistribuicaoGlobal(opcoes), falhasRollback);
    }
    return semAlteracao(await statusDistribuicaoGlobal(opcoes));
  }

  const final = await statusDistribuicaoGlobal(opcoes);
  if (!resultadoInteiramenteReady(final)) {
    const falhasRollback = await tentarRollback(snapshotLauncher, snapshotSkill);
    if (falhasRollback.length > 0) {
      return falhaRollback(await statusDistribuicaoGlobal(opcoes), falhasRollback);
    }
    return semAlteracao(await statusDistribuicaoGlobal(opcoes));
  }

  const launcherConfirmado = await confirmarSnapshotLauncherGlobalTransacao(snapshotLauncher);
  if (launcherConfirmado.estado !== "READY") {
    const falhasRollback = await tentarRollback(snapshotLauncher, snapshotSkill);
    if (falhasRollback.length > 0) {
      return falhaRollback(await statusDistribuicaoGlobal(opcoes), falhasRollback);
    }
    return semAlteracao(await statusDistribuicaoGlobal(opcoes));
  }
  return comAlteracoesConfirmadas(
    combinar(launcherConfirmado, final.skill),
    { ...launcher, alterado: launcher.alterado || launcherConfirmado.alterado },
    skill,
  );
}

export async function sincronizarDistribuicaoGlobal(
  opcoes: OpcoesAmbienteDistribuicaoGlobal = {},
): Promise<ResultadoDistribuicaoGlobal> {
  try {
    return await comLockDistribuicaoGlobal(opcoes, async ({ diretorioUsuario }) => (
      sincronizarDistribuicaoGlobalSemLock({ ...opcoes, diretorioUsuario })
    ));
  } catch (erro) {
    const falha = falhaParaResultado(erro);
    if (["LOCK_PERDIDO", "LOCK_TIMEOUT", "CONTEUDO_NAO_GERENCIADO", "ROLLBACK_FALHOU"]
      .includes(falha.codigo)) {
      return falhaLock(
        await statusDistribuicaoGlobal(opcoes),
        falha.codigo,
        falha.codigo === "LOCK_PERDIDO" || falha.codigo === "ROLLBACK_FALHOU",
      );
    }
    return semAlteracao(await statusDistribuicaoGlobal(opcoes));
  }
}
