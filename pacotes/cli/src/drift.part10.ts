// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type {
  EngineBanco,
  IrBancoDados,
  IrFlow,
  IrModulo,
  IrRecursoPersistencia,
  IrRoute,
  IrSuperficie,
  IrTask,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  TipoRecursoPersistencia,
} from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { FonteLegado } from "./tipos.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairSimbolosLua } from "./lua-symbols.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";

import { RecursoEsperadoDrift, RecursoResolvido, RegistroVinculoDrift, SimboloResolvido } from "./drift.part01.js";
import { nomesRecursoPersistencia, recursoPersistenciaCombinaAlvo, taskEhBridgeFirebase, taskSugerePersistenciaSemBanco, tiposAceitosParaRecursoPersistencia } from "./drift.part09.js";
import { variantesNomeRecursoDrift } from "./drift.part03.js";

export function extrairRecursosEsperados(
  task: IrTask,
  ir: IrModulo,
  mapaRecursos?: Map<string, RecursoResolvido[]>,
  mapaImpl?: Map<string, SimboloResolvido>,
): RecursoEsperadoDrift[] {
  const esperados = new Map<string, RecursoEsperadoDrift>();
  const registrar = (esperado: RecursoEsperadoDrift) => {
    const chave = `${esperado.origem ?? "qualquer"}:${esperado.tiposAceitos.join(",")}:${esperado.nomes.join("|")}:${esperado.alvo}`;
    if (!esperados.has(chave)) {
      esperados.set(chave, esperado);
    }
  };

  if (taskEhBridgeFirebase(task)) {
    for (const efeito of task.efeitosEstruturados.filter((item) => item.categoria === "persistencia" && Boolean(item.alvo))) {
      registrar({
        categoria: "persistencia",
        alvo: efeito.alvo,
        origem: "firebase",
        tiposAceitos: ["colecao"],
        nomes: [efeito.alvo],
      });
    }
  }

  const efeitosPersistencia = task.efeitosEstruturados.filter((efeito) =>
    ["persistencia", "db.read", "db.write"].includes(efeito.categoria) && Boolean(efeito.alvo));
  if (efeitosPersistencia.length === 0) {
    return [...esperados.values()];
  }

  if (ir.databases.length === 0) {
    const sugerePersistenciaLocal = taskSugerePersistenciaSemBanco(task, mapaRecursos, mapaImpl);
    for (const efeito of efeitosPersistencia) {
      if (!sugerePersistenciaLocal) {
        continue;
      }
      if ([...esperados.values()].some((item) => item.alvo === efeito.alvo)) {
        continue;
      }
      registrar({
        categoria: "persistencia",
        alvo: efeito.alvo,
        tiposAceitos: ["table", "collection", "document", "keyspace", "stream", "view", "query", "index", "arquivo_local"],
        nomes: [efeito.alvo],
      });
    }
    return [...esperados.values()];
  }

  for (const efeito of efeitosPersistencia) {
    for (const database of ir.databases) {
      for (const recurso of database.resources) {
        const tiposAceitos = tiposAceitosParaRecursoPersistencia(recurso);
        if (tiposAceitos.length === 0 || !recursoPersistenciaCombinaAlvo(recurso, efeito.alvo)) {
          continue;
        }
        registrar({
          categoria: "persistencia",
          alvo: efeito.alvo,
          origem: database.engine,
          tiposAceitos,
          nomes: nomesRecursoPersistencia(recurso),
        });
      }
    }
  }

  return [...esperados.values()];
}

export function construirMapaRecursos(recursos: RecursoResolvido[]): Map<string, RecursoResolvido[]> {
  const mapa = new Map<string, RecursoResolvido[]>();
  for (const recurso of recursos) {
    for (const variante of variantesNomeRecursoDrift(recurso.nome)) {
      const existentes = mapa.get(variante) ?? [];
      if (!existentes.some((item) =>
        item.origem === recurso.origem
        && item.tipo === recurso.tipo
        && item.arquivo === recurso.arquivo
        && item.nome === recurso.nome
        && item.simbolo === recurso.simbolo)) {
        existentes.push(recurso);
        mapa.set(variante, existentes);
      }
    }
  }
  return mapa;
}

export function recursoResolvidoCombinaEsperado(recurso: RecursoResolvido, esperado: RecursoEsperadoDrift): boolean {
  if (esperado.origem && recurso.origem !== esperado.origem) {
    return false;
  }
  if (esperado.tiposAceitos.length > 0 && !esperado.tiposAceitos.includes(recurso.tipo)) {
    return false;
  }
  const recursoVariantes = new Set(variantesNomeRecursoDrift(recurso.nome));
  return esperado.nomes.some((nome) =>
    variantesNomeRecursoDrift(nome).some((variante) => recursoVariantes.has(variante)));
}

export function resolverRecursoEsperado(
  mapaRecursos: Map<string, RecursoResolvido[]>,
  esperado: RecursoEsperadoDrift,
  arquivosPreferidos?: Set<string>,
): RecursoResolvido | undefined {
  const candidatos = new Map<string, RecursoResolvido>();
  for (const nome of esperado.nomes) {
    for (const variante of variantesNomeRecursoDrift(nome)) {
      for (const recurso of mapaRecursos.get(variante) ?? []) {
        if (recursoResolvidoCombinaEsperado(recurso, esperado)) {
          candidatos.set(`${recurso.origem}:${recurso.tipo}:${recurso.nome}:${recurso.arquivo}:${recurso.simbolo ?? ""}`, recurso);
        }
      }
    }
  }

  return [...candidatos.values()].sort((a, b) =>
    Number(Boolean(arquivosPreferidos?.has(b.arquivo))) - Number(Boolean(arquivosPreferidos?.has(a.arquivo)))
    || a.arquivo.localeCompare(b.arquivo, "pt-BR")
    || a.nome.localeCompare(b.nome, "pt-BR"))[0];
}

export function coletarVinculosIr(ir: IrModulo): Array<{ donoTipo: RegistroVinculoDrift["donoTipo"]; dono: string; vinculo: IrVinculo }> {
  return [
    ...ir.vinculos.map((vinculo) => ({ donoTipo: "modulo" as const, dono: ir.nome, vinculo })),
    ...ir.tasks.flatMap((task) => task.vinculos.map((vinculo) => ({ donoTipo: "task" as const, dono: task.nome, vinculo }))),
    ...ir.flows.flatMap((flow: IrFlow) => flow.vinculos.map((vinculo) => ({ donoTipo: "flow" as const, dono: flow.nome, vinculo }))),
    ...ir.routes.flatMap((route: IrRoute) => route.vinculos.map((vinculo) => ({ donoTipo: "route" as const, dono: route.nome, vinculo }))),
    ...ir.superficies.flatMap((superficie: IrSuperficie) => superficie.vinculos.map((vinculo) => ({ donoTipo: "superficie" as const, dono: `${superficie.tipo}:${superficie.nome}`, vinculo }))),
  ];
}
