// SEMA-GOVERNED: sema.produto.cli_sessao
// Descrição: verifica a versão materializada do protocolo sem ler o índice nem alterar regras manuais.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { criarAgentContextPack, criarGuiaCapacidadeIa } from "./agentContextPack.js";
import { renderizarInstrucaoCodexSema, renderizarSemaBoot, renderizarSemaSmallModel } from "./agentBootstrap.js";

export async function arquivosProtocoloDesatualizados(base: string): Promise<string[]> {
  const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
  const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();
  const esperados = [
    ["AGENTS.md", renderizarInstrucaoCodexSema(pack)],
    ["SEMA_BOOT.md", renderizarSemaBoot(pack)],
  ];
  const desatualizados: string[] = [];
  for (const [arquivo, esperado] of esperados) {
    let atual: string;
    try { atual = normalize(await readFile(path.join(base, arquivo!), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      desatualizados.push(arquivo!);
      continue;
    }
    if (arquivo === "AGENTS.md") {
      // Somente o bloco gerenciado pertence ao gerador; regras manuais são preservadas.
      const blocos = [...atual.matchAll(/<!-- sema:agent-entrypoint:start -->([\s\S]*?)<!-- sema:agent-entrypoint:end -->/g)];
      const inicios = atual.match(/<!-- sema:agent-entrypoint:start -->/g)?.length ?? 0;
      const finais = atual.match(/<!-- sema:agent-entrypoint:end -->/g)?.length ?? 0;
      if (blocos.length !== 1 || inicios !== 1 || finais !== 1 || normalize(blocos[0]![1]!) !== normalize(esperado!)) {
        desatualizados.push(arquivo);
      }
    } else if (atual !== normalize(esperado!)) desatualizados.push(arquivo!);
  }
  return desatualizados;
}
