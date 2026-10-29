// SEMA-GOVERNED: sema.produto.cli_sessao
// Descrição: abertura progressiva com perfil explícito, frescor e navegação limitada por orçamento.
import { tokensEntradaLocal } from "./contextDelivery.js";
import path from "node:path";
import { verificarFrescorArtefatos } from "./index.part04.js";
import { carregarProjeto } from "./projetoCarregar.js";
import { carregarConfiguracaoProjeto } from "./projetoConfig.js";
import { resolverDocumentacaoObrigatoria } from "./docs.js";
import { resolverPerfilContexto, salvarPerfilContexto, estimarRespostaTokens, PERGUNTA_CONTEXTO } from "./contextBudget.js";
import { navegarContextoSessao } from "./sessionContext.js";
import { carregarMudanca, normalizarEscopo, proximasChamadas } from "./changeScope.js";
import { consultarContratosAtuais } from "./sessionContractState.js";

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
  const mudancaId = opcao(args, "--mudanca-id");
  if (mudancaId) {
    try {
      const mudanca = await carregarMudanca(base, mudancaId);
      if (intencao && intencao !== mudanca.intencao) return emitir({ sucesso: false, status: "escopo_divergente", proximosPassos: ["Retome o id sem trocar a intenção; abra docs-impacto para uma mudança distinta."] }, 1);
      const arquivoSolicitado = opcao(args, "--arquivo");
      if (arquivoSolicitado && !mudanca.arquivosAlvo.includes(normalizarEscopo(base, [arquivoSolicitado])[0]!)) return emitir({ sucesso: false, status: "escopo_divergente", proximosPassos: ["O id já fixa os arquivos da mudança."] }, 1);
      const frescor = await verificarFrescorArtefatos(base);
      const estadoInicial = await consultarContratosAtuais(base, mudanca.arquivosAlvo);
      const docs = estadoInicial.valido === false ? undefined : await resolverDocumentacaoObrigatoria({ baseProjeto: base, intencao: mudanca.intencao, arquivosAlvo: mudanca.arquivosAlvo });
      const estadoAtual = docs ? await consultarContratosAtuais(base, [...mudanca.arquivosAlvo,
        ...docs.leituraObrigatoria.filter((d) => d.tipo === "contrato").map((d) => d.relativo)]) : estadoInicial;
      const sucesso = Boolean(docs?.sucesso) && frescor.fresco && estadoAtual.valido !== false;
      const contratos = estadoAtual.contratos.map((c) => c.arquivo);
      const retomada = {
        comando: "sessao", sucesso, status: estadoAtual.valido === false ? "contrato_invalido" : !frescor.fresco ? "indice_desatualizado" : "mudanca_retomada", execucaoAutorizada: false,
        mudancaId, intencao: mudanca.intencao, arquivosAlvo: mudanca.arquivosAlvo, perfil, frescor,
        estadoAtual,
        gates: contratos.map((arquivo) => ({ arquivo, validar: ["validar", arquivo, "--json"], drift: ["drift", arquivo, "--cache", "fresh", "--pacote", "--json"] })),
        documentacao: docs ? "escopo_resolvido" : "nao_avaliada_por_contrato_invalido",
        leiturasObrigatorias: docs?.leituraObrigatoria.map((d) => ({ arquivo: d.relativo, motivo: d.motivo })),
        proximasChamadas: docs ? proximasChamadas(mudanca, docs.leituraObrigatoria.map((d) => d.relativo)) : { retomar: ["sessao", "--mudanca-id", mudanca.id, "--json"] },
        proximosPassos: [estadoAtual.valido === false
          ? "Execute validar nos contratos indicados e corrija os erros atuais antes de editar código ou interpretar contagens parciais."
          : frescor.fresco ? "Retome o mesmo escopo. Reavalie documentos alterados; declaração de leitura não comprova comportamento."
          : "Rode sema sync-codex --json e retome este mesmo id; releia SEMA_BOOT.md após a sincronização.",
          "Use estadoAtual recompilado como referência; resumos da conversa não comprovam validação, drift ou comportamento. impl/vinculos pertencem ao contrato .sema. Execute os gates retornados e consuma o JSON completo."],
      };
      if (await tokensEntradaLocal(base) + estimarRespostaTokens(retomada) > perfil.orcamentoTokens) return emitir({ sucesso: false, status: "orcamento_insuficiente", proximosPassos: ["O escopo preservado excede o orçamento; ajuste --orcamento-contexto sem omitir dependências."] }, 1);
      return emitir(retomada, sucesso ? 0 : 1);
    } catch (erro) { return emitir({ sucesso: false, status: "mudanca_invalida", proximosPassos: [(erro as Error).message] }, 1); }
  }
  const projeto = await carregarProjeto(entrada, cwd, { escopo: "projeto", adiarDescobertaCodigo: true });
  const frescor = await verificarFrescorArtefatos(projeto.baseProjeto);
  const pacoteCli = (await import("../package.json", { with: { type: "json" } })).default;
  const arquivo = opcao(args, "--arquivo");
  const contexto = frescor.fresco && intencao.trim() ? await navegarContextoSessao(projeto.baseProjeto, intencao, arquivo) : undefined;
  const contrato = contexto?.candidatos.length === 1 ? contexto.candidatos[0]!.contrato : undefined;
  const docs = contrato ? await resolverDocumentacaoObrigatoria({ baseProjeto: projeto.baseProjeto, intencao, arquivosAlvo: [contrato], criarAusentes: false }) : undefined;
  const alvo = contrato ? JSON.stringify(contrato) : "<contrato>";
  const tokensEntrada = await tokensEntradaLocal(base);
  const payload = {
    comando: "sessao", sucesso: frescor.fresco,
    status: !frescor.fresco ? "indice_desatualizado" : contexto?.status ?? "intencao_necessaria",
    execucaoAutorizada: false,
    workspace: { baseProjeto: projeto.baseProjeto, nomePasta: path.basename(projeto.baseProjeto), hashContratos: frescor.hashAtual, cliVersao: pacoteCli.version },
    frescor,
    perfil,
    contexto: contexto ? { ...contexto, candidatosOmitidos: 0 } : undefined,
    intencoes: { intencao, docsBloqueantes: docs?.leituraObrigatoria.map((doc) => doc.relativo) ?? [], leituraPendente: true },
    gates: {
      drift: `sema drift ${alvo} --cache fresh --pacote --json`,
      validar: `sema validar ${alvo} --json`,
      verificar: `sema verificar ${alvo} --alvo <alvo> --json`,
      finalizar: `sema finalizar-mudanca --intencao "<intenção>" --arquivo ${alvo} --doc-lida <doc> --json`,
    },
    proximosPassos: !frescor.fresco ? [frescor.sugestao, "Repita a sessão após a sincronização; não carregue o índice bruto."]
      : contexto?.status === "contrato_necessario" ? ["Projeto adotado sem contratos ativos. Modele em contratos/ o comportamento solicitado pelo usuário e valide antes de implementar. Exemplos em exemplos/ são referências de sintaxe, não funcionalidades do projeto."]
      : contrato ? [`Leia ${contrato}; consulte docs-impacto com esse --arquivo para motivos e dependências. Depois inspecione apenas o código vinculado.`, "Referências do índice são navegação. Confirme regras completas e gates antes de agir."]
      : ["Informe uma intenção específica ou --arquivo <contrato-ou-código> para resolver o escopo. Não edite enquanto houver ambiguidade."],
    orcamento: { metodo: "chars_div_4", tokensEstimadosResposta: 0, tokensEntrada, tokensEstimadosTotal: 0, limiteTokens: perfil.orcamentoTokens, contagemExata: false, contextoDaConversaMedido: false },
  };
  while (tokensEntrada + estimarRespostaTokens(payload) > perfil.orcamentoTokens && payload.contexto?.candidatos.length) {
    payload.contexto.candidatos.pop();
    payload.contexto.candidatosOmitidos++;
  }
  if (payload.contexto?.candidatosOmitidos) {
    payload.status = "refinar_escopo";
    payload.proximosPassos = ["Há candidatos omitidos pelo orçamento. Refine a intenção ou informe --arquivo; não interprete omissão como ausência de dependência."];
  }
  for (let i = 0; i < 3; i++) {
    payload.orcamento.tokensEstimadosResposta = estimarRespostaTokens(payload);
    payload.orcamento.tokensEstimadosTotal = tokensEntrada + payload.orcamento.tokensEstimadosResposta;
  }
  if (payload.orcamento.tokensEstimadosTotal > perfil.orcamentoTokens) return emitir({
    comando: "sessao", sucesso: false, status: "orcamento_insuficiente", execucaoAutorizada: false,
    proximosPassos: ["Instruções locais, metadados e leituras bloqueantes excedem o orçamento. Refine --arquivo ou ajuste --orcamento-contexto; nenhuma leitura foi dispensada."],
  }, 1);
  return emitir(payload, frescor.fresco ? 0 : 1);
}
