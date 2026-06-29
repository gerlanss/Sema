// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: codigo governado pelo Sema; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descricao: comandos de profiles semanticos e Author, com gates de score e decis?o de agente.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatarDiagnosticos, temErros, type IrModulo } from "@sema/nucleo";
import { carregarModulos } from "./carregarModulos.js";
import { caminhoExiste } from "./fsGovernado.js";
import { localizarDiretorioExemplosOficiais } from "./exemplosOficiais.js";
import { obterOpcao, possuiFlag } from "./cliArgs.js";
import { limitarLista, resumirListaTexto, unicosOrdenados } from "./textoListas.js";
import type { AcaoAuthorTexto, AchadoClicheAuthor, ConfiancaValidacaoAuthor, DecisaoAgenteProfile, PresetAuthor, ResultadoAuthorBriefing, ResultadoAuthorCliches, ResultadoAuthorIniciar } from "./profileAuthorTipos.js";
import { POLITICAS_AUTHOR_GATE, politicaAuthorAtiva, politicasDinamicasContratoAuthor, politicasProibicoesLiteraisAuthor, extrairTokensContratoAuthor, normalizarTextoAuthor, regexFraseAuthor } from "./authorPoliticas.js";
import { avaliarHeuristicasNarrativasAuthor, calcularScoreAuthor, calcularScoreRiscoAuthor, compararDiffSemanticoAuthor, criarAchadoAuthor, criarAchadoHeuristicoAuthor, extrairGuardrailsAuthor, extrairIrNarrativoAuthor, extrairProibicoesAuthor, montarImpactMapAuthor } from "./authorAnalise.js";
export { comandoProfile, criarPayloadRulePacks, normalizarProfileGovernanca, renderizarRulePacksTexto } from "./profileCommand.js";

export async function iniciarProfileAuthor(
  destinoOpcional: string | undefined,
  temaSensivel: boolean,
  cwd = process.cwd(),
): Promise<ResultadoAuthorIniciar> {
  const exemplos = await localizarDiretorioExemplosOficiais();
  const nomeTemplate = temaSensivel ? "author_tema_sensivel.sema" : "author_obra_comum.sema";
  const destino = path.resolve(cwd, destinoOpcional ?? path.join("contratos", "author.sema"));

  if (!exemplos) {
    return {
      comando: "author iniciar",
      sucesso: false,
      destino,
      template: null,
      temaSensivel,
      erro: "Diretorio de exemplos oficiais nao foi encontrado no pacote da CLI.",
    };
  }

  const template = path.join(exemplos, nomeTemplate);
  if (!(await caminhoExiste(template))) {
    return {
      comando: "author iniciar",
      sucesso: false,
      destino,
      template,
      temaSensivel,
      erro: `Template oficial ${nomeTemplate} nao foi encontrado.`,
    };
  }

  if (await caminhoExiste(destino)) {
    return {
      comando: "author iniciar",
      sucesso: false,
      destino,
      template,
      temaSensivel,
      erro: `Arquivo ja existe: ${destino}`,
    };
  }

  const moduloDestino = temaSensivel ? "author.tema_sensivel" : "author.obra_comum";
  const conteudo = (await readFile(template, "utf8"))
    .replace(/^module exemplos\.author\.(obra_comum|tema_sensivel) \{/m, `module ${moduloDestino} {`);

  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, conteudo, "utf8");

  return {
    comando: "author iniciar",
    sucesso: true,
    destino,
    template,
    temaSensivel,
  };
}

async function validarProfileAuthor(entrada: string | undefined, emJson: boolean): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const resultados = modulos.map((item) => ({
    caminho: item.caminho,
    modulo: item.resultado.modulo?.nome ?? null,
    sucesso: !temErros(item.resultado.diagnosticos),
    diagnosticos: item.resultado.diagnosticos,
  }));
  const payload = {
    comando: "author validar",
    sucesso: resultados.every((resultado) => resultado.sucesso),
    resultados,
  };

  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return payload.sucesso ? 0 : 1;
  }

  console.log(formatarDiagnosticos(modulos.flatMap((item) => item.resultado.diagnosticos)));
  return payload.sucesso ? 0 : 1;
}

export async function criarAuthorBriefing(entrada: string | undefined, preset: PresetAuthor | null = null): Promise<ResultadoAuthorBriefing> {
  if (!entrada) {
    throw new Error("Uso: sema author briefing <arquivo-ou-pasta> [--preset conto|romance|roteiro|lore|campanha] [--json]");
  }

  const modulos = await carregarModulos(entrada);
  const escolhido = modulos.find((item) => /author/i.test(item.resultado.modulo?.nome ?? item.caminho)) ?? modulos[0];
  if (!escolhido) {
    throw new Error(`Nenhum modulo Sema encontrado para ${entrada}.`);
  }

  const conteudo = await readFile(escolhido.caminho, "utf8");
  const ir = escolhido.resultado.ir ?? null;
  const tasks = ir?.tasks.map((task) => task.nome) ?? [];
  const flows = ir?.flows.map((flow) => flow.nome) ?? [];
  const guardrails = extrairGuardrailsAuthor(conteudo, ir);
  const proibicoes = extrairProibicoesAuthor(ir, conteudo);
  const coreDetectado = /AuthorCore|author core|declarar_author_core|core:/i.test(conteudo);
  const agentsDetectados = /AgentAuthor|AuthorAgent|agents_author|sensitivity_reviewer|revisor_cliche|guardiao/i.test(conteudo);
  const flowDetectado = flows.length > 0 || /flow\s+author/i.test(conteudo);

  return {
    comando: "author briefing",
    sucesso: !temErros(escolhido.resultado.diagnosticos),
    arquivo: escolhido.caminho,
    modulo: escolhido.resultado.modulo?.nome ?? null,
    profile: "author",
    preset,
    presetsDisponiveis: PRESETS_AUTHOR,
    coreDetectado,
    agentsDetectados,
    flowDetectado,
    tasks,
    flows,
    guardrails,
    proibicoes,
    checks: [
      ...checksPresetAuthor(preset).map((check) => `preset ${preset}: ${check}`),
      "sema author validar <arquivo> --json",
      "sema author revisar-cliches <arquivo> --texto <texto> --json",
      "sema author validar-narrativa <arquivo> --texto <texto> --json",
      "sema author validar-proibicoes <arquivo> --texto <texto> --json",
      "sema validar <arquivo> --json",
      "sema drift <arquivo> --json",
    ],
    diagnosticos: escolhido.resultado.diagnosticos,
  };
}

export async function revisarClichesAuthor(
  entrada: string | undefined,
  textoOpcional: string | undefined,
  textoArquivoOpcional: string | undefined,
  textoAnteriorOpcional: string | undefined,
  textoAnteriorArquivoOpcional: string | undefined,
  acao: AcaoAuthorTexto = "revisar-cliches",
  preset: PresetAuthor | null = null,
): Promise<ResultadoAuthorCliches> {
  if (!entrada) {
    throw new Error(`Uso: sema author ${acao} <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--texto-anterior <texto>|--texto-anterior-arquivo <arquivo>] [--json]`);
  }

  const modulos = await carregarModulos(entrada);
  const escolhido = modulos.find((item) => /author/i.test(item.resultado.modulo?.nome ?? item.caminho)) ?? modulos[0];
  if (!escolhido) {
    throw new Error(`Nenhum modulo Sema encontrado para ${entrada}.`);
  }

  const conteudoContrato = await readFile(escolhido.caminho, "utf8");
  const textoFonte = textoArquivoOpcional
    ? await readFile(path.resolve(textoArquivoOpcional), "utf8")
    : textoOpcional ?? conteudoContrato;
  const textoAnterior = textoAnteriorArquivoOpcional
    ? await readFile(path.resolve(textoAnteriorArquivoOpcional), "utf8")
    : textoAnteriorOpcional ?? null;
  const tokensContrato = extrairTokensContratoAuthor(conteudoContrato);
  const politicasAplicadasCatalogo = POLITICAS_AUTHOR_GATE
    .filter((politica) => politicaAuthorAtiva(politica, tokensContrato));
  const politicasDinamicas = politicasDinamicasContratoAuthor(tokensContrato);
  const politicasProibicoes = politicasProibicoesLiteraisAuthor(conteudoContrato, escolhido.resultado.ir ?? null);
  const achadosCatalogo = politicasAplicadasCatalogo
    .map((politica) => criarAchadoAuthor(politica, textoFonte, "catalogo"))
    .filter((achado): achado is AchadoClicheAuthor => achado !== null);
  const achadosDinamicos = politicasDinamicas
    .map((politica) => criarAchadoAuthor(politica, textoFonte, "contrato"))
    .filter((achado): achado is AchadoClicheAuthor => achado !== null);
  const achadosProibicoes = politicasProibicoes
    .map((politica) => criarAchadoAuthor(politica, textoFonte, "contrato"))
    .filter((achado): achado is AchadoClicheAuthor => achado !== null);
  const achadosHeuristicos = avaliarHeuristicasNarrativasAuthor(textoFonte, conteudoContrato, tokensContrato);
  const achadosPreset = avaliarPresetAuthor(preset, textoFonte);
  const achados = acao === "validar-proibicoes"
    ? achadosProibicoes
    : [
      ...achadosCatalogo,
      ...achadosDinamicos,
      ...achadosProibicoes,
      ...achadosHeuristicos,
      ...achadosPreset,
    ];
  const bloqueios = achados
    .filter((achado) => achado.bloqueante)
    .map((achado) => achado.id);
  const contratoValido = !temErros(escolhido.resultado.diagnosticos);
  const scoreCoerenciaTonal = calcularScoreAuthor(achados, ["tom", "voz", "palavra_generica", "frase_generica"]);
  const scoreDriftNarrativo = calcularScoreAuthor(achados, [
    "arco_emocional",
    "campanha_persistente",
    "impact_map",
    "memoria_personagem",
    "promessa_narrativa",
    "proibicao_literal",
    "tema_sensivel",
  ]);
  const scoreContratoFormal = contratoValido ? 100 : 0;
  const scoreContratoBase = contratoValido ? calcularScoreAuthor(achados) : 0;
  const scoreRisco = calcularScoreRiscoAuthor(achados, contratoValido);
  const confiancaValidacao: ConfiancaValidacaoAuthor = textoFonte.trim().length === 0
    ? "baixa"
    : acao === "validar-narrativa" || acao === "validar-proibicoes" || politicasProibicoes.length > 0
      ? "alta"
      : "parcial";
  const scoreAderenciaSemantica = confiancaValidacao === "parcial"
    ? Math.min(scoreContratoBase, 85)
    : scoreContratoBase;
  const scoreContrato = Math.min(scoreContratoFormal, scoreAderenciaSemantica);
  const aprovado = contratoValido
    && bloqueios.length === 0
    && scoreCoerenciaTonal >= 80
    && scoreDriftNarrativo >= 80
    && scoreAderenciaSemantica >= 80
    && scoreRisco < 40;
  const prontoParaAcao = aprovado && confiancaValidacao !== "baixa";
  const guardrailsDeclarados = extrairGuardrailsAuthor(conteudoContrato, escolhido.resultado.ir ?? null);
  const irNarrativo = extrairIrNarrativoAuthor(textoFonte);
  const diffSemantico = compararDiffSemanticoAuthor(textoAnterior, textoFonte);
  const impactMap = montarImpactMapAuthor(achados);
  const diagnosticoLocalizado = achados.filter((achado) => achado.bloqueante);
  const trechosBloqueantes = diagnosticoLocalizado.flatMap((achado) => achado.trechos);
  const violacoesProibicoes = achados.filter((achado) => achado.categoria === "proibicao_literal");
  const decisaoAgente: DecisaoAgenteProfile = !contratoValido
    ? "parar"
    : diagnosticoLocalizado.some((achado) => achado.severidadePadrao === "critical")
      ? "chamar_humano"
      : bloqueios.length > 0
        ? "parar"
        : confiancaValidacao === "parcial"
          ? "continuar_com_ressalva"
          : "continuar";
  const podeContinuar = decisaoAgente === "continuar" || decisaoAgente === "continuar_com_ressalva";

  return {
    comando: acao === "revisar-cliches"
      ? "author revisar-cliches"
      : acao === "validar-narrativa"
        ? "author validar-narrativa"
        : "author validar-proibicoes",
    sucesso: aprovado,
    contratoValido,
    arquivo: escolhido.caminho,
    textoFonte: textoArquivoOpcional ? path.resolve(textoArquivoOpcional) : "inline",
    maturidade: "production",
    preset,
    presetsDisponiveis: PRESETS_AUTHOR,
    aprovado,
    bloqueado: !aprovado,
    podeContinuar,
    decisaoAgente,
    scoreCoerenciaTonal,
    scoreDriftNarrativo,
    scoreContrato,
    scoreContratoFormal,
    scoreAderenciaSemantica,
    scoreRisco,
    prontoParaAcao,
    confiancaValidacao,
    achados,
    bloqueios,
    diagnosticoLocalizado,
    trechosBloqueantes,
    violacoesProibicoes,
    modoSaidaAgente: "cirurgico",
    politicasAplicadas: unicosOrdenados([
      ...politicasAplicadasCatalogo.map((politica) => politica.id),
      ...politicasDinamicas.map((politica) => politica.id),
      ...politicasProibicoes.map((politica) => politica.id),
      ...achadosHeuristicos.map((achado) => achado.id),
      ...achadosPreset.map((achado) => achado.id),
    ]),
    guardrailsDeclarados,
    irNarrativo,
    impactMap,
    diffSemantico,
    recomendacoes: achados.length === 0
      ? ["Contrato respeitado: nenhum bloqueio narrativo detectado. Ainda revise tensao, voz e consequencia da cena."]
      : unicosOrdenados(achados.map((achado) => achado.sugestao)),
    diagnosticos: escolhido.resultado.diagnosticos,
  };
}

function renderizarAuthorBriefingTexto(resultado: ResultadoAuthorBriefing): string {
  return [
    "AUTHOR_BRIEFING",
    `ARQUIVO: ${resultado.arquivo}`,
    `MODULO: ${resultado.modulo ?? "desconhecido"}`,
    `PRESET: ${resultado.preset ?? "nenhum"}`,
    `CORE: ${resultado.coreDetectado ? "ok" : "ausente"}`,
    `AGENTS: ${resultado.agentsDetectados ? "ok" : "ausente"}`,
    `FLOW: ${resultado.flowDetectado ? "ok" : "ausente"}`,
    `TASKS: ${resumirListaTexto(resultado.tasks, 8)}`,
    `FLOWS: ${resumirListaTexto(resultado.flows, 8)}`,
    `PROIBICOES: ${resumirListaTexto(resultado.proibicoes, 8)}`,
    `CHECKS: ${resumirListaTexto(resultado.checks, 4)}`,
  ].join("\n");
}

function renderizarAuthorClichesTexto(resultado: ResultadoAuthorCliches): string {
  const linhas = [
    resultado.comando === "author revisar-cliches" ? "AUTHOR_CLICHES" : resultado.comando.toUpperCase().replace(/[\s-]+/g, "_"),
    `ARQUIVO: ${resultado.arquivo}`,
    `TEXTO: ${resultado.textoFonte}`,
    `PRESET: ${resultado.preset ?? "nenhum"}`,
    `APROVADO: ${resultado.aprovado ? "sim" : "nao"}`,
    `BLOQUEADO: ${resultado.bloqueado ? "sim" : "nao"}`,
    `DECISAO_AGENTE: ${resultado.decisaoAgente}`,
    `SCORE_TOM: ${resultado.scoreCoerenciaTonal}`,
    `SCORE_DRIFT: ${resultado.scoreDriftNarrativo}`,
    `SCORE_CONTRATO: ${resultado.scoreContrato}`,
    `SCORE_CONTRATO_FORMAL: ${resultado.scoreContratoFormal}`,
    `SCORE_ADERENCIA_SEMANTICA: ${resultado.scoreAderenciaSemantica}`,
    `SCORE_RISCO: ${resultado.scoreRisco}`,
    `PRONTO_PARA_ACAO: ${resultado.prontoParaAcao ? "sim" : "nao"}`,
    `CONFIANCA_VALIDACAO: ${resultado.confiancaValidacao}`,
    `ACHADOS: ${resultado.achados.length}`,
    `VIOLACOES_PROIBICOES: ${resultado.violacoesProibicoes.length}`,
  ];
  for (const achado of resultado.achados) {
    linhas.push(`- ${achado.id} (${achado.categoria}, ${achado.severidade}, ${achado.ocorrencias} ocorrencia(s)): ${achado.motivo}`);
    const primeiroTrecho = achado.trechos[0];
    if (primeiroTrecho) {
      linhas.push(`  trecho ${primeiroTrecho.linha}:${primeiroTrecho.coluna}: ${primeiroTrecho.texto}`);
    }
    linhas.push(`  sugestao: ${achado.sugestaoReescrita}`);
  }
  if (resultado.achados.length === 0) {
    linhas.push("- nenhum bloqueio narrativo detectado");
  }
  return linhas.join("\n");
}

function normalizarSubcomandoAuthor(subcomando?: string): string | undefined {
  return subcomando?.replace(/_/g, "-");
}

const PRESETS_AUTHOR: PresetAuthor[] = ["conto", "romance", "roteiro", "lore", "campanha"];

function normalizarPresetAuthor(valor: string | undefined): PresetAuthor | null {
  if (!valor) return null;
  const chave = valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const alias: Record<string, PresetAuthor> = {
    short_story: "conto",
    novela: "romance",
    script: "roteiro",
    screenplay: "roteiro",
    worldbuilding: "lore",
    mundo: "lore",
    campanha_persistente: "campanha",
  };
  const preset = alias[chave] ?? (chave as PresetAuthor);
  return PRESETS_AUTHOR.includes(preset) ? preset : null;
}

function checksPresetAuthor(preset: PresetAuthor | null): string[] {
  if (!preset) return [];
  const mapa: Record<PresetAuthor, string[]> = {
    conto: ["conflito concreto", "virada", "fechamento com consequencia"],
    romance: ["arco de personagem", "continuidade entre capitulos", "promessa narrativa"],
    roteiro: ["cenas", "dialogo", "acao visual", "estrutura de ato"],
    lore: ["canon", "mundo", "linha do tempo", "restricao de continuidade"],
    campanha: ["memoria persistente", "estado de personagens", "eventos irreversiveis", "drift entre sessoes"],
  };
  return mapa[preset];
}

function avaliarPresetAuthor(preset: PresetAuthor | null, textoFonte: string): AchadoClicheAuthor[] {
  if (!preset) return [];
  const checks: Record<PresetAuthor, Array<{ id: string; regex: RegExp; sugestao: string }>> = {
    conto: [
      { id: "author_conto_sem_conflito", regex: /conflito|quer|precisa|perde|arrisca|custo/i, sugestao: "conto precisa de desejo, custo e conflito visiveis." },
      { id: "author_conto_sem_fechamento", regex: /fim|final|consequencia|consequÃªncia|mudou|perdeu|ganhou/i, sugestao: "feche o conto com mudanca ou consequencia, nao so atmosfera." },
    ],
    romance: [
      { id: "author_romance_sem_arco", regex: /arco|capitulo|capÃ­tulo|continuidade|promessa|personagem/i, sugestao: "romance precisa preservar arco, promessa e continuidade entre capitulos." },
    ],
    roteiro: [
      { id: "author_roteiro_sem_cena", regex: /cena|ato|dialogo|diÃ¡logo|acao visual|aÃ§Ã£o visual|int\.|ext\./i, sugestao: "roteiro precisa de cena, acao visual e/ou dialogo estruturado." },
    ],
    lore: [
      { id: "author_lore_sem_canon", regex: /canon|linha do tempo|mundo|facÃ§Ã£o|faccao|regra do mundo|continuidade/i, sugestao: "lore precisa de canon, mundo e restricoes de continuidade." },
    ],
    campanha: [
      { id: "author_campanha_sem_estado", regex: /estado|memoria|memÃ³ria|sessao|sessÃ£o|evento irreversivel|evento irreversÃ­vel|personagem/i, sugestao: "campanha precisa guardar estado, memoria e eventos irreversiveis." },
    ],
  };
  return checks[preset].flatMap((check) => {
    if (check.regex.test(textoFonte)) return [];
    const achado = criarAchadoHeuristicoAuthor(
      check.id,
      "preset_author",
      "media",
      1,
      check.sugestao,
      [],
      textoFonte,
      check.sugestao,
      check.sugestao,
    );
    return achado ? [achado] : [];
  });
}

export async function comandoAuthor(posicionais: string[], args: string[], emJson: boolean): Promise<number> {
  const subcomandoOriginal = posicionais[0];
  const subcomando = normalizarSubcomandoAuthor(subcomandoOriginal);
  if (!subcomando || subcomando === "help" || subcomando === "ajuda") {
    console.log([
      "Uso: sema author <iniciar|validar|briefing|revisar-cliches|validar-narrativa|validar-proibicoes>",
      "",
      "Comandos:",
      "  sema author iniciar [--tema-sensivel] [--saida contratos/author.sema] [--json]",
      "  sema author validar <arquivo-ou-pasta> [--json]",
      "  sema author briefing <arquivo-ou-pasta> [--preset conto|romance|roteiro|lore|campanha] [--json]",
      "  sema author revisar-cliches <arquivo.sema> [--preset conto|romance|roteiro|lore|campanha] [--texto <texto>|--texto-arquivo <arquivo>] [--texto-anterior <texto>|--texto-anterior-arquivo <arquivo>] [--json]",
      "  sema author validar-narrativa <arquivo.sema> [--preset conto|romance|roteiro|lore|campanha] [--texto <texto>|--texto-arquivo <arquivo>] [--json]",
      "  sema author validar-proibicoes <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--json]",
      "",
      "Aliases aceitos: revisar_cliches, validar_narrativa e validar_proibicoes.",
    ].join("\n"));
    return subcomando ? 0 : 1;
  }

  if (subcomando === "iniciar") {
    const resultado = await iniciarProfileAuthor(obterOpcao(args, "--saida"), possuiFlag(args, "--tema-sensivel"));
    if (emJson) {
      console.log(JSON.stringify(resultado, null, 2));
    } else if (resultado.sucesso) {
      console.log(`Profile Author criado em ${resultado.destino}`);
    } else {
      console.error(resultado.erro ?? "Falha ao iniciar profile Author.");
    }
    return resultado.sucesso ? 0 : 1;
  }

  const entrada = posicionais[1] ?? obterOpcao(args, "--arquivo");
  const presetAuthor = normalizarPresetAuthor(obterOpcao(args, "--preset"));
  if (obterOpcao(args, "--preset") && !presetAuthor) {
    console.error(`Preset Author invalido. Use: ${PRESETS_AUTHOR.join(", ")}.`);
    return 1;
  }
  if (subcomando === "validar") {
    return validarProfileAuthor(entrada, emJson);
  }

  if (subcomando === "briefing") {
    const resultado = await criarAuthorBriefing(entrada, presetAuthor);
    if (emJson) {
      console.log(JSON.stringify(resultado, null, 2));
    } else {
      console.log(renderizarAuthorBriefingTexto(resultado));
    }
    return resultado.sucesso ? 0 : 1;
  }

  if (subcomando === "revisar-cliches" || subcomando === "validar-narrativa" || subcomando === "validar-proibicoes") {
    const resultado = await revisarClichesAuthor(
      entrada,
      obterOpcao(args, "--texto"),
      obterOpcao(args, "--texto-arquivo"),
      obterOpcao(args, "--texto-anterior"),
      obterOpcao(args, "--texto-anterior-arquivo"),
      subcomando,
      presetAuthor,
    );
    if (emJson) {
      console.log(JSON.stringify(resultado, null, 2));
    } else {
      console.log(renderizarAuthorClichesTexto(resultado));
    }
    return resultado.sucesso ? 0 : 1;
  }

  console.error(`Subcomando author desconhecido: ${subcomandoOriginal}`);
  return 1;
}
