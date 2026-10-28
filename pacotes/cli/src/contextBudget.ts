// SEMA-GOVERNED: sema.produto.cli_sessao
// Descrição: perfil local explícito e orçamento estimado de contexto, sem inferir capacidade pelo modelo.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { escreverArquivoWorkspaceSeguro, validarDestinosEscritaWorkspace } from "./workspaceWrite.js";

export const ARQUIVO_PERFIL_CONTEXTO = ".sema/contexto-ia.json";
export const OPCOES_CONTEXTO = ["--janela-contexto", "--orcamento-contexto", "--reserva-saida"] as const;
export const PERGUNTA_CONTEXTO = "Qual é a janela de contexto efetivamente configurada para esta IA, em tokens?";
export interface PerfilContexto {
  schema: "sema.agent-context-profile/v1";
  janelaTokens: number;
  orcamentoTokens: number;
  reservaSaidaTokens: number;
}

export function criarPerfilContexto(janela: number, orcamento?: number, reserva?: number): PerfilContexto {
  const perfil: PerfilContexto = {
    schema: "sema.agent-context-profile/v1",
    janelaTokens: janela,
    orcamentoTokens: orcamento ?? Math.min(4096, Math.floor(janela / 8)),
    reservaSaidaTokens: reserva ?? Math.min(4096, Math.floor(janela / 4)),
  };
  if (![perfil.janelaTokens, perfil.orcamentoTokens, perfil.reservaSaidaTokens].every(Number.isSafeInteger)
    || janela < 4096 || perfil.orcamentoTokens < 512 || perfil.reservaSaidaTokens < 256
    || perfil.orcamentoTokens + perfil.reservaSaidaTokens > janela - 1024) {
    throw new Error("Perfil inválido: janela >= 4096, orçamento >= 512, reserva >= 256 e pelo menos 1024 tokens livres para instruções e conversa.");
  }
  return perfil;
}

export function numeroOpcaoContexto(args: readonly string[], nome: string): number | undefined {
  const indice = args.findIndex((arg) => arg === nome || arg.startsWith(`${nome}=`));
  if (indice < 0) return undefined;
  const raw = args[indice]!.startsWith(`${nome}=`) ? args[indice]!.slice(nome.length + 1) : args[indice + 1];
  if (!raw || !/^[1-9]\d*$/u.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`${nome} exige um inteiro positivo em tokens.`);
  }
  return Number(raw);
}

export async function lerPerfilContexto(base: string): Promise<PerfilContexto | undefined> {
  const [destino] = await validarDestinosEscritaWorkspace(base, [ARQUIVO_PERFIL_CONTEXTO]);
  if (!destino?.existe) return undefined;
  const perfil = JSON.parse(await readFile(path.join(base, ARQUIVO_PERFIL_CONTEXTO), "utf8"));
  if (perfil.schema !== "sema.agent-context-profile/v1") throw new Error("Schema do perfil de contexto inválido.");
  return criarPerfilContexto(perfil.janelaTokens, perfil.orcamentoTokens, perfil.reservaSaidaTokens);
}

export async function resolverPerfilContexto(base: string, args: readonly string[]): Promise<PerfilContexto | undefined> {
  const janela = numeroOpcaoContexto(args, "--janela-contexto");
  const orcamento = numeroOpcaoContexto(args, "--orcamento-contexto");
  const reserva = numeroOpcaoContexto(args, "--reserva-saida");
  const salvo = await lerPerfilContexto(base);
  if (janela !== undefined) return criarPerfilContexto(janela, orcamento, reserva);
  if (!salvo) {
    if (orcamento !== undefined || reserva !== undefined) throw new Error("Informe --janela-contexto antes de ajustar o orçamento.");
    return undefined;
  }
  return criarPerfilContexto(salvo.janelaTokens, orcamento ?? salvo.orcamentoTokens, reserva ?? salvo.reservaSaidaTokens);
}

export async function salvarPerfilContexto(base: string, perfil: PerfilContexto): Promise<void> {
  await escreverArquivoWorkspaceSeguro(base, ARQUIVO_PERFIL_CONTEXTO, `${JSON.stringify(perfil, null, 2)}\n`, { sobrescrever: true });
}

// Reserva conservadora para o envelope público e a indentação que o adaptador acrescenta.
export function estimarRespostaTokens(payload: unknown): number {
  const envelope = { schemaVersion: "sema.cli.result/v1", ok: true, kind: "SUCCESS", command: "sessao", code: "CLI_SUCCESS", message: null, exitCode: 0, payload };
  return Math.ceil((JSON.stringify(envelope, null, 2).length + 256) / 4);
}
