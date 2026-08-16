// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: define o contrato público e injetável da distribuição local global da CLI e da skill Sema.

export const ESTADOS_DISTRIBUICAO_GLOBAL = [
  "READY",
  "MISSING",
  "STALE",
  "BROKEN_TARGET",
  "PERMISSION_DENIED",
] as const;

export type EstadoDistribuicaoGlobal = typeof ESTADOS_DISTRIBUICAO_GLOBAL[number];

export interface OpcoesAmbienteDistribuicaoGlobal {
  /** Plataforma usada para escolher o formato do launcher. */
  plataforma?: NodeJS.Platform;
  /** Home explícita. A implementação nunca consulta outro diretório quando este valor é informado. */
  diretorioUsuario?: string;
  /** Executável absoluto do Node que será embutido no launcher. */
  executavelNode?: string;
  /** Raiz absoluta do pacote @semacode/cli instalado. */
  raizPacote?: string;
}

export type CodigoDiagnosticoDistribuicaoGlobal =
  | "AMBIENTE_INVALIDO"
  | "CAMINHO_FORA_DA_HOME"
  | "COMPONENTE_NAO_DIRETORIO"
  | "CONTEUDO_NAO_GERENCIADO"
  | "DESTINO_ALTERADO"
  | "DESTINO_AUSENTE"
  | "DESTINO_DESATUALIZADO"
  | "DESTINO_PRONTO"
  | "ERRO_PERMISSAO"
  | "EXECUTAVEL_NODE_INVALIDO"
  | "LIMPEZA_PENDENTE"
  | "LOCK_PERDIDO"
  | "LOCK_TIMEOUT"
  | "PACOTE_INVALIDO"
  | "PERMISSAO_EXECUCAO_INVALIDA"
  | "RECIBO_INVALIDO"
  | "ROLLBACK_FALHOU"
  | "SYMLINK_OU_JUNCTION"
  | "TARGET_CLI_INVALIDO";

export interface ResultadoLauncherGlobal {
  estado: EstadoDistribuicaoGlobal;
  alterado: boolean;
  destino_simbolico: "$HOME/.sema/bin/sema" | "$HOME/.sema/bin/sema.cmd";
  codigo: CodigoDiagnosticoDistribuicaoGlobal;
  node_absoluto: boolean;
  entrypoint_absoluto: boolean;
  recibo_valido: boolean;
  independente_path: boolean;
  fallback_simbolico: "$HOME/.sema/bin/sema-managed.ps1" | null;
}

export type IdentificadorDestinoSkillGlobal = "agents" | "claude";

export interface ResultadoDestinoSkillGlobal {
  id: IdentificadorDestinoSkillGlobal;
  estado: EstadoDistribuicaoGlobal;
  alterado: boolean;
  destino_simbolico: "$HOME/.agents/skills/sema" | "$HOME/.claude/skills/sema";
  codigo: CodigoDiagnosticoDistribuicaoGlobal;
}

export interface ResultadoSkillGlobal {
  estado: EstadoDistribuicaoGlobal;
  alterado: boolean;
  origem_simbolica: "$PACKAGE_ROOT/skills/sema";
  destino_agents: EstadoDistribuicaoGlobal;
  destino_claude: EstadoDistribuicaoGlobal | "NOT_DETECTED";
  espelho_claude_detectado: boolean;
  ownership_valido: boolean;
  digest_alinhado: boolean;
  cache_plugin_intocado: true;
  destinos: ResultadoDestinoSkillGlobal[];
}

export interface ResultadoDistribuicaoGlobal {
  estado: EstadoDistribuicaoGlobal;
  alterado: boolean;
  launcher: ResultadoLauncherGlobal;
  skill: ResultadoSkillGlobal;
}
