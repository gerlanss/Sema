// SEMA-GOVERNED: sema.produto.cli_sessao
// Descrição: abertura progressiva com perfil explícito, frescor e navegação limitada por orçamento.
import path from "node:path";
import { verificarFrescorArtefatos } from "./index.part04.js";
import { carregarProjeto } from "./projetoCarregar.js";
import { carregarConfiguracaoProjeto } from "./projetoConfig.js";
import { resolverDocumentacaoObrigatoria } from "./docs.js";
import { resolverPerfilContexto, salvarPerfilContexto, estimarRespostaTokens, PERGUNTA_CONTEXTO } from "./contextBudget.js";
import { navegarContextoSessao } from "./sessionContext.js";

function opcao(args: string[], nome: string): string | undefined {
  const i = args.findIndex((arg) => arg === nome || arg.startsWith(`${nome}=`));
  return i < 0 ? undefined : args[i]!.startsWith(`${nome}=`) ? args[i]!.slice(nome.length + 1) : args[i + 1];
}

export async function comandoSessao(posicionais: string[], args: string[], emJson: boolean, cwd = process.cwd()): Promise<number> {
  const emitir = (payload: object, codigo = 0) => {
    if (emJson) console.log(JSON.stringify(payload));
    else {
      const p = payload as { status?: string; proximosPassos?: string[]; contexto?: { candidatos?: Array<{ contrato: string; motivo: string }> } };
      console.log(`Sessão Sema — ${p.status ?? "consulta"}`);
      for (const candidato of p.contexto?.candidatos ?? []) console.log(`  ${candidato.contrato} — ${candidato.motivo}`);
      for (const passo of p.proximosPassos ?? []) console.log(`  → ${passo}`);
    }
    return codigo;
  };
  const intencao = posicionais[0] ?? "";
  if (intencao.length > 2048) return emitir({ comando: "sessao", sucesso: false, status: "intencao_longa", proximosPassos: ["Descreva a intenção em até 2048 caracteres e informe --arquivo para fixar o escopo."] }, 1);
  const entrada = posicionais[1];
  const configuracao = await carregarConfiguracaoProjeto(entrada ? path.resolve(cwd, entrada) : cwd);
  const base = configuracao?.baseDiretorio ?? cwd;
  const perfil = await resolverPerfilContexto(base, args);
  if (!perfil) return emitir({
    comando: "sessao", sucesso: true, status: "configuracao_necessaria", execucaoAutorizada: false,
    proximosPassos: [PERGUNTA_CONTEXTO, 'Repita sema sessao "<intenção>" --janela-contexto <tokens> --salvar-perfil --json. Não infira a janela pelo modelo.'],
  });
  if (args.includes("--salvar-perfil")) await salvarPerfilContexto(base, perfil);
  const projeto = await carregarProjeto(entrada, cwd, { escopo: "projeto", adiarDescobertaCodigo: true });
  const frescor = await verificarFrescorArtefatos(projeto.baseProjeto);
  const pacoteCli = (await import("../package.json", { with: { type: "json" } })).default;
  const arquivo = opcao(args, "--arquivo");
  const contexto = frescor.fresco && intencao.trim() ? await navegarContextoSessao(projeto.baseProjeto, intencao, arquivo) : undefined;
  const contrato = contexto?.candidatos.length === 1 ? contexto.candidatos[0]!.contrato : undefined;
  const docs = contrato ? await resolverDocumentacaoObrigatoria({ baseProjeto: projeto.baseProjeto, intencao, arquivosAlvo: [contrato], criarAusentes: false }) : undefined;
  const alvo = contrato ? JSON.stringify(contrato) : "<contrato>";
  const payload = {
    comando: "sessao", sucesso: true,
    status: !frescor.fresco ? "indice_desatualizado" : contexto?.status ?? "intencao_necessaria",
    execucaoAutorizada: false,
    workspace: { baseProjeto: projeto.baseProjeto, nomePasta: path.basename(projeto.baseProjeto), hashContratos: frescor.hashAtual, cliVersao: pacoteCli.version },
    frescor,
    perfil,
    contexto: contexto ? { ...contexto, candidatosOmitidos: 0 } : undefined,
    intencoes: { intencao, docsBloqueantes: docs?.leituraObrigatoria.map((doc) => doc.relativo) ?? [], leituraPendente: true },
    gates: {
      drift: `sema drift ${alvo} --cache fresh --json`,
      validar: `sema validar ${alvo} --json`,
      verificar: `sema verificar ${alvo} --alvo <alvo> --json`,
      finalizar: `sema finalizar-mudanca --intencao "<intenção>" --arquivo ${alvo} --doc-lida <doc> --json`,
    },
    proximosPassos: !frescor.fresco ? ["Rode sema sync-codex --json e repita a sessão."]
      : contrato ? [`Leia ${contrato}; consulte docs-impacto com esse --arquivo para motivos e dependências. Depois inspecione apenas o código vinculado.`, "Referências do índice são navegação. Confirme regras completas e gates antes de agir."]
      : ["Informe uma intenção específica ou --arquivo <contrato-ou-código> para resolver o escopo. Não edite enquanto houver ambiguidade."],
    orcamento: { metodo: "chars_div_4", tokensEstimadosResposta: 0, limiteTokens: perfil.orcamentoTokens, contagemExata: false, contextoDaConversaMedido: false },
  };
  while (estimarRespostaTokens(payload) > perfil.orcamentoTokens && payload.contexto?.candidatos.length) {
    payload.contexto.candidatos.pop();
    payload.contexto.candidatosOmitidos++;
  }
  if (payload.contexto?.candidatosOmitidos) {
    payload.status = "refinar_escopo";
    payload.proximosPassos = ["Há candidatos omitidos pelo orçamento. Refine a intenção ou informe --arquivo; não interprete omissão como ausência de dependência."];
  }
  for (let i = 0; i < 3; i++) payload.orcamento.tokensEstimadosResposta = estimarRespostaTokens(payload);
  if (payload.orcamento.tokensEstimadosResposta > perfil.orcamentoTokens) return emitir({
    comando: "sessao", sucesso: false, status: "orcamento_insuficiente", execucaoAutorizada: false,
    proximosPassos: ["Metadados e leituras bloqueantes excedem o orçamento. Refine --arquivo ou ajuste --orcamento-contexto; nenhuma leitura foi dispensada."],
  }, 1);
  return emitir(payload);
}
