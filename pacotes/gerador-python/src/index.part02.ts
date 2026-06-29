// SEMA-GOVERNED: sema.geradores_codigo_governado
// Descricao: modulo particionado; consulte contratos/sema/geradores_codigo_governado.sema antes de editar.

import path from "node:path";
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  extrairTiposNomeados,
  mapearTipoParaPython,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
  type FrameworkGeracao,
} from "@sema/padroes";

import { OpcoesGeracaoPython, coletarTiposCompostos, coletarTiposExternos, formatarLiteralTestePython, gerarComentarioInvariantesPython, gerarDataclass, gerarListaCamposPython, gerarLiteralBlocoTestePython, gerarMapaErrosPython, gerarPreparacaoSaida, mapearCampoParaPython, paraPascalCase, resolverExpressaoPython } from "./index.part01.js";

export function finalizarBlocoPython(linhas: string[]): string {
  if (linhas.length === 0) {
    return "    pass";
  }

  const possuiInstrucaoExecutavel = linhas.some((linha) => {
    const texto = linha.trim();
    return texto.length > 0 && !texto.startsWith("#");
  });

  if (possuiInstrucaoExecutavel) {
    return linhas.join("\n");
  }

  return `${linhas.join("\n")}\n    pass`;
}

export function gerarFuncaoGarantias(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas = [
    ...task.garantiasEstruturadas.map((garantia) => {
      switch (garantia.tipo) {
        case "predicado":
          return `    # Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`;
        default:
          return `    if not (${resolverExpressaoPython(garantia, camposSaida, "saida")}):\n        raise ValueError("Garantia violada: ${garantia.textoOriginal}")`;
      }
    }),
    ...task.guarantees
      .filter((garantia) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === garantia))
      .map((garantia) => `    # Garantia declarada em Sema: ${garantia}`),
  ];

  return `def verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida: ${task.nome}Saida) -> None:\n${finalizarBlocoPython(linhas)}\n`;
}

export function gerarMetadadosTask(task: IrTask): string {
  const efeitos = task.efeitosEstruturados.length === 0
    ? "[]"
    : `[\n${task.efeitosEstruturados.map((efeito) => `    {"categoria": "${efeito.categoria}", "alvo": "${efeito.alvo}"${efeito.detalhe ? `, "detalhe": ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, "criticidade": "${efeito.criticidade}"` : ""}},`).join("\n")}\n]`;
  const implementacoes = task.implementacoesExternas.length === 0
    ? "[]"
    : `[\n${task.implementacoesExternas.map((impl) => `    {"origem": "${impl.origem}", "caminho": "${impl.caminho}", "resolucaoImpl": "${impl.resolucaoImpl ?? impl.caminho}", "statusImpl": "${impl.statusImpl ?? "nao_verificado"}"},`).join("\n")}\n]`;

  return `contrato_${normalizarNomeParaSimbolo(task.nome)} = {
    "nome": "${task.nome}",
    "input": ${gerarListaCamposPython(task.input)},
    "output": ${gerarListaCamposPython(task.output)},
    "effects": ${efeitos},
    "impl": ${implementacoes},
    "errors": ${gerarMapaErrosPython(task.errors)},
    "guarantees": ${JSON.stringify(task.guarantees, null, 2)},
}
`;
}

export function gerarMapeamentoSaidaPublicaPython(nomeVariavel: string, campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "{}";
  }
  return `{\n${campos.map((campo) => `            "${campo.nome}": ${nomeVariavel}.${campo.nome},`).join("\n")}\n        }`;
}

export function gerarValidacoesRespostaPublicaPython(campos: IrCampo[]): string {
  const obrigatorios = campos.filter((campo) => campo.modificadores.includes("required"));
  if (obrigatorios.length === 0) {
    return "    pass";
  }
  return obrigatorios
    .map((campo) => `    if dados.${campo.nome} is None:\n        raise ValueError("Resposta publica invalida: campo obrigatorio ausente ${campo.nome}")`)
    .join("\n");
}

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
    const efeitosPublicos = route.efeitosPublicos.length === 0
      ? "[]"
      : `[\n${route.efeitosPublicos.map((efeito) => `    {"categoria": "${efeito.categoria}", "alvo": "${efeito.alvo}"${efeito.detalhe ? `, "detalhe": ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, "criticidade": "${efeito.criticidade}"` : ""}},`).join("\n")}\n]`;
    const mapaErros = route.errosPublicos.length === 0
      ? "{}"
      : `{\n${route.errosPublicos.map((erro) => `    ${JSON.stringify(erro.nome)}: ${JSON.stringify(erro.mensagem ?? taskAssociada.errors[erro.nome] ?? "")},`).join("\n")}\n}`;
    const blocosErro = route.errosPublicos.map((erro) => `    except ${taskAssociada.nome}_${erro.nome}Erro:
        return {"sucesso": False, "erro": {"codigo": "${erro.nome}", "mensagem": ${JSON.stringify(erro.mensagem ?? taskAssociada.errors[erro.nome] ?? `Erro publico ${erro.nome}`)}}}`).join("\n");

    return `
${gerarDataclass(`${route.nome}EntradaPublica`, route.inputPublico)}
${gerarDataclass(`${route.nome}SaidaPublica`, route.outputPublico)}
contrato_publico_${nomeSimboloRoute} = {
    "nome": "${route.nome}",
    "metodo": ${JSON.stringify(route.metodo ?? null)},
    "caminho": ${JSON.stringify(route.caminho ?? null)},
    "task": ${JSON.stringify(route.task ?? null)},
    "input": ${gerarListaCamposPython(route.inputPublico)},
    "output": ${gerarListaCamposPython(route.outputPublico)},
    "effects": ${efeitosPublicos},
    "guarantees": ${JSON.stringify(route.garantiasPublicasMinimas, null, 4)},
    "errors": ${mapaErros},
}

def verificar_resposta_publica_${nomeSimboloRoute}(dados: ${route.nome}SaidaPublica) -> None:
${gerarValidacoesRespostaPublicaPython(route.outputPublico)}

def adaptar_${nomeSimboloRoute}(requisicao: ${route.nome}EntradaPublica) -> dict[str, object]:
    try:
        saida = executar_${nomeSimboloTask}(requisicao)  # type: ignore[arg-type]
        dados_publicos = ${route.nome}SaidaPublica(${route.outputPublico.map((campo) => `${campo.nome}=saida.${campo.nome}`).join(", ")})
        verificar_resposta_publica_${nomeSimboloRoute}(dados_publicos)
        return {
            "sucesso": True,
            "dados": ${gerarMapeamentoSaidaPublicaPython("dados_publicos", route.outputPublico)},
        }
${blocosErro || "    except Exception:\n        raise"}
    except Exception:
        raise
`;
  }).join("\n");
}

export function gerarTask(task: IrTask, tiposCompostos: Map<string, Map<string, string>>): string {
  const nome = normalizarNomeParaSimbolo(task.nome);
  const camposEntrada = new Set(task.input.map((campo) => campo.nome));
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const errosMapeados = new Map(Object.entries(task.errors));
  for (const caso of task.tests) {
    const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
    if (tipoErro && !errosMapeados.has(tipoErro)) {
      errosMapeados.set(tipoErro, `Erro sintetico gerado a partir do caso de teste "${caso.nome}".`);
    }
  }
  const erros = [...errosMapeados.entries()];
  const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
  const erroAutenticacao = erros.find(([nomeErro]) => nomeErro.includes("autentic"))?.[0];
  const erroAutorizacao = erros.find(([nomeErro]) => nomeErro.includes("acesso_negado") || nomeErro.includes("autoriz"))?.[0];
  const validacoes = [
    ...task.input
      .filter((campo) => campo.modificadores.includes("required"))
      .map((campo) => `    if entrada.${campo.nome} is None:\n        raise ValueError("Campo obrigatorio ausente: ${campo.nome}")`),
    ...task.regrasEstruturadas.map((regra) => {
      switch (regra.tipo) {
        case "predicado":
          return `    # Predicado declarado em Sema: ${regra.textoOriginal}`;
        default:
          return `    if not (${resolverExpressaoPython(regra, camposEntrada, "entrada")}):\n        raise ValueError("Regra violada: ${regra.textoOriginal}")`;
      }
    }),
    ...task.rules
      .filter((regra) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === regra))
      .map((regra) => `    # Regra declarada em Sema: ${regra}`),
  ];

  const efeitos = task.efeitosEstruturados.length > 0
    ? task.efeitosEstruturados.map((efeito) => `    # Efeito estruturado: categoria=${efeito.categoria} alvo=${efeito.alvo}${efeito.detalhe ? ` detalhe=${efeito.detalhe}` : ""}${efeito.criticidade ? ` criticidade=${efeito.criticidade}` : ""}`).join("\n")
    : task.effects.length === 0
    ? "    # Nenhum efeito declarado."
    : task.effects.map((efeito) => `    # Efeito declarado: ${efeito}`).join("\n");
  const implementacoes = task.implementacoesExternas.length > 0
    ? task.implementacoesExternas.map((impl) => `    # Implementacao externa vinculada: origem=${impl.origem} caminho=${impl.caminho} status=${impl.statusImpl ?? "nao_verificado"}`).join("\n")
    : "";

  const garantias = `    verificar_garantias_${nome}(saida)\n    return saida`;

  return `
${gerarDataclass(`${task.nome}Entrada`, task.input)}
${gerarDataclass(`${task.nome}Saida`, task.output)}
${erros.map(([nomeErro, mensagem]) => `\nclass ${task.nome}_${nomeErro}Erro(Exception):\n    codigo = "${nomeErro}"\n\n    def __init__(self) -> None:\n        super().__init__(${JSON.stringify(mensagem)})\n`).join("\n")}

def normalizar_contexto_${nome}(contexto: dict[str, object] | None = None) -> dict[str, object]:
    contexto_normalizado: dict[str, object] = dict(contexto or {})
    contexto_normalizado.setdefault("autenticado", True)
    contexto_normalizado.setdefault("autorizado", True)
    contexto_normalizado.setdefault("erro_esperado", None)
    return contexto_normalizado

def criar_erro_${nome}(codigo: str) -> Exception:
${finalizarBlocoPython(erros.map(([nomeErro]) => `    if codigo == "${nomeErro}":\n        return ${task.nome}_${nomeErro}Erro()`).concat(`    return Exception(f"Erro sintetico nao mapeado para ${task.nome}: {codigo}")`))}

${gerarMetadadosTask(task)}

def validar_${nome}(entrada: ${task.nome}Entrada) -> None:
${finalizarBlocoPython(validacoes)}

${gerarFuncaoGarantias(task)}

def executar_${nome}(entrada: ${task.nome}Entrada, contexto: dict[str, object] | None = None) -> ${task.nome}Saida:
    contexto_execucao = normalizar_contexto_${nome}(contexto)
${erroAutenticacao ? `    if contexto_execucao["erro_esperado"] == "${erroAutenticacao}" or (${JSON.stringify(task.auth.modo ?? "")} == "obrigatorio" and not bool(contexto_execucao["autenticado"])):\n        raise ${task.nome}_${erroAutenticacao}Erro()` : ""}
${erroAutorizacao ? `    if contexto_execucao["erro_esperado"] == "${erroAutorizacao}" or (${task.authz.explicita ? "not bool(contexto_execucao[\"autorizado\"])" : "False"}):\n        raise ${task.nome}_${erroAutorizacao}Erro()` : ""}
    if contexto_execucao["erro_esperado"] is not None${erroAutenticacao ? ` and contexto_execucao["erro_esperado"] != "${erroAutenticacao}"` : ""}${erroAutorizacao ? ` and contexto_execucao["erro_esperado"] != "${erroAutorizacao}"` : ""}:
        raise criar_erro_${nome}(str(contexto_execucao["erro_esperado"]))
    validar_${nome}(entrada)
${task.stateContract ? `    # Vinculo de estado: ${task.stateContract.nomeEstado ?? "nao_definido"}\n    # Transicoes declaradas pela task: ${task.stateContract.transicoes.map((transicao) => `${transicao.origem}->${transicao.destino}`).join(", ") || "nenhuma"}` : ""}
${implementacoes}
${efeitos}
${gerarPreparacaoSaida(task)}
${garantias}
`;
}

export function gerarTestes(modulo: IrModulo): string {
  const linhas = ["import pytest", `from ${normalizarNomeModulo(modulo.nome).replace(/\./g, "_")} import *`, ""];
  const tiposCompostos = coletarTiposCompostos(modulo);
  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
    for (const caso of task.tests) {
      const argumentos = [
        ...caso.given.campos
          .filter((campo) => tiposEntrada.has(campo.nome))
          .map((campo) => `${campo.nome}=${formatarLiteralTestePython(campo.tipo, tiposEntrada.get(campo.nome))}`),
        ...caso.given.blocos
          .filter((subbloco) => tiposEntrada.has(subbloco.nome))
          .map((subbloco) => `${subbloco.nome}=${gerarLiteralBlocoTestePython(subbloco.conteudo, tiposCompostos, undefined, tiposEntrada.get(subbloco.nome))}`),
      ].join(", ");
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        const contextoLinhas = [`"erro_esperado": ${JSON.stringify(tipoErro)}`];
        if (tipoErro.includes("autentic")) {
          contextoLinhas.push('"autenticado": False', '"autorizado": False');
        } else if (tipoErro.includes("acesso_negado") || tipoErro.includes("autoriz")) {
          contextoLinhas.push('"autenticado": True', '"autorizado": False');
        }
        linhas.push(`def test_${normalizarNomeParaSimbolo(task.nome)}_${normalizarNomeParaSimbolo(caso.nome)}() -> None:\n    entrada = ${task.nome}Entrada(${argumentos})\n    contexto = { ${contextoLinhas.join(", ")} }\n    with pytest.raises(${task.nome}_${tipoErro}Erro):\n        ${nomeFuncao}(entrada, contexto)\n`);
        continue;
      }
      linhas.push(`def test_${normalizarNomeParaSimbolo(task.nome)}_${normalizarNomeParaSimbolo(caso.nome)}() -> None:\n    entrada = ${task.nome}Entrada(${argumentos})\n    resultado = ${nomeFuncao}(entrada)\n    assert resultado is not None\n`);
    }
  }
  return linhas.join("\n");
}

export type TipoCabecalhoSemaPython = "contrato" | "teste" | "schemas" | "service" | "router";

export function gerarCabecalhoSemaPython(
  modulo: IrModulo,
  tipo: TipoCabecalhoSemaPython = "contrato",
): string {
  const descricoes: Record<TipoCabecalhoSemaPython, string> = {
    contrato: "artefato Python gerado para executar e revisar as regras declaradas no contrato Sema.",
    teste: "testes Python gerados a partir dos casos do contrato Sema.",
    schemas: "schemas FastAPI derivados do contrato Sema para entrada e saída públicas.",
    service: "service FastAPI que conecta o scaffold do framework às tasks governadas pelo contrato Sema.",
    router: "router FastAPI derivado das routes públicas declaradas no contrato Sema.",
  };
  return [
    "# SEMA-GOVERNED",
    `# Módulo de origem: ${modulo.nome}`,
    "# Consulte o contrato .sema aplicável antes de editar este arquivo.",
    "# Rastreabilidade: outros contratos .sema podem governar este mesmo arquivo via vinculos.",
    "# Para IA fraca/média/forte: chame Sema, rode docs-impacto e drift antes de alterar código.",
    `# Descrição: ${descricoes[tipo]}`,
    "",
  ].join("\n");
}

export function gerarPythonBase(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const interoperabilidades = modulo.interoperabilidades
    .map((interop) => `# Interop externo ${interop.origem}: ${interop.caminho}`)
    .join("\n");
  const tiposExternos = coletarTiposExternos(modulo)
    .map((tipo) => `class ${tipo}(SimpleNamespace):\n    pass\n`)
    .join("\n");
  const enums = modulo.enums.map((enumeracao) => `class ${enumeracao.nome}:\n${enumeracao.valores.map((valor) => `    ${valor} = "${valor}"`).join("\n")}\n`).join("\n");
  const tipos = modulo.types.map((type) => `${gerarComentarioInvariantesPython(type.invariantes)}${gerarDataclass(type.nome, type.definicao.campos)}`).join("\n");
  const entidades = modulo.entities.map((entity) => `${gerarComentarioInvariantesPython(entity.invariantes)}${gerarDataclass(entity.nome, entity.campos)}`).join("\n");
  const states = modulo.states.map((state) => `# State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} invariantes=${state.invariantes.length} transicoes=${state.transicoes.length}`).join("\n");
  const flows = modulo.flows.map((flow) => `# Flow ${flow.nome}: etapas=${flow.linhas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"} ramificacoes=${flow.etapasEstruturadas.filter((etapa) => etapa.emSucesso || etapa.emErro).length} mapeamentos=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.mapeamentos.length, 0)} rotas_erro=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.porErro.length, 0)} efeitos=${flow.efeitosEstruturados.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"}`).join("\n");
  const routes = modulo.routes.map((route) => `# Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"} input_publico=${route.inputPublico.map((campo) => campo.nome).join(", ") || "padrao_task"} output_publico=${route.outputPublico.map((campo) => campo.nome).join(", ") || "padrao_task"} erros_publicos=${route.errosPublicos.map((erro) => erro.nome).join(", ") || "padrao_task"} effects_publicos=${route.efeitosPublicos.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"} garantias_publicas=${route.garantiasPublicasMinimas.length}`).join("\n");
  const tiposCompostos = coletarTiposCompostos(modulo);
  const tasks = modulo.tasks.map((task) => gerarTask(task, tiposCompostos)).join("\n");
  const contratosPublicos = gerarRotas(modulo);

  const codigo = `${gerarCabecalhoSemaPython(modulo)}from __future__ import annotations\n${interoperabilidades ? `${interoperabilidades}\n` : ""}\nfrom dataclasses import dataclass\nfrom types import SimpleNamespace\n\n${tiposExternos}\n${tipos}\n${enums}\n${entidades}\n${states}\n${flows}\n${routes}\n${tasks}\n${contratosPublicos}\n`;
  const testes = `${gerarCabecalhoSemaPython(modulo, "teste")}${gerarTestes(modulo)}`;

  return [
    { caminhoRelativo: `${nomeBase}.py`, conteudo: codigo },
    { caminhoRelativo: `test_${nomeBase}.py`, conteudo: testes },
  ];
}

export function gerarFastApiSchemas(modulo: IrModulo, caminhoContrato: string): string {
  const linhas = [
    "from pydantic import BaseModel",
    `from ${caminhoContrato} import *`,
    "",
  ];

  for (const task of modulo.tasks) {
    linhas.push(`class ${task.nome}EntradaSchema(BaseModel):
${task.input.length === 0 ? "    pass" : task.input.map((campo) => `    ${campo.nome}: ${mapearCampoParaPython(campo)}`).join("\n")}
`);
    linhas.push(`class ${task.nome}SaidaSchema(BaseModel):
${task.output.length === 0 ? "    pass" : task.output.map((campo) => `    ${campo.nome}: ${mapearCampoParaPython(campo)}`).join("\n")}
`);
  }

  for (const route of modulo.routes) {
    linhas.push(`class ${route.nome}EntradaPublicaSchema(BaseModel):
${route.inputPublico.length === 0 ? "    pass" : route.inputPublico.map((campo) => `    ${campo.nome}: ${mapearCampoParaPython(campo)}`).join("\n")}
`);
    linhas.push(`class ${route.nome}SaidaPublicaSchema(BaseModel):
${route.outputPublico.length === 0 ? "    pass" : route.outputPublico.map((campo) => `    ${campo.nome}: ${mapearCampoParaPython(campo)}`).join("\n")}
`);
  }

  return `${gerarCabecalhoSemaPython(modulo, "schemas")}${linhas.join("\n")}`;
}

export function gerarFastApiService(modulo: IrModulo, caminhoContrato: string): string {
  const nomeClasse = `${paraPascalCase(descreverEstruturaModulo(modulo.nome).nomeArquivo)}Service`;
  const metodos = [
    `class ${nomeClasse}:`,
    ...(modulo.tasks.length === 0
      ? ["    pass"]
      : modulo.tasks.flatMap((task) => [
        `    def ${normalizarNomeParaSimbolo(task.nome)}(self, entrada: ${task.nome}Entrada) -> ${task.nome}Saida:`,
        ...(task.implementacoesExternas.length > 0
          ? task.implementacoesExternas.map((impl) => `        # impl ${impl.origem}: ${impl.caminho}`)
          : ["        # TODO: conectar a implementacao real do projeto."]),
        `        return executar_${normalizarNomeParaSimbolo(task.nome)}(entrada)`,
        "",
      ])),
  ];
  return `${gerarCabecalhoSemaPython(modulo, "service")}${[`from ${caminhoContrato} import *`, "", ...metodos].join("\n")}`;
}

export function gerarFastApiRouter(modulo: IrModulo, caminhoSchemas: string, caminhoService: string): string {
  const nomeClasse = `${paraPascalCase(descreverEstruturaModulo(modulo.nome).nomeArquivo)}Service`;
  const imports = [
    "from fastapi import APIRouter",
    `from ${caminhoSchemas} import *`,
    `from ${caminhoService} import ${nomeClasse}`,
    "",
    "router = APIRouter()",
    `service = ${nomeClasse}()`,
    "",
  ];

  const rotas = modulo.routes
    .filter((route) => route.task)
    .map((route) => {
      const metodo = (route.metodo ?? "post").toLowerCase();
      const schemaEntrada = `${route.nome}EntradaPublicaSchema`;
      return `@router.${metodo}(${JSON.stringify(route.caminho ?? "/")})
def ${normalizarNomeParaSimbolo(route.nome)}(entrada: ${schemaEntrada}):
    return adaptar_${normalizarNomeParaSimbolo(route.nome)}(${route.inputPublico.length > 0 ? `entrada` : `${schemaEntrada}()`})`;
    }).join("\n\n");

  return `${gerarCabecalhoSemaPython(modulo, "router")}${imports.join("\n")}${rotas}\n`;
}

export function gerarFastApiTests(modulo: IrModulo, caminhoRouter: string): string {
  return `${gerarCabecalhoSemaPython(modulo, "teste")}from fastapi.testclient import TestClient
from ${caminhoRouter} import router
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)
client = TestClient(app)

def test_scaffold_${normalizarNomeParaSimbolo(descreverEstruturaModulo(modulo.nome).nomeArquivo)}() -> None:
    assert client is not None
`;
}

export function gerarPythonFastApi(modulo: IrModulo): ArquivoGerado[] {
  const base = gerarPythonBase(modulo);
  const contrato = base.find((arquivo) => arquivo.caminhoRelativo.endsWith(".py") && !path.posix.basename(arquivo.caminhoRelativo).startsWith("test_"));
  const testeContrato = base.find((arquivo) => path.posix.basename(arquivo.caminhoRelativo).startsWith("test_"));
  const estrutura = descreverEstruturaModulo(modulo.nome);
  const contexto = estrutura.contextoRelativo;
  const contratoPath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}_contract.py`;
  const schemasPath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}_schemas.py`;
  const servicePath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}_service.py`;
  const routerPath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}_router.py`;
  const testContractPath = path.posix.join("tests", `${contexto ? `${contexto}/` : ""}test_${estrutura.nomeArquivo}_contract.py`);
  const testRouterPath = path.posix.join("tests", `${contexto ? `${contexto}/` : ""}test_${estrutura.nomeArquivo}_router.py`);
  const contratoModulo = path.posix.basename(contratoPath, ".py");
  const schemasModulo = path.posix.basename(schemasPath, ".py");
  const serviceModulo = path.posix.basename(servicePath, ".py");
  const routerModulo = path.posix.basename(routerPath, ".py");

  return [
    {
      caminhoRelativo: path.posix.join("app", contratoPath),
      conteudo: contrato?.conteudo ?? "# Nenhum contrato base gerado.\n",
    },
    {
      caminhoRelativo: path.posix.join("app", schemasPath),
      conteudo: gerarFastApiSchemas(modulo, `.${contratoModulo}`),
    },
    {
      caminhoRelativo: path.posix.join("app", servicePath),
      conteudo: gerarFastApiService(modulo, `.${contratoModulo}`),
    },
    {
      caminhoRelativo: path.posix.join("app", routerPath),
      conteudo: gerarFastApiRouter(modulo, `.${schemasModulo}`, `.${serviceModulo}`),
    },
    {
      caminhoRelativo: testContractPath,
      conteudo: (testeContrato?.conteudo ?? "").replace(`from ${estrutura.nomeBase} import *`, `from app.${(contexto ? `${contexto.replace(/\//g, ".")}.` : "")}${contratoModulo} import *`),
    },
    {
      caminhoRelativo: testRouterPath,
      conteudo: gerarFastApiTests(modulo, `app.${(contexto ? `${contexto.replace(/\//g, ".")}.` : "")}${routerModulo}`),
    },
  ];
}

export function gerarPython(modulo: IrModulo, opcoes: OpcoesGeracaoPython = {}): ArquivoGerado[] {
  if (opcoes.framework === "fastapi") {
    return gerarPythonFastApi(modulo);
  }
  return gerarPythonBase(modulo);
}
