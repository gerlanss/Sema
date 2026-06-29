// SEMA-GOVERNED: sema.produto.governanca_ia.qualidade_contrato
// Descricao: validador observavel de i18n por idioma em artefatos reais do profile Software.

import { localizacaoDoMatchProfile } from "./profileArtefatoBase.js";
import { VALIDADORES_I18N, type IdiomaI18nSuportado, type ValidadorIdioma } from "./profileI18nCatalogo.js";
import type { AchadoProfile, MaturidadeProfile, SeveridadeProfile } from "./profileAuthorTipos.js";
import { criarAchadoArtefatoProfile } from "./profileRegras.js";

interface SegmentoTextoVisivel {
  texto: string;
  inicio: number;
  contexto: string;
}

interface EscopoI18nObservavel {
  ativo: boolean;
  idiomaNaoDeclarado: boolean;
  idiomas: IdiomaI18nSuportado[];
  idiomasSemValidador: string[];
}

const REGEX_TEXTO_TAG = />\s*([^<>{}]{1,240}?[A-Za-zÀ-ÿ][^<>{}]{0,240})\s*</g;
const REGEX_ATRIBUTO_VISIVEL = /\b(?:placeholder|aria-label|title|alt|value|label)\s*=\s*(["'])([^"']{1,240})\1/gi;
const REGEX_LITERAL_STRING = /"([^"\\\r\n]{1,240}(?:\\.[^"\\\r\n]{0,240})*)"|'([^'\\\r\n]{1,240}(?:\\.[^'\\\r\n]{0,240})*)'|`([^`\\]{1,240}(?:\\.[^`\\]{0,240})*)`/g;

function semAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizarTokenIdioma(token: string): string {
  return token.trim().toLowerCase().replace(/_/g, "-");
}

function idiomaSuportado(token: string): IdiomaI18nSuportado | null {
  const normalizado = normalizarTokenIdioma(token);
  if (normalizado === "pt" || normalizado === "pt-br" || normalizado === "ptbr") return "pt-BR";
  if (normalizado === "es" || normalizado === "es-es" || normalizado === "es-mx" || normalizado === "es-419") return "es";
  if (normalizado === "fr" || normalizado === "fr-fr" || normalizado === "fr-ca") return "fr";
  return null;
}

function adicionarIdioma(
  idiomas: Set<IdiomaI18nSuportado>,
  semValidador: Set<string>,
  token: string,
): void {
  const suportado = idiomaSuportado(token);
  if (suportado) {
    idiomas.add(suportado);
  } else {
    semValidador.add(normalizarTokenIdioma(token));
  }
}

export function detectarEscopoI18nObservavel(contrato: string): EscopoI18nObservavel {
  const normalizado = semAcentos(contrato).toLowerCase();
  const mencionaI18n = /\bi18n\b|\bi18n[-_][a-z0-9_-]+/i.test(normalizado);
  const declaraTextoVisivel = mencionaI18n || /\b(?:texto[_ -]?visivel|interface|ui|labels?|mensagens?|placeholder|aria-label|locale|idioma|language|traducao|traducoes|translation|acento|acentos|diacritico|diacriticos|cedilha|mojibake)\b/.test(normalizado);
  const declaraIdiomaOuI18n = mencionaI18n || /\b(?:locale|idioma|language|traducao|traducoes|translation|pt[-_ ]?br|portugues|portuguese|espanhol|spanish|frances|french)\b/.test(normalizado);
  const ativo = declaraTextoVisivel && declaraIdiomaOuI18n;
  if (!ativo) return { ativo: false, idiomaNaoDeclarado: false, idiomas: [], idiomasSemValidador: [] };

  const idiomas = new Set<IdiomaI18nSuportado>();
  const semValidador = new Set<string>();

  if (/\bi18n[-_]ptbr\b|\b(?:pt[-_ ]?br|portugues|portuguese)\b/.test(normalizado)) idiomas.add("pt-BR");
  if (/\b(?:espanhol|espanol|spanish)\b/.test(normalizado)) idiomas.add("es");
  if (/\b(?:frances|french)\b/.test(normalizado)) idiomas.add("fr");

  for (const match of normalizado.matchAll(/\bi18n[-_]([a-z]{2,4}(?:[-_][a-z0-9]{2,3})?)\b/g)) {
    adicionarIdioma(idiomas, semValidador, match[1] ?? "");
  }
  for (const match of normalizado.matchAll(/\b(?:locale|idioma|language)\s*[:=]?\s*["']?([a-z]{2}(?:[-_][a-z0-9]{2,3})?)\b/g)) {
    adicionarIdioma(idiomas, semValidador, match[1] ?? "");
  }

  return {
    ativo: true,
    idiomaNaoDeclarado: idiomas.size === 0 && semValidador.size === 0,
    idiomas: [...idiomas],
    idiomasSemValidador: [...semValidador],
  };
}

function limparTextoSegmento(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

function contextoPareceScriptOuEstilo(artefato: string, indice: number): boolean {
  const antes = artefato.slice(Math.max(0, indice - 40), indice).toLowerCase();
  return /<\s*(?:script|style|template)\b/.test(antes);
}

function textoTemTermoSemDiacritico(texto: string, validadores: ValidadorIdioma[]): boolean {
  return validadores.some((validador) => validador.termos.some((termo) => termo.regex.test(texto)));
}

function literalPareceTecnico(texto: string, validadores: ValidadorIdioma[]): boolean {
  const valor = texto.trim();
  if (!valor || valor.length > 240) return true;
  if (/^(?:GET|POST|PUT|PATCH|DELETE|true|false|null|undefined)$/i.test(valor)) return true;
  if (/^(?:https?:\/\/|\/|\.\/|#|[A-Z_][A-Z0-9_]*$)/.test(valor)) return true;
  return /^[a-z0-9_.:/#-]+$/.test(valor) && !textoTemTermoSemDiacritico(valor, validadores);
}

function coletarSegmentosTextoVisivel(artefato: string, validadores: ValidadorIdioma[]): SegmentoTextoVisivel[] {
  const segmentos: SegmentoTextoVisivel[] = [];

  for (const match of artefato.matchAll(REGEX_TEXTO_TAG)) {
    if (contextoPareceScriptOuEstilo(artefato, match.index ?? 0)) continue;
    const texto = limparTextoSegmento(match[1] ?? "");
    if (texto) segmentos.push({ texto, inicio: (match.index ?? 0) + match[0].indexOf(match[1] ?? ""), contexto: "texto_tag_html" });
  }

  for (const match of artefato.matchAll(REGEX_ATRIBUTO_VISIVEL)) {
    const texto = limparTextoSegmento(match[2] ?? "");
    if (texto) segmentos.push({ texto, inicio: (match.index ?? 0) + match[0].indexOf(match[2] ?? ""), contexto: "atributo_visivel_html" });
  }

  for (const match of artefato.matchAll(REGEX_LITERAL_STRING)) {
    const texto = limparTextoSegmento(match[1] ?? match[2] ?? match[3] ?? "");
    if (literalPareceTecnico(texto, validadores) || !textoTemTermoSemDiacritico(texto, validadores)) continue;
    segmentos.push({ texto, inicio: (match.index ?? 0) + match[0].indexOf(texto), contexto: "literal_string_ui" });
  }

  return segmentos;
}

function severidadeI18n(maturidade: MaturidadeProfile): SeveridadeProfile {
  if (maturidade === "critical") return "critical";
  if (maturidade === "draft") return "warning";
  return "blocking";
}

function criarAchadoIdiomaNaoDeclarado(maturidade: MaturidadeProfile): AchadoProfile {
  return criarAchadoArtefatoProfile(
    "software_i18n_idioma_nao_declarado",
    "contrato declara i18n observavel, mas nao declara idioma/locale verificavel",
    false,
    severidadeI18n(maturidade),
    undefined,
    "declare o idioma explicitamente, por exemplo i18n_ptbr, i18n_es ou locale: pt-BR.",
    "i18n sem idioma impede validar acentos, diacriticos e texto visivel de forma observavel.",
    { regra: "i18n_idioma_obrigatorio", risco: "garantia_i18n_ambigua" },
  );
}

function criarAchadoIdiomaSemValidador(idioma: string, maturidade: MaturidadeProfile): AchadoProfile {
  return criarAchadoArtefatoProfile(
    "software_i18n_idioma_sem_validador_observavel",
    "contrato declara idioma i18n sem validador observavel registrado",
    false,
    severidadeI18n(maturidade),
    undefined,
    `adicione validador observavel para "${idioma}" ou remova a garantia de i18n desse idioma.`,
    "a garantia i18n nao pode aprovar idioma sem regra de verificacao executavel.",
    { regra: "i18n_validador_por_idioma_obrigatorio", risco: "garantia_i18n_sem_checker" },
  );
}

export function avaliarI18nVisivelArtefato(
  contrato: string,
  artefato: string,
  maturidade: MaturidadeProfile,
): AchadoProfile[] {
  const escopo = detectarEscopoI18nObservavel(contrato);
  if (!escopo.ativo) return [];

  const achados: AchadoProfile[] = [];
  if (escopo.idiomaNaoDeclarado) achados.push(criarAchadoIdiomaNaoDeclarado(maturidade));
  for (const idioma of escopo.idiomasSemValidador) {
    achados.push(criarAchadoIdiomaSemValidador(idioma, maturidade));
  }

  const validadores = escopo.idiomas.map((idioma) => VALIDADORES_I18N[idioma]);
  const vistos = new Set<string>();
  for (const segmento of coletarSegmentosTextoVisivel(artefato, validadores)) {
    for (const validador of validadores) {
      for (const termo of validador.termos) {
        const match = termo.regex.exec(segmento.texto);
        if (!match) continue;
        const inicio = segmento.inicio + match.index;
        const chave = `${validador.idioma}:${inicio}:${match[0].toLowerCase()}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        const localizacao = localizacaoDoMatchProfile(artefato, inicio, match[0].length);

        achados.push(criarAchadoArtefatoProfile(
          "software_i18n_diacritico_ausente",
          "texto visivel perdeu diacritico obrigatorio para idioma declarado no contrato",
          false,
          severidadeI18n(maturidade),
          localizacao.trecho,
          `troque "${match[0]}" por "${termo.esperado}" em ${validador.nome} ou remova essa garantia i18n do contrato.`,
          `contrato declara i18n observavel para ${validador.idioma}, mas o artefato contem literal de UI sem diacritico no contexto ${segmento.contexto}.`,
          {
            linha: localizacao.linha,
            coluna: localizacao.coluna,
            inicio: localizacao.inicio,
            fim: localizacao.fim,
            regra: `i18n_${validador.idioma.toLowerCase()}_diacriticos_observaveis`,
            risco: "garantia_i18n_nao_observada",
          },
        ));

        if (achados.length >= 16) return achados;
      }
    }
  }

  return achados;
}
