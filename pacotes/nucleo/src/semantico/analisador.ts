import { criarDiagnostico, type Diagnostico } from "../diagnosticos/index.js";
import type {
  BlocoCasoTesteAst,
  BlocoGenericoAst,
  CampoAst,
  EntityAst,
  EnumAst,
  FlowAst,
  ModuloAst,
  RouteAst,
  StateAst,
  TaskAst,
  TypeAst,
} from "../ast/tipos.js";
import {
  ehCategoriaEfeitoSemantico,
  ehCriticidadeEfeitoSemantico,
  extrairReferenciasDaExpressao,
  parsearEfeitoSemantico,
  parsearEtapaFlow,
  parsearExpressaoSemantica,
  parsearTransicaoEstado,
} from "./estruturas.js";

export interface SimboloSemantico {
  nome: string;
  categoria: "tipo" | "entity" | "enum" | "task" | "flow" | "route" | "state" | "worker" | "evento" | "fila" | "cron" | "webhook" | "cache" | "storage" | "policy";
}

export interface CampoSemantico {
  nome: string;
  tipo: string;
  modificadores: string[];
}

export interface ErroSemanticoTask {
  codigo: string;
  mensagem: string;
  categoria?: string;
  recuperabilidade?: string;
  acaoChamador?: string;
  impactaEstado?: boolean;
  requerCompensacao?: boolean;
}

export interface ResumoTaskSemantico {
  input: CampoSemantico[];
  output: CampoSemantico[];
  errors: ErroSemanticoTask[];
  guarantees: string[];
  implementacoes: ImplementacaoTaskSemantica[];
}

export interface InteropSemantico {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
}

export interface ImplementacaoTaskSemantica {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
}

export interface ContextoSemantico {
  modulo: string;
  simbolos: Map<string, SimboloSemantico>;
  tiposConhecidos: Set<string>;
  tasksConhecidas: Set<string>;
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>;
  statesConhecidos: Map<string, { transicoes: Set<string> }>;
  modulosImportados: string[];
  interoperabilidades: InteropSemantico[];
  enumsConhecidos: Map<string, Set<string>>;
}

export interface ResultadoSemantico {
  contexto: ContextoSemantico;
  diagnosticos: Diagnostico[];
}

export interface OpcoesAnaliseSemantica {
  contextosModulos?: Map<string, ContextoSemantico>;
}

function ehUseInterop(
  use: ModuloAst["uses"][number],
): use is ModuloAst["uses"][number] & { origem: InteropSemantico["origem"] } {
  return use.origem !== "sema";
}

const TIPOS_PRIMITIVOS = new Set([
  "Texto",
  "Numero",
  "Inteiro",
  "Decimal",
  "Booleano",
  "Data",
  "DataHora",
  "Id",
  "Email",
  "Url",
  "Json",
  "Vazio",
]);
const TIPOS_COMPOSTOS_SUPORTADOS = new Set(["Lista", "Mapa", "Opcional", "Ou"]);
const CAMPOS_VINCULO_SUPORTADOS = new Set([
  "arquivo",
  "simbolo",
  "recurso",
  "superficie",
  "rota",
  "teste",
  "tabela",
  "fila",
  "job",
  "policy",
  "artefato",
  "evento",
  "cache",
  "storage",
  "worker",
  "cron",
  "webhook",
]);
const CAMPOS_EXECUCAO_SUPORTADOS = new Set([
  "idempotencia",
  "timeout",
  "retry",
  "compensacao",
  "criticidade_operacional",
]);
const CAMPOS_ERRO_OPERACIONAL = new Set([
  "mensagem",
  "categoria",
  "recuperabilidade",
  "acao_chamador",
  "impacta_estado",
  "requer_compensacao",
]);
const CRITICIDADES_OPERACIONAIS = new Set(["baixa", "media", "alta", "critica"]);

const PADRAO_CAMINHO_INTEROP = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;

function normalizarOrigemImplementacao(valor: string): ImplementacaoTaskSemantica["origem"] | undefined {
  switch (valor.toLowerCase()) {
    case "ts":
    case "typescript":
      return "ts";
    case "py":
    case "python":
      return "py";
    case "dart":
      return "dart";
    case "cs":
    case "csharp":
    case "dotnet":
      return "cs";
    case "java":
      return "java";
    case "go":
    case "golang":
      return "go";
    case "rust":
    case "rs":
      return "rust";
    case "cpp":
    case "cxx":
    case "cc":
    case "c++":
      return "cpp";
    default:
      return undefined;
  }
}

function extrairReferenciasDeTipos(texto: string): string[] {
  const correspondencias = texto.match(/[A-Z][A-Za-z0-9_]*/g);
  return (correspondencias ?? []).filter((referencia) => !TIPOS_COMPOSTOS_SUPORTADOS.has(referencia));
}

function extrairRaiz(referencia: string): string {
  return referencia.split(".")[0] ?? referencia;
}

function ehMarcadorSemantico(referencia: string): boolean {
  return ["persistencia", "sucesso", "estado"].includes(extrairRaiz(referencia));
}

function diagnosticoDuplicado(nome: string, categoria: string, intervalo?: CampoAst["intervalo"]): Diagnostico {
  return criarDiagnostico(
    "SEM001",
    `${categoria} "${nome}" foi declarado mais de uma vez no mesmo modulo.`,
    "erro",
    intervalo,
    "Use nomes unicos para simbolos do modulo.",
  );
}

function validarCamposDeTipos(
  campos: CampoAst[],
  tiposConhecidos: Set<string>,
  diagnosticos: Diagnostico[],
  contexto: string,
): void {
  for (const campo of campos) {
    const referencias = extrairReferenciasDeTipos(campo.valor);
    for (const referencia of referencias) {
      if (!tiposConhecidos.has(referencia)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM002",
            `Tipo "${referencia}" nao foi encontrado em ${contexto}.`,
            "erro",
            campo.intervalo,
            "Declare o tipo, entidade ou enum antes de usa-lo.",
          ),
        );
      }
    }
  }
}

function localizarBloco(corpo: BlocoGenericoAst, nome: string): BlocoGenericoAst | undefined {
  return corpo.blocos.find((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico" && bloco.palavraChave === nome);
}

function localizarCampo(bloco: BlocoGenericoAst, ...nomes: string[]): CampoAst | undefined {
  return bloco.campos.find((campo) => nomes.includes(campo.nome));
}

function valorCampoCompleto(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }
  return [campo.valor, ...campo.modificadores].join(" ").trim() || undefined;
}

function parsearBooleanoSemantico(valor?: string): boolean | undefined {
  if (!valor) {
    return undefined;
  }
  if (valor === "verdadeiro" || valor === "true") {
    return true;
  }
  if (valor === "falso" || valor === "false") {
    return false;
  }
  return undefined;
}

function converterCampoSemantico(campo: CampoAst): CampoSemantico {
  return {
    nome: campo.nome,
    tipo: campo.valor,
    modificadores: [...campo.modificadores],
  };
}

function indicesCampos(campos: CampoSemantico[]): Map<string, CampoSemantico> {
  return new Map(campos.map((campo) => [campo.nome, campo]));
}

function indiceErros(erros: ErroSemanticoTask[]): Map<string, ErroSemanticoTask> {
  return new Map(erros.map((erro) => [erro.codigo, erro]));
}

function coletarErrosTask(task: TaskAst): ErroSemanticoTask[] {
  const erros = new Map<string, ErroSemanticoTask>();
  for (const campo of task.error?.campos ?? []) {
    erros.set(campo.nome, {
      codigo: campo.nome,
      mensagem: [campo.valor, ...campo.modificadores].join(" ").trim(),
    });
  }

  for (const bloco of task.error?.blocos ?? []) {
    if (bloco.tipo !== "bloco_generico") {
      continue;
    }
    const codigo = bloco.nome ?? bloco.palavraChave;
    if (!codigo || codigo === "desconhecido") {
      continue;
    }

    erros.set(codigo, {
      codigo,
      mensagem: valorCampoCompleto(localizarCampo(bloco, "mensagem")) ?? `Erro estruturado "${codigo}".`,
      categoria: valorCampoCompleto(localizarCampo(bloco, "categoria")),
      recuperabilidade: valorCampoCompleto(localizarCampo(bloco, "recuperabilidade")),
      acaoChamador: valorCampoCompleto(localizarCampo(bloco, "acao_chamador")),
      impactaEstado: parsearBooleanoSemantico(valorCampoCompleto(localizarCampo(bloco, "impacta_estado"))),
      requerCompensacao: parsearBooleanoSemantico(valorCampoCompleto(localizarCampo(bloco, "requer_compensacao"))),
    });
  }

  for (const bloco of task.tests?.blocos ?? []) {
    if (bloco.tipo !== "caso_teste") {
      continue;
    }
    const codigoErro = bloco.error?.campos.find((campo) => campo.nome === "tipo")?.valor;
    if (codigoErro && !erros.has(codigoErro)) {
      erros.set(codigoErro, {
        codigo: codigoErro,
        mensagem: `Erro sintetico derivado do caso de teste "${bloco.nome}".`,
      });
    }
  }

  return [...erros.values()];
}

function coletarResumoTask(task: TaskAst): ResumoTaskSemantico {
  return {
    input: (task.input?.campos ?? []).map(converterCampoSemantico),
    output: (task.output?.campos ?? []).map(converterCampoSemantico),
    errors: coletarErrosTask(task),
    guarantees: (task.guarantees?.linhas ?? []).map((linha) => linha.conteudo),
    implementacoes: (task.impl?.campos ?? [])
      .map((campo) => {
        const origem = normalizarOrigemImplementacao(campo.nome);
        return origem ? { origem, caminho: campo.valor } : undefined;
      })
      .filter((item): item is ImplementacaoTaskSemantica => Boolean(item)),
  };
}

function validarImplementacoesTask(task: TaskAst, diagnosticos: Diagnostico[]): void {
  if (!task.impl) {
    return;
  }

  const origens = new Set<string>();
  for (const campo of task.impl.campos) {
    const origem = normalizarOrigemImplementacao(campo.nome);
    if (!origem) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM059",
          `Task "${task.nome}" declarou implementacao externa invalida em impl: "${campo.nome}".`,
          "erro",
          campo.intervalo,
          "Use apenas ts, py, dart, cs, java, go, rust ou cpp dentro do bloco impl.",
        ),
      );
      continue;
    }

    if (origens.has(origem)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM060",
          `Task "${task.nome}" declarou mais de uma implementacao ${origem} no bloco impl.`,
          "erro",
          campo.intervalo,
          "Cada origem externa deve aparecer no maximo uma vez dentro de impl.",
        ),
      );
      continue;
    }
    origens.add(origem);

    if (!PADRAO_CAMINHO_INTEROP.test(campo.valor)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM061",
          `Task "${task.nome}" declarou caminho invalido para impl ${origem}: "${campo.valor}".`,
          "erro",
          campo.intervalo,
          "Use um identificador de implementacao como pacote.modulo.funcao ou app.servico.metodo.",
        ),
      );
    }
  }
}

function validarVinculos(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_VINCULO_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM064",
          `Campo de vinculo "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use arquivo, simbolo, recurso, superficie, rota, teste, tabela, fila, job, policy, artefato, evento, cache, storage, worker, cron ou webhook.",
        ),
      );
    }
  }
}

function validarExecucao(task: TaskAst, diagnosticos: Diagnostico[]): void {
  if (!task.execucao) {
    return;
  }

  for (const campo of task.execucao.campos) {
    if (!CAMPOS_EXECUCAO_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM065",
          `Campo de execucao "${campo.nome}" nao e suportado na task "${task.nome}".`,
          "erro",
          campo.intervalo,
          "Use apenas idempotencia, timeout, retry, compensacao ou criticidade_operacional.",
        ),
      );
      continue;
    }

    if (campo.nome === "criticidade_operacional") {
      const criticidade = valorCampoCompleto(campo);
      if (criticidade && !CRITICIDADES_OPERACIONAIS.has(criticidade)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM066",
            `Task "${task.nome}" declarou criticidade_operacional invalida: "${criticidade}".`,
            "erro",
            campo.intervalo,
            "Use apenas baixa, media, alta ou critica em execucao.",
          ),
        );
      }
    }
  }
}

function validarErroOperacional(task: TaskAst, diagnosticos: Diagnostico[]): void {
  if (!task.error) {
    return;
  }

  const nomes = new Set<string>();
  for (const campo of task.error.campos) {
    if (nomes.has(campo.nome)) {
      diagnosticos.push(diagnosticoDuplicado(campo.nome, "Erro", campo.intervalo));
    }
    nomes.add(campo.nome);
  }

  for (const bloco of task.error.blocos) {
    if (bloco.tipo !== "bloco_generico") {
      continue;
    }

    const codigo = bloco.nome ?? bloco.palavraChave;
    if (!codigo || codigo === "desconhecido") {
      continue;
    }

    if (nomes.has(codigo)) {
      diagnosticos.push(diagnosticoDuplicado(codigo, "Erro", bloco.intervalo));
    }
    nomes.add(codigo);

    const mensagem = localizarCampo(bloco, "mensagem");
    if (!mensagem) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM067",
          `Erro estruturado "${codigo}" da task "${task.nome}" precisa declarar mensagem.`,
          "erro",
          bloco.intervalo,
          "Use error { codigo { mensagem: \"...\" categoria: dominio ... } }.",
        ),
      );
    }

    for (const campo of bloco.campos) {
      if (!CAMPOS_ERRO_OPERACIONAL.has(campo.nome)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM068",
            `Erro estruturado "${codigo}" da task "${task.nome}" usa o campo "${campo.nome}", que nao e suportado.`,
            "erro",
            campo.intervalo,
            "Use mensagem, categoria, recuperabilidade, acao_chamador, impacta_estado ou requer_compensacao.",
          ),
        );
      }
    }
  }
}

function validarSuperficie(
  superficie: BlocoGenericoAst,
  tipoSuperficie: SimboloSemantico["categoria"],
  tasksConhecidas: Set<string>,
  tiposConhecidos: Set<string>,
  diagnosticos: Diagnostico[],
): void {
  const nomeSuperficie = superficie.nome ?? tipoSuperficie;
  const task = localizarCampo(superficie, "task", "tarefa");
  const input = localizarBloco(superficie, "input");
  const output = localizarBloco(superficie, "output");
  const effects = localizarBloco(superficie, "effects");
  const impl = localizarBloco(superficie, "impl");
  const vinculos = localizarBloco(superficie, "vinculos");

  if (!task && !impl && !vinculos) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM069",
        `Superficie ${tipoSuperficie} "${nomeSuperficie}" precisa declarar task, impl ou vinculos para nao virar bloco decorativo.`,
        "erro",
        superficie.intervalo,
        "Declare ao menos uma task associada, um impl explicito ou vinculos rastreaveis com codigo vivo.",
      ),
    );
  }

  if (task && !tasksConhecidas.has(task.valor)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM070",
        `Superficie ${tipoSuperficie} "${nomeSuperficie}" referencia task "${task.valor}" que nao existe.`,
        "erro",
        task.intervalo,
        "Ajuste a task para apontar para uma task declarada ou importada.",
      ),
    );
  }

  if (input) {
    validarCamposDeTipos(input.campos, tiposConhecidos, diagnosticos, `input da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  if (output) {
    validarCamposDeTipos(output.campos, tiposConhecidos, diagnosticos, `output da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  validarVinculos(vinculos, diagnosticos, `${tipoSuperficie} ${nomeSuperficie}`);
}

function recomporCaminhoRoute(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }

  return [campo.valor, ...campo.modificadores]
    .join(" ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function serializarTransicao(origem: string, destino: string): string {
  return `${origem}->${destino}`;
}

function descreverSugestoes(valores: Iterable<string>, prefixo: string): string | undefined {
  const lista = [...new Set([...valores].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (lista.length === 0) {
    return undefined;
  }
  const recorte = lista.slice(0, 6).join(", ");
  return `${prefixo}: ${recorte}${lista.length > 6 ? ", ..." : ""}.`;
}

function listarCandidatosUseRelativo(moduloAtual: string, caminhoImportado: string): string[] {
  const segmentos = moduloAtual.split(".").filter(Boolean);
  const caminhoNormalizado = caminhoImportado.replace(/^\.+/u, "").trim();
  if (!caminhoNormalizado || segmentos.length <= 1) {
    return [];
  }

  const candidatos: string[] = [];
  for (let tamanho = segmentos.length - 1; tamanho >= 1; tamanho -= 1) {
    const candidato = [...segmentos.slice(0, tamanho), caminhoNormalizado].join(".");
    if (candidato !== caminhoImportado) {
      candidatos.push(candidato);
    }
  }

  return [...new Set(candidatos)];
}

function resolverUseSema(
  moduloAtual: string,
  caminhoImportado: string,
  contextosModulos?: Map<string, ContextoSemantico>,
): { caminhoResolvido?: string; candidatosRelativos: string[] } {
  if (!contextosModulos) {
    return { caminhoResolvido: undefined, candidatosRelativos: [] };
  }

  if (contextosModulos.has(caminhoImportado)) {
    return { caminhoResolvido: caminhoImportado, candidatosRelativos: [] };
  }

  const candidatosRelativos = listarCandidatosUseRelativo(moduloAtual, caminhoImportado);
  const caminhoResolvido = candidatosRelativos.find((candidato) => contextosModulos.has(candidato));
  return { caminhoResolvido, candidatosRelativos };
}

function descreverDicaSintaxeExpressao(texto: string, dicaPadrao: string): string {
  const normalizado = texto.trim();
  if (
    /\sou\s/u.test(normalizado)
    && (
      normalizado.includes("\"")
      || normalizado.includes("'")
      || /^[A-Za-z_][A-Za-z0-9_.]*\s*(==|!=|>|<|>=|<=)\s+.+\s+ou\s+.+$/u.test(normalizado)
    )
    && !/\bem\s+\[/u.test(normalizado)
  ) {
    const alvo = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*(==|!=|>|<|>=|<=)/u)?.[1];
    if (alvo) {
      return `${dicaPadrao} Se a ideia era comparar ${alvo} contra varios valores, repita o campo em cada comparacao ou prefira "${alvo} em [A, B]".`;
    }
    return `${dicaPadrao} Se a ideia era comparar um campo contra varios valores, repita o campo em cada comparacao ou prefira "campo em [A, B]".`;
  }

  return dicaPadrao;
}

function validarExpressoesDeclaradas(
  linhas: BlocoGenericoAst["linhas"],
  diagnosticos: Diagnostico[],
  contexto: {
    codigoErroSintaxe: string;
    codigoErroReferencia: string;
    nomeBloco: string;
    simbolosPermitidos: Set<string>;
    dicaSintaxe: string;
    dicaReferencia: string;
    aceitarMarcadoresSemanticos?: boolean;
    dicaReferenciaPersonalizada?: (raiz: string, linha: string) => string | undefined;
  },
): void {
  for (const linha of linhas) {
    const expressao = parsearExpressaoSemantica(linha.conteudo);
    if (!expressao) {
      diagnosticos.push(
        criarDiagnostico(
          contexto.codigoErroSintaxe,
          `Declaracao invalida em ${contexto.nomeBloco}: "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          descreverDicaSintaxeExpressao(linha.conteudo, contexto.dicaSintaxe),
        ),
      );
      continue;
    }

    for (const referencia of extrairReferenciasDaExpressao(expressao)) {
      const raiz = extrairRaiz(referencia);
      const referenciaPermitida = contexto.simbolosPermitidos.has(raiz) || (contexto.aceitarMarcadoresSemanticos && ehMarcadorSemantico(raiz));
      if (!referenciaPermitida) {
        diagnosticos.push(
          criarDiagnostico(
            contexto.codigoErroReferencia,
            `Declaracao em ${contexto.nomeBloco} referencia "${raiz}", que nao pertence ao contexto permitido.`,
            "erro",
            linha.intervalo,
            contexto.dicaReferenciaPersonalizada?.(raiz, linha.conteudo) ?? contexto.dicaReferencia,
          ),
        );
      }
    }
  }
}

function validarEfeitosDeclarados(linhas: BlocoGenericoAst["linhas"], diagnosticos: Diagnostico[], contexto: string): void {
  for (const linha of linhas) {
    const efeito = parsearEfeitoSemantico(linha.conteudo);
    if (!efeito) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM023",
          `Declaracao invalida de efeito em ${contexto}: "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          "Use o formato \"categoria alvo\" ou \"categoria alvo detalhe\", com categorias como persistencia, consulta, evento, notificacao ou auditoria.",
        ),
      );
      continue;
    }

    if (!ehCategoriaEfeitoSemantico(efeito.categoria)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM048",
          `Categoria de efeito "${efeito.categoria}" nao e suportada em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use apenas persistencia, consulta, evento, notificacao ou auditoria.",
        ),
      );
    }

    if (efeito.criticidadeTexto && !ehCriticidadeEfeitoSemantico(efeito.criticidadeTexto)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM052",
          `Criticidade de efeito "${efeito.criticidadeTexto}" nao e suportada em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use apenas criticidade=baixa, criticidade=media, criticidade=alta ou criticidade=critica.",
        ),
      );
    }
  }
}

function validarState(
  state: StateAst,
  tiposConhecidos: Set<string>,
  enumsConhecidos: Map<string, Set<string>>,
  diagnosticos: Diagnostico[],
): void {
  const possuiConteudo = state.corpo.campos.length > 0 || state.corpo.linhas.length > 0 || state.corpo.blocos.length > 0;
  if (!possuiConteudo) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM011",
        `Bloco state${state.nome ? ` "${state.nome}"` : ""} precisa declarar campos, linhas ou subblocos.`,
        "erro",
        state.intervalo,
        "Use state para modelar informacao ou transicao observavel, nao como bloco vazio.",
      ),
    );
  }

  validarCamposDeTipos(state.corpo.campos, tiposConhecidos, diagnosticos, `state ${state.nome ?? "<anonimo>"}`);
  const fields = localizarBloco(state.corpo, "fields");
  if (fields) {
    validarCamposDeTipos(fields.campos, tiposConhecidos, diagnosticos, `fields do state ${state.nome ?? "<anonimo>"}`);
  }

  const nomesCampos = new Set([
    ...state.corpo.campos.map((campo) => campo.nome),
    ...(fields?.campos ?? []).map((campo) => campo.nome),
  ]);

  const invariants = localizarBloco(state.corpo, "invariants");
  if (invariants) {
    validarExpressoesDeclaradas(invariants.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM024",
      codigoErroReferencia: "SEM025",
      nomeBloco: `invariants do state ${state.nome ?? "<anonimo>"}`,
      simbolosPermitidos: nomesCampos,
      dicaSintaxe: "Use expressoes como \"campo existe\", \"campo == valor\" ou \"campo em [A, B]\".",
      dicaReferencia: "Referencie apenas campos do proprio state nas invariantes.",
    });
  }

  const transitions = localizarBloco(state.corpo, "transitions");
  if (transitions) {
    const campoTransicao = (fields?.campos ?? []).find((campo) => campo.nome === "status" || campo.nome === "estado")
      ?? state.corpo.campos.find((campo) => campo.nome === "status" || campo.nome === "estado");

    if (!campoTransicao) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM026",
          `State ${state.nome ? `"${state.nome}" ` : ""}declarou transitions sem um campo status ou estado.`,
          "erro",
          transitions.intervalo,
          "Adicione um campo status ou estado para ancorar semanticamente as transicoes.",
        ),
      );
    }

    const enumValores = campoTransicao ? enumsConhecidos.get(campoTransicao.valor) : undefined;
    for (const linha of transitions.linhas) {
      const transicao = parsearTransicaoEstado(linha.conteudo);
      if (!transicao) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM027",
            `Transicao invalida em state ${state.nome ?? "<anonimo>"}: "${linha.conteudo}".`,
            "erro",
            linha.intervalo,
            "Use o formato \"ORIGEM -> DESTINO\" para declarar transicoes.",
          ),
        );
        continue;
      }

      if (enumValores) {
        if (!enumValores.has(transicao.origem)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM028",
              `Transicao do state ${state.nome ?? "<anonimo>"} usa origem "${transicao.origem}" fora do enum ${campoTransicao?.valor}.`,
              "erro",
              linha.intervalo,
              "Use apenas valores declarados no enum associado ao campo status/estado.",
            ),
          );
        }
        if (!enumValores.has(transicao.destino)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM029",
              `Transicao do state ${state.nome ?? "<anonimo>"} usa destino "${transicao.destino}" fora do enum ${campoTransicao?.valor}.`,
              "erro",
              linha.intervalo,
              "Use apenas valores declarados no enum associado ao campo status/estado.",
            ),
          );
        }
      }
    }
  }
}

function validarInvariantesDeCampos(
  bloco: BlocoGenericoAst,
  nomeBloco: string,
  diagnosticos: Diagnostico[],
): void {
  const fields = localizarBloco(bloco, "fields");
  const nomesCampos = new Set([
    ...bloco.campos.map((campo) => campo.nome),
    ...(fields?.campos ?? []).map((campo) => campo.nome),
  ]);

  const invariants = localizarBloco(bloco, "invariants");
  if (!invariants) {
    return;
  }

  validarExpressoesDeclaradas(invariants.linhas, diagnosticos, {
    codigoErroSintaxe: "SEM062",
    codigoErroReferencia: "SEM063",
    nomeBloco: `invariants de ${nomeBloco}`,
    simbolosPermitidos: nomesCampos,
    dicaSintaxe: "Use expressoes como \"campo existe\", \"campo == valor\" ou \"campo em [A, B]\".",
    dicaReferencia: "Referencie apenas campos declarados no proprio bloco ao escrever invariantes de dominio.",
  });
}

function validarFlow(
  flow: FlowAst,
  tasksConhecidas: Set<string>,
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>,
  diagnosticos: Diagnostico[],
): void {
  const possuiEtapas = flow.corpo.linhas.length > 0 || flow.corpo.campos.length > 0 || flow.corpo.blocos.length > 0;
  if (!possuiEtapas) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM012",
        `Flow "${flow.nome}" precisa declarar ao menos uma etapa.`,
        "erro",
        flow.intervalo,
        "Adicione linhas declarativas, campos ou subblocos dentro de flow.",
      ),
    );
  }

  const effects = localizarBloco(flow.corpo, "effects");
  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects do flow ${flow.nome}`);
  }
  validarVinculos(flow.vinculos, diagnosticos, `flow ${flow.nome}`);

  const tarefasReferenciadas = flow.corpo.campos
    .filter((campo) => campo.nome === "task" || campo.nome === "tarefa")
    .map((campo) => campo.valor);

  for (const tarefa of tarefasReferenciadas) {
    if (!tasksConhecidas.has(tarefa)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM013",
          `Flow "${flow.nome}" referencia task "${tarefa}" que nao existe.`,
          "erro",
          flow.intervalo,
          "Declare a task no mesmo modulo ou ajuste a referencia do flow.",
        ),
      );
    }
  }

  const etapas = flow.corpo.linhas
    .map((linha) => ({ linha, etapa: parsearEtapaFlow(linha.conteudo) }))
    .filter((item) => item.linha.conteudo.trim().startsWith("etapa "));

  const nomesEtapas = new Set<string>();
  const contextoFlow = new Set(flow.corpo.campos.map((campo) => campo.nome));
  const etapasValidas = new Map<string, NonNullable<(typeof etapas)[number]["etapa"]>>();
  for (const item of etapas) {
    if (!item.etapa) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM032",
          `Linha de etapa invalida em flow "${flow.nome}": "${item.linha.conteudo}".`,
          "erro",
          item.linha.intervalo,
          "Use o formato \"etapa nome usa task com campo=valor quando expressao depende_de etapa_a, etapa_b em_sucesso proxima em_erro falha\".",
        ),
      );
      continue;
    }

    if (nomesEtapas.has(item.etapa.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM033",
          `Flow "${flow.nome}" declarou a etapa "${item.etapa.nome}" mais de uma vez.`,
          "erro",
          item.linha.intervalo,
          "Use nomes unicos para cada etapa estruturada do flow.",
        ),
      );
      continue;
    }

    nomesEtapas.add(item.etapa.nome);
    etapasValidas.set(item.etapa.nome, item.etapa);

    if (item.etapa.task && !tasksConhecidas.has(item.etapa.task)) {
      const sugestoesTasks = descreverSugestoes(tasksConhecidas, "Tasks conhecidas no contexto");
      diagnosticos.push(
        criarDiagnostico(
          "SEM034",
          `Etapa "${item.etapa.nome}" do flow "${flow.nome}" usa task "${item.etapa.task}" que nao existe.`,
          "erro",
          item.linha.intervalo,
          sugestoesTasks ?? "Ajuste a task da etapa para apontar para uma task declarada ou importada.",
        ),
      );
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      if (detalhesTask) {
        const indiceInput = indicesCampos(detalhesTask.input);
        for (const mapeamento of item.etapa.mapeamentos) {
          const campoInput = indiceInput.get(mapeamento.campo);
          if (!campoInput) {
            diagnosticos.push(
              criarDiagnostico(
                "SEM042",
                `Etapa "${item.etapa.nome}" do flow "${flow.nome}" mapeia o campo "${mapeamento.campo}", que nao existe no input da task "${item.etapa.task}".`,
                "erro",
                item.linha.intervalo,
                "Use apenas campos declarados no input da task associada a etapa.",
              ),
            );
          }

          const raizValor = extrairRaiz(mapeamento.valor);
          const ehLiteral = ["verdadeiro", "falso", "nulo"].includes(mapeamento.valor)
            || /^-?\d+(?:\.\d+)?$/.test(mapeamento.valor)
            || /^".*"$/.test(mapeamento.valor);
          const aceitaLiteralTextual = Boolean(
            campoInput
            && ["Texto", "Id", "Email", "Url"].includes(campoInput.tipo)
            && !mapeamento.valor.includes(".")
            && !contextoFlow.has(raizValor)
            && !nomesEtapas.has(raizValor),
          );
          if (!ehLiteral && !aceitaLiteralTextual && !contextoFlow.has(raizValor) && !nomesEtapas.has(raizValor)) {
            const sugestoesContexto = [
              descreverSugestoes(contextoFlow, "Campos do flow"),
              descreverSugestoes(nomesEtapas, "Etapas conhecidas"),
            ].filter(Boolean).join(" ");
            diagnosticos.push(
              criarDiagnostico(
                "SEM043",
                `Etapa "${item.etapa.nome}" do flow "${flow.nome}" referencia "${mapeamento.valor}" fora do contexto conhecido.`,
                "erro",
                item.linha.intervalo,
                sugestoesContexto || "Mapeie usando campos do proprio flow, saidas de etapas anteriores ou literais simples.",
              ),
            );
          }

          if (mapeamento.valor.includes(".")) {
            const [etapaOrigem, campoSaida] = mapeamento.valor.split(".", 2);
            const etapaReferenciada = etapaOrigem ? etapasValidas.get(etapaOrigem) : undefined;
            const taskReferenciada = etapaReferenciada?.task ? tarefasDetalhadas.get(etapaReferenciada.task) : undefined;
            const indiceOutput = taskReferenciada ? indicesCampos(taskReferenciada.output) : undefined;
            if (etapaOrigem && campoSaida && etapaReferenciada && indiceOutput && !indiceOutput.has(campoSaida)) {
              diagnosticos.push(
                criarDiagnostico(
                  "SEM044",
                  `Etapa "${item.etapa.nome}" do flow "${flow.nome}" referencia a saida "${campoSaida}" da etapa "${etapaOrigem}", mas essa saida nao existe na task associada.`,
                  "erro",
                  item.linha.intervalo,
                  "Use apenas campos declarados no output da task da etapa de origem.",
                ),
              );
            }
          }
        }
      }
    }

    if (item.etapa.condicao) {
      const referencias = extrairReferenciasDaExpressao(item.etapa.condicao).map((referencia) => extrairRaiz(referencia));
      for (const referencia of referencias) {
        if (!ehMarcadorSemantico(referencia) && !tasksConhecidas.has(referencia) && !nomesEtapas.has(referencia) && !contextoFlow.has(referencia)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM035",
              `Condicao da etapa "${item.etapa.nome}" em flow "${flow.nome}" referencia "${referencia}" fora do contexto atual.`,
              "erro",
              item.linha.intervalo,
              "No MVP atual, condicoes de flow devem apontar para marcadores semanticos, campos do flow, tasks conhecidas ou etapas anteriores.",
            ),
          );
        }
      }
    }
  }

  for (const item of etapas) {
    if (!item.etapa) {
      continue;
    }
    for (const dependencia of item.etapa.dependencias) {
      if (!nomesEtapas.has(dependencia)) {
        const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
        diagnosticos.push(
          criarDiagnostico(
            "SEM036",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" depende de "${dependencia}", que nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            sugestoesEtapas ?? "Declare a etapa dependente no mesmo flow antes de referencia-la.",
          ),
        );
      }
    }

    for (const destino of [item.etapa.emSucesso, item.etapa.emErro].filter(Boolean)) {
      if (destino && !nomesEtapas.has(destino)) {
        const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
        diagnosticos.push(
          criarDiagnostico(
            "SEM045",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta para "${destino}" em ramificacao, mas essa etapa nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            sugestoesEtapas ?? "Declare a etapa de destino no mesmo flow antes de usa-la em em_sucesso ou em_erro.",
          ),
        );
      }
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      const indiceErrors = indiceErros(detalhesTask?.errors ?? []);
      for (const rotaErro of item.etapa.porErro) {
        if (!indiceErrors.has(rotaErro.tipo)) {
          const sugestoesErros = descreverSugestoes(indiceErrors.keys(), "Erros declarados pela task");
          diagnosticos.push(
            criarDiagnostico(
              "SEM046",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" roteia o erro "${rotaErro.tipo}", mas esse erro nao pertence ao contrato da task "${item.etapa.task}".`,
              "erro",
              item.linha.intervalo,
              sugestoesErros ?? "Use apenas erros declarados pela task ou cobertos por testes de erro do contrato atual.",
            ),
          );
        }

        if (!nomesEtapas.has(rotaErro.destino)) {
          const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
          diagnosticos.push(
            criarDiagnostico(
              "SEM047",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta o erro "${rotaErro.tipo}" para "${rotaErro.destino}", mas essa etapa nao foi declarada.`,
              "erro",
              item.linha.intervalo,
              sugestoesEtapas ?? "Declare a etapa de destino no mesmo flow antes de usa-la em por_erro.",
            ),
          );
        }
      }
    }
  }
}

function validarVinculoEstadoDaTask(
  task: TaskAst,
  statesConhecidos: Map<string, { transicoes: Set<string> }>,
  diagnosticos: Diagnostico[],
): void {
  if (!task.state) {
    return;
  }

  const nomeEstado = task.state.nome ?? task.state.campos.find((campo) => campo.nome === "state" || campo.nome === "estado")?.valor;
  if (!nomeEstado) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM037",
        `Task "${task.nome}" declarou state sem indicar qual estado ela governa.`,
        "erro",
        task.state.intervalo,
        "Use \"state nome_do_estado { ... }\" ou declare \"estado: nome_do_estado\" dentro do bloco state da task.",
      ),
    );
    return;
  }

  const estadoConhecido = statesConhecidos.get(nomeEstado);
  if (!estadoConhecido) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM038",
        `Task "${task.nome}" referencia state "${nomeEstado}", mas esse state nao foi encontrado.`,
        "erro",
        task.state.intervalo,
        "Declare o state no mesmo modulo ou importe um modulo que exponha esse state.",
      ),
    );
    return;
  }

  const blocoTransitions = localizarBloco(task.state, "transitions");
  const linhasTransicao = blocoTransitions?.linhas ?? task.state.linhas;
  if (linhasTransicao.length === 0) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM039",
        `Task "${task.nome}" referencia state "${nomeEstado}" sem declarar transicoes.`,
        "erro",
        task.state.intervalo,
        "Declare ao menos uma transicao para explicitar como a task altera o estado.",
      ),
    );
    return;
  }

  for (const linha of linhasTransicao) {
    const transicao = parsearTransicaoEstado(linha.conteudo);
    if (!transicao) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM040",
          `Task "${task.nome}" declarou uma transicao invalida no state "${nomeEstado}": "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          "Use o formato \"ORIGEM -> DESTINO\" dentro do bloco transitions da task.",
        ),
      );
      continue;
    }

    if (!estadoConhecido.transicoes.has(serializarTransicao(transicao.origem, transicao.destino))) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM041",
          `Task "${task.nome}" declarou a transicao "${transicao.origem} -> ${transicao.destino}" fora do contrato do state "${nomeEstado}".`,
          "erro",
          linha.intervalo,
          "Use apenas transicoes declaradas no state associado a task.",
        ),
      );
    }
  }
}

function validarContratoRoute(
  route: RouteAst,
  taskNome: string,
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>,
  diagnosticos: Diagnostico[],
): void {
  const inputPublico = localizarBloco(route.corpo, "input");
  const outputPublico = localizarBloco(route.corpo, "output");
  const errorPublico = localizarBloco(route.corpo, "error");
  const detalhesTask = tarefasDetalhadas.get(taskNome);

  if (!detalhesTask) {
    return;
  }

  const indiceInputTask = indicesCampos(detalhesTask.input);
  const indiceOutputTask = indicesCampos(detalhesTask.output);
  const indiceErrorsTask = indiceErros(detalhesTask.errors);

  if (inputPublico) {
    for (const campo of inputPublico.campos) {
      const campoTask = indiceInputTask.get(campo.nome);
      if (!campoTask) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM049",
            `Route "${route.nome}" expoe o campo de input "${campo.nome}", mas ele nao existe na task "${taskNome}".`,
            "erro",
            campo.intervalo,
            "Use apenas campos declarados no input da task associada a route.",
          ),
        );
        continue;
      }

      if (campoTask.tipo !== campo.valor) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM053",
            `Route "${route.nome}" declara o campo publico "${campo.nome}" com tipo "${campo.valor}", mas a task "${taskNome}" usa "${campoTask.tipo}".`,
            "erro",
            campo.intervalo,
            "Mantenha o tipo publico coerente com o contrato interno da task.",
          ),
        );
      }
    }
  }

  if (outputPublico) {
    for (const campo of outputPublico.campos) {
      const campoTask = indiceOutputTask.get(campo.nome);
      if (!campoTask) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM050",
            `Route "${route.nome}" expoe o campo de output "${campo.nome}", mas ele nao existe na task "${taskNome}".`,
            "erro",
            campo.intervalo,
            "Use apenas campos declarados no output da task associada a route.",
          ),
        );
        continue;
      }

      if (campoTask.tipo !== campo.valor) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM054",
            `Route "${route.nome}" declara o campo publico de saida "${campo.nome}" com tipo "${campo.valor}", mas a task "${taskNome}" usa "${campoTask.tipo}".`,
            "erro",
            campo.intervalo,
            "Mantenha o output publico coerente com o contrato interno da task.",
          ),
        );
      }
    }
  }

  if (errorPublico) {
    for (const campo of errorPublico.campos) {
      if (!indiceErrorsTask.has(campo.nome)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM051",
            `Route "${route.nome}" expoe o erro "${campo.nome}", mas ele nao pertence ao contrato da task "${taskNome}".`,
            "erro",
            campo.intervalo,
            "Exponha apenas erros declarados pela task associada a route.",
          ),
        );
      }
    }
  }
}

function validarRoute(
  route: RouteAst,
  tasksConhecidas: Set<string>,
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>,
  diagnosticos: Diagnostico[],
): void {
  const metodo = localizarCampo(route.corpo, "metodo");
  const caminho = localizarCampo(route.corpo, "caminho");
  const caminhoResolvido = recomporCaminhoRoute(caminho);
  const task = localizarCampo(route.corpo, "task", "tarefa");
  const effects = localizarBloco(route.corpo, "effects");

  if (!metodo) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM014",
        `Route "${route.nome}" precisa declarar o campo metodo.`,
        "erro",
        route.intervalo,
        "Use um campo como metodo: GET, POST, PUT, PATCH ou DELETE.",
      ),
    );
  }

  if (!caminho) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM015",
        `Route "${route.nome}" precisa declarar o campo caminho.`,
        "erro",
        route.intervalo,
        "Use um campo como caminho: \"/recurso\".",
      ),
    );
  }

  if (metodo) {
    const metodosValidos = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    if (!metodosValidos.has(metodo.valor.toUpperCase())) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM016",
          `Route "${route.nome}" usa metodo invalido "${metodo.valor}".`,
          "erro",
          metodo.intervalo,
          "Use apenas GET, POST, PUT, PATCH ou DELETE no MVP.",
        ),
      );
    }
  }

  if (caminho && (!caminhoResolvido || !caminhoResolvido.startsWith("/"))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM017",
          `Route "${route.nome}" precisa usar um caminho iniciando com '/'.`,
          "erro",
          caminho.intervalo,
          "Exemplo valido: caminho: \"/produtos\".",
      ),
    );
  }

  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects da route ${route.nome}`);
  }
  validarVinculos(route.vinculos, diagnosticos, `route ${route.nome}`);

  if (task && !tasksConhecidas.has(task.valor)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM018",
        `Route "${route.nome}" referencia task "${task.valor}" que nao existe.`,
        "erro",
        task.intervalo,
        "Ajuste o campo task da route para apontar para uma task declarada no modulo.",
      ),
    );
    return;
  }

  if (task) {
    validarContratoRoute(route, task.valor, tarefasDetalhadas, diagnosticos);
  }
}

export function criarContextoLocal(modulo: ModuloAst): ContextoSemantico {
  const simbolos = new Map<string, SimboloSemantico>();
  const tiposConhecidos = new Set(TIPOS_PRIMITIVOS);
  const tasksConhecidas = new Set<string>();
  const tarefasDetalhadas = new Map<string, ResumoTaskSemantico>();
  const statesConhecidos = new Map<string, { transicoes: Set<string> }>();
  const enumsConhecidos = new Map<string, Set<string>>();

  const registrar = (nome: string, categoria: SimboloSemantico["categoria"]): void => {
    if (simbolos.has(nome)) {
      return;
    }
    simbolos.set(nome, { nome, categoria });
    if (categoria === "task") {
      tasksConhecidas.add(nome);
      return;
    }
    tiposConhecidos.add(nome);
  };

  for (const type of modulo.types) {
    registrar(type.nome, "tipo");
  }
  for (const entity of modulo.entities) {
    registrar(entity.nome, "entity");
  }
  for (const enumeracao of modulo.enums) {
    registrar(enumeracao.nome, "enum");
    enumsConhecidos.set(enumeracao.nome, new Set(enumeracao.valores));
  }
  for (const task of modulo.tasks) {
    registrar(task.nome, "task");
    tarefasDetalhadas.set(task.nome, coletarResumoTask(task));
  }
  for (const flow of modulo.flows) {
    registrar(flow.nome, "flow");
  }
  for (const route of modulo.routes) {
    registrar(route.nome, "route");
  }
  for (const worker of modulo.workers) {
    if (worker.nome) {
      registrar(worker.nome, "worker");
    }
  }
  for (const evento of modulo.eventos) {
    if (evento.nome) {
      registrar(evento.nome, "evento");
    }
  }
  for (const fila of modulo.filas) {
    if (fila.nome) {
      registrar(fila.nome, "fila");
    }
  }
  for (const cron of modulo.crons) {
    if (cron.nome) {
      registrar(cron.nome, "cron");
    }
  }
  for (const webhook of modulo.webhooks) {
    if (webhook.nome) {
      registrar(webhook.nome, "webhook");
    }
  }
  for (const cache of modulo.caches) {
    if (cache.nome) {
      registrar(cache.nome, "cache");
    }
  }
  for (const storage of modulo.storages) {
    if (storage.nome) {
      registrar(storage.nome, "storage");
    }
  }
  for (const policy of modulo.policies) {
    if (policy.nome) {
      registrar(policy.nome, "policy");
    }
  }
  for (const state of modulo.states) {
    if (state.nome) {
      registrar(state.nome, "state");
      const transicoes = new Set(
        (localizarBloco(state.corpo, "transitions")?.linhas ?? [])
          .map((linha) => parsearTransicaoEstado(linha.conteudo))
          .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha))
          .map((linha) => serializarTransicao(linha.origem, linha.destino)),
      );
      statesConhecidos.set(state.nome, { transicoes });
    }
  }

  return {
    modulo: modulo.nome,
    simbolos,
    tiposConhecidos,
    tasksConhecidas,
    tarefasDetalhadas,
    statesConhecidos,
    modulosImportados: [],
    interoperabilidades: modulo.uses
      .filter(ehUseInterop)
      .map((use) => ({ origem: use.origem, caminho: use.caminho })),
    enumsConhecidos,
  };
}

function validarTask(
  task: TaskAst,
  tiposConhecidos: Set<string>,
  statesConhecidos: Map<string, { transicoes: Set<string> }>,
  diagnosticos: Diagnostico[],
): void {
  if (!task.input) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM003",
        `Task "${task.nome}" precisa declarar input.`,
        "erro",
        task.intervalo,
        "Toda task precisa declarar as entradas de forma explicita.",
      ),
    );
  }

  if (!task.output) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM004",
        `Task "${task.nome}" precisa declarar output.`,
        "erro",
        task.intervalo,
        "Toda task precisa declarar a saida esperada.",
      ),
    );
  }

  if (!task.guarantees) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM005",
        `Task "${task.nome}" precisa declarar guarantees.`,
        "erro",
        task.intervalo,
        "A proposta da Sema e falhar cedo quando a pos-condicao nao esta explicita.",
      ),
    );
  }

  if (task.input) {
    validarCamposDeTipos(task.input.campos, tiposConhecidos, diagnosticos, `input da task ${task.nome}`);
  }
  if (task.output) {
    validarCamposDeTipos(task.output.campos, tiposConhecidos, diagnosticos, `output da task ${task.nome}`);
  }

  const entradasConhecidas = new Set(task.input?.campos.map((campo) => campo.nome) ?? []);
  const saidasConhecidas = new Set(task.output?.campos.map((campo) => campo.nome) ?? []);

  if (task.rules) {
    validarExpressoesDeclaradas(task.rules.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM021",
      codigoErroReferencia: "SEM022",
      nomeBloco: `rules da task ${task.nome}`,
      simbolosPermitidos: entradasConhecidas,
      dicaSintaxe: "Use expressoes como \"campo existe\", \"campo > 0\", \"campo em [A, B]\" ou \"campo deve_ser predicado\".",
      dicaReferencia: "No MVP atual, rules devem referenciar apenas campos do input.",
      dicaReferenciaPersonalizada: (raiz) => (
        saidasConhecidas.has(raiz)
          ? `\"${raiz}\" parece vir do output. Rules devem validar entrada; se a intencao era afirmar pos-condicao, mova isso para guarantees.`
          : undefined
      ),
    });
  }

  if (task.effects) {
    validarEfeitosDeclarados(task.effects.linhas, diagnosticos, `effects da task ${task.nome}`);
  }
  validarVinculos(task.vinculos, diagnosticos, `task ${task.nome}`);
  validarExecucao(task, diagnosticos);

  validarImplementacoesTask(task, diagnosticos);

  if (task.tests) {
    for (const bloco of task.tests.blocos) {
      if (bloco.tipo !== "caso_teste") {
        continue;
      }
      validarCasoTeste(task, bloco, diagnosticos);
    }
  }

  if (task.guarantees && task.output) {
    validarExpressoesDeclaradas(task.guarantees.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM030",
      codigoErroReferencia: "SEM031",
      nomeBloco: `guarantees da task ${task.nome}`,
      simbolosPermitidos: saidasConhecidas,
      dicaSintaxe: "Use expressoes como \"saida existe\", \"saida == valor\" ou \"saida em [A, B]\" nas guarantees.",
      dicaReferencia: "No MVP atual, guarantees devem referenciar campos do output ou marcadores semanticos permitidos.",
      aceitarMarcadoresSemanticos: true,
      dicaReferenciaPersonalizada: (raiz) => (
        entradasConhecidas.has(raiz)
          ? `\"${raiz}\" parece vir do input. Guarantees devem afirmar output, estado ou marcadores semanticos; se a intencao era validar entrada, mova isso para rules.`
          : undefined
      ),
    });
  }

  validarErroOperacional(task, diagnosticos);

  const blocoInternoTests = localizarBloco(task.corpo, "tests");
  if (blocoInternoTests && blocoInternoTests.blocos.length === 0) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM007",
        `Task "${task.nome}" declarou tests sem casos.`,
        "erro",
        blocoInternoTests.intervalo,
        "Adicione ao menos um bloco caso dentro de tests.",
      ),
    );
  }

  validarVinculoEstadoDaTask(task, statesConhecidos, diagnosticos);
}

function validarCasoTeste(task: TaskAst, caso: BlocoCasoTesteAst, diagnosticos: Diagnostico[]): void {
  if (!caso.given) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM008",
        `Caso de teste "${caso.nome}" da task "${task.nome}" precisa declarar given.`,
        "erro",
        caso.intervalo,
      ),
    );
  }
  if (!caso.expect) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM009",
        `Caso de teste "${caso.nome}" da task "${task.nome}" precisa declarar expect.`,
        "erro",
        caso.intervalo,
      ),
    );
  }
}

export function analisarSemantica(modulo: ModuloAst, opcoes: OpcoesAnaliseSemantica = {}): ResultadoSemantico {
  const diagnosticos: Diagnostico[] = [];
  const simbolos = new Map<string, SimboloSemantico>();
  const tiposConhecidos = new Set(TIPOS_PRIMITIVOS);
  const tasksConhecidas = new Set<string>();
  const tarefasDetalhadas = new Map<string, ResumoTaskSemantico>();
  const statesConhecidos = new Map<string, { transicoes: Set<string> }>();
  const modulosImportados: string[] = [];
  const interoperabilidades: InteropSemantico[] = [];
  const enumsConhecidos = new Map<string, Set<string>>();

  for (const use of modulo.uses) {
    if (use.origem !== "sema") {
      if (!PADRAO_CAMINHO_INTEROP.test(use.caminho)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM058",
            `Interop externa "${use.origem} ${use.caminho}" e invalida no modulo "${modulo.nome}".`,
            "erro",
            use.intervalo,
            "Use um identificador de modulo externo como pacote.servico, app.modulo ou dominio.executor.",
          ),
        );
        continue;
      }
      interoperabilidades.push({ origem: use.origem, caminho: use.caminho });
      continue;
    }

    const resolucaoUse = resolverUseSema(modulo.nome, use.caminho, opcoes.contextosModulos);
    const contextoImportado = resolucaoUse.caminhoResolvido
      ? opcoes.contextosModulos?.get(resolucaoUse.caminhoResolvido)
      : undefined;
    if (!contextoImportado) {
      const candidatosEncontrados = resolucaoUse.candidatosRelativos
        .filter((candidato) => opcoes.contextosModulos?.has(candidato))
        .slice(0, 4);
      const sugestoesModulos = descreverSugestoes(opcoes.contextosModulos?.keys() ?? [], "Modulos disponiveis neste contexto");
      diagnosticos.push(
        criarDiagnostico(
          "SEM019",
          `Modulo "${modulo.nome}" usa "${use.caminho}", mas esse modulo nao foi encontrado no projeto atual.`,
          "erro",
          use.intervalo,
          candidatosEncontrados.length > 0
            ? `Se a intencao era um import relativo ao namespace atual, tente um caminho como ${candidatosEncontrados.join(", ")}.`
            : (sugestoesModulos ?? "Garanta que o arquivo .sema importado esteja presente no mesmo conjunto de compilacao."),
        ),
      );
      continue;
    }

    modulosImportados.push(resolucaoUse.caminhoResolvido ?? use.caminho);
    for (const tipo of contextoImportado.tiposConhecidos) {
      tiposConhecidos.add(tipo);
    }
    for (const task of contextoImportado.tasksConhecidas) {
      tasksConhecidas.add(task);
    }
    for (const [nomeTask, detalhesTask] of contextoImportado.tarefasDetalhadas) {
      tarefasDetalhadas.set(nomeTask, {
        input: detalhesTask.input.map((campo) => ({ ...campo, modificadores: [...campo.modificadores] })),
        output: detalhesTask.output.map((campo) => ({ ...campo, modificadores: [...campo.modificadores] })),
        errors: detalhesTask.errors.map((erro) => ({ ...erro })),
        guarantees: [...detalhesTask.guarantees],
        implementacoes: detalhesTask.implementacoes.map((impl) => ({ ...impl })),
      });
    }
    for (const [nomeState, metadadosState] of contextoImportado.statesConhecidos) {
      statesConhecidos.set(nomeState, { transicoes: new Set(metadadosState.transicoes) });
    }
    for (const [nomeEnum, valores] of contextoImportado.enumsConhecidos) {
      enumsConhecidos.set(nomeEnum, new Set(valores));
    }
    for (const interop of contextoImportado.interoperabilidades) {
      interoperabilidades.push({ ...interop });
    }
  }

  const registrar = (
    nome: string,
    categoria: SimboloSemantico["categoria"],
    intervalo?: TypeAst["intervalo"] | EntityAst["intervalo"] | EnumAst["intervalo"],
  ): void => {
    if (simbolos.has(nome)) {
      diagnosticos.push(diagnosticoDuplicado(nome, categoria, intervalo));
      return;
    }
    simbolos.set(nome, { nome, categoria });
    if (categoria === "task") {
      tasksConhecidas.add(nome);
      return;
    }
    tiposConhecidos.add(nome);
  };

  for (const type of modulo.types) {
    registrar(type.nome, "tipo", type.intervalo);
  }
  for (const entity of modulo.entities) {
    registrar(entity.nome, "entity", entity.intervalo);
  }
  for (const enumeracao of modulo.enums) {
    registrar(enumeracao.nome, "enum", enumeracao.intervalo);
    enumsConhecidos.set(enumeracao.nome, new Set(enumeracao.valores));
  }
  for (const task of modulo.tasks) {
    registrar(task.nome, "task", task.intervalo);
    tarefasDetalhadas.set(task.nome, coletarResumoTask(task));
  }
  for (const flow of modulo.flows) {
    registrar(flow.nome, "flow", flow.intervalo);
  }
  for (const route of modulo.routes) {
    registrar(route.nome, "route", route.intervalo);
  }
  for (const worker of modulo.workers) {
    if (worker.nome) {
      registrar(worker.nome, "worker", worker.intervalo);
    }
  }
  for (const evento of modulo.eventos) {
    if (evento.nome) {
      registrar(evento.nome, "evento", evento.intervalo);
    }
  }
  for (const fila of modulo.filas) {
    if (fila.nome) {
      registrar(fila.nome, "fila", fila.intervalo);
    }
  }
  for (const cron of modulo.crons) {
    if (cron.nome) {
      registrar(cron.nome, "cron", cron.intervalo);
    }
  }
  for (const webhook of modulo.webhooks) {
    if (webhook.nome) {
      registrar(webhook.nome, "webhook", webhook.intervalo);
    }
  }
  for (const cache of modulo.caches) {
    if (cache.nome) {
      registrar(cache.nome, "cache", cache.intervalo);
    }
  }
  for (const storage of modulo.storages) {
    if (storage.nome) {
      registrar(storage.nome, "storage", storage.intervalo);
    }
  }
  for (const policy of modulo.policies) {
    if (policy.nome) {
      registrar(policy.nome, "policy", policy.intervalo);
    }
  }
  for (const state of modulo.states) {
    if (state.nome) {
      registrar(state.nome, "state", state.intervalo);
      const transicoes = new Set(
        (localizarBloco(state.corpo, "transitions")?.linhas ?? [])
          .map((linha) => parsearTransicaoEstado(linha.conteudo))
          .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha))
          .map((linha) => serializarTransicao(linha.origem, linha.destino)),
      );
      statesConhecidos.set(state.nome, { transicoes });
    }
  }

  for (const type of modulo.types) {
    validarCamposDeTipos(type.corpo.campos, tiposConhecidos, diagnosticos, `type ${type.nome}`);
    const fields = localizarBloco(type.corpo, "fields");
    if (fields) {
      validarCamposDeTipos(fields.campos, tiposConhecidos, diagnosticos, `fields do type ${type.nome}`);
    }
    validarInvariantesDeCampos(type.corpo, `type ${type.nome}`, diagnosticos);
  }

  for (const entity of modulo.entities) {
    const fields = localizarBloco(entity.corpo, "fields");
    if (!fields || fields.campos.length === 0) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM010",
          `Entity "${entity.nome}" precisa declarar fields.`,
          "erro",
          entity.intervalo,
          "Adicione um bloco fields com os campos da entidade.",
        ),
      );
    } else {
      validarCamposDeTipos(fields.campos, tiposConhecidos, diagnosticos, `entity ${entity.nome}`);
    }
    validarInvariantesDeCampos(entity.corpo, `entity ${entity.nome}`, diagnosticos);
  }

  for (const task of modulo.tasks) {
    validarTask(task, tiposConhecidos, statesConhecidos, diagnosticos);
  }

  for (const flow of modulo.flows) {
    validarFlow(flow, tasksConhecidas, tarefasDetalhadas, diagnosticos);
  }

  for (const route of modulo.routes) {
    validarRoute(route, tasksConhecidas, tarefasDetalhadas, diagnosticos);
  }

  validarVinculos(modulo.vinculos, diagnosticos, `modulo ${modulo.nome}`);
  for (const worker of modulo.workers) {
    validarSuperficie(worker, "worker", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const evento of modulo.eventos) {
    validarSuperficie(evento, "evento", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const fila of modulo.filas) {
    validarSuperficie(fila, "fila", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const cron of modulo.crons) {
    validarSuperficie(cron, "cron", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const webhook of modulo.webhooks) {
    validarSuperficie(webhook, "webhook", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const cache of modulo.caches) {
    validarSuperficie(cache, "cache", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const storage of modulo.storages) {
    validarSuperficie(storage, "storage", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const policy of modulo.policies) {
    validarSuperficie(policy, "policy", tasksConhecidas, tiposConhecidos, diagnosticos);
  }

  const assinaturasRoute = new Map<string, RouteAst>();
  for (const route of modulo.routes) {
    const metodo = (localizarCampo(route.corpo, "metodo")?.valor ?? "").toUpperCase();
    const caminho = recomporCaminhoRoute(localizarCampo(route.corpo, "caminho")) ?? "";
    if (!metodo || !caminho) {
      continue;
    }
    const chave = `${metodo} ${caminho}`;
    const existente = assinaturasRoute.get(chave);
    if (existente) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM055",
          `Route "${route.nome}" reutiliza a assinatura publica "${chave}", ja declarada por "${existente.nome}".`,
          "erro",
          route.intervalo,
          "Cada combinacao de metodo e caminho deve ser unica no mesmo modulo.",
        ),
      );
      continue;
    }
    assinaturasRoute.set(chave, route);
  }

  for (const state of modulo.states) {
    validarState(state, tiposConhecidos, enumsConhecidos, diagnosticos);
  }

  return {
    contexto: {
      modulo: modulo.nome,
      simbolos,
      tiposConhecidos,
      tasksConhecidas,
      tarefasDetalhadas,
      statesConhecidos,
      modulosImportados,
      interoperabilidades,
      enumsConhecidos,
    },
    diagnosticos,
  };
}
