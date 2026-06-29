// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: cat?logo e pol?ticas literais do gate Author sem acoplar comando de CLI.

import type { IrModulo } from "@sema/nucleo";
import type { SeveridadeAuthor, SeveridadeProfile, RiscoAuthor, TrechoAuthor } from "./profileAuthorTipos.js";

export interface PoliticaAuthorGate {
  id: string;
  categoria: string;
  contratoTokens: string[];
  regex: RegExp;
  severidade: SeveridadeAuthor;
  motivo: string;
  sugestao: string;
  sugestaoReescrita: string;
}

export const POLITICAS_AUTHOR_GATE: PoliticaAuthorGate[] = [
  {
    id: "escolhido_predestinado",
    categoria: "cliche",
    contratoTokens: [
      "sem_cliche_escolhido_predestinado",
      "cliche_escolhido_predestinado",
      "aceitar_cliche_sem_justificativa",
    ],
    regex: /\b(escolhid[oa]|predestinad[oa]|profecia)\b/gi,
    severidade: "alta",
    motivo: "Destino abstrato substitui desejo, decisao e custo concreto.",
    sugestao: "Troque destino abstrato por desejo, custo e conflito concreto.",
    sugestaoReescrita: "Comece por uma escolha sob pressao, uma perda concreta ou um prazo que force o personagem a agir.",
  },
  {
    id: "dialogo_resumo",
    categoria: "dialogo",
    contratoTokens: [
      "sem_dialogo_resumo",
      "dialogo_resumo",
      "dialogo_expositivo",
      "aceitar_dialogo_expositivo",
    ],
    regex: /\b(como voce sabe|deixe-me explicar|resumindo|em outras palavras)\b/gi,
    severidade: "media",
    motivo: "Dialogo explica informacao para o leitor em vez de criar atrito entre personagens.",
    sugestao: "Transforme explicacao em atrito, subtexto ou acao observavel.",
    sugestaoReescrita: "Troque a explicacao direta por uma acusacao, hesitacao, pergunta hostil ou gesto que revele a informacao.",
  },
  {
    id: "frase_de_efeito_vazia",
    categoria: "promessa_narrativa",
    contratoTokens: [
      "sem_frase_de_efeito_vazia",
      "frase_de_efeito_vazia",
      "validar_promessa_narrativa",
    ],
    regex: /\b(o destino nos chama|a esperanca e tudo|o tempo dira|no fim tudo ficara bem)\b/gi,
    severidade: "media",
    motivo: "Frase pronta promete emocao sem consequencia especifica de cena.",
    sugestao: "Substitua frase pronta por consequencia especifica da cena.",
    sugestaoReescrita: "Ancore a frase em objeto, dano, promessa quebrada ou consequencia verificavel.",
  },
  {
    id: "voz_generica_de_ia",
    categoria: "voz",
    contratoTokens: [
      "sem_voz_generica_de_ia",
      "voz_generica_de_ia",
      "aceitar_voz_generica_de_ia",
      "politica_estilo_por_autor",
    ],
    regex: /\b(uma jornada de autodescoberta|emocionante e envolvente|profundamente humano|historia cativante)\b/gi,
    severidade: "alta",
    motivo: "Rotulo editorial descreve qualidade pretendida em vez de produzir experiencia narrativa.",
    sugestao: "Corte rotulo editorial e mostre textura, decisao e perda.",
    sugestaoReescrita: "Mostre uma imagem concreta, uma decisao desconfortavel ou uma perda que carregue o tom.",
  },
  {
    id: "moralizacao_barata",
    categoria: "tom",
    contratoTokens: [
      "sem_moralizacao_barata",
      "moralizacao_barata",
      "score_coerencia_tonal",
    ],
    regex: /\b(licao importante|todos aprenderam|moral da historia|o bem sempre vence)\b/gi,
    severidade: "media",
    motivo: "Conclusao moralizante entrega a interpretacao pronta e reduz ambiguidade.",
    sugestao: "Deixe a consequencia moral emergir da acao, nao de sermoes.",
    sugestaoReescrita: "Troque a licao declarada por uma consequencia que obrigue o leitor a inferir o custo moral.",
  },
  {
    id: "exposicao_sem_conflito",
    categoria: "conflito",
    contratoTokens: [
      "sem_exposicao_sem_conflito",
      "exposicao_sem_conflito",
      "validar_promessa_narrativa",
    ],
    regex: /\b(ele explicou tudo|ela contou toda a verdade|a historia era simples)\b/gi,
    severidade: "media",
    motivo: "Exposicao resolve informacao sem resistencia, suspeita ou conflito.",
    sugestao: "Divida informacao em conflito, suspeita, erro ou descoberta.",
    sugestaoReescrita: "Quebre a informacao em revelacao parcial, mal-entendido, mentira util ou descoberta com preco.",
  },
];

export function contarOcorrencias(regex: RegExp, texto: string): number {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  return Array.from(texto.matchAll(new RegExp(regex.source, flags))).length;
}

export function posicaoLinhaColunaAuthor(texto: string, indice: number): { linha: number; coluna: number } {
  const antes = texto.slice(0, Math.max(0, indice));
  const linhas = antes.split(/\r?\n/);
  return {
    linha: linhas.length,
    coluna: (linhas.at(-1)?.length ?? 0) + 1,
  };
}

export function recortarContextoAuthor(texto: string, inicio: number, fim: number, margem = 70): string {
  const alvoInicio = Math.max(0, inicio - margem);
  const alvoFim = Math.min(texto.length, fim + margem);
  const recorte = texto.slice(alvoInicio, alvoFim).replace(/\s+/g, " ").trim();
  const prefixo = alvoInicio > 0 ? "... " : "";
  const sufixo = alvoFim < texto.length ? " ..." : "";
  return `${prefixo}${recorte}${sufixo}`.trim();
}

export function localizarTrechosRegexAuthor(
  regex: RegExp,
  texto: string,
  motivo: string,
  sugestao: string,
  limite = 5,
): TrechoAuthor[] {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const local = new RegExp(regex.source, flags);
  const trechos: TrechoAuthor[] = [];
  const vistos = new Set<string>();
  for (const match of texto.matchAll(local)) {
    const raw = match[0] ?? "";
    const inicio = match.index ?? -1;
    if (!raw || inicio < 0) continue;
    const fim = inicio + raw.length;
    const { linha, coluna } = posicaoLinhaColunaAuthor(texto, inicio);
    const chave = `${linha}:${coluna}:${raw.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    trechos.push({
      texto: recortarContextoAuthor(texto, inicio, fim),
      linha,
      coluna,
      inicio,
      fim,
      motivo,
      sugestao,
    });
    if (trechos.length >= limite) break;
  }
  return trechos;
}

export function localizarTrechosPorEvidenciasAuthor(
  texto: string,
  evidencias: string[],
  motivo: string,
  sugestao: string,
): TrechoAuthor[] {
  const trechos: TrechoAuthor[] = [];
  const vistos = new Set<string>();
  for (const evidencia of evidencias.filter(Boolean)) {
    const regex = regexFraseAuthor(evidencia);
    for (const trecho of localizarTrechosRegexAuthor(regex, texto, motivo, sugestao, 3)) {
      const chave = `${trecho.linha}:${trecho.coluna}:${trecho.texto}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      trechos.push(trecho);
      if (trechos.length >= 5) return trechos;
    }
  }
  return trechos;
}

export function criarTrechoContextualAuthor(texto: string, motivo: string, sugestao: string): TrechoAuthor[] {
  const match = texto.match(/\S[\s\S]{0,180}/);
  if (!match || match.index === undefined) return [];
  const inicio = match.index;
  const fim = inicio + match[0].length;
  const { linha, coluna } = posicaoLinhaColunaAuthor(texto, inicio);
  return [{
    texto: recortarContextoAuthor(texto, inicio, fim, 0),
    linha,
    coluna,
    inicio,
    fim,
    motivo,
    sugestao,
  }];
}

export function normalizarTextoAuthor(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function extrairTokensContratoAuthor(conteudo: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of conteudo.matchAll(/\b[A-Za-z_][A-Za-z0-9_.-]*\b/g)) {
    tokens.add(match[0]);
  }
  return tokens;
}

export function politicaAuthorAtiva(politica: PoliticaAuthorGate, tokensContrato: Set<string>): boolean {
  return [
    politica.id,
    `sem_${politica.id}`,
    `validar_${politica.id}`,
    `aceitar_${politica.id}`,
    ...politica.contratoTokens,
  ].some((token) => tokensContrato.has(token));
}

export function regexFraseAuthor(frase: string): RegExp {
  const escapada = frase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escapada}\\b`, "gi");
}

export function slugParaTextoAuthor(slug: string): string {
  return slug.replace(/_/g, " ").trim();
}

export function riscoAuthorPorSeveridade(severidade: SeveridadeAuthor): RiscoAuthor {
  return severidade === "alta" ? "alto" : severidade === "media" ? "medio" : "baixo";
}

export function severidadeAuthorPadrao(severidade: SeveridadeAuthor, categoria: string): SeveridadeProfile {
  if (categoria === "tema_sensivel") return "critical";
  if (severidade === "alta") return categoria === "proibicao_literal" ? "blocking" : "blocking";
  if (severidade === "media") return "warning";
  return "info";
}

export function normalizarIdAuthor(valor: string): string {
  return normalizarTextoAuthor(valor)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function removerComentarioSema(linha: string): string {
  return linha
    .replace(/\/\/.*$/g, "")
    .replace(/#.*$/g, "")
    .trim();
}

export function extrairLinhasForbiddenAuthor(conteudo: string): string[] {
  const linhas: string[] = [];
  for (const bloco of conteudo.matchAll(/forbidden\s*\{([\s\S]*?)\}/gi)) {
    for (const linha of bloco[1].split(/\r?\n/)) {
      const limpa = removerComentarioSema(linha);
      if (!limpa || limpa === "}") continue;
      linhas.push(limpa);
    }
  }
  return linhas;
}

export function extrairFrasesProibidasAuthor(conteudo: string): string[] {
  const frases: string[] = [];
  const regex = /\b(?:avoid|evitar|proibir|proibido|proibida|banir|banido|banida|nao_usar|nao usar)\s*["'`](.+?)["'`]/gi;
  for (const match of conteudo.matchAll(regex)) {
    const frase = match[1]?.trim();
    if (frase) frases.push(frase);
  }
  return frases;
}

export function politicaCatalogoConhecidaAuthor(token: string): boolean {
  const chave = normalizarIdAuthor(token.replace(/^(sem|validar|aceitar)_/, ""));
  return POLITICAS_AUTHOR_GATE.some((politica) => (
    politica.id === token
    || politica.id === chave
    || politica.contratoTokens.includes(token)
    || politica.contratoTokens.includes(chave)
  ));
}

export function textoProibicaoLiteralAuthor(valor: string): string | null {
  const bruto = valor.trim().replace(/^["'`]|["'`]$/g, "").trim();
  if (!bruto) return null;
  if (/\s/.test(bruto)) return bruto.replace(/\s+/g, " ");

  const dinamica = bruto.match(/^(?:frase|palavra|termo)_(?:banida|banido|proibida|proibido)_(.+)$/);
  if (dinamica) return slugParaTextoAuthor(dinamica[1]);

  const explicita = bruto.match(/^(?:proibido|proibida|banido|banida|nao_usar|evitar|sem)_(.+)$/);
  if (explicita && !politicaCatalogoConhecidaAuthor(explicita[1])) {
    return slugParaTextoAuthor(explicita[1]);
  }

  if (politicaCatalogoConhecidaAuthor(bruto)) return null;
  if (/^(aceitar|gerar|publicar|obra|fontes|estilo|voz|dialogo|cliche|exposicao|moralizacao|score|tratar|ignorar|aprovar|validar|contrato|texto|diagnostico|author|revisor|sensitivity|proibicao)_/.test(bruto)) {
    return null;
  }
  if (!bruto.includes("_")) return null;
  return slugParaTextoAuthor(bruto);
}

export function politicasProibicoesLiteraisAuthor(conteudo: string, ir: IrModulo | null): PoliticaAuthorGate[] {
  const tarefas = ir?.tasks ?? [];
  const superficies = ir?.superficies ?? [];
  const declaradas = [
    ...tarefas.flatMap((task) => task.forbidden.regras),
    ...superficies.flatMap((superficie) => superficie.forbidden.regras),
    ...extrairLinhasForbiddenAuthor(conteudo),
    ...extrairFrasesProibidasAuthor(conteudo),
  ];
  const politicas: PoliticaAuthorGate[] = [];
  const vistos = new Set<string>();
  for (const declarada of declaradas) {
    const texto = textoProibicaoLiteralAuthor(declarada);
    if (!texto) continue;
    const idBase = normalizarIdAuthor(texto);
    if (!idBase || vistos.has(idBase)) continue;
    vistos.add(idBase);
    politicas.push({
      id: `proibicao_literal_author_${idBase}`,
      categoria: "proibicao_literal",
      contratoTokens: [declarada],
      regex: regexFraseAuthor(texto),
      severidade: "alta",
      motivo: `O texto usa uma proibicao literal declarada no contrato Author: "${texto}".`,
      sugestao: `Remova "${texto}" ou edite o contrato antes de manter esse elemento narrativo.`,
      sugestaoReescrita: `Troque "${texto}" por um evento, objeto ou relacao permitida pelo contrato atual.`,
    });
  }
  return politicas;
}

export function politicasDinamicasContratoAuthor(tokensContrato: Set<string>): PoliticaAuthorGate[] {
  const politicas: PoliticaAuthorGate[] = [];
  for (const token of tokensContrato) {
    const match = token.match(/^(frase|palavra|termo)_(?:banida|banido|proibida|proibido)_(.+)$/);
    if (!match) {
      continue;
    }
    const [, tipo, slug] = match;
    const texto = slugParaTextoAuthor(slug);
    const regex = tipo === "palavra"
      ? new RegExp(`\\b${texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")
      : regexFraseAuthor(texto);
    politicas.push({
      id: token,
      categoria: tipo === "palavra" ? "palavra_generica" : "frase_generica",
      contratoTokens: [token],
      regex,
      severidade: "alta",
      motivo: `Termo proibido pelo contrato Author: "${texto}".`,
      sugestao: `Remova "${texto}" ou justifique com detalhe concreto de cena.`,
      sugestaoReescrita: `Substitua "${texto}" por uma imagem, decisao ou consequencia especifica da obra.`,
    });
  }
  return politicas;
}
