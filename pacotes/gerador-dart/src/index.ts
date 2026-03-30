import type { IrCampo, IrModulo } from "@sema/nucleo";
import { mapearTipoParaDart, normalizarNomeModulo, type ArquivoGerado } from "@sema/padroes";

const TIPOS_PRIMITIVOS_SEMA = new Set(["Texto", "Numero", "Inteiro", "Decimal", "Booleano", "Data", "DataHora", "Id", "Email", "Url", "Json", "Vazio"]);

function gerarClasse(nome: string, campos: IrCampo[]): string {
  const declaracoes = campos.length === 0
    ? "  const " + nome + "();"
    : `  const ${nome}({\n${campos.map((campo) => `    this.${campo.nome},`).join("\n")}\n  });`;
  const propriedades = campos.length === 0
    ? ""
    : `${campos.map((campo) => `  final ${campo.modificadores.includes("required") ? "" : ""}${mapearTipoParaDart(campo.tipo)}${campo.modificadores.includes("required") ? "" : "?"} ${campo.nome};`).join("\n")}\n`;

  return `class ${nome} {\n${propriedades}${declaracoes}\n}\n`;
}

function coletarTiposExternos(modulo: IrModulo): string[] {
  const locais = new Set([
    ...modulo.types.map((item) => item.nome),
    ...modulo.entities.map((item) => item.nome),
    ...modulo.enums.map((item) => item.nome),
  ]);
  const referenciados = new Set<string>();
  const campos = [
    ...modulo.entities.flatMap((entity) => entity.campos),
    ...modulo.tasks.flatMap((task) => [...task.input, ...task.output]),
    ...modulo.routes.flatMap((route) => [...route.inputPublico, ...route.outputPublico]),
    ...modulo.states.flatMap((state) => state.campos),
  ];

  for (const campo of campos) {
    if (!TIPOS_PRIMITIVOS_SEMA.has(campo.tipo) && !locais.has(campo.tipo)) {
      referenciados.add(campo.tipo);
    }
  }

  return [...referenciados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function gerarDart(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const interops = modulo.interoperabilidades.map((interop) => `// Interop externo ${interop.origem}: ${interop.caminho}`).join("\n");
  const tiposExternos = coletarTiposExternos(modulo).map((tipo) => `typedef ${tipo} = Object;`).join("\n");
  const entidades = modulo.entities.map((entity) => gerarClasse(entity.nome, entity.campos)).join("\n");
  const enums = modulo.enums.map((enumeracao) => `enum ${enumeracao.nome} { ${enumeracao.valores.map((valor) => valor.toLowerCase()).join(", ")} }\n`).join("\n");
  const tasks = modulo.tasks.map((task) => `// Task ${task.nome}: input=${task.input.length} output=${task.output.length} effects=${task.efeitosEstruturados.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"} impl=${task.implementacoesExternas.map((impl) => `${impl.origem}:${impl.caminho}`).join(", ") || "nenhuma"}`).join("\n");
  const flows = modulo.flows.map((flow) => `// Flow ${flow.nome}: etapas=${flow.etapasEstruturadas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"}`).join("\n");
  const routes = modulo.routes.map((route) => `// Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"} erros_publicos=${route.errosPublicos.map((erro) => erro.nome).join(", ") || "nenhum"}`).join("\n");
  const codigo = `// Arquivo gerado automaticamente pela Sema.\n// Modulo de origem: ${modulo.nome}\n${interops ? `${interops}\n` : ""}\n${tiposExternos}\n\n${enums}\n${entidades}\n${tasks}\n${flows}\n${routes}\n`;

  return [{ caminhoRelativo: `${nomeBase}.dart`, conteudo: codigo }];
}
