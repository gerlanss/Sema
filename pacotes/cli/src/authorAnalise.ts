// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: an?lise Author de clich?s, heur?sticas, scores, IR narrativo e impact map.

import type { IrModulo } from "@sema/nucleo";
import { limitarLista, unicosOrdenados } from "./textoListas.js";
import type { PoliticaAuthorGate } from "./authorPoliticas.js";
import {
  contarOcorrencias,
  criarTrechoContextualAuthor,
  localizarTrechosPorEvidenciasAuthor,
  localizarTrechosRegexAuthor,
  normalizarTextoAuthor,
  politicasProibicoesLiteraisAuthor,
  regexFraseAuthor,
  riscoAuthorPorSeveridade,
  severidadeAuthorPadrao,
  slugParaTextoAuthor,
} from "./authorPoliticas.js";
import type {
  AchadoClicheAuthor,
  DiffSemanticoAuthor,
  ImpactoNarrativoAuthor,
  IrNarrativoAuthor,
  SeveridadeAuthor,
} from "./profileAuthorTipos.js";

export function criarAchadoAuthor(
  politica: PoliticaAuthorGate,
  textoFonte: string,
  origem: AchadoClicheAuthor["origem"],
): AchadoClicheAuthor | null {
  const trechos = localizarTrechosRegexAuthor(politica.regex, textoFonte, politica.motivo, politica.sugestaoReescrita);
  const ocorrencias = contarOcorrencias(politica.regex, textoFonte);
  if (ocorrencias <= 0) {
    return null;
  }
  return {
    id: politica.id,
    categoria: politica.categoria,
    severidade: politica.severidade,
    severidadePadrao: severidadeAuthorPadrao(politica.severidade, politica.categoria),
    ocorrencias,
    risco: riscoAuthorPorSeveridade(politica.severidade),
    motivo: politica.motivo,
    sugestao: politica.sugestao,
    sugestaoReescrita: politica.sugestaoReescrita,
    origem,
    bloqueante: politica.severidade === "alta" || politica.categoria !== "observacao",
    trechos,
    evidencias: trechos.map((trecho) => trecho.texto),
  };
}

export function contarPalavrasAuthor(textoNormalizado: string, palavras: string[]): number {
  return palavras.reduce((total, palavra) => {
    const regex = new RegExp(`\\b${palavra}\\b`, "g");
    return total + Array.from(textoNormalizado.matchAll(regex)).length;
  }, 0);
}

export function criarAchadoHeuristicoAuthor(
  id: string,
  categoria: string,
  severidade: SeveridadeAuthor,
  ocorrencias: number,
  sugestao: string,
  evidencias: string[] = [],
  textoFonte = "",
  motivo = sugestao,
  sugestaoReescrita = sugestao,
): AchadoClicheAuthor | null {
  if (ocorrencias <= 0) {
    return null;
  }
  const trechos = textoFonte
    ? localizarTrechosPorEvidenciasAuthor(textoFonte, evidencias, motivo, sugestaoReescrita)
    : [];
  return {
    id,
    categoria,
    severidade,
    severidadePadrao: severidadeAuthorPadrao(severidade, categoria),
    ocorrencias,
    risco: riscoAuthorPorSeveridade(severidade),
    motivo,
    sugestao,
    sugestaoReescrita,
    origem: "heuristica",
    bloqueante: true,
    trechos: trechos.length > 0 ? trechos : (textoFonte ? criarTrechoContextualAuthor(textoFonte, motivo, sugestaoReescrita) : []),
    evidencias,
  };
}

export function contratoAutorizaTemaSensivel(conteudoContrato: string): boolean {
  return /sensitivity_reviewer|validar_tema_sensivel|PublicoAuthor[\s\S]*SENSIVEL|PublicoSensivel/i.test(conteudoContrato);
}

export function avaliarHeuristicasNarrativasAuthor(
  textoFonte: string,
  conteudoContrato: string,
  tokensContrato: Set<string>,
): AchadoClicheAuthor[] {
  const normalizado = normalizarTextoAuthor(textoFonte);
  const achados: Array<AchadoClicheAuthor | null> = [];
  const gateAtivo = (token: string) => tokensContrato.has(token) || tokensContrato.has(`validar_${token}`) || tokensContrato.has(`sem_${token}`);

  if (gateAtivo("palavra_generica_sem_concreto") || tokensContrato.has("score_coerencia_tonal")) {
    const genericas = ["algo", "coisa", "muito", "incrivel", "especial", "importante", "profundo", "intenso", "cativante", "emocionante"];
    const ocorrencias = contarPalavrasAuthor(normalizado, genericas);
    achados.push(criarAchadoHeuristicoAuthor(
      "palavra_generica_sem_concreto",
      "palavra_generica",
      ocorrencias >= 4 ? "alta" : "media",
      ocorrencias >= 3 ? ocorrencias : 0,
      "Troque adjetivo abstrato por imagem, acao, escolha ou custo observavel.",
      genericas.filter((palavra) => new RegExp(`\\b${palavra}\\b`).test(normalizado)),
      textoFonte,
      "Palavra generica aparece sem ancoragem concreta suficiente.",
      "Substitua por imagem fisica, acao especifica, escolha ou custo observavel.",
    ));
  }

  if (gateAtivo("arco_emocional_sem_mudanca")) {
    const temMarcadorMudanca = /\b(passou de|deixou de|percebeu|decidiu|renunciou|custou|perdeu|escolheu|mudou|foi obrigado|teve que)\b/i.test(normalizado);
    achados.push(criarAchadoHeuristicoAuthor(
      "arco_emocional_sem_mudanca",
      "arco_emocional",
      "alta",
      textoFonte.trim().length > 120 && !temMarcadorMudanca ? 1 : 0,
      "Declare a mudanca emocional da cena: estado inicial, pressao, decisao e custo.",
      [],
      textoFonte,
      "Texto longo nao mostra mudanca emocional rastreavel.",
      "Mostre estado inicial, pressao, decisao e custo emocional em uma sequencia concreta.",
    ));
  }

  if (gateAtivo("personagem_sem_memoria")) {
    const temNome = /\b[A-Z][a-z]{2,}\b/.test(textoFonte);
    const temEstado = /\b(quer|teme|esconde|prometeu|lembra|culpa|ferida|objetivo|segredo)\b/i.test(normalizado);
    achados.push(criarAchadoHeuristicoAuthor(
      "personagem_sem_memoria",
      "memoria_personagem",
      "alta",
      !temNome || !temEstado ? 1 : 0,
      "Amarre personagem a memoria persistente: desejo, medo, segredo, ferida ou promessa ja declarada.",
      [],
      textoFonte,
      "Personagem aparece sem memoria operacional suficiente para guiar continuidade.",
      "Declare desejo, medo, segredo, ferida ou promessa que possa ser reutilizada depois.",
    ));
  }

  if (gateAtivo("promessa_narrativa_quebrada")) {
    const temPromessa = /\b(promessa|prometeu|proteger|objetivo|misterio|conflito|pergunta|ameaca|custo)\b/i.test(normalizado);
    const resolveSemCusto = /\b(no fim tudo ficara bem|de repente tudo se resolveu|por sorte)\b/i.test(normalizado);
    achados.push(criarAchadoHeuristicoAuthor(
      "promessa_narrativa_quebrada",
      "promessa_narrativa",
      resolveSemCusto ? "alta" : "media",
      resolveSemCusto || !temPromessa ? 1 : 0,
      "Toda promessa narrativa precisa de pergunta, tensao, consequencia e validacao antes de ser resolvida.",
      resolveSemCusto ? ["no fim tudo ficara bem", "de repente tudo se resolveu", "por sorte"].filter((termo) => normalizado.includes(termo)) : [],
      textoFonte,
      resolveSemCusto ? "Resolucao sem custo enfraquece a promessa narrativa." : "Texto nao explicita promessa, pergunta, ameaca ou custo narrativo.",
      "Amarre a promessa a pergunta, tensao, consequencia e validacao antes de resolver.",
    ));
  }

  if (gateAtivo("impacto_capitulo_nao_mapeado")) {
    const mudancaCanonica = /\b(morreu|matou|traiu|revelou|destruiu|rompeu|desapareceu|casou|venceu|perdeu)\b/i.test(normalizado);
    const temConsequencia = /\b(por isso|como consequencia|afetou|obriga|altera|muda|impacta|no capitulo seguinte)\b/i.test(normalizado);
    achados.push(criarAchadoHeuristicoAuthor(
      "impacto_capitulo_nao_mapeado",
      "impact_map",
      "alta",
      mudancaCanonica && !temConsequencia ? 1 : 0,
      "Mudanca canonica precisa de impact map entre capitulos, relacoes, promessas e cenas futuras.",
      [],
      textoFonte,
      "Mudanca canonica aparece sem consequencia mapeada para continuidade.",
      "Declare quem muda, que promessa quebra e qual cena futura fica obrigada a responder.",
    ));
  }

  if (gateAtivo("tema_sensivel_sem_autorizacao")) {
    const termosSensiveis = ["suicidio", "abuso", "luto", "trauma", "violencia sexual", "automutilacao", "racismo"];
    const ocorrencias = termosSensiveis.filter((termo) => normalizado.includes(termo)).length;
    achados.push(criarAchadoHeuristicoAuthor(
      "tema_sensivel_sem_autorizacao",
      "tema_sensivel",
      "alta",
      ocorrencias > 0 && !contratoAutorizaTemaSensivel(conteudoContrato) ? ocorrencias : 0,
      "Tema sensivel so pode entrar quando publico, fontes, limites e sensitivity reviewer estiverem contratados.",
      termosSensiveis.filter((termo) => normalizado.includes(termo)),
      textoFonte,
      "Tema sensivel detectado sem autorizacao explicita no contrato Author.",
      "Declare publico, limites, fontes e sensitivity reviewer antes de manter esse tema.",
    ));
  }

  if (gateAtivo("rpg_campanha_sem_estado")) {
    const mencionaCampanha = /\b(campanha|sessao|npc|jogador|party|mestre|dado|quest)\b/i.test(normalizado);
    const temEstadoCampanha = /\b(estado|inventario|local|missao|relacao|faccao|reputacao|checkpoint)\b/i.test(normalizado);
    achados.push(criarAchadoHeuristicoAuthor(
      "rpg_campanha_sem_estado",
      "campanha_persistente",
      "media",
      mencionaCampanha && !temEstadoCampanha ? 1 : 0,
      "Modo RPG/campanha precisa preservar estado: local, inventario, relacoes, faccoes, missao e consequencias.",
      ["campanha", "sessao", "npc", "jogador", "party", "mestre", "dado", "quest"].filter((termo) => normalizado.includes(termo)),
      textoFonte,
      "Campanha/RPG foi mencionado sem estado persistente suficiente.",
      "Inclua local, inventario, relacoes, faccao, missao, checkpoint ou consequencia persistente.",
    ));
  }

  return achados.filter((achado): achado is AchadoClicheAuthor => achado !== null);
}

export function extrairIrNarrativoAuthor(texto: string): IrNarrativoAuthor {
  const normalizado = normalizarTextoAuthor(texto);
  const personagens = unicosOrdenados(
    Array.from(texto.matchAll(/\b[A-Z][a-z]{2,}\b/g))
      .map((match) => match[0])
      .filter((nome) => !["O", "A", "Os", "As", "Um", "Uma", "Por", "Para", "Isso", "Como"].includes(nome)),
  ).slice(0, 12);
  const capitulos = unicosOrdenados(
    Array.from(normalizado.matchAll(/\b(?:capitulo|sessao)\s+([a-z0-9_-]+)/g)).map((match) => match[0]),
  ).slice(0, 12);
  const eventos = unicosOrdenados(
    Array.from(normalizado.matchAll(/\b(morreu|matou|traiu|revelou|decidiu|perdeu|venceu|rompeu|descobriu|prometeu)\b/g)).map((match) => match[0]),
  ).slice(0, 12);
  const temasSensiveis = ["suicidio", "abuso", "luto", "trauma", "violencia sexual", "automutilacao", "racismo"]
    .filter((termo) => normalizado.includes(termo));
  const modoCampanha = /\b(campanha|sessao|npc|jogador|party|mestre|quest)\b/i.test(normalizado);
  return { personagens, capitulos, eventos, temasSensiveis, modoCampanha };
}

export function compararDiffSemanticoAuthor(textoAnterior: string | null, textoAtual: string): DiffSemanticoAuthor {
  if (!textoAnterior) {
    return {
      disponivel: false,
      personagensAdicionados: [],
      personagensRemovidos: [],
      eventosAdicionados: [],
      eventosRemovidos: [],
      riscoDrift: "baixo",
    };
  }
  const anterior = extrairIrNarrativoAuthor(textoAnterior);
  const atual = extrairIrNarrativoAuthor(textoAtual);
  const adicionados = (atuais: string[], antigos: string[]) => atuais.filter((item) => !antigos.includes(item));
  const removidos = (antigos: string[], atuais: string[]) => antigos.filter((item) => !atuais.includes(item));
  const personagensAdicionados = adicionados(atual.personagens, anterior.personagens);
  const personagensRemovidos = removidos(anterior.personagens, atual.personagens);
  const eventosAdicionados = adicionados(atual.eventos, anterior.eventos);
  const eventosRemovidos = removidos(anterior.eventos, atual.eventos);
  const mudancas = personagensAdicionados.length + personagensRemovidos.length + eventosAdicionados.length + eventosRemovidos.length;
  return {
    disponivel: true,
    personagensAdicionados,
    personagensRemovidos,
    eventosAdicionados,
    eventosRemovidos,
    riscoDrift: mudancas >= 5 ? "alto" : mudancas >= 2 ? "medio" : "baixo",
  };
}

export function calcularScoreAuthor(achados: AchadoClicheAuthor[], categorias?: string[]): number {
  const relevantes = categorias ? achados.filter((achado) => categorias.includes(achado.categoria)) : achados;
  const penalidade = relevantes.reduce((total, achado) => {
    const peso = achado.severidade === "alta" ? 30 : achado.severidade === "media" ? 15 : 5;
    return total + (peso * Math.max(1, achado.ocorrencias));
  }, 0);
  return Math.max(0, 100 - penalidade);
}

export function calcularScoreRiscoAuthor(achados: AchadoClicheAuthor[], contratoValido: boolean): number {
  const risco = achados.reduce((total, achado) => {
    const peso = achado.severidade === "alta" ? 35 : achado.severidade === "media" ? 18 : 6;
    return total + (peso * Math.max(1, achado.ocorrencias));
  }, contratoValido ? 0 : 40);
  return Math.min(100, risco);
}

export function montarImpactMapAuthor(achados: AchadoClicheAuthor[]): ImpactoNarrativoAuthor[] {
  const camadasPorCategoria: Record<string, string[]> = {
    arco_emocional: ["personagem", "cena", "capitulo"],
    campanha_persistente: ["campanha", "sessao", "estado"],
    cliche: ["premissa", "personagem", "promessa"],
    conflito: ["cena", "informacao", "ritmo"],
    dialogo: ["dialogo", "subtexto", "exposicao"],
    frase_generica: ["estilo", "voz", "promessa"],
    impact_map: ["capitulo", "continuidade", "cenas futuras"],
    memoria_personagem: ["personagem", "relacoes", "canon"],
    palavra_generica: ["estilo", "imagem", "voz"],
    proibicao_literal: ["contrato", "texto", "guardrail"],
    promessa_narrativa: ["promessa", "resolucao", "expectativa"],
    tema_sensivel: ["publico", "fontes", "limites"],
    tom: ["tom", "publico", "estilo"],
    voz: ["voz", "estilo", "autor"],
  };
  return achados.map((achado) => ({
    alvo: achado.id,
    camadas: camadasPorCategoria[achado.categoria] ?? ["texto"],
    motivo: achado.sugestao,
  }));
}

export function extrairGuardrailsAuthor(conteudo: string, ir: IrModulo | null): string[] {
  const tarefas = ir?.tasks ?? [];
  const superficies = ir?.superficies ?? [];
  const linhasMarcadas = conteudo
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => /(cliche|proibid|forbidden|sensivel|publico|fonte|estilo|voz|dialogo|conflito|atrito|dano|limite)/i.test(linha));
  return limitarLista(unicosOrdenados([
    ...tarefas.flatMap((task) => task.rules),
    ...tarefas.flatMap((task) => task.guarantees),
    ...tarefas.flatMap((task) => task.forbidden.regras),
    ...superficies.flatMap((superficie) => superficie.forbidden.regras),
    ...linhasMarcadas,
  ]), 18);
}

export function extrairProibicoesAuthor(ir: IrModulo | null, conteudo: string): string[] {
  const tarefas = ir?.tasks ?? [];
  const superficies = ir?.superficies ?? [];
  const proibicoesDeclaradas = [
    ...tarefas.flatMap((task) => task.forbidden.regras),
    ...superficies.flatMap((superficie) => superficie.forbidden.regras),
  ];
  const proibicoesLiterais = politicasProibicoesLiteraisAuthor(conteudo, ir)
    .map((politica) => slugParaTextoAuthor(politica.id.replace(/^proibicao_literal_author_/, "")));
  const proibicoesTextuais = conteudo
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => /^(aceitar_|gerar_|publicar_|obra_|fontes_|estilo_|voz_|dialogo_|cliche_|exposicao_|moralizacao_)/.test(linha));
  return limitarLista(unicosOrdenados([...proibicoesDeclaradas, ...proibicoesTextuais, ...proibicoesLiterais]), 16);
}
