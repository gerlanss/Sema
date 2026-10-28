// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.entrypoints
// Descrição: uma entrada de contexto limitada pelo perfil, com migração preservada dos resumos legados.
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { lerPerfilContexto, PERGUNTA_CONTEXTO, estimarRespostaTokens } from "./contextBudget.js";
import { validarDestinosEscritaWorkspace, escreverArquivoWorkspaceSeguro } from "./workspaceWrite.js";
import { criarAgentContextPack, criarGuiaCapacidadeIa } from "./agentContextPack.js";
import { renderizarInstrucaoCodexSema, renderizarSemaBoot } from "./agentBootstrap.js";

export type NivelContexto = "micro" | "curto" | "medio";
export const ARQUIVOS_CONTEXTO_PROJETO = ["SEMA_BRIEF.micro.txt", "SEMA_BRIEF.curto.txt", "SEMA_BRIEF.md"] as const;
export const ARQUIVOS_CONTEXTO_MODULO = ["resumo.micro.txt", "resumo.curto.txt", "resumo.md"] as const;
export const RESUMOS_LEGADOS = ["SEMA_BRIEF.micro.txt", "SEMA_BRIEF.curto.txt", "SEMA_BRIEF.md", "resumo.micro.txt", "resumo.curto.txt", "resumo.md", "SEMA_SMALL_MODEL.md", "SEMA_CONTEXT.md"];

// Count local instructions once; summaries and session responses are alternative deliveries.
export async function tokensEntradaLocal(base: string, aposSincronizar = false): Promise<number> {
  let caracteres = 0;
  const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
  const padrao: Record<string, string> = {
    "AGENTS.md": `<!-- sema:agent-entrypoint:start -->\n${renderizarInstrucaoCodexSema(pack)}<!-- sema:agent-entrypoint:end -->\n`,
    "SEMA_BOOT.md": renderizarSemaBoot(pack),
  };
  for (const arquivo of ["AGENTS.md", "SEMA_BOOT.md"]) {
    await validarDestinosEscritaWorkspace(base, [arquivo]);
    try {
      let texto = await readFile(path.join(base, arquivo), "utf8");
      if (aposSincronizar) {
        if (arquivo === "SEMA_BOOT.md") texto = padrao[arquivo]!;
        else texto = texto.replace(/<!-- sema:agent-entrypoint:start -->[\s\S]*?<!-- sema:agent-entrypoint:end -->/g, "") + padrao[arquivo]!;
      }
      caracteres += texto.length;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      caracteres += padrao[arquivo]!.length;
    }
  }
  return Math.ceil(caracteres / 4);
}

export function nivelParaJanela(janelaTokens: number): NivelContexto {
  return janelaTokens <= 32768 ? "micro" : janelaTokens <= 131072 ? "curto" : "medio";
}

export async function selecionarContextoAtivo(
  base: string, resumos: Record<NivelContexto, string>, escopo: "projeto" | "modulo" = "projeto",
): Promise<{ caminhoRelativo: string; conteudo: string; nivel: NivelContexto } | undefined> {
  const perfil = await lerPerfilContexto(base);
  if (!perfil) return undefined;
  const niveis: NivelContexto[] = ["micro", "curto", "medio"];
  const maximo = niveis.indexOf(nivelParaJanela(perfil.janelaTokens));
  const inicial = await tokensEntradaLocal(base, true);
  const arquivos = escopo === "projeto" ? ARQUIVOS_CONTEXTO_PROJETO : ARQUIVOS_CONTEXTO_MODULO;
  for (let i = maximo; i >= 0; i--) {
    const nivel = niveis[i]!;
    const entrada = `# SEMA_BRIEF ${nivel}\nPerfil: ${perfil.janelaTokens}/${perfil.orcamentoTokens}/${perfil.reservaSaidaTokens}. Consulta opcional; não ler se a sessão já entregou o contexto necessário.\nResumo de navegação; confirme as regras completas no contrato antes de editar.\n`;
    const limpo = resumos[nivel].split(/\r?\n/).filter(l => !/^(ENTRADA_IA|DESIGN_VISUAL|POLITICA_PLATAFORMA|TIMEOUT_SEMA|CODIGO_GOVERNADO|ORCAMENTO_SEMANTICO|PAYLOAD_INLINE):/.test(l)).join("\n");
    const conteudo = entrada + limpo;
    if (inicial + 512 + Math.ceil(conteudo.length / 4) <= perfil.orcamentoTokens) return { caminhoRelativo: arquivos[i]!, conteudo, nivel };
  }
  // Do not generate a misleading partial summary if even the minimum cannot fit.
  return undefined;
}

export async function emitirContextoLimitado(base: string, payload: unknown): Promise<boolean> {
  const perfil = await lerPerfilContexto(base);
  const entrada = await tokensEntradaLocal(base);
  if (!perfil) {
    console.log(JSON.stringify({ sucesso: false, status: "configuracao_necessaria", execucaoAutorizada: false, pergunta: PERGUNTA_CONTEXTO, proximoPasso: "sema sessao com --janela-contexto <tokens> --salvar-perfil" }));
    return false;
  }
  if (entrada + estimarRespostaTokens(payload) > perfil.orcamentoTokens) {
    console.log(JSON.stringify({ sucesso: false, status: "orcamento_insuficiente", execucaoAutorizada: false, tokensEntrada: entrada, limiteTokens: perfil.orcamentoTokens, proximoPasso: "Refine a intenção e --arquivo em sema sessao. Nenhuma leitura bloqueante foi dispensada." }));
    return false;
  }
  console.log(JSON.stringify(payload, null, 2));
  return true;
}

export async function arquivarResumosLegados(base: string): Promise<string[]> {
  const arquivados: string[] = [];
  for (const nome of RESUMOS_LEGADOS) {
    const [origem] = await validarDestinosEscritaWorkspace(base, [nome]);
    if (!origem?.existe) continue;
    const conteudo = await readFile(path.join(base, nome), "utf8");
    // Unrecognized/manual files remain untouched.
    if (!/^(# SEMA_BRIEF|PROJETO:|MODULO:|# Resumo|# SEMA_SMALL_MODEL|# SEMA_CONTEXT|MODO:)/.test(conteudo)) continue;
    const hash = createHash("sha256").update(conteudo).digest("hex").slice(0, 16);
    const destino = `.sema/contexto-legado/${hash}-${nome}`;
    const [, backup] = await validarDestinosEscritaWorkspace(base, [nome, destino]);
    if (!backup?.existe) await escreverArquivoWorkspaceSeguro(base, destino, conteudo, { sobrescrever: false });
    if (await readFile(path.join(base, destino), "utf8") !== conteudo) {
      throw new Error(`Backup modificado: ${destino}. O arquivo original foi preservado.`);
    }
    await validarDestinosEscritaWorkspace(base, [nome, destino]);
    if (await readFile(path.join(base, nome), "utf8") !== conteudo) {
      throw new Error(`Resumo alterado durante a migração: ${nome}. O arquivo foi preservado.`);
    }
    // Copy then unlink: a legacy hardlink must not alias an external file in the backup.
    await unlink(path.join(base, nome));
    arquivados.push(nome);
  }
  return arquivados;
}
