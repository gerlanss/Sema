import type { BlocoGenericoAst, CampoAst } from "../ast/tipos.js";

export type EngineBanco = "postgres" | "mysql" | "sqlite" | "mongodb" | "redis";
export type TipoRecursoPersistencia =
  | "table"
  | "view"
  | "query"
  | "transaction"
  | "index"
  | "constraint"
  | "relationship"
  | "collection"
  | "document"
  | "keyspace"
  | "stream"
  | "lock"
  | "retention"
  | "replication";
export type StatusCompatibilidadePersistencia = "nativo" | "adaptado" | "parcial" | "invalido";
export type ConsistenciaPersistencia = "eventual" | "forte" | "serializable" | "snapshot" | "causal";
export type DurabilidadePersistencia = "baixa" | "media" | "alta";
export type ModeloTransacaoPersistencia = "mvcc" | "bloqueio" | "documento" | "otimista" | "single_thread";
export type ModeloConsultaPersistencia = "sql" | "documento" | "chave_valor" | "pipeline" | "stream";

export interface CompatibilidadePersistencia {
  engine: EngineBanco;
  status: StatusCompatibilidadePersistencia;
  motivo: string;
}

export const ENGINES_BANCO_SUPORTADOS = new Set<EngineBanco>([
  "postgres",
  "mysql",
  "sqlite",
  "mongodb",
  "redis",
]);

export const TIPOS_RECURSO_PERSISTENCIA = new Set<TipoRecursoPersistencia>([
  "table",
  "view",
  "query",
  "transaction",
  "index",
  "constraint",
  "relationship",
  "collection",
  "document",
  "keyspace",
  "stream",
  "lock",
  "retention",
  "replication",
]);

export const CAMPOS_DATABASE_SUPORTADOS = new Set([
  "engine",
  "schema",
  "database",
  "consistency",
  "durability",
  "transaction_model",
  "query_model",
  "portavel",
  "adapter",
  "perfil",
  "compatibilidade",
]);

export const CAMPOS_RECURSO_PERSISTENCIA_SUPORTADOS = new Set([
  "entity",
  "consistency",
  "durability",
  "transaction_model",
  "query_model",
  "portavel",
  "mode",
  "isolation",
  "strategy",
  "ttl",
  "retention",
  "path",
  "from",
  "to",
  "surface",
  "adapter",
  "resource_kind",
  "collection",
  "table",
  "compatibilidade",
]);

const CONSISTENCIAS_SUPORTADAS = new Set<ConsistenciaPersistencia>([
  "eventual",
  "forte",
  "serializable",
  "snapshot",
  "causal",
]);

const DURABILIDADES_SUPORTADAS = new Set<DurabilidadePersistencia>([
  "baixa",
  "media",
  "alta",
]);

const MODELOS_TRANSACAO_SUPORTADOS = new Set<ModeloTransacaoPersistencia>([
  "mvcc",
  "bloqueio",
  "documento",
  "otimista",
  "single_thread",
]);

const MODELOS_CONSULTA_SUPORTADOS = new Set<ModeloConsultaPersistencia>([
  "sql",
  "documento",
  "chave_valor",
  "pipeline",
  "stream",
]);

export function valorCampoCompletoPersistencia(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }
  return [campo.valor, ...campo.modificadores].join(" ").trim() || undefined;
}

export function localizarCampoPersistencia(bloco: BlocoGenericoAst | undefined, ...nomes: string[]): CampoAst | undefined {
  return bloco?.campos.find((campo) => nomes.includes(campo.nome));
}

export function parsearBooleanoPersistencia(valor?: string): boolean | undefined {
  if (!valor) {
    return undefined;
  }
  const normalizado = valor.toLowerCase();
  if (normalizado === "verdadeiro" || normalizado === "true") {
    return true;
  }
  if (normalizado === "falso" || normalizado === "false") {
    return false;
  }
  return undefined;
}

export function normalizarEngineBanco(valor?: string): EngineBanco | undefined {
  switch ((valor ?? "").toLowerCase()) {
    case "postgres":
    case "postgresql":
      return "postgres";
    case "mysql":
      return "mysql";
    case "sqlite":
    case "sqlite3":
      return "sqlite";
    case "mongo":
    case "mongodb":
      return "mongodb";
    case "redis":
      return "redis";
    default:
      return undefined;
  }
}

export function normalizarConsistenciaPersistencia(valor?: string): ConsistenciaPersistencia | undefined {
  if (!valor) {
    return undefined;
  }
  const normalizado = valor.toLowerCase() as ConsistenciaPersistencia;
  return CONSISTENCIAS_SUPORTADAS.has(normalizado) ? normalizado : undefined;
}

export function normalizarDurabilidadePersistencia(valor?: string): DurabilidadePersistencia | undefined {
  if (!valor) {
    return undefined;
  }
  const normalizado = valor.toLowerCase() as DurabilidadePersistencia;
  return DURABILIDADES_SUPORTADAS.has(normalizado) ? normalizado : undefined;
}

export function normalizarModeloTransacaoPersistencia(valor?: string): ModeloTransacaoPersistencia | undefined {
  if (!valor) {
    return undefined;
  }
  const normalizado = valor.toLowerCase() as ModeloTransacaoPersistencia;
  return MODELOS_TRANSACAO_SUPORTADOS.has(normalizado) ? normalizado : undefined;
}

export function normalizarModeloConsultaPersistencia(valor?: string): ModeloConsultaPersistencia | undefined {
  if (!valor) {
    return undefined;
  }
  const normalizado = valor.toLowerCase() as ModeloConsultaPersistencia;
  return MODELOS_CONSULTA_SUPORTADOS.has(normalizado) ? normalizado : undefined;
}

export function nomeTipoRecursoPersistencia(bloco: BlocoGenericoAst): TipoRecursoPersistencia | undefined {
  const candidato = (
    bloco.palavraChave === "desconhecido"
      ? bloco.nome
      : bloco.palavraChave
  )?.toLowerCase();

  if (!candidato) {
    return undefined;
  }

  return TIPOS_RECURSO_PERSISTENCIA.has(candidato as TipoRecursoPersistencia)
    ? candidato as TipoRecursoPersistencia
    : undefined;
}

export function listarRecursosPersistencia(bloco: BlocoGenericoAst | undefined): BlocoGenericoAst[] {
  if (!bloco) {
    return [];
  }
  return bloco.blocos.filter((item): item is BlocoGenericoAst =>
    item.tipo === "bloco_generico" && Boolean(nomeTipoRecursoPersistencia(item)));
}

function compatibilidadeBasica(
  engine: EngineBanco,
  status: StatusCompatibilidadePersistencia,
  motivo: string,
): CompatibilidadePersistencia {
  return { engine, status, motivo };
}

function classificarCompatibilidadePorTipo(
  tipo: TipoRecursoPersistencia,
  engine: EngineBanco,
): CompatibilidadePersistencia {
  switch (tipo) {
    case "table":
    case "view":
      if (engine === "postgres" || engine === "mysql" || engine === "sqlite") {
        return compatibilidadeBasica(engine, "nativo", `${tipo} e nativo em motores relacionais.`);
      }
      return compatibilidadeBasica(engine, "invalido", `${tipo} nao existe como primitivo em ${engine}.`);
    case "query":
      if (engine === "postgres" || engine === "mysql" || engine === "sqlite" || engine === "mongodb") {
        return compatibilidadeBasica(engine, "nativo", `query e suportado de forma nativa em ${engine}.`);
      }
      return compatibilidadeBasica(engine, "parcial", "Redis consulta dados, mas a expressividade depende da estrutura escolhida.");
    case "transaction":
      if (engine === "postgres" || engine === "mysql" || engine === "sqlite") {
        return compatibilidadeBasica(engine, "nativo", "Transacao ACID e parte do contrato principal do engine.");
      }
      if (engine === "mongodb") {
        return compatibilidadeBasica(engine, "parcial", "MongoDB suporta transacoes, mas com restricoes operacionais e de topologia.");
      }
      return compatibilidadeBasica(engine, "invalido", "Redis nao oferece transacao de banco relacional como primitivo equivalente.");
    case "index":
      if (engine === "postgres" || engine === "mysql" || engine === "sqlite" || engine === "mongodb") {
        return compatibilidadeBasica(engine, "nativo", "Indexacao e um recurso nativo do engine.");
      }
      return compatibilidadeBasica(engine, "parcial", "Redis indexa via modulos/estrategias especificas, nao como indice generico universal.");
    case "constraint":
      if (engine === "postgres" || engine === "mysql") {
        return compatibilidadeBasica(engine, "nativo", "Constraints fazem parte do contrato relacional do engine.");
      }
      if (engine === "sqlite") {
        return compatibilidadeBasica(engine, "parcial", "SQLite suporta constraints, mas com escopo e enforcement mais limitados.");
      }
      return compatibilidadeBasica(engine, "invalido", `Constraint relacional nao e nativo em ${engine}.`);
    case "relationship":
      if (engine === "postgres" || engine === "mysql" || engine === "sqlite") {
        return compatibilidadeBasica(engine, "nativo", "Relacionamentos por chave e join sao nativos em motores relacionais.");
      }
      if (engine === "mongodb") {
        return compatibilidadeBasica(engine, "adaptado", "MongoDB modela relacionamento por referencia ou embutimento.");
      }
      return compatibilidadeBasica(engine, "invalido", "Redis nao modela relacionamento com garantias relacionais nativas.");
    case "collection":
      return engine === "mongodb"
        ? compatibilidadeBasica(engine, "nativo", "Collection e o recurso estrutural principal do MongoDB.")
        : compatibilidadeBasica(engine, "invalido", `Collection nao e recurso estrutural nativo de ${engine}.`);
    case "document":
      if (engine === "mongodb") {
        return compatibilidadeBasica(engine, "nativo", "Documentos sao o recurso central do MongoDB.");
      }
      if (engine === "postgres" || engine === "mysql" || engine === "sqlite") {
        return compatibilidadeBasica(engine, "adaptado", "Documentos podem ser modelados sobre JSON ou blobs estruturados.");
      }
      return compatibilidadeBasica(engine, "parcial", "Redis suporta documentos por modulos, mas nao como baseline universal.");
    case "keyspace":
      return engine === "redis"
        ? compatibilidadeBasica(engine, "nativo", "Keyspace e o modelo estrutural primario do Redis.")
        : compatibilidadeBasica(engine, "invalido", `Keyspace nao e primitivo nativo em ${engine}.`);
    case "stream":
      if (engine === "redis") {
        return compatibilidadeBasica(engine, "nativo", "Streams sao nativos em Redis.");
      }
      if (engine === "postgres" || engine === "mysql") {
        return compatibilidadeBasica(engine, "adaptado", "Stream exige adaptacao sobre log, outbox ou fila auxiliar.");
      }
      if (engine === "mongodb") {
        return compatibilidadeBasica(engine, "parcial", "MongoDB oferece change streams, mas nao um stream geral identico.");
      }
      return compatibilidadeBasica(engine, "invalido", "SQLite nao oferece stream nativo comparavel.");
    case "lock":
      if (engine === "postgres" || engine === "mysql") {
        return compatibilidadeBasica(engine, "nativo", "Locks e concorrencia controlada sao nativos do engine.");
      }
      if (engine === "sqlite" || engine === "mongodb") {
        return compatibilidadeBasica(engine, "parcial", "O engine controla concorrencia, mas com semantica diferente de lock explicito relacional.");
      }
      return compatibilidadeBasica(engine, "adaptado", "Redis consegue coordenar lock, mas por convencao e nao por contrato relacional.");
    case "retention":
      if (engine === "redis" || engine === "mongodb") {
        return compatibilidadeBasica(engine, "nativo", "Retencao/TTL faz parte do repertorio nativo do engine.");
      }
      return compatibilidadeBasica(engine, "adaptado", "Retencao exige politica auxiliar, cleanup agendado ou particionamento.");
    case "replication":
      if (engine === "sqlite") {
        return compatibilidadeBasica(engine, "invalido", "SQLite nao trata replicacao como capacidade nativa principal.");
      }
      return compatibilidadeBasica(engine, "nativo", "Replicacao e tratada como capacidade oficial do engine ou da plataforma gerenciada.");
    default:
      return compatibilidadeBasica(engine, "invalido", `Recurso ${tipo} ainda nao foi classificado para ${engine}.`);
  }
}

export function classificarCompatibilidadePersistencia(
  tipo: TipoRecursoPersistencia,
  engine: EngineBanco,
  opcoes: {
    mode?: string;
    isolation?: string;
  } = {},
): CompatibilidadePersistencia {
  const compatibilidade = classificarCompatibilidadePorTipo(tipo, engine);

  if (tipo === "query") {
    const modo = normalizarModeloConsultaPersistencia(opcoes.mode);
    if (modo === "sql" && (engine === "mongodb" || engine === "redis")) {
      return compatibilidadeBasica(engine, "invalido", `Query em modo sql nao e nativo em ${engine}.`);
    }
    if (modo === "documento" && (engine === "postgres" || engine === "mysql" || engine === "sqlite")) {
      return compatibilidadeBasica(engine, "adaptado", `Query documental em ${engine} depende de JSON e adaptacao do runtime.`);
    }
    if (modo === "pipeline" && engine !== "mongodb") {
      return compatibilidadeBasica(engine, engine === "redis" ? "parcial" : "invalido", `Pipeline foi pedido, mas ${engine} nao tem pipeline documental nativo equivalente ao MongoDB.`);
    }
    if (modo === "stream" && engine !== "redis") {
      return compatibilidadeBasica(engine, compatibilidade.status === "nativo" ? "adaptado" : compatibilidade.status, `Query orientada a stream em ${engine} exige adaptacao fora do baseline do engine.`);
    }
  }

  if (tipo === "transaction" && opcoes.isolation && (engine === "mongodb" || engine === "redis")) {
    return compatibilidadeBasica(engine, "invalido", `Transaction com isolation explicita nao e suportada de forma equivalente em ${engine}.`);
  }

  return compatibilidade;
}

export function matrizCompatibilidadePersistencia(
  tipo: TipoRecursoPersistencia,
  opcoes: {
    mode?: string;
    isolation?: string;
  } = {},
): CompatibilidadePersistencia[] {
  return [...ENGINES_BANCO_SUPORTADOS].map((engine) => classificarCompatibilidadePersistencia(tipo, engine, opcoes));
}

export function recursoPersistenciaPodeSerPortavel(
  tipo: TipoRecursoPersistencia,
  opcoes: {
    mode?: string;
    isolation?: string;
  } = {},
): boolean {
  return matrizCompatibilidadePersistencia(tipo, opcoes)
    .every((item) => item.status === "nativo" || item.status === "adaptado");
}
