// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.argumentos
// Descrição: prova rejeição pública, estável e sem efeitos de sintaxes inválidas antes do dispatch.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ehCliControlError } from "../../pacotes/cli/src/cliControlError.js";
import { validarSintaxeInvocacaoPublica } from "../../pacotes/cli/src/cliGrammar.js";

export const cli_controle_argumentos = "sema.cli.public-arguments/v1";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = path.join(RAIZ, "pacotes", "cli", "dist", "bin.js");
const CHAVES_ENVELOPE = ["code", "exitCode", "kind", "message", "ok", "schemaVersion"];

interface CasoInvalido {
  readonly nome: string;
  readonly args: readonly string[];
  readonly categoria?: "UNKNOWN_COMMAND" | "ARGUMENT_ERROR";
}

const CASOS_INVALIDOS: readonly CasoInvalido[] = [
  { nome: "comando desconhecido", args: ["comando-inexistente", "file:%252Ftmp%252Fargv-secreto", "--json"], categoria: "UNKNOWN_COMMAND" },
  { nome: "profile encoded desconhecido", args: ["profile", "file:%252Ftmp%252Fargv-secreto", "--json"] },
  { nome: "author encoded desconhecido", args: ["author", "%252Ftmp%252Fargv-secreto", "--json"] },
  { nome: "init sem argumentos obrigatórios", args: ["init", "--json"] },
  { nome: "init template inválido", args: ["init", "--template", "banana", "--saida", "saida.sema", "--modulo", "app.modulo", "--json"] },
  { nome: "dev com posicional inesperado", args: ["dev", "banana", "--json"] },
  { nome: "dev modo inválido", args: ["dev", "--modo", "banana", "--json"] },
  { nome: "sync sem alvo", args: ["sync", "--json"] },
  { nome: "sync sem operação", args: ["sync", "prisma", "--json"] },
  { nome: "ast sem operando", args: ["ast", "--json"] },
  { nome: "ir sem operando", args: ["ir", "--json"] },
  { nome: "diagnósticos sem operando", args: ["diagnosticos", "--json"] },
  { nome: "contexto IA sem operando", args: ["contexto-ia", "--json"] },
  { nome: "iniciar template inválido", args: ["iniciar", "--template", "banana", "--json"] },
  { nome: "guard subcomando inválido", args: ["guard", "banana", "--json"] },
  { nome: "rule packs profile inválido", args: ["rule-packs", "--profile", "banana", "--json"] },
  { nome: "prompt curto drift não suportado", args: ["prompt-curto", ".", "--drift", "banana", "--json"] },
  { nome: "skill subcomando inválido", args: ["skill", "banana", "--json"] },
  { nome: "conteúdo subcomando inválido", args: ["conteudo", "banana", "--json"] },
  { nome: "descobrir subcomando inválido", args: ["descobrir", "banana", "--json"] },
  { nome: "interativo subcomando inválido", args: ["interativo", "banana", "--json"] },
];

function variantesSensiveis(valor: string): string[] {
  const variantes = new Set([valor]);
  let atual = valor;
  for (let indice = 0; indice < 2; indice += 1) {
    try {
      atual = decodeURIComponent(atual);
      variantes.add(atual);
    } catch {
      break;
    }
  }
  return [...variantes].filter((item) => item.length >= 3);
}

async function fingerprint(base: string): Promise<string[]> {
  const entradas: string[] = [];
  async function visitar(atual: string): Promise<void> {
    const estado = await stat(atual);
    const relativo = path.relative(base, atual).replaceAll(path.sep, "/") || ".";
    if (estado.isDirectory()) {
      entradas.push(`D ${relativo}`);
      for (const filho of (await readdir(atual)).sort()) await visitar(path.join(atual, filho));
      return;
    }
    const digest = createHash("sha256").update(await readFile(atual)).digest("hex");
    entradas.push(`F ${relativo} ${digest}`);
  }
  await visitar(base);
  return entradas;
}

test("validador puro classifica todos os bypasses antes do dispatch", () => {
  for (const caso of CASOS_INVALIDOS) {
    assert.throws(
      () => validarSintaxeInvocacaoPublica(caso.args),
      (erro: unknown) => {
        assert.equal(ehCliControlError(erro), true, caso.nome);
        if (!ehCliControlError(erro)) return false;
        const categoria = caso.categoria ?? "ARGUMENT_ERROR";
        assert.equal(erro.categoria, categoria, caso.nome);
        assert.equal(erro.codigoPublico, categoria === "UNKNOWN_COMMAND" ? "CLI_UNKNOWN_COMMAND" : "CLI_ARGUMENT_ERROR");
        assert.equal(erro.codigoSaida, 1);
        assert.equal(erro.message, erro.mensagemPublica);
        return true;
      },
    );
  }

  for (const args of [
    ["validar", "arquivo-ausente.sema", "--json"],
    ["compilar", "arquivo-ausente.sema", "--alvo", "cs", "--saida", "saida"],
    ["testar", "arquivo-ausente.sema", "--alvo", "c++", "--saida", "saida"],
    ["profile", "validar", "software", "arquivo-ausente.sema", "--json"],
    ["author", "validar", "arquivo-ausente.sema", "--json"],
    ["guard", "status", "--json"],
  ] as const) {
    assert.equal(validarSintaxeInvocacaoPublica(args).dispatchPermitido, true, args.join(" "));
  }
});

test("bin rejeita cada sintaxe com um único envelope e sem mutação ou vazamento", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-cli-argumentos-"));
  t.after(async () => rm(base, { recursive: true, force: true }));
  const workspace = path.join(base, "workspace");
  const home = path.join(base, "home");
  const cache = path.join(base, "cache");
  const temporarios = path.join(base, "temporarios");
  const pathVazio = path.join(base, "path-vazio");
  await Promise.all([workspace, home, cache, temporarios, pathVazio].map((diretorio) => mkdir(diretorio, { recursive: true })));
  await writeFile(path.join(workspace, "sentinela.txt"), "imutável\n", "utf8");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CACHE_HOME: cache,
    TEMP: temporarios,
    TMP: temporarios,
    PATH: pathVazio,
    Path: pathVazio,
  };

  for (const caso of CASOS_INVALIDOS) {
    const antes = await fingerprint(base);
    const resultado = spawnSync(process.execPath, [CLI, ...caso.args], {
      cwd: workspace,
      env,
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    const depois = await fingerprint(base);
    assert.equal(resultado.error, undefined, `${caso.nome}: ${resultado.error?.message ?? "falha"}`);
    assert.equal(resultado.status, 1, caso.nome);
    assert.equal(resultado.signal, null, caso.nome);
    assert.equal(resultado.stderr, "", caso.nome);
    assert.deepEqual(depois, antes, `${caso.nome}: a rejeição alterou o ambiente isolado`);

    let envelope: Record<string, unknown>;
    assert.doesNotThrow(() => { envelope = JSON.parse(resultado.stdout) as Record<string, unknown>; }, caso.nome);
    envelope = JSON.parse(resultado.stdout) as Record<string, unknown>;
    const categoria = caso.categoria ?? "ARGUMENT_ERROR";
    assert.deepEqual(Object.keys(envelope).sort(), [...CHAVES_ENVELOPE].sort(), caso.nome);
    assert.equal(envelope.schemaVersion, "sema.cli.control/v1", caso.nome);
    assert.equal(envelope.ok, false, caso.nome);
    assert.equal(envelope.kind, categoria, caso.nome);
    assert.equal(envelope.code, categoria === "UNKNOWN_COMMAND" ? "CLI_UNKNOWN_COMMAND" : "CLI_ARGUMENT_ERROR", caso.nome);
    assert.equal(envelope.exitCode, 1, caso.nome);
    assert.equal(
      envelope.message,
      categoria === "UNKNOWN_COMMAND"
        ? "Comando Sema desconhecido."
        : "Argumentos inválidos. Consulte a ajuda do comando.",
      caso.nome,
    );

    const saidaCompleta = `${resultado.stdout}\n${resultado.stderr}`;
    const segredos = [base, workspace, home, cache, temporarios, ...caso.args.flatMap(variantesSensiveis)];
    for (const segredo of segredos) assert.equal(saidaCompleta.includes(segredo), false, `${caso.nome}: vazou ${segredo}`);
    assert.doesNotMatch(saidaCompleta, /(?:\bat\s+[^\n]+:\d+:\d+|Error:\s|node:internal|[A-Za-z]:\\)/u, caso.nome);
  }
});
