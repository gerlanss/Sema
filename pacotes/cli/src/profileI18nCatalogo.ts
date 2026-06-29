// SEMA-GOVERNED: sema.produto.governanca_ia.qualidade_contrato
// Descricao: catalogo de termos i18n por idioma para validacao observavel de texto visivel.

export type IdiomaI18nSuportado = "pt-BR" | "es" | "fr";

interface TermoDiacritico {
  regex: RegExp;
  esperado: string;
}

export interface ValidadorIdioma {
  idioma: IdiomaI18nSuportado;
  nome: string;
  termos: TermoDiacritico[];
}

export const VALIDADORES_I18N: Record<IdiomaI18nSuportado, ValidadorIdioma> = {
  "pt-BR": {
    idioma: "pt-BR",
    nome: "Portugues do Brasil",
    termos: [
      { regex: /\bDescricao\b/i, esperado: "Descrição" },
      { regex: /\bDescricoes\b/i, esperado: "Descrições" },
      { regex: /\bAcao\b/i, esperado: "Ação" },
      { regex: /\bAcoes\b/i, esperado: "Ações" },
      { regex: /\bAtencao\b/i, esperado: "Atenção" },
      { regex: /\bConfiguracao\b/i, esperado: "Configuração" },
      { regex: /\bInformacao\b/i, esperado: "Informação" },
      { regex: /\bInformacoes\b/i, esperado: "Informações" },
      { regex: /\bEducacao\b/i, esperado: "Educação" },
      { regex: /\bSaude\b/i, esperado: "Saúde" },
      { regex: /\bAlimentacao\b/i, esperado: "Alimentação" },
      { regex: /\bLancamento\b/i, esperado: "Lançamento" },
      { regex: /\bLancamentos\b/i, esperado: "Lançamentos" },
      { regex: /\bOnibus\b/i, esperado: "Ônibus" },
      { regex: /\balmoco\b/i, esperado: "almoço" },
      { regex: /\brapido\b/i, esperado: "rápido" },
      { regex: /\brapida\b/i, esperado: "rápida" },
      { regex: /\bnumero\b/i, esperado: "número" },
      { regex: /\binvalido\b/i, esperado: "inválido" },
      { regex: /\binvalida\b/i, esperado: "inválida" },
      { regex: /\bobrigatorio\b/i, esperado: "obrigatório" },
      { regex: /\bobrigatoria\b/i, esperado: "obrigatória" },
      { regex: /\busuario\b/i, esperado: "usuário" },
      { regex: /\busuarios\b/i, esperado: "usuários" },
      { regex: /\bcartao\b/i, esperado: "cartão" },
      { regex: /\bcredito\b/i, esperado: "crédito" },
      { regex: /\bdebito\b/i, esperado: "débito" },
      { regex: /\bvalidacao\b/i, esperado: "validação" },
      { regex: /\bexclusao\b/i, esperado: "exclusão" },
      { regex: /\bhistorico\b/i, esperado: "histórico" },
      { regex: /\bVoce\b/i, esperado: "Você" },
      { regex: /\bvoce\b/i, esperado: "você" },
      { regex: /\bNao\b/i, esperado: "Não" },
      { regex: /\bnao\b/i, esperado: "não" },
      { regex: /\bJa\b/i, esperado: "Já" },
      { regex: /\bja\b/i, esperado: "já" },
      { regex: /\bAte\b/i, esperado: "Até" },
      { regex: /\bate\b/i, esperado: "até" },
      { regex: /\bProximo\b/i, esperado: "Próximo" },
      { regex: /\bproximo\b/i, esperado: "próximo" },
    ],
  },
  es: {
    idioma: "es",
    nome: "Espanhol",
    termos: [
      { regex: /\bDescripcion\b/i, esperado: "Descripción" },
      { regex: /\bAccion\b/i, esperado: "Acción" },
      { regex: /\bAcciones\b/i, esperado: "Acciones" },
      { regex: /\bAtencion\b/i, esperado: "Atención" },
      { regex: /\bConfiguracion\b/i, esperado: "Configuración" },
      { regex: /\bInformacion\b/i, esperado: "Información" },
      { regex: /\bEducacion\b/i, esperado: "Educación" },
      { regex: /\brapido\b/i, esperado: "rápido" },
      { regex: /\brapida\b/i, esperado: "rápida" },
      { regex: /\bnumero\b/i, esperado: "número" },
      { regex: /\binvalido\b/i, esperado: "inválido" },
      { regex: /\binvalida\b/i, esperado: "inválida" },
      { regex: /\bobligacion\b/i, esperado: "obligación" },
      { regex: /\bcredito\b/i, esperado: "crédito" },
      { regex: /\bdebito\b/i, esperado: "débito" },
      { regex: /\btelefono\b/i, esperado: "teléfono" },
      { regex: /\bproximo\b/i, esperado: "próximo" },
      { regex: /\bTambien\b/i, esperado: "También" },
      { regex: /\btambien\b/i, esperado: "también" },
    ],
  },
  fr: {
    idioma: "fr",
    nome: "Frances",
    termos: [
      { regex: /\bResume\b/i, esperado: "Résumé" },
      { regex: /\bresume\b/i, esperado: "résumé" },
      { regex: /\btelephone\b/i, esperado: "téléphone" },
      { regex: /\bnumero\b/i, esperado: "numéro" },
      { regex: /\bdeja\b/i, esperado: "déjà" },
      { regex: /\becole\b/i, esperado: "école" },
      { regex: /\beleve\b/i, esperado: "élève" },
      { regex: /\bfrancais\b/i, esperado: "français" },
      { regex: /\bFrancais\b/i, esperado: "Français" },
      { regex: /\baout\b/i, esperado: "août" },
      { regex: /\bNoel\b/i, esperado: "Noël" },
      { regex: /\bNoe?l\b/i, esperado: "Noël" },
    ],
  },
};
