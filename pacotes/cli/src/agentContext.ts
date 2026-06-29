// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: compõe a entrada canônica do projeto para cada capacidade de IA.

import { criarAgentContextPack } from './agentContextPack.js';
import {
  ALIASES_CAPACIDADE_IA,
  ARQUIVO_AGENT_CONTEXT_PACK,
  ARQUIVO_SEMA_BOOT,
  ARQUIVO_SEMA_SMALL_MODEL,
  ARQUIVOS_CANONICOS_IA_RAIZ,
  DOCUMENTOS_SUPORTE_IA,
  type GuiaCapacidadeIaMap,
} from './agentContextTipos.js';

export function criarEntradaCanonicaProjeto(guiaPorCapacidade: GuiaCapacidadeIaMap) {
  const agentContextPack = criarAgentContextPack(guiaPorCapacidade);
  const fraca = [ARQUIVO_SEMA_BOOT, ARQUIVO_SEMA_SMALL_MODEL, 'llms.txt', ARQUIVO_AGENT_CONTEXT_PACK, 'SEMA_BRIEF.micro.txt', 'SEMA_INDEX.json', 'AGENTS.md'];
  const media = [ARQUIVO_SEMA_BOOT, 'llms.txt', ARQUIVO_AGENT_CONTEXT_PACK, 'SEMA_BRIEF.curto.txt', 'SEMA_INDEX.json', 'AGENTS.md', 'README.md'];
  const forte = [ARQUIVO_SEMA_BOOT, 'llms-full.txt', ARQUIVO_AGENT_CONTEXT_PACK, 'SEMA_BRIEF.md', 'SEMA_INDEX.json', 'AGENTS.md', 'README.md'];
  return {
    descricao: 'Entrada can?nica do reposit?rio para IA. O repo n?o ? human-first; a IA deve come?ar por esses artefatos antes de abrir c?digo cru.',
    ordemLeitura: [...ARQUIVOS_CANONICOS_IA_RAIZ],
    porCapacidade: {
      fraca,
      pequena: fraca,
      media,
      forte,
      grande: forte,
    },
    aliasesCapacidade: { ...ALIASES_CAPACIDADE_IA },
    docsSuporte: [...DOCUMENTOS_SUPORTE_IA],
    agentContextPack,
    guiaPorCapacidade,
  };
}
