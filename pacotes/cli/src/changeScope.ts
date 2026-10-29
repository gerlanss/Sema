// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao.finalizacao
// Descrição: preserva intenção, escopo e declarações de leitura por mudança, sem tratar declaração como prova.
import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { escreverArquivoWorkspaceSeguro, validarDestinosEscritaWorkspace } from "./workspaceWrite.js";

export interface ChangeScope {
  schema: "sema.change-scope/v1";
  id: string;
  intencao: string;
  arquivosAlvo: string[];
  leiturasDeclaradas: Record<string, string>;
}
const pasta = ".sema/mudancas";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");

export function normalizarEscopo(base: string, arquivos: string[]): string[] {
  return [...new Set(arquivos.map((arquivo) => {
    const relativo = path.relative(path.resolve(base), path.resolve(base, arquivo)).replace(/\\/g, "/");
    if (!relativo || relativo === ".." || relativo.startsWith("../") || path.isAbsolute(relativo)) {
      throw new Error("Informe arquivos dentro do workspace para fixar o escopo.");
    }
    return relativo;
  }))].sort();
}

export async function hashArquivoMudanca(base: string, arquivo: string): Promise<string> {
  const [relativo] = normalizarEscopo(base, [arquivo]);
  await validarDestinosEscritaWorkspace(base, [relativo!]);
  const destino = path.resolve(base, relativo!);
  if (!(await stat(destino)).isFile()) throw new Error(`Leitura deve apontar para arquivo: ${relativo}`);
  return digest(await readFile(destino, "utf8"));
}

export async function carregarMudanca(base: string, id: string): Promise<ChangeScope> {
  if (!/^[a-f0-9]{20}$/.test(id)) throw new Error("Identificador de mudança inválido; copie o id retornado por docs-impacto.");
  const arquivo = `${pasta}/${id}.json`;
  await validarDestinosEscritaWorkspace(base, [arquivo]);
  const registro: ChangeScope = JSON.parse(await readFile(path.join(base, arquivo), "utf8"));
  if (registro.schema !== "sema.change-scope/v1" || registro.id !== id || typeof registro.intencao !== "string"
    || !Array.isArray(registro.arquivosAlvo) || !registro.arquivosAlvo.length
    || registro.arquivosAlvo.some((a) => typeof a !== "string")
    || !registro.leiturasDeclaradas || typeof registro.leiturasDeclaradas !== "object"
    || Array.isArray(registro.leiturasDeclaradas)
    || Object.entries(registro.leiturasDeclaradas).some(([doc, hash]) => !doc || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Registro de mudança inválido. Abra docs-impacto com intenção e arquivos explícitos.");
  }
  const escopo = normalizarEscopo(base, registro.arquivosAlvo);
  if (id !== digest(JSON.stringify([registro.intencao, escopo])).slice(0, 20)) throw new Error("Escopo da mudança foi alterado no registro.");
  return { ...registro, arquivosAlvo: escopo };
}

export async function salvarMudanca(base: string, registro: ChangeScope): Promise<void> {
  await escreverArquivoWorkspaceSeguro(base, `${pasta}/${registro.id}.json`, JSON.stringify(registro, null, 2) + "\n", { sobrescrever: true });
}

export async function registrarMudanca(base: string, intencao: string, arquivos: string[]): Promise<ChangeScope> {
  const arquivosAlvo = normalizarEscopo(base, arquivos);
  if (!arquivosAlvo.length) throw new Error("Informe --arquivo para registrar uma mudança.");
  const id = digest(JSON.stringify([intencao.trim(), arquivosAlvo])).slice(0, 20);
  try { return await carregarMudanca(base, id); }
  catch (erro) { if ((erro as NodeJS.ErrnoException).code !== "ENOENT") throw erro; }
  const registro: ChangeScope = { schema: "sema.change-scope/v1", id, intencao: intencao.trim(), arquivosAlvo, leiturasDeclaradas: {} };
  await salvarMudanca(base, registro);
  return registro;
}

export async function listarMudancas(base: string): Promise<Array<Pick<ChangeScope, "id" | "intencao" | "arquivosAlvo">>> {
  const destino = path.join(base, pasta);
  try {
    // Não seguir uma pasta de registros redirecionada para fora do workspace.
    if (path.resolve(await realpath(destino)) !== path.resolve(await realpath(base), pasta)) throw new Error("Pasta de mudanças redirecionada.");
    const nomes = (await readdir(destino)).filter((n) => /^[a-f0-9]{20}\.json$/.test(n)).sort().slice(0, 20);
    return await Promise.all(nomes.map(async (n) => {
      const { id, intencao, arquivosAlvo } = await carregarMudanca(base, n.slice(0, -5));
      return { id, intencao, arquivosAlvo };
    }));
  } catch (erro) { if ((erro as NodeJS.ErrnoException).code === "ENOENT") return []; throw erro; }
}

export function proximasChamadas(registro: ChangeScope, docs: string[]) {
  return {
    retomar: ["sessao", "--mudanca-id", registro.id, "--json"],
    finalizar: ["finalizar-mudanca", "--mudanca-id", registro.id, ...docs.flatMap((d) => ["--doc-lida", d]), "--json"],
    instrucao: "Execute sema com estes argumentos. Declare apenas documentos efetivamente lidos; hashes permitem reaproveitar a declaração enquanto o documento não mudar.",
  };
}
