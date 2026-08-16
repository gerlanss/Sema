// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: analisa modulos selecionados no drift; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
import path from "node:path";
import type { IrFlow, IrRoute, IrSuperficie, IrTask } from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type {
  DiagnosticoDrift,
  RecursoResolvido,
  RegistroImplDrift,
  RegistroRecursoDrift,
  RegistroRotaDivergente,
  RegistroVinculoDrift,
  ResultadoDrift,
  RotaResolvida,
  SimboloCandidatoDrift,
  SimboloResolvido,
} from "./drift.part01.js";
import { escolherArquivoPorVinculo, escolherSimboloPorVinculo } from "./drift.part03.js";
import { calcularRiscoOperacional, encontrarAncoraSuperficie } from "./drift.part04.js";
import { resolverPersistenciaLocalPorTask } from "./drift.part08.js";
import { escolherRotasEsperadas, normalizarCaminhoRota, ordenarCandidatos, sugerirCandidatosParaImpl, sugerirCandidatosParaTaskSemImpl } from "./drift.part09.js";
import { coletarVinculosIr, extrairRecursosEsperados, resolverRecursoEsperado } from "./drift.part10.js";
export interface GuardrailsTaskDrift {
  publica: boolean;
  sensivel: boolean;
  auth: boolean;
  authz: boolean;
  dados: boolean;
  audit: boolean;
  segredos: boolean;
  forbidden: boolean;
  dadosSensiveis: boolean;
  efeitoPrivilegiado: boolean;
  exigeSegredos: boolean;
}

function escolherArquivoDeclarado(
  contexto: ContextoProjetoCarregado,
  arquivosConhecidos: string[],
  valor: string,
): { arquivo?: string; confianca: RegistroVinculoDrift["confianca"]; status: RegistroVinculoDrift["status"] } {
  if (!caminhoEstaDentroDoWorkspace(contexto.baseProjeto, valor)) {
    return { confianca: "baixa", status: "nao_encontrado" };
  }

  const resolucaoIndexada = escolherArquivoPorVinculo(arquivosConhecidos, valor);
  if (resolucaoIndexada.arquivo
    && !caminhoEstaDentroDoWorkspace(contexto.baseProjeto, resolucaoIndexada.arquivo)) {
    return { confianca: "baixa", status: "nao_encontrado" };
  }
  return resolucaoIndexada;
}

function caminhoEstaDentroDoWorkspace(baseProjeto: string, valor: string): boolean {
  const relativo = path.relative(path.resolve(baseProjeto), path.resolve(baseProjeto, valor));
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

function redigirCaminhoDeclaradoExterno(baseProjeto: string, valor: string): string {
  if (caminhoEstaDentroDoWorkspace(baseProjeto, valor)) {
    return valor;
  }
  const nome = path.basename(path.normalize(valor)) || "arquivo";
  return `[fora_do_workspace]/${nome}`;
}
export interface ResumoVinculosTaskDrift {
  validos: number;
  quebrados: number;
  arquivos: Set<string>;
}
export interface EstadoAnaliseModulosDrift {
  contexto: ContextoProjetoCarregado;
  mapaImpl: Map<string, SimboloResolvido>;
  todosSimbolos: SimboloResolvido[];
  mapaRecursos: Map<string, RecursoResolvido[]>;
  todosRecursos: RecursoResolvido[];
  todasRotasIndexadas: RotaResolvida[];
  todosArquivosConhecidos: string[];
  implsValidos: RegistroImplDrift[];
  implsQuebrados: RegistroImplDrift[];
  vinculosValidos: RegistroVinculoDrift[];
  vinculosQuebrados: RegistroVinculoDrift[];
  rotasDivergentes: RegistroRotaDivergente[];
  recursosValidos: RegistroRecursoDrift[];
  recursosDivergentes: RegistroRecursoDrift[];
  diagnosticos: DiagnosticoDrift[];
  tasksResumo: ResultadoDrift["tasks"];
  taskPorChave: Map<string, IrTask>;
  guardrailsPorTask: Map<string, GuardrailsTaskDrift>;
  resumoVinculosPorTask: Map<string, ResumoVinculosTaskDrift>;
  arquivosAncoraHerdadosPorTask: Map<string, Set<string>>;
}
export function analisarModulosSelecionadosDrift(estado: EstadoAnaliseModulosDrift): void {
  const {
    contexto,
    mapaImpl,
    todosSimbolos,
    mapaRecursos,
    todosRecursos,
    todasRotasIndexadas,
    todosArquivosConhecidos,
    implsValidos,
    implsQuebrados,
    vinculosValidos,
    vinculosQuebrados,
    rotasDivergentes,
    recursosValidos,
    recursosDivergentes,
    diagnosticos,
    tasksResumo,
    taskPorChave,
    guardrailsPorTask,
    resumoVinculosPorTask,
    arquivosAncoraHerdadosPorTask,
  } = estado;
  for (const item of contexto.modulosSelecionados) {
    const ir = item.resultado.ir;
    if (!ir) {
      continue;
    }
    const superficiesPorChave = new Map<string, IrSuperficie>(
      ir.superficies.map((superficie) => [`${superficie.tipo}:${superficie.nome}`, superficie]),
    );
    const routesPorNome = new Map<string, IrRoute>(ir.routes.map((route) => [route.nome, route]));
    const flowsPorNome = new Map<string, IrFlow>(ir.flows.map((flow) => [flow.nome, flow]));
    const registrarArquivoAncoraHerdado = (taskNome: string, arquivo?: string) => {
      if (!arquivo) {
        return;
      }
      const chaveTask = `${ir.nome}:${taskNome}`;
      const arquivos = arquivosAncoraHerdadosPorTask.get(chaveTask) ?? new Set<string>();
      arquivos.add(arquivo);
      arquivosAncoraHerdadosPorTask.set(chaveTask, arquivos);
    };
    for (const task of ir.tasks) {
      guardrailsPorTask.set(`${ir.nome}:${task.nome}`, {
        publica: false,
        sensivel: calcularRiscoOperacional(task) === "alto",
        auth: task.auth.explicita,
        authz: task.authz.explicita,
        dados: task.dados.explicita,
        audit: task.audit.explicita,
        segredos: task.segredos.explicita,
        forbidden: task.forbidden.explicita,
        dadosSensiveis: Boolean(
          task.dados.classificacaoPadrao && ["pii", "financeiro", "credencial", "segredo"].includes(task.dados.classificacaoPadrao)
          || task.dados.campos.some((campo) => ["pii", "financeiro", "credencial", "segredo"].includes(campo.classificacao))
        ),
        efeitoPrivilegiado: task.efeitosEstruturados.some((efeito) =>
          ["db.read", "db.write", "queue.publish", "queue.consume", "fs.read", "fs.write", "network.egress", "secret.read", "shell.exec"].includes(efeito.categoria)
          || ["alta", "critica"].includes(efeito.criticidade ?? ""),
        ),
        exigeSegredos: task.efeitosEstruturados.some((efeito) => efeito.categoria === "secret.read")
          || Boolean(
            task.dados.classificacaoPadrao && ["credencial", "segredo"].includes(task.dados.classificacaoPadrao)
            || task.dados.campos.some((campo) => ["credencial", "segredo"].includes(campo.classificacao))
          ),
      });
    }
    for (const route of ir.routes) {
      if (!route.task || route.perfilCompatibilidade !== "publico") {
        continue;
      }
      const guardrails = guardrailsPorTask.get(`${ir.nome}:${route.task}`);
      if (guardrails) {
        guardrails.publica = true;
        guardrails.auth = guardrails.auth || route.auth.explicita;
        guardrails.authz = guardrails.authz || route.authz.explicita;
        guardrails.dados = guardrails.dados || route.dados.explicita;
        guardrails.audit = guardrails.audit || route.audit.explicita;
        guardrails.segredos = guardrails.segredos || route.segredos.explicita;
        guardrails.forbidden = guardrails.forbidden || route.forbidden.explicita;
        guardrails.dadosSensiveis = guardrails.dadosSensiveis || Boolean(
          route.dados.classificacaoPadrao && ["pii", "financeiro", "credencial", "segredo"].includes(route.dados.classificacaoPadrao)
          || route.dados.campos.some((campo) => ["pii", "financeiro", "credencial", "segredo"].includes(campo.classificacao))
        );
        guardrails.efeitoPrivilegiado = guardrails.efeitoPrivilegiado || route.efeitosPublicos.some((efeito) =>
          ["db.read", "db.write", "queue.publish", "queue.consume", "fs.read", "fs.write", "network.egress", "secret.read", "shell.exec"].includes(efeito.categoria)
          || ["alta", "critica"].includes(efeito.criticidade ?? ""),
        );
        guardrails.exigeSegredos = guardrails.exigeSegredos || route.efeitosPublicos.some((efeito) => efeito.categoria === "secret.read")
          || Boolean(
            route.dados.classificacaoPadrao && ["credencial", "segredo"].includes(route.dados.classificacaoPadrao)
            || route.dados.campos.some((campo) => ["credencial", "segredo"].includes(campo.classificacao))
          );
      }
    }
    for (const superficie of ir.superficies) {
      if (!superficie.task || superficie.perfilCompatibilidade !== "publico") {
        continue;
      }
      const guardrails = guardrailsPorTask.get(`${ir.nome}:${superficie.task}`);
      if (guardrails) {
        guardrails.publica = true;
        guardrails.auth = guardrails.auth || superficie.auth.explicita;
        guardrails.authz = guardrails.authz || superficie.authz.explicita;
        guardrails.dados = guardrails.dados || superficie.dados.explicita;
        guardrails.audit = guardrails.audit || superficie.audit.explicita;
        guardrails.segredos = guardrails.segredos || superficie.segredos.explicita;
        guardrails.forbidden = guardrails.forbidden || superficie.forbidden.explicita;
        guardrails.dadosSensiveis = guardrails.dadosSensiveis || Boolean(
          superficie.dados.classificacaoPadrao && ["pii", "financeiro", "credencial", "segredo"].includes(superficie.dados.classificacaoPadrao)
          || superficie.dados.campos.some((campo) => ["pii", "financeiro", "credencial", "segredo"].includes(campo.classificacao))
        );
        guardrails.efeitoPrivilegiado = guardrails.efeitoPrivilegiado || superficie.effects.some((efeito) =>
          ["db.read", "db.write", "queue.publish", "queue.consume", "fs.read", "fs.write", "network.egress", "secret.read", "shell.exec"].includes(efeito.categoria)
          || ["alta", "critica"].includes(efeito.criticidade ?? ""),
        );
        guardrails.exigeSegredos = guardrails.exigeSegredos || superficie.effects.some((efeito) => efeito.categoria === "secret.read")
          || Boolean(
            superficie.dados.classificacaoPadrao && ["credencial", "segredo"].includes(superficie.dados.classificacaoPadrao)
            || superficie.dados.campos.some((campo) => ["credencial", "segredo"].includes(campo.classificacao))
          );
      }
    }
    for (const task of ir.tasks) {
      taskPorChave.set(`${ir.nome}:${task.nome}`, task);
      let validos = 0;
      let quebrados = 0;
      const arquivosReferenciados = new Set<string>();
      const simbolosReferenciados = new Set<string>();
      const candidatosTask = new Map<string, SimboloCandidatoDrift>();
      if (task.implementacoesExternas.length === 0) {
        for (const candidato of sugerirCandidatosParaTaskSemImpl(todosSimbolos, task.nome)) {
          candidatosTask.set(`${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`, candidato);
        }
        diagnosticos.push({
          tipo: "task_sem_impl",
          modulo: ir.nome,
          task: task.nome,
          mensagem: `Task "${task.nome}" ainda nao foi ligada a nenhuma implementacao externa.`,
        });
      }
      for (const impl of task.implementacoesExternas) {
        const resolvido = mapaImpl.get(impl.caminho);
        const registro: RegistroImplDrift = {
          modulo: ir.nome,
          task: task.nome,
          origem: impl.origem,
          caminho: impl.caminho,
          arquivo: resolvido?.arquivo,
          simbolo: resolvido?.simbolo,
          caminhoResolvido: resolvido?.caminho,
          status: resolvido ? "resolvido" : "quebrado",
        };
        if (resolvido) {
          arquivosReferenciados.add(resolvido.arquivo);
          simbolosReferenciados.add(resolvido.simbolo);
          implsValidos.push(registro);
          validos += 1;
        } else {
          registro.candidatos = sugerirCandidatosParaImpl(todosSimbolos, impl.origem, impl.caminho);
          for (const candidato of registro.candidatos) {
            candidatosTask.set(`${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`, candidato);
          }
          implsQuebrados.push(registro);
          quebrados += 1;
          diagnosticos.push({
            tipo: "impl_quebrado",
            modulo: ir.nome,
            task: task.nome,
            mensagem: `Implementacao externa "${impl.origem}:${impl.caminho}" nao foi encontrada nos diretorios de codigo vivos.`,
          });
        }
      }
      tasksResumo.push({
        modulo: ir.nome,
        task: task.nome,
        impls: task.implementacoesExternas.length,
        implsValidos: validos,
        implsQuebrados: quebrados,
        semImplementacao: task.implementacoesExternas.length === 0,
        scoreSemantico: 0,
        confiancaVinculo: "baixa",
        riscoOperacional: "baixo",
        lacunas: [],
        ancoragemVinculo: "ausente",
        arquivosReferenciados: [...arquivosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        arquivosAncoraHerdados: [],
        arquivosProvaveisEditar: [],
        simbolosReferenciados: [...simbolosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        candidatosImpl: ordenarCandidatos([...candidatosTask.values()]).slice(0, 5),
        checksSugeridos: [],
      });
      for (const recursoEsperado of extrairRecursosEsperados(task, ir, mapaRecursos, mapaImpl)) {
        let resolvido = resolverRecursoEsperado(mapaRecursos, recursoEsperado, arquivosReferenciados);
        if (!resolvido) {
          resolvido = resolverPersistenciaLocalPorTask(mapaRecursos, task, ir, recursoEsperado, mapaImpl)[0];
        }
        const registro: RegistroRecursoDrift = {
          modulo: ir.nome,
          task: task.nome,
          categoria: recursoEsperado.categoria,
          alvo: recursoEsperado.alvo,
          arquivo: resolvido?.arquivo ?? "",
          origem: resolvido?.origem ?? recursoEsperado.origem ?? "firebase",
          tipo: resolvido?.tipo ?? recursoEsperado.tiposAceitos[0] ?? "query",
          status: resolvido ? "resolvido" : "divergente",
        };
        if (resolvido) {
          registro.arquivo = resolvido.arquivo;
          recursosValidos.push(registro);
        } else {
          recursosDivergentes.push(registro);
          const escopo = recursoEsperado.origem ? `${recursoEsperado.origem}` : "persistencia declarada";
          diagnosticos.push({
            tipo: "recurso_divergente",
            modulo: ir.nome,
            task: task.nome,
            mensagem: `Recurso vivo "${recursoEsperado.alvo}" nao foi encontrado no codigo legado para ${escopo}.`,
          });
        }
      }
    }
    for (const route of ir.routes) {
      const taskAssociada = ir.tasks.find((task) => task.nome === route.task);
      const esperadas = escolherRotasEsperadas(taskAssociada ?? {
        nome: "",
        input: [],
        output: [],
        rules: [],
        regrasEstruturadas: [],
        effects: [],
        efeitosEstruturados: [],
        implementacoesExternas: [],
        vinculos: [],
        execucao: {
          idempotencia: false,
          timeout: "padrao",
          retry: "nenhum",
          compensacao: "nenhuma",
          criticidadeOperacional: "media",
          explicita: false,
        },
        auth: {
          explicita: false,
        },
        authz: {
          explicita: false,
          papeis: [],
          escopos: [],
        },
        dados: {
          explicita: false,
          campos: [],
        },
        audit: {
          explicita: false,
        },
        segredos: {
          explicita: false,
          itens: [],
        },
        forbidden: {
          explicita: false,
          regras: [],
        },
        guarantees: [],
        garantiasEstruturadas: [],
        errors: {},
        errosDetalhados: [],
        perfilCompatibilidade: "interno",
        resumoAgente: {
          riscos: [],
          checks: [],
          entidadesAfetadas: [],
          superficiesPublicas: [],
          mutacoesPrevistas: [],
        },
        tests: [],
      }, contexto.fontesLegado);
      if (!esperadas.length || !route.metodo || !route.caminho) {
        continue;
      }
      const encontradas = todasRotasIndexadas.filter((rotaResolvida) =>
        rotaResolvida.origem !== "nextjs-consumer"
        && rotaResolvida.origem !== "react-vite-consumer"
        && rotaResolvida.origem !== "angular-consumer"
        && rotaResolvida.origem !== "flutter-consumer"
        && esperadas.includes(rotaResolvida.origem));
      const combina = encontradas.some((rotaResolvida) =>
        rotaResolvida.metodo === route.metodo
        && normalizarCaminhoRota(rotaResolvida.caminho) === normalizarCaminhoRota(route.caminho));
      if (!combina) {
        const registro = {
          modulo: ir.nome,
          route: route.nome,
          metodo: route.metodo,
          caminho: route.caminho,
          motivo: `Nenhuma rota publica ${route.metodo} ${route.caminho} foi encontrada no codigo legado para o framework esperado.`,
        };
        rotasDivergentes.push(registro);
        diagnosticos.push({
          tipo: "rota_divergente",
          modulo: ir.nome,
          route: route.nome,
          mensagem: registro.motivo,
        });
      }
    }
    for (const itemVinculo of coletarVinculosIr(ir)) {
      const registro: RegistroVinculoDrift = {
        modulo: ir.nome,
        donoTipo: itemVinculo.donoTipo,
        dono: itemVinculo.dono,
        tipo: itemVinculo.vinculo.tipo,
        valor: itemVinculo.vinculo.valor,
        status: "nao_encontrado",
        confianca: "baixa",
      };
      const arquivoDeclarado = itemVinculo.vinculo.arquivo ?? (itemVinculo.vinculo.tipo === "arquivo" ? itemVinculo.vinculo.valor : undefined);
      const simboloDeclarado = itemVinculo.vinculo.simbolo ?? (itemVinculo.vinculo.tipo === "simbolo" ? itemVinculo.vinculo.valor : undefined);
      const recursoDeclarado = itemVinculo.vinculo.recurso ?? (["recurso", "tabela", "fila", "cache", "storage"].includes(itemVinculo.vinculo.tipo) ? itemVinculo.vinculo.valor : undefined);
      const superficieDeclarada = itemVinculo.vinculo.superficie ?? (["superficie", "rota", "worker", "cron", "webhook", "evento", "policy", "fila", "cache", "storage"].includes(itemVinculo.vinculo.tipo) ? itemVinculo.vinculo.valor : undefined);
      if (simboloDeclarado) {
        const resolucaoSimbolo = escolherSimboloPorVinculo(todosSimbolos, mapaImpl, simboloDeclarado);
        registro.status = resolucaoSimbolo.status;
        registro.confianca = resolucaoSimbolo.confianca;
        registro.arquivo = resolucaoSimbolo.simbolo?.arquivo;
        registro.simbolo = resolucaoSimbolo.simbolo?.simbolo;
      } else if (arquivoDeclarado) {
        registro.valor = redigirCaminhoDeclaradoExterno(contexto.baseProjeto, registro.valor);
        const resolucaoArquivo = escolherArquivoDeclarado(contexto, todosArquivosConhecidos, arquivoDeclarado);
        registro.status = resolucaoArquivo.status;
        registro.confianca = resolucaoArquivo.confianca;
        registro.arquivo = resolucaoArquivo.arquivo;
      } else if (recursoDeclarado) {
        const recurso = resolverRecursoEsperado(mapaRecursos, {
          categoria: "persistencia",
          alvo: recursoDeclarado,
          tiposAceitos: [],
          nomes: [recursoDeclarado],
        });
        if (recurso) {
          registro.status = "resolvido";
          registro.confianca = "alta";
          registro.arquivo = recurso.arquivo;
        }
      } else if (superficieDeclarada) {
        const rota = todasRotasIndexadas.find((rotaResolvida) =>
          normalizarCaminhoRota(rotaResolvida.caminho) === normalizarCaminhoRota(superficieDeclarada));
        if (rota) {
          registro.status = "resolvido";
          registro.confianca = "alta";
          registro.arquivo = rota.arquivo;
          registro.simbolo = rota.simbolo;
        } else {
          const resolucaoArquivo = escolherArquivoDeclarado(contexto, todosArquivosConhecidos, superficieDeclarada);
          registro.status = resolucaoArquivo.status;
          registro.confianca = resolucaoArquivo.confianca;
          registro.arquivo = resolucaoArquivo.arquivo;
        }
      } else {
        registro.valor = redigirCaminhoDeclaradoExterno(contexto.baseProjeto, registro.valor);
        const resolucaoArquivo = escolherArquivoDeclarado(contexto, todosArquivosConhecidos, itemVinculo.vinculo.valor);
        registro.status = resolucaoArquivo.status;
        registro.confianca = resolucaoArquivo.confianca;
        registro.arquivo = resolucaoArquivo.arquivo;
      }
      if (registro.status === "nao_encontrado" && itemVinculo.donoTipo === "superficie") {
        const superficie = superficiesPorChave.get(itemVinculo.dono);
        const ancora = superficie
          ? encontrarAncoraSuperficie(ir, superficie, todosSimbolos, mapaImpl, todosArquivosConhecidos)
          : undefined;
        if (ancora) {
          registro.status = "parcial";
          registro.confianca = ancora.confianca === "alta" ? "media" : ancora.confianca;
          registro.arquivo = registro.arquivo ?? ancora.arquivo;
          registro.simbolo = registro.simbolo ?? ancora.simbolo;
        }
      }
      if (registro.status === "nao_encontrado") {
        vinculosQuebrados.push(registro);
        diagnosticos.push({
          tipo: "vinculo_quebrado",
          modulo: ir.nome,
          mensagem: `Vinculo ${registro.tipo}="${registro.valor}" de ${registro.donoTipo} "${registro.dono}" nao foi resolvido no codigo vivo.`,
          ...(itemVinculo.donoTipo === "task" ? { task: itemVinculo.dono } : itemVinculo.donoTipo === "route" ? { route: itemVinculo.dono } : {}),
        });
      } else {
        vinculosValidos.push(registro);
        if (itemVinculo.donoTipo === "modulo") {
          for (const task of ir.tasks) {
            registrarArquivoAncoraHerdado(task.nome, registro.arquivo);
          }
        } else if (itemVinculo.donoTipo === "flow") {
          const flow = flowsPorNome.get(itemVinculo.dono);
          for (const taskNome of flow?.tasksReferenciadas ?? []) {
            registrarArquivoAncoraHerdado(taskNome, registro.arquivo);
          }
        } else if (itemVinculo.donoTipo === "route") {
          const route = routesPorNome.get(itemVinculo.dono);
          if (route?.task) {
            registrarArquivoAncoraHerdado(route.task, registro.arquivo);
          }
        } else if (itemVinculo.donoTipo === "superficie") {
          const superficie = superficiesPorChave.get(itemVinculo.dono);
          if (superficie?.task) {
            registrarArquivoAncoraHerdado(superficie.task, registro.arquivo);
          }
        }
      }
      if (itemVinculo.donoTipo === "task") {
        const chaveTask = `${ir.nome}:${itemVinculo.dono}`;
        const resumo = resumoVinculosPorTask.get(chaveTask) ?? {
          validos: 0,
          quebrados: 0,
          arquivos: new Set<string>(),
        };
        if (registro.status === "nao_encontrado") {
          resumo.quebrados += 1;
        } else {
          resumo.validos += 1;
        }
        if (registro.arquivo) {
          resumo.arquivos.add(registro.arquivo);
        }
        resumoVinculosPorTask.set(chaveTask, resumo);
      }
    }
  }
}
