// SEMA-GOVERNED: sema.produto.cli_sessao
// Descrição: recompila apenas os contratos do escopo retomado, sem reutilizar veredictos da conversa.
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { carregarProjeto } from "./projetoCarregar.js";
import { validarDestinosEscritaWorkspace } from "./workspaceWrite.js";
import { normalizarEscopo } from "./changeScope.js";

export async function consultarContratosAtuais(base: string, arquivos: string[]) {
  const contratos = new Map<string, { arquivo: string; hash: string | null; valido: boolean; tarefasReconhecidas: number | null; erros: number; ausente?: boolean }>();
  for (const arquivo of normalizarEscopo(base, arquivos).filter((a) => a.toLowerCase().endsWith(".sema"))) {
    if (contratos.has(arquivo)) continue;
    await validarDestinosEscritaWorkspace(base, [arquivo]);
    try { await stat(path.resolve(base, arquivo)); }
    catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== "ENOENT") throw erro;
      contratos.set(arquivo, { arquivo, hash: null, valido: false, tarefasReconhecidas: null, erros: 1, ausente: true });
      continue;
    }
    const projeto = await carregarProjeto(arquivo, base, { escopo: "modulo", adiarDescobertaCodigo: true });
    for (const modulo of projeto.modulosCarregados) {
      const [relativo] = normalizarEscopo(base, [modulo.caminho]);
      const erros = modulo.resultado.diagnosticos.filter((d) => d.severidade === "erro").length;
      contratos.set(relativo!, { arquivo: relativo!, hash: createHash("sha256").update(modulo.codigo).digest("hex"), valido: erros === 0,
        tarefasReconhecidas: modulo.resultado.modulo?.tasks.length ?? null, erros });
    }
  }
  const atuais = [...contratos.values()];
  return { origem: "contratos_recompilados", contratos: atuais, valido: atuais.length ? atuais.every((c) => c.valido) : null,
    drift: "nao_avaliado", comportamento: "nao_avaliado" };
}
