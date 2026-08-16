// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: prova allowlist, ownership, upgrade atômico e confinamento da skill global Sema.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { symlinkSync, unlinkSync, watch, writeFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  capturarSnapshotSkillGlobalTransacao,
  NOME_RECIBO_SKILL_SEMA,
  restaurarSnapshotSkillGlobalTransacao,
  sincronizarSkillGlobal,
  sincronizarSkillGlobalTransacional,
  statusSkillGlobal,
} from "../../pacotes/cli/src/distribuicao/skillGlobal.js";
import { nomeLockDistribuicaoGlobal } from "../../pacotes/cli/src/distribuicao/lockGlobal.js";

async function bloquearExclusaoArquivoWindows(caminho: string): Promise<() => Promise<void>> {
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const script = [
    "& { param([string]$arquivo)",
    "$stream = $null",
    "try {",
    "  $stream = [System.IO.File]::Open($arquivo, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)",
    "  [Console]::Out.WriteLine('LOCKED')",
    "  [Console]::Out.Flush()",
    "  [Console]::In.ReadLine() | Out-Null",
    "} finally { if ($null -ne $stream) { $stream.Dispose() } }",
    "}",
  ].join("\n");
  const filho = spawn(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script, caminho],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  const erros: Buffer[] = [];
  filho.stderr.on("data", (parte) => erros.push(Buffer.from(parte)));
  await new Promise<void>((resolve, reject) => {
    let stdout = "";
    const temporizador = setTimeout(() => {
      filho.kill();
      reject(new Error("timeout ao bloquear arquivo de teste no Windows"));
    }, 10_000);
    filho.stdout.on("data", (parte) => {
      stdout += Buffer.from(parte).toString("utf8");
      if (stdout.includes("LOCKED")) {
        clearTimeout(temporizador);
        resolve();
      }
    });
    filho.once("error", (erro) => {
      clearTimeout(temporizador);
      reject(erro);
    });
    filho.once("exit", (codigo) => {
      clearTimeout(temporizador);
      reject(new Error(`processo de lock encerrou com ${codigo}: ${Buffer.concat(erros).toString("utf8")}`));
    });
  });
  return async () => {
    if (filho.exitCode !== null) return;
    const fechado = new Promise<void>((resolve) => filho.once("close", () => resolve()));
    filho.stdin.end("\n");
    await fechado;
  };
}

async function criarPacote(
  base: string,
  versao = "2.3.6-test",
  skill = "skill-v1",
): Promise<string> {
  const raiz = path.join(base, "pacote CLI üni");
  await mkdir(path.join(raiz, "skills", "sema", "agents"), { recursive: true });
  await writeFile(path.join(raiz, "package.json"), JSON.stringify({
    name: "@semacode/cli",
    version: versao,
  }), "utf8");
  await writeFile(path.join(raiz, "skills", "sema", "SKILL.md"), `${skill}\n`, "utf8");
  await writeFile(
    path.join(raiz, "skills", "sema", "agents", "openai.yaml"),
    `name: sema\nversion: ${versao}\n`,
    "utf8",
  );
  await writeFile(path.join(raiz, "skills", "sema", "arquivo-fora-da-allowlist.txt"), "ignorar", "utf8");
  await mkdir(path.join(raiz, "skills", "sema", "cache"));
  await writeFile(path.join(raiz, "skills", "sema", "cache", "sentinela"), "intacta", "utf8");
  return raiz;
}

test("skill instala allowlist com receipt, é idempotente e não toca caches/plugins", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-global-"));
  try {
    const home = path.join(base, "home usuário");
    const cachePlugin = path.join(home, ".codex", "plugins", "cache", "sema", "sentinela");
    const workspace = path.join(base, "workspace", "sentinela.txt");
    await mkdir(path.dirname(cachePlugin), { recursive: true });
    await mkdir(path.dirname(workspace), { recursive: true });
    await writeFile(cachePlugin, "cache-intocado", "utf8");
    await writeFile(workspace, "workspace-intocado", "utf8");
    const raizPacote = await criarPacote(base);
    const opcoes = { diretorioUsuario: home, raizPacote } as const;

    const ausente = await statusSkillGlobal(opcoes);
    assert.equal(ausente.estado, "MISSING");
    assert.equal(ausente.destino_agents, "MISSING");
    assert.equal(ausente.destino_claude, "NOT_DETECTED");
    assert.equal(ausente.espelho_claude_detectado, false);
    assert.equal(ausente.ownership_valido, false);
    assert.equal(ausente.digest_alinhado, false);
    assert.equal(ausente.cache_plugin_intocado, true);
    assert.equal(JSON.stringify(ausente).includes(base), false);

    const instalado = await sincronizarSkillGlobal(opcoes);
    assert.equal(instalado.estado, "READY");
    assert.equal(instalado.alterado, true);
    assert.equal(instalado.destino_agents, "READY");
    assert.equal(instalado.ownership_valido, true);
    assert.equal(instalado.digest_alinhado, true);

    const destino = path.join(home, ".agents", "skills", "sema");
    assert.deepEqual((await readdir(destino)).sort(), [
      NOME_RECIBO_SKILL_SEMA,
      "SKILL.md",
      "agents",
    ].sort());
    assert.deepEqual(await readdir(path.join(destino, "agents")), ["openai.yaml"]);
    assert.equal(await readFile(path.join(destino, "SKILL.md"), "utf8"), "skill-v1\n");
    const recibo = JSON.parse(await readFile(path.join(destino, NOME_RECIBO_SKILL_SEMA), "utf8")) as {
      schema: string;
      manager: string;
      files: Record<string, string>;
    };
    assert.equal(recibo.schema, "sema.skill-install-receipt/v1");
    assert.equal(recibo.manager, "@semacode/cli");
    assert.deepEqual(Object.keys(recibo.files), ["SKILL.md", "agents/openai.yaml"]);
    assert.match(recibo.files["SKILL.md"] ?? "", /^[a-f0-9]{64}$/u);
    assert.equal(await readFile(cachePlugin, "utf8"), "cache-intocado");
    assert.equal(await readFile(workspace, "utf8"), "workspace-intocado");
    assert.equal(
      await readFile(path.join(raizPacote, "skills", "sema", "cache", "sentinela"), "utf8"),
      "intacta",
    );

    const mtimeAntes = (await stat(path.join(destino, "SKILL.md"))).mtimeMs;
    const repetido = await sincronizarSkillGlobal(opcoes);
    assert.equal(repetido.estado, "READY");
    assert.equal(repetido.alterado, false);
    assert.equal((await stat(path.join(destino, "SKILL.md"))).mtimeMs, mtimeAntes);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("skill atualiza somente instalação gerenciada e bloqueia conteúdo adulterado ou alheio", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-upgrade-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base);
    const opcoes = { diretorioUsuario: home, raizPacote } as const;
    await sincronizarSkillGlobal(opcoes);
    const destino = path.join(home, ".agents", "skills", "sema");

    await writeFile(path.join(raizPacote, "package.json"), JSON.stringify({
      name: "@semacode/cli",
      version: "2.3.7-test",
    }), "utf8");
    await writeFile(path.join(raizPacote, "skills", "sema", "SKILL.md"), "skill-v2\n", "utf8");
    const stale = await statusSkillGlobal(opcoes);
    assert.equal(stale.estado, "STALE");
    assert.equal(stale.ownership_valido, true);
    assert.equal(stale.digest_alinhado, false);
    const atualizado = await sincronizarSkillGlobal(opcoes);
    assert.equal(atualizado.estado, "READY");
    assert.equal(atualizado.alterado, true);
    assert.equal(await readFile(path.join(destino, "SKILL.md"), "utf8"), "skill-v2\n");
    assert.deepEqual(await readdir(path.join(home, ".agents", "skills")), ["sema"]);

    await writeFile(path.join(destino, "SKILL.md"), "alteração humana", "utf8");
    const adulterado = await statusSkillGlobal(opcoes);
    assert.equal(adulterado.estado, "BROKEN_TARGET");
    assert.equal(adulterado.destinos[0]?.codigo, "DESTINO_ALTERADO");
    assert.equal(adulterado.ownership_valido, false);
    assert.equal((await sincronizarSkillGlobal(opcoes)).estado, "BROKEN_TARGET");
    assert.equal(await readFile(path.join(destino, "SKILL.md"), "utf8"), "alteração humana");

    const homeAlheia = path.join(base, "home-alheia");
    const alheio = path.join(homeAlheia, ".agents", "skills", "sema");
    await mkdir(alheio, { recursive: true });
    await writeFile(path.join(alheio, "SKILL.md"), "skill do usuário", "utf8");
    const opcoesAlheias = { diretorioUsuario: homeAlheia, raizPacote } as const;
    const naoGerenciado = await statusSkillGlobal(opcoesAlheias);
    assert.equal(naoGerenciado.estado, "BROKEN_TARGET");
    assert.equal(naoGerenciado.destinos[0]?.codigo, "CONTEUDO_NAO_GERENCIADO");
    assert.equal((await sincronizarSkillGlobal(opcoesAlheias)).alterado, false);
    assert.equal(await readFile(path.join(alheio, "SKILL.md"), "utf8"), "skill do usuário");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("skill sincroniza downgrade solicitado explicitamente com a versão instalada", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-downgrade-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base, "3.0.0", "skill-3");
    const opcoes = { diretorioUsuario: home, raizPacote } as const;
    assert.equal((await sincronizarSkillGlobal(opcoes)).estado, "READY");
    const destino = path.join(home, ".agents", "skills", "sema");
    await writeFile(path.join(raizPacote, "package.json"), JSON.stringify({
      name: "@semacode/cli",
      version: "2.3.6",
    }), "utf8");
    await writeFile(path.join(raizPacote, "skills", "sema", "SKILL.md"), "skill-2\n", "utf8");
    await writeFile(
      path.join(raizPacote, "skills", "sema", "agents", "openai.yaml"),
      "name: sema\nversion: 2.3.6\n",
      "utf8",
    );
    const status = await statusSkillGlobal(opcoes);
    assert.equal(status.estado, "STALE");
    assert.equal(status.destinos[0]?.codigo, "DESTINO_DESATUALIZADO");
    assert.equal(status.ownership_valido, true);
    const sync = await sincronizarSkillGlobal(opcoes);
    assert.equal(sync.estado, "READY");
    assert.equal(sync.destinos[0]?.codigo, "DESTINO_PRONTO");
    assert.equal(sync.alterado, true);
    assert.equal(await readFile(path.join(destino, "SKILL.md"), "utf8"), "skill-2\n");
    assert.equal(
      await readFile(path.join(destino, "agents", "openai.yaml"), "utf8"),
      "name: sema\nversion: 2.3.6\n",
    );
    const recibo = JSON.parse(
      await readFile(path.join(destino, NOME_RECIBO_SKILL_SEMA), "utf8"),
    ) as { packageVersion: string };
    assert.equal(recibo.packageVersion, "2.3.6");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("skill espelha em Claude somente quando detectado e preserva conteúdo adjacente", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-claude-"));
  try {
    const home = path.join(base, "home");
    await mkdir(path.join(home, ".claude"), { recursive: true });
    await writeFile(path.join(home, ".claude", "settings.json"), "config-intacta", "utf8");
    const raizPacote = await criarPacote(base);
    const resultado = await sincronizarSkillGlobal({ diretorioUsuario: home, raizPacote });
    assert.equal(resultado.estado, "READY");
    assert.equal(resultado.espelho_claude_detectado, true);
    assert.equal(resultado.destino_agents, "READY");
    assert.equal(resultado.destino_claude, "READY");
    assert.equal(resultado.destinos.length, 2);
    assert.equal(
      await readFile(path.join(home, ".claude", "skills", "sema", "SKILL.md"), "utf8"),
      "skill-v1\n",
    );
    assert.equal(await readFile(path.join(home, ".claude", "settings.json"), "utf8"), "config-intacta");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("skill pública diagnostica todos os destinos antes de criar o canônico", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-diagnostico-"));
  try {
    const home = path.join(base, "home");
    const skillClaudeAlheia = path.join(home, ".claude", "skills", "sema");
    await mkdir(skillClaudeAlheia, { recursive: true });
    await writeFile(path.join(skillClaudeAlheia, "SKILL.md"), "skill do usuário", "utf8");
    const raizPacote = await criarPacote(base);

    const resultado = await sincronizarSkillGlobal({ diretorioUsuario: home, raizPacote });

    assert.equal(resultado.estado, "BROKEN_TARGET");
    assert.equal(resultado.alterado, false);
    assert.equal(resultado.destinos.find((destino) => destino.id === "agents")?.alterado, false);
    assert.equal(resultado.destinos.find((destino) => destino.id === "claude")?.codigo, "CONTEUDO_NAO_GERENCIADO");
    await assert.rejects(stat(path.join(home, ".agents", "skills", "sema")), { code: "ENOENT" });
    assert.equal(await readFile(path.join(skillClaudeAlheia, "SKILL.md"), "utf8"), "skill do usuário");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("skill retorna o estado físico restaurado após compensação bem-sucedida", async (t) => {
  if (process.platform !== "win32") {
    t.skip("regressão específica do bloqueio de rename no Windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-rollback-fisico-"));
  let liberar: (() => Promise<void>) | undefined;
  try {
    const home = path.join(base, "home");
    await mkdir(path.join(home, ".claude"), { recursive: true });
    const raizPacote = await criarPacote(base, "2.3.6", "skill-v1");
    const opcoes = { diretorioUsuario: home, raizPacote } as const;
    assert.equal((await sincronizarSkillGlobal(opcoes)).estado, "READY");
    const agentsSkill = path.join(home, ".agents", "skills", "sema", "SKILL.md");
    const claudeSkill = path.join(home, ".claude", "skills", "sema", "SKILL.md");

    await writeFile(path.join(raizPacote, "package.json"), JSON.stringify({
      name: "@semacode/cli",
      version: "2.3.7",
    }), "utf8");
    await writeFile(path.join(raizPacote, "skills", "sema", "SKILL.md"), "skill-v2\n", "utf8");
    await writeFile(
      path.join(raizPacote, "skills", "sema", "agents", "openai.yaml"),
      "name: sema\nversion: 2.3.7\n",
      "utf8",
    );
    liberar = await bloquearExclusaoArquivoWindows(claudeSkill);

    const resultado = await sincronizarSkillGlobal(opcoes);
    assert.equal(resultado.estado, "STALE");
    assert.equal(resultado.alterado, false);
    assert.equal(resultado.destino_agents, "STALE");
    assert.equal(resultado.destino_claude, "STALE");
    assert.equal(resultado.destinos.every((destino) => (
      destino.codigo === "DESTINO_DESATUALIZADO" && destino.alterado === false
    )), true);
    assert.equal(await readFile(agentsSkill, "utf8"), "skill-v1\n");
    assert.equal(await readFile(claudeSkill, "utf8"), "skill-v1\n");
  } finally {
    await liberar?.();
    await rm(base, { recursive: true, force: true });
  }
});

test("skill rejeita junction ou symlink na cadeia sem tocar o alvo externo", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-link-"));
  try {
    const home = path.join(base, "home");
    const externo = path.join(base, "externo");
    await mkdir(home);
    await mkdir(externo);
    await writeFile(path.join(externo, "sentinela.txt"), "intacta", "utf8");
    const raizPacote = await criarPacote(base);
    try {
      await symlink(externo, path.join(home, ".agents"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente não permite criar link de teste");
        return;
      }
      throw erro;
    }
    const opcoes = { diretorioUsuario: home, raizPacote } as const;
    const status = await statusSkillGlobal(opcoes);
    assert.equal(status.estado, "BROKEN_TARGET");
    assert.equal(status.destinos[0]?.codigo, "SYMLINK_OU_JUNCTION");
    assert.equal((await sincronizarSkillGlobal(opcoes)).alterado, false);
    assert.equal(await readFile(path.join(externo, "sentinela.txt"), "utf8"), "intacta");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("skill canonicaliza raiz de pacote informada por junction", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-package-link-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizReal = await criarPacote(base);
    const raizLink = path.join(base, "pacote-link");
    try {
      await symlink(raizReal, raizLink, process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente não permite criar link de teste");
        return;
      }
      throw erro;
    }
    const opcoes = { diretorioUsuario: home, raizPacote: raizLink } as const;
    assert.equal((await statusSkillGlobal(opcoes)).estado, "MISSING");
    assert.equal((await sincronizarSkillGlobal(opcoes)).estado, "READY");
    assert.equal((await statusSkillGlobal(opcoes)).estado, "READY");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("skill serializa sincronizações concorrentes na mesma HOME", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-concorrente-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base);
    const opcoes = { diretorioUsuario: home, raizPacote } as const;
    const resultados = await Promise.all(Array.from({ length: 20 }, async () => (
      sincronizarSkillGlobal(opcoes)
    )));
    assert.equal(
      resultados.every((resultado) => resultado.estado === "READY"),
      true,
      JSON.stringify(resultados),
    );
    assert.equal((await statusSkillGlobal(opcoes)).estado, "READY");
    assert.equal(
      await readFile(path.join(home, ".agents", "skills", "sema", "SKILL.md"), "utf8"),
      "skill-v1\n",
    );
    assert.equal((await readdir(home)).includes(".sema-distribuicao-global.lock"), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("criação parcial de stage compensa internamente sem deixar órfão", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-stage-falha-"));
  let observador: ReturnType<typeof watch> | undefined;
  try {
    const home = path.join(base, "home");
    const paiSkills = path.join(home, ".agents", "skills");
    await mkdir(paiSkills, { recursive: true });
    const raizPacote = await criarPacote(base);
    let bloqueioInjetado = false;
    observador = watch(paiSkills, (_evento, nome) => {
      const nomeTexto = nome?.toString() ?? "";
      if (bloqueioInjetado || !nomeTexto.startsWith(".sema-stage-")) return;
      try {
        writeFileSync(path.join(paiSkills, nomeTexto, "agents"), "bloqueio-controlado", {
          flag: "wx",
        });
        bloqueioInjetado = true;
      } catch {
        // Outra etapa venceu a corrida; callbacks seguintes ainda podem injetar.
      }
    });
    const resultado = await sincronizarSkillGlobal({ diretorioUsuario: home, raizPacote });
    observador.close();
    observador = undefined;
    assert.equal(bloqueioInjetado, true, "o bloqueador fs.watch precisa vencer a janela testada");
    assert.notEqual(resultado.estado, "READY");
    assert.deepEqual(
      (await readdir(paiSkills)).filter((nome) => nome.startsWith(".sema-stage-")),
      [],
    );
  } finally {
    observador?.close();
    await rm(base, { recursive: true, force: true });
  }
});

test("rollback da skill tenta todos os destinos e agrega falhas", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-rollback-agregado-"));
  try {
    const home = path.join(base, "home");
    await mkdir(path.join(home, ".claude"), { recursive: true });
    const raizPacote = await criarPacote(base, "2.3.6", "skill-v1");
    const opcoes = { diretorioUsuario: home, raizPacote } as const;
    assert.equal((await sincronizarSkillGlobal(opcoes)).estado, "READY");
    await writeFile(path.join(raizPacote, "package.json"), JSON.stringify({
      name: "@semacode/cli",
      version: "2.3.7",
    }), "utf8");
    await writeFile(path.join(raizPacote, "skills", "sema", "SKILL.md"), "skill-v2\n", "utf8");
    await writeFile(
      path.join(raizPacote, "skills", "sema", "agents", "openai.yaml"),
      "name: sema\nversion: 2.3.7\n",
      "utf8",
    );
    const snapshot = await capturarSnapshotSkillGlobalTransacao(opcoes);
    assert.equal((await sincronizarSkillGlobalTransacional(snapshot)).estado, "READY");
    const agentsSkill = path.join(home, ".agents", "skills", "sema", "SKILL.md");
    const claudeSkill = path.join(home, ".claude", "skills", "sema", "SKILL.md");
    await writeFile(claudeSkill, "alteração concorrente\n", "utf8");

    await assert.rejects(
      restaurarSnapshotSkillGlobalTransacao(snapshot),
      (erro: unknown) => erro instanceof AggregateError
        && erro.message === "ROLLBACK_FALHOU"
        && erro.errors.length === 1,
    );
    assert.equal(await readFile(agentsSkill, "utf8"), "skill-v1\n");
    assert.equal(await readFile(claudeSkill, "utf8"), "alteração concorrente\n");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("sync direto reporta perda de ownership como alterado e não declara sucesso", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-lock-perdido-"));
  let observador: ReturnType<typeof watch> | undefined;
  try {
    const home = path.join(base, "home");
    const paiSkills = path.join(home, ".agents", "skills");
    await mkdir(paiSkills, { recursive: true });
    const raizPacote = await criarPacote(base);
    const lock = path.join(home, nomeLockDistribuicaoGlobal());
    let substituido = false;
    observador = watch(paiSkills, (_evento, nome) => {
      const nomeTexto = nome?.toString() ?? "";
      if (substituido || !nomeTexto.startsWith(".sema-stage-")) return;
      try {
        unlinkSync(lock);
        writeFileSync(lock, "owner substituto", "utf8");
        substituido = true;
      } catch {
        // O teste só afirma a corrida quando a substituição realmente ocorreu.
      }
    });
    const resultado = await sincronizarSkillGlobal({ diretorioUsuario: home, raizPacote });
    observador.close();
    observador = undefined;
    assert.equal(substituido, true);
    assert.equal(resultado.estado, "BROKEN_TARGET");
    assert.equal(resultado.alterado, true);
    assert.equal(resultado.destinos[0]?.codigo, "LOCK_PERDIDO");
    assert.equal(await readFile(lock, "utf8"), "owner substituto");
    await assert.rejects(stat(path.join(home, ".agents", "skills", "sema")), { code: "ENOENT" });
  } finally {
    observador?.close();
    await rm(base, { recursive: true, force: true });
  }
});

test("falha no cleanup do backup não dispara segundo rollback nem retorna READY", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-skill-backup-pendente-"));
  let observador: ReturnType<typeof watch> | undefined;
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base, "2.3.6", "skill-v1");
    const opcoes = { diretorioUsuario: home, raizPacote } as const;
    assert.equal((await sincronizarSkillGlobal(opcoes)).estado, "READY");
    await writeFile(path.join(raizPacote, "package.json"), JSON.stringify({
      name: "@semacode/cli",
      version: "2.3.7",
    }), "utf8");
    await writeFile(path.join(raizPacote, "skills", "sema", "SKILL.md"), "skill-v2\n", "utf8");
    const paiSkills = path.join(home, ".agents", "skills");
    const externo = path.join(base, "externo");
    await mkdir(externo);
    let injetado = false;
    let linkBloqueado = false;
    observador = watch(paiSkills, (_evento, nome) => {
      const nomeTexto = nome?.toString() ?? "";
      if (injetado || linkBloqueado || !nomeTexto.startsWith(".sema-backup-")) return;
      try {
        symlinkSync(
          externo,
          path.join(paiSkills, nomeTexto, "injetado"),
          process.platform === "win32" ? "junction" : "dir",
        );
        injetado = true;
      } catch (erro) {
        if (["EPERM", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
          linkBloqueado = true;
        }
      }
    });
    const resultado = await sincronizarSkillGlobal(opcoes);
    observador.close();
    observador = undefined;
    if (linkBloqueado) {
      t.skip("ambiente não permite criar link de teste");
      return;
    }
    assert.equal(injetado, true);
    assert.equal(resultado.estado, "BROKEN_TARGET");
    assert.equal(resultado.alterado, true);
    assert.equal(resultado.destinos[0]?.codigo, "ROLLBACK_FALHOU");
    const backups = (await readdir(paiSkills)).filter((nome) => nome.startsWith(".sema-backup-"));
    assert.equal(backups.length, 1, "falha local não pode criar uma segunda cadeia de rollback");
  } finally {
    observador?.close();
    await rm(base, { recursive: true, force: true });
  }
});
