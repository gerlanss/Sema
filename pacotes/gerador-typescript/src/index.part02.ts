// SEMA-GOVERNED: sema.geradores_codigo_governado
// Descricao: modulo particionado; consulte contratos/sema/geradores_codigo_governado.sema antes de editar.

import path from "node:path";
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  extrairTiposNomeados,
  mapearTipoParaTypeScript,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
  type FrameworkGeracao,
} from "@sema/padroes";

import { coletarTiposExternos, converterBlocoTesteParaValorTypeScript, gerarComentarioInvariantesTypeScript, gerarFuncaoGarantias, gerarGarantias, gerarInterface, gerarLiteralCamposTypeScript, gerarMapeamentoSaidaPublicaTypeScript, gerarMetadadosTask, gerarPreparacaoSaida, gerarValidacoes } from "./index.part01.js";

export function gerarRotas(modulo: IrModulo): string {
  const rotasComTask = modulo.routes.filter((route) => route.task);
  if (rotasComTask.length === 0) {
    return "";
  }

  return rotasComTask.map((route) => {
    const taskAssociada = modulo.tasks.find((task) => task.nome === route.task);
    if (!taskAssociada) {
      return "";
    }

    const nomeSimboloRoute = normalizarNomeParaSimbolo(route.nome);
    const nomeSimboloTask = normalizarNomeParaSimbolo(taskAssociada.nome);
    const uniaoErros = route.errosPublicos.length === 0
      ? "never"
      : route.errosPublicos.map((erro) => JSON.stringify(erro.nome)).join(" | ");
    const efeitosPublicos = route.efeitosPublicos.length === 0
      ? "[]"
      : `[\n${route.efeitosPublicos.map((efeito) => `  { categoria: "${efeito.categoria}", alvo: "${efeito.alvo}"${efeito.detalhe ? `, detalhe: ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, criticidade: "${efeito.criticidade}"` : ""} },`).join("\n")}\n]`;
    const verificacoesErro = route.errosPublicos.map((erro) => `    if (erro instanceof ${taskAssociada.nome}_${erro.nome}Erro) {
      return { sucesso: false, erro: { codigo: "${erro.nome}" as ${route.nome}ErroPublico, mensagem: ${JSON.stringify(erro.mensagem ?? taskAssociada.errors[erro.nome] ?? `Erro publico ${erro.nome}`)} } };
    }`).join("\n");

    return `
${gerarInterface(`${route.nome}EntradaPublica`, route.inputPublico)}
${gerarInterface(`${route.nome}SaidaPublica`, route.outputPublico)}
export type ${route.nome}ErroPublico = ${uniaoErros};
export type ${route.nome}RespostaPublica =
  | { sucesso: true; dados: ${route.nome}SaidaPublica }
  | { sucesso: false; erro: { codigo: ${route.nome}ErroPublico; mensagem: string } };

export const contrato_publico_${nomeSimboloRoute} = {
  nome: "${route.nome}",
  metodo: ${JSON.stringify(route.metodo ?? null)},
  caminho: ${JSON.stringify(route.caminho ?? null)},
  task: ${JSON.stringify(route.task ?? null)},
  input: ${gerarLiteralCamposTypeScript(route.inputPublico)},
  output: ${gerarLiteralCamposTypeScript(route.outputPublico)},
  effects: ${efeitosPublicos},
  guarantees: ${JSON.stringify(route.garantiasPublicasMinimas, null, 2)},
  errors: ${route.errosPublicos.length === 0 ? "[]" : `[\n${route.errosPublicos.map((erro) => `  { nome: "${erro.nome}", mensagem: ${JSON.stringify(erro.mensagem ?? taskAssociada.errors[erro.nome] ?? "")} },`).join("\n")}\n]`},
} as const;

export function verificar_resposta_publica_${nomeSimboloRoute}(dados: ${route.nome}SaidaPublica): void {
${route.outputPublico.length === 0
  ? "  // Route sem campos publicos obrigatorios."
  : route.outputPublico.map((campo) => campo.modificadores.includes("required")
      ? `  if (dados.${campo.nome} === undefined || dados.${campo.nome} === null) throw new Error("Resposta publica invalida: campo obrigatorio ausente ${campo.nome}");`
      : `  // Campo publico opcional: ${campo.nome}`).join("\n")}
}

export async function adaptar_${nomeSimboloRoute}(requisicao: ${route.nome}EntradaPublica): Promise<${route.nome}RespostaPublica> {
  try {
    const saida = await executar_${nomeSimboloTask}(requisicao as ${taskAssociada.nome}Entrada);
    const dados = ${gerarMapeamentoSaidaPublicaTypeScript("saida", route.outputPublico)} as ${route.nome}SaidaPublica;
    verificar_resposta_publica_${nomeSimboloRoute}(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
${verificacoesErro || "    throw erro;"}
    throw erro;
  }
}
`;
  }).join("\n");
}

export function gerarTask(task: IrTask): string {
  const nomeSimbolo = normalizarNomeParaSimbolo(task.nome);
  const entradaNome = `${nomeSimbolo}_entrada`;
  const saidaNome = `${nomeSimbolo}_saida`;
  const errosMapeados = new Map(Object.entries(task.errors));
  for (const caso of task.tests) {
    const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
    if (tipoErro && !errosMapeados.has(tipoErro)) {
      errosMapeados.set(tipoErro, `Erro sintetico gerado a partir do caso de teste "${caso.nome}".`);
    }
  }
  const erros = [...errosMapeados.entries()];
  const erroAutenticacao = erros.find(([nomeErro]) => nomeErro.includes("autentic"))?.[0];
  const erroAutorizacao = erros.find(([nomeErro]) => nomeErro.includes("acesso_negado") || nomeErro.includes("autoriz"))?.[0];
  return `
${gerarInterface(`${task.nome}Entrada`, task.input)}
${gerarInterface(`${task.nome}Saida`, task.output)}
export type ${task.nome}Erro = ${erros.length === 0 ? "never" : erros.map(([erro]) => `"${erro}"`).join(" | ")};
${erros.map(([nomeErro, mensagem]) => `export class ${task.nome}_${nomeErro}Erro extends Error {\n  readonly codigo = "${nomeErro}";\n  constructor() {\n    super(${JSON.stringify(mensagem)});\n    this.name = "${task.nome}_${nomeErro}Erro";\n  }\n}\n`).join("\n")}
export interface ${task.nome}ContextoExecucao {
  autenticado?: boolean;
  autorizado?: boolean;
  erroEsperado?: ${task.nome}Erro | null;
}

function normalizar_contexto_${nomeSimbolo}(contexto: ${task.nome}ContextoExecucao = {}): Required<${task.nome}ContextoExecucao> {
  return {
    autenticado: contexto.autenticado ?? true,
    autorizado: contexto.autorizado ?? true,
    erroEsperado: contexto.erroEsperado ?? null,
  };
}

function criar_erro_${nomeSimbolo}(codigo: ${task.nome}Erro): Error {
  switch (codigo) {
${erros.map(([nomeErro]) => `    case "${nomeErro}":\n      return new ${task.nome}_${nomeErro}Erro();`).join("\n")}
    default:
      return new Error(\`Erro sintetico nao mapeado para ${task.nome}: \${codigo as string}\`);
  }
}

${gerarMetadadosTask(task)}

export function validar_${nomeSimbolo}(entrada: ${task.nome}Entrada): void {
${gerarValidacoes(task)}
}

${gerarFuncaoGarantias(task)}

export async function executar_${nomeSimbolo}(entrada: ${task.nome}Entrada, contexto: ${task.nome}ContextoExecucao = {}): Promise<${task.nome}Saida> {
  const contextoExecucao = normalizar_contexto_${nomeSimbolo}(contexto);
  const erroEsperado = contextoExecucao.erroEsperado as ${task.nome}Erro | null;
${erroAutenticacao ? `  if (contextoExecucao.erroEsperado === "${erroAutenticacao}" || (${JSON.stringify(task.auth.modo ?? "")} === "obrigatorio" && !contextoExecucao.autenticado)) {\n    throw new ${task.nome}_${erroAutenticacao}Erro();\n  }` : ""}
${erroAutorizacao ? `  if (contextoExecucao.erroEsperado === "${erroAutorizacao}" || (${task.authz.explicita ? "!contextoExecucao.autorizado" : "false"})) {\n    throw new ${task.nome}_${erroAutorizacao}Erro();\n  }` : ""}
  if (erroEsperado${erroAutenticacao || erroAutorizacao ? ` && ![${[erroAutenticacao, erroAutorizacao].filter(Boolean).map((erro) => JSON.stringify(erro)).join(", ")}].includes(erroEsperado)` : ""}) {
    throw criar_erro_${nomeSimbolo}(erroEsperado);
  }
  validar_${nomeSimbolo}(entrada);
${task.stateContract ? `  // Vinculo de estado: ${task.stateContract.nomeEstado ?? "nao_definido"}\n  // Transicoes declaradas pela task: ${task.stateContract.transicoes.map((transicao) => `${transicao.origem}->${transicao.destino}`).join(", ") || "nenhuma"}` : ""}
${task.implementacoesExternas.length > 0 ? `  // Implementacoes externas vinculadas:\n${task.implementacoesExternas.map((impl) => `  // - ${impl.origem}: ${impl.caminho} [${impl.statusImpl ?? "nao_verificado"}]`).join("\n")}` : ""}
  // Efeitos declarados:
${task.efeitosEstruturados.map((efeito) => `  // - categoria=${efeito.categoria} alvo=${efeito.alvo}${efeito.detalhe ? ` detalhe=${efeito.detalhe}` : ""}${efeito.criticidade ? ` criticidade=${efeito.criticidade}` : ""}`).join("\n") || task.effects.map((efeito) => `  // - ${efeito}`).join("\n") || "  // - Nenhum efeito declarado."}
${gerarPreparacaoSaida(task)}
${gerarGarantias(task)}
}

export const ${entradaNome} = {} as ${task.nome}Entrada;
export const ${saidaNome} = {} as ${task.nome}Saida;
`;
}

export function gerarTestes(modulo: IrModulo): string {
  const classesErro = modulo.tasks.flatMap((task) => {
    const nomes = new Set<string>(Object.keys(task.errors));
    for (const caso of task.tests) {
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        nomes.add(tipoErro);
      }
    }
    return [...nomes].map((nomeErro) => `${task.nome}_${nomeErro}Erro`);
  });
  const linhas = [
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    `import { ${[...modulo.tasks.map((task) => `executar_${normalizarNomeParaSimbolo(task.nome)}`), ...classesErro].join(", ")} } from "./${normalizarNomeModulo(modulo.nome).replace(/\./g, "_")}.ts";`,
  ];

  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
    for (const caso of task.tests) {
      const entrada = converterBlocoTesteParaValorTypeScript(caso.given, tiposEntrada);
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        const contextoLinhas = [`erroEsperado: ${JSON.stringify(tipoErro)}`];
        if (tipoErro.includes("autentic")) {
          contextoLinhas.push("autenticado: false", "autorizado: false");
        } else if (tipoErro.includes("acesso_negado") || tipoErro.includes("autoriz")) {
          contextoLinhas.push("autenticado: true", "autorizado: false");
        }
        linhas.push(`
test("${task.nome} :: ${caso.nome}", async () => {
  const entrada = ${JSON.stringify(entrada, null, 2)};
  const contexto = {
    ${contextoLinhas.join(",\n    ")}
  } as const;
  await assert.rejects(() => ${nomeFuncao}(entrada as any, contexto), ${task.nome}_${tipoErro}Erro);
});
`);
        continue;
      }
      linhas.push(`
test("${task.nome} :: ${caso.nome}", async () => {
  const entrada = ${JSON.stringify(entrada, null, 2)};
  const resultado = await ${nomeFuncao}(entrada as any);
  assert.ok(resultado !== undefined);
});
`);
    }
  }

  return linhas.join("\n");
}

export type TipoCabecalhoSemaTypeScript = "contrato" | "teste" | "dto" | "service" | "controller" | "spec";

export function gerarCabecalhoSemaTypeScript(
  modulo: IrModulo,
  tipo: TipoCabecalhoSemaTypeScript = "contrato",
): string {
  const descricoes: Record<TipoCabecalhoSemaTypeScript, string> = {
    contrato: "artefato TypeScript gerado para executar e revisar as regras declaradas no contrato Sema.",
    teste: "testes TypeScript gerados a partir dos casos do contrato Sema.",
    dto: "DTOs NestJS derivados do contrato Sema para transportar entrada e saída públicas.",
    service: "service NestJS que conecta o scaffold do framework às tasks governadas pelo contrato Sema.",
    controller: "controller NestJS derivado das routes públicas declaradas no contrato Sema.",
    spec: "teste NestJS mínimo para manter o scaffold governado verificável.",
  };
  return [
    "// SEMA-GOVERNED",
    `// Módulo de origem: ${modulo.nome}`,
    "// Consulte o contrato .sema aplicável antes de editar este arquivo.",
    "// Rastreabilidade: outros contratos .sema podem governar este mesmo arquivo via vinculos.",
    "// Para IA fraca/média/forte: chame Sema, rode docs-impacto e drift antes de alterar código.",
    `// Descrição: ${descricoes[tipo]}`,
    "",
  ].join("\n");
}

export function gerarTypeScriptBase(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const interoperabilidades = modulo.interoperabilidades
    .map((interop) => `// Interop externo ${interop.origem}: ${interop.caminho}`)
    .join("\n");
  const tiposExternos = coletarTiposExternos(modulo)
    .map((tipo) => `export type ${tipo} = any; // Tipo externo referenciado por use ou por contrato compartilhado.\n`)
    .join("\n");
  const entidades = modulo.entities
    .map((entity) => `${gerarComentarioInvariantesTypeScript(entity.invariantes)}${gerarInterface(entity.nome, entity.campos)}`)
    .join("\n");
  const tipos = modulo.types
    .map((type) => `${gerarComentarioInvariantesTypeScript(type.invariantes)}${gerarInterface(type.nome, type.definicao.campos)}`)
    .join("\n");
  const enums = modulo.enums
    .map((enumeracao) => `export type ${enumeracao.nome} = ${enumeracao.valores.map((valor) => `"${valor}"`).join(" | ")};\n`)
    .join("\n");
  const states = modulo.states
    .map((state) => `// State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} invariantes=${state.invariantes.length} transicoes=${state.transicoes.length}`)
    .join("\n");
  const flows = modulo.flows
    .map((flow) => `// Flow ${flow.nome}: etapas=${flow.linhas.length} estruturadas=${flow.etapasEstruturadas.length} tasks=${flow.tasksReferenciadas.join(", ") || flow.etapasEstruturadas.map((etapa) => etapa.task).filter(Boolean).join(", ") || "nenhuma"} ramificacoes=${flow.etapasEstruturadas.filter((etapa) => etapa.emSucesso || etapa.emErro).length} mapeamentos=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.mapeamentos.length, 0)} rotas_erro=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.porErro.length, 0)} efeitos=${flow.efeitosEstruturados.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"}`)
    .join("\n");
  const routes = modulo.routes
    .map((route) => `// Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"} input_publico=${route.inputPublico.map((campo) => campo.nome).join(", ") || "padrao_task"} output_publico=${route.outputPublico.map((campo) => campo.nome).join(", ") || "padrao_task"} erros_publicos=${route.errosPublicos.map((erro) => erro.nome).join(", ") || "padrao_task"} effects_publicos=${route.efeitosPublicos.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"} garantias_publicas=${route.garantiasPublicasMinimas.length}`)
    .join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");
  const contratosPublicos = gerarRotas(modulo);

  const codigo = `${gerarCabecalhoSemaTypeScript(modulo)}${interoperabilidades ? `${interoperabilidades}\n` : ""}\n${tiposExternos}\n${tipos}\n${entidades}\n${enums}\n${states}\n${flows}\n${routes}\n${tasks}\n${contratosPublicos}\n`;
  const testes = `${gerarCabecalhoSemaTypeScript(modulo, "teste")}${gerarTestes(modulo)}`;

  return [
    { caminhoRelativo: `${nomeBase}.ts`, conteudo: codigo },
    { caminhoRelativo: `${nomeBase}.test.ts`, conteudo: testes },
  ];
}

export function paraPascalCase(valor: string): string {
  return valor
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((parte) => parte[0]!.toUpperCase() + parte.slice(1))
    .join("");
}

export function limparPrefixoRota(caminho?: string): string {
  return (caminho ?? "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function gerarNestJsDtos(modulo: IrModulo, caminhoContrato: string): string {
  const tiposReferenciados = new Set<string>();
  const registrarTipos = (campos: IrCampo[]) => {
    for (const campo of campos) {
      for (const tipo of extrairTiposNomeados(campo.tipo)) {
        tiposReferenciados.add(tipo);
      }
    }
  };

  for (const task of modulo.tasks) {
    registrarTipos(task.input);
    registrarTipos(task.output);
  }
  for (const route of modulo.routes) {
    registrarTipos(route.inputPublico);
    registrarTipos(route.outputPublico);
  }

  const linhas: string[] = [];
  if (tiposReferenciados.size > 0) {
    linhas.push(`import type { ${[...tiposReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ")} } from "${caminhoContrato}";`);
    linhas.push("");
  }

  const gerarClasseDto = (nomeClasse: string, campos: IrCampo[]) => {
    linhas.push(`export class ${nomeClasse} {`);
    if (campos.length === 0) {
      linhas.push("  // Sem campos declarados.");
    } else {
      for (const campo of campos) {
        linhas.push(`  ${campo.nome}${campo.modificadores.includes("required") ? "!" : "?"}: ${mapearTipoParaTypeScript(campo.tipo)};`);
      }
    }
    linhas.push("}");
    linhas.push("");
  };

  for (const task of modulo.tasks) {
    gerarClasseDto(`${paraPascalCase(task.nome)}EntradaDto`, task.input);
    gerarClasseDto(`${paraPascalCase(task.nome)}SaidaDto`, task.output);
  }
  for (const route of modulo.routes) {
    gerarClasseDto(`${paraPascalCase(route.nome)}EntradaPublicaDto`, route.inputPublico);
    gerarClasseDto(`${paraPascalCase(route.nome)}SaidaPublicaDto`, route.outputPublico);
  }

  return `${gerarCabecalhoSemaTypeScript(modulo, "dto")}${linhas.join("\n").trim()}\n`;
}

export function gerarNestJsService(modulo: IrModulo, caminhoContrato: string): string {
  const nomeClasse = `${paraPascalCase(descreverEstruturaModulo(modulo.nome).nomeArquivo)}Service`;
  const imports = [
    `import { Injectable } from "@nestjs/common";`,
    `import {`,
    ...modulo.tasks.flatMap((task) => [`  executar_${normalizarNomeParaSimbolo(task.nome)},`, `  type ${task.nome}Entrada,`, `  type ${task.nome}Saida,`]),
    ...modulo.routes.flatMap((route) => route.task ? [
      `  adaptar_${normalizarNomeParaSimbolo(route.nome)},`,
      `  type ${route.nome}EntradaPublica,`,
      `  type ${route.nome}RespostaPublica,`,
    ] : []),
    `} from "${caminhoContrato}";`,
  ];

  const metodosTask = modulo.tasks.map((task) => `  async ${normalizarNomeParaSimbolo(task.nome)}(entrada: ${task.nome}Entrada): Promise<${task.nome}Saida> {
${task.implementacoesExternas.length > 0 ? task.implementacoesExternas.map((impl) => `    // impl ${impl.origem}: ${impl.caminho}`).join("\n") : "    // TODO: ajustar a implementacao real e preencher dependencias do framework."}
    return executar_${normalizarNomeParaSimbolo(task.nome)}(entrada);
  }`).join("\n\n");

  const metodosRota = modulo.routes
    .filter((route) => route.task)
    .map((route) => `  async ${normalizarNomeParaSimbolo(route.nome)}(entrada: ${route.nome}EntradaPublica): Promise<${route.nome}RespostaPublica> {
    return adaptar_${normalizarNomeParaSimbolo(route.nome)}(entrada);
  }`).join("\n\n");

  return `${gerarCabecalhoSemaTypeScript(modulo, "service")}${imports.join("\n")}

@Injectable()
export class ${nomeClasse} {
${metodosTask}${metodosTask && metodosRota ? "\n\n" : ""}${metodosRota}
}
`;
}

export function gerarNestJsController(modulo: IrModulo, caminhoDto: string, caminhoService: string): string {
  const nomeArquivo = descreverEstruturaModulo(modulo.nome).nomeArquivo;
  const nomeClasse = `${paraPascalCase(nomeArquivo)}Controller`;
  const nomeService = `${paraPascalCase(nomeArquivo)}Service`;
  const decoratorsImport = new Set<string>(["Controller"]);
  const metodos = modulo.routes
    .filter((route) => route.task)
    .map((route) => {
      const metodo = (route.metodo ?? "POST").toUpperCase();
      if (metodo === "GET") {
        decoratorsImport.add("Get");
      } else if (metodo === "PUT") {
        decoratorsImport.add("Put");
      } else if (metodo === "PATCH") {
        decoratorsImport.add("Patch");
      } else if (metodo === "DELETE") {
        decoratorsImport.add("Delete");
      } else {
        decoratorsImport.add("Post");
      }
      if ((route.inputPublico ?? []).length > 0) {
        decoratorsImport.add("Body");
      }
      const decorator = metodo === "GET" ? "Get" : metodo === "PUT" ? "Put" : metodo === "PATCH" ? "Patch" : metodo === "DELETE" ? "Delete" : "Post";
      const caminhoDecorador = limparPrefixoRota(route.caminho);
      const bodyArg = route.inputPublico.length > 0
        ? `@Body() entrada: ${paraPascalCase(route.nome)}EntradaPublicaDto`
        : "";
      const tipoResposta = `${route.nome}RespostaPublica`;
      return `  @${decorator}(${JSON.stringify(caminhoDecorador)})
  async ${normalizarNomeParaSimbolo(route.nome)}(${bodyArg}): Promise<${tipoResposta}> {
    return this.service.${normalizarNomeParaSimbolo(route.nome)}(${route.inputPublico.length > 0 ? "entrada" : "{}"});
  }`;
    }).join("\n\n");

  const dtosImportados = [...new Set(modulo.routes
    .filter((route) => route.task && route.inputPublico.length > 0)
    .map((route) => `${paraPascalCase(route.nome)}EntradaPublicaDto`))];

  const contratosImportados = [...new Set(modulo.routes
    .filter((route) => route.task)
    .map((route) => `type ${route.nome}RespostaPublica`))];

  return `${gerarCabecalhoSemaTypeScript(modulo, "controller")}import { ${[...decoratorsImport].join(", ")} } from "@nestjs/common";
import { ${nomeService} } from "${caminhoService}";
${dtosImportados.length > 0 ? `import { ${dtosImportados.join(", ")} } from "${caminhoDto}";` : ""}
${contratosImportados.length > 0 ? `import { ${contratosImportados.join(", ")} } from "./${descreverEstruturaModulo(modulo.nome).nomeArquivo}.contract";` : ""}

@Controller()
export class ${nomeClasse} {
  constructor(private readonly service: ${nomeService}) {}

${metodos || "  // Nenhuma route publica declarada no modulo."}
}
`;
}

export function gerarNestJsSpec(modulo: IrModulo, caminhoService: string, caminhoController: string): string {
  const nomeArquivo = descreverEstruturaModulo(modulo.nome).nomeArquivo;
  const nomeService = `${paraPascalCase(nomeArquivo)}Service`;
  const nomeController = `${paraPascalCase(nomeArquivo)}Controller`;

  return `${gerarCabecalhoSemaTypeScript(modulo, "spec")}import { describe, it } from "@jest/globals";
import { ${nomeService} } from "${caminhoService}";
import { ${nomeController} } from "${caminhoController}";

describe("${nomeController}", () => {
  it("mantem o scaffold inicial em pe", () => {
    const service = new ${nomeService}();
    const controller = new ${nomeController}(service);
    expect(controller).toBeDefined();
  });
});
`;
}
