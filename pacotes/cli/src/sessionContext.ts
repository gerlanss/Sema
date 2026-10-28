// SEMA-GOVERNED: sema.produto.cli_sessao
// Descrição: consulta o índice local internamente e retorna candidatos rastreáveis, sem autorização de edição.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { selecionarIndiceContexto } from "./indexPack.js";
import { validarDestinosEscritaWorkspace } from "./workspaceWrite.js";

export async function navegarContextoSessao(base: string, pedido: string, arquivo?: string) {
  await validarDestinosEscritaWorkspace(base, ["SEMA_INDEX.json"]);
  const texto = await readFile(path.join(base, "SEMA_INDEX.json"), "utf8");
  const indice = JSON.parse(texto) as { modulos?: Parameters<typeof selecionarIndiceContexto>[0]["modulos"]; geradoEm?: string };
  if (!Array.isArray(indice.modulos)) throw new Error("Índice sem módulos; rode sema sync-codex --json.");
  const relativo = (valor: string): string => {
    const absoluto = path.resolve(base, valor);
    const rel = path.relative(base, absoluto);
    if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error("Referência de contexto fora do workspace.");
    return rel.replace(/\\/g, "/");
  };
  const alvo = arquivo ? relativo(arquivo) : undefined;
  const exatos = alvo ? indice.modulos.filter((m) => relativo(m.arquivo) === alvo
    || m.arquivosProvaveis?.some((p: string) => relativo(p) === alvo)) : [];
  const pack = selecionarIndiceContexto({ modulos: indice.modulos, request: pedido, baseProject: base, sourceIndexChars: texto.length, maximoModulos: indice.modulos.length });
  const encontrados = alvo ? exatos.map((m) => ({
    module: m.modulo, contract: m.arquivo, purpose: m.faz, likelyFiles: m.arquivosProvaveis,
  })) : pack.matches;
  return {
    totalModulos: indice.modulos.length,
    indiceCaracteres: texto.length,
    candidatos: encontrados.map((m) => ({
      modulo: m.module,
      contrato: relativo(m.contract),
      motivo: alvo ? `Referência exata: ${alvo}` : "Correspondência de intenção; confirme no contrato antes de editar.",
      resumo: m.purpose,
      arquivos: (m.likelyFiles ?? []).map(relativo),
    })),
    status: encontrados.length === 0 ? "sem_correspondencia" : encontrados.length === 1 ? "contrato_localizado" : "selecionar_contrato",
    execucaoAutorizada: false,
  };
}
