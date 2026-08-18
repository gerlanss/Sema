// SEMA-GOVERNED: sema.produto.dsl_design
// Descrição: presets de identidade visual e resolucao de tokens de design a partir do bloco design do contrato.

export interface CoresDesign {
  primaria: string;
  primariaHover: string;
  primariaSuave: string;
  fundo: string;
  superficie: string;
  texto: string;
  textoSecundario: string;
  borda: string;
  bordaFoco: string;
}

export interface PaletaDesign extends CoresDesign {
  escuras: CoresDesign;
}

export interface TipografiaDesign {
  fonte: string;
  fonteTitulo: string;
  fonteMono: string;
}

export interface EscalaTipografica {
  base: string;
  titulo: string;
  subtitulo: string;
  pequeno: string;
}

export interface FormaDesign {
  raio: string;
  raioLg: string;
}

export interface DesignTokensResolvidos {
  cores: CoresDesign;
  coresEscuras: CoresDesign;
  tipografia: TipografiaDesign;
  escala: EscalaTipografica;
  forma: FormaDesign;
  movimentoDuracao: string;
}

interface DesignDeclarado {
  dominio?: string;
  identidade?: string;
  tokens?: {
    paleta?: string;
    tipografia?: string;
    densidade?: string;
    forma?: string;
    movimento?: string;
    overrides?: Record<string, string>;
  };
}

const PALETAS: Record<string, PaletaDesign> = {
  padrao: {
    primaria: "#6366f1", primariaHover: "#4f46e5", primariaSuave: "#eef2ff",
    fundo: "#fafafa", superficie: "#ffffff", texto: "#18181b",
    textoSecundario: "#71717a", borda: "#e4e4e7", bordaFoco: "#a5b4fc",
    escuras: { primaria: "#818cf8", primariaHover: "#a5b4fc", primariaSuave: "#1e1b4b", fundo: "#09090b", superficie: "#18181b", texto: "#fafafa", textoSecundario: "#a1a1aa", borda: "#3f3f46", bordaFoco: "#6366f1" },
  },
  terra: {
    primaria: "#b45309", primariaHover: "#92400e", primariaSuave: "#fef3c7",
    fundo: "#faf7f2", superficie: "#fffef9", texto: "#292524",
    textoSecundario: "#78716c", borda: "#e7e5e4", bordaFoco: "#d97706",
    escuras: { primaria: "#d97706", primariaHover: "#f59e0b", primariaSuave: "#451a03", fundo: "#1c1410", superficie: "#292019", texto: "#faf5ef", textoSecundario: "#b8a894", borda: "#4a3a2c", bordaFoco: "#f59e0b" },
  },
  floresta: {
    primaria: "#15803d", primariaHover: "#166534", primariaSuave: "#dcfce7",
    fundo: "#f7faf7", superficie: "#ffffff", texto: "#1a2e1a",
    textoSecundario: "#6b7f6b", borda: "#dbe7db", bordaFoco: "#22c55e",
    escuras: { primaria: "#4ade80", primariaHover: "#86efac", primariaSuave: "#14532d", fundo: "#0d1510", superficie: "#16211a", texto: "#f0faf0", textoSecundario: "#93a893", borda: "#2a3d2e", bordaFoco: "#4ade80" },
  },
  oceano: {
    primaria: "#0369a1", primariaHover: "#075985", primariaSuave: "#e0f2fe",
    fundo: "#f8fafc", superficie: "#ffffff", texto: "#0f172a",
    textoSecundario: "#64748b", borda: "#e2e8f0", bordaFoco: "#38bdf8",
    escuras: { primaria: "#38bdf8", primariaHover: "#7dd3fc", primariaSuave: "#0c4a6e", fundo: "#0b1220", superficie: "#141f33", texto: "#f1f6fb", textoSecundario: "#8ba3bd", borda: "#28394f", bordaFoco: "#38bdf8" },
  },
  noturno: {
    primaria: "#22d3ee", primariaHover: "#06b6d4", primariaSuave: "#164e63",
    fundo: "#0f172a", superficie: "#1e293b", texto: "#e2e8f0",
    textoSecundario: "#94a3b8", borda: "#334155", bordaFoco: "#22d3ee",
    escuras: { primaria: "#67e8f9", primariaHover: "#a5f3fc", primariaSuave: "#0e2a33", fundo: "#020617", superficie: "#111c2e", texto: "#eef6fa", textoSecundario: "#8899ab", borda: "#22334a", bordaFoco: "#67e8f9" },
  },
  grafite: {
    primaria: "#f97316", primariaHover: "#ea580c", primariaSuave: "#ffedd5",
    fundo: "#18181b", superficie: "#27272a", texto: "#fafafa",
    textoSecundario: "#a1a1aa", borda: "#3f3f46", bordaFoco: "#fb923c",
    escuras: { primaria: "#fb923c", primariaHover: "#fdba74", primariaSuave: "#431407", fundo: "#101012", superficie: "#1d1d20", texto: "#fafafa", textoSecundario: "#a0a0a6", borda: "#3a3a40", bordaFoco: "#fb923c" },
  },
  neon: {
    primaria: "#a3e635", primariaHover: "#84cc16", primariaSuave: "#365314",
    fundo: "#0a0a0a", superficie: "#171717", texto: "#fafafa",
    textoSecundario: "#a3a3a3", borda: "#262626", bordaFoco: "#a3e635",
    escuras: { primaria: "#bef264", primariaHover: "#d9f99d", primariaSuave: "#1a2e05", fundo: "#050505", superficie: "#101210", texto: "#fafafa", textoSecundario: "#9ca89c", borda: "#1f241f", bordaFoco: "#bef264" },
  },
  pixel: {
    primaria: "#fbbf24", primariaHover: "#f59e0b", primariaSuave: "#451a03",
    fundo: "#111827", superficie: "#1f2937", texto: "#f9fafb",
    textoSecundario: "#9ca3af", borda: "#374151", bordaFoco: "#fbbf24",
    escuras: { primaria: "#fcd34d", primariaHover: "#fde68a", primariaSuave: "#3b2a05", fundo: "#0a0d16", superficie: "#151a28", texto: "#f9fafb", textoSecundario: "#98a1b3", borda: "#2b3446", bordaFoco: "#fcd34d" },
  },
};

const TIPOGRAFIAS: Record<string, TipografiaDesign> = {
  padrao: {
    fonte: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    fonteTitulo: '"Inter", "Segoe UI", system-ui, sans-serif',
    fonteMono: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
  },
  humanista: {
    fonte: '"Nunito Sans", "Segoe UI", system-ui, sans-serif',
    fonteTitulo: '"Source Serif 4", Georgia, serif',
    fonteMono: '"IBM Plex Mono", "Consolas", monospace',
  },
  tecnica: {
    fonte: '"IBM Plex Sans", system-ui, sans-serif',
    fonteTitulo: '"IBM Plex Mono", "Consolas", monospace',
    fonteMono: '"IBM Plex Mono", "Consolas", monospace',
  },
  display: {
    fonte: '"Inter", system-ui, sans-serif',
    fonteTitulo: '"Fraunces", Georgia, serif',
    fonteMono: '"JetBrains Mono", monospace',
  },
};

const DENSIDADES: Record<string, EscalaTipografica> = {
  compacta: { base: "0.875rem", titulo: "1.5rem", subtitulo: "1.125rem", pequeno: "0.75rem" },
  padrao: { base: "0.9375rem", titulo: "1.75rem", subtitulo: "1.25rem", pequeno: "0.8125rem" },
  confortavel: { base: "1rem", titulo: "1.875rem", subtitulo: "1.375rem", pequeno: "0.875rem" },
};

const FORMAS: Record<string, FormaDesign> = {
  reta: { raio: "0", raioLg: "0" },
  padrao: { raio: "0.5rem", raioLg: "0.75rem" },
  arredondada: { raio: "0.75rem", raioLg: "1rem" },
  pill: { raio: "999px", raioLg: "999px" },
};

const MOVIMENTOS: Record<string, string> = {
  nenhum: "0s",
  padrao: "150ms",
  suave: "280ms",
};

const CHAVES_COR: Record<string, keyof CoresDesign> = {
  cor_primaria: "primaria",
  cor_primaria_hover: "primariaHover",
  cor_primaria_suave: "primariaSuave",
  cor_fundo: "fundo",
  cor_superficie: "superficie",
  cor_texto: "texto",
  cor_texto_secundario: "textoSecundario",
  cor_borda: "borda",
};

const CHAVES_COR_ESCURA: Record<string, keyof CoresDesign> = {
  cor_primaria_escuro: "primaria",
  cor_primaria_hover_escuro: "primariaHover",
  cor_primaria_suave_escuro: "primariaSuave",
  cor_fundo_escuro: "fundo",
  cor_superficie_escuro: "superficie",
  cor_texto_escuro: "texto",
  cor_texto_secundario_escuro: "textoSecundario",
  cor_borda_escuro: "borda",
};

export function resolverDesignTokens(design?: DesignDeclarado): DesignTokensResolvidos {
  const tokens = design?.tokens ?? {};
  const paleta = PALETAS[tokens.paleta ?? "padrao"] ?? PALETAS.padrao!;
  const { escuras, ...cores } = { ...paleta, escuras: { ...paleta.escuras } };
  const coresEscuras = escuras;
  const tipografia = { ...TIPOGRAFIAS[tokens.tipografia ?? "padrao"] ?? TIPOGRAFIAS.padrao! };
  const escala = { ...DENSIDADES[tokens.densidade ?? "padrao"] ?? DENSIDADES.padrao! };
  const forma = { ...FORMAS[tokens.forma ?? "padrao"] ?? FORMAS.padrao! };
  const movimentoDuracao = MOVIMENTOS[tokens.movimento ?? "padrao"] ?? MOVIMENTOS.padrao!;

  const overrides = tokens.overrides ?? {};
  for (const [chave, valor] of Object.entries(overrides)) {
    const alvoCor = CHAVES_COR[chave];
    const alvoCorEscura = CHAVES_COR_ESCURA[chave];
    if (alvoCor) {
      cores[alvoCor] = valor;
    } else if (alvoCorEscura) {
      coresEscuras[alvoCorEscura] = valor;
    } else if (chave === "fonte") {
      tipografia.fonte = valor;
    } else if (chave === "fonte_titulo") {
      tipografia.fonteTitulo = valor;
    } else if (chave === "fonte_mono") {
      tipografia.fonteMono = valor;
    } else if (chave === "raio_base") {
      forma.raio = valor;
      forma.raioLg = valor;
    }
  }

  return { cores, coresEscuras, tipografia, escala, forma, movimentoDuracao };
}

export function listarNomesDesign(): { paletas: string[]; tipografias: string[]; densidades: string[]; formas: string[]; movimentos: string[] } {
  return {
    paletas: Object.keys(PALETAS),
    tipografias: Object.keys(TIPOGRAFIAS),
    densidades: Object.keys(DENSIDADES),
    formas: Object.keys(FORMAS),
    movimentos: Object.keys(MOVIMENTOS),
  };
}
