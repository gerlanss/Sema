export interface ParametroRotaBackend {
  nome: string;
  tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id";
}

export interface SimboloDotnetExtraido {
  simbolo: string;
  retorno?: string;
  parametros: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

export interface RotaDotnetExtraida {
  origem: "dotnet";
  metodo: string;
  caminho: string;
  simbolo: string;
  parametros: ParametroRotaBackend[];
  retorno?: string;
}

const METODOS_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function normalizarCaminhoBase(caminho?: string): string | undefined {
  if (!caminho) {
    return undefined;
  }
  return caminho.replace(/^\/+|\/+$/g, "");
}

function juntarCaminho(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base, sufixo]
    .map((parte) => normalizarCaminhoBase(parte))
    .filter((parte): parte is string => Boolean(parte));
  return `/${partes.join("/")}`.replace(/\/+/g, "/");
}

function normalizarCaminhoAspNet(caminho: string, classe?: string, metodo?: string): string {
  const controller = (classe ?? "").replace(/Controller$/i, "");
  const action = metodo ?? "";
  return caminho
    .replace(/\[controller\]/gi, controller ? controller.toLowerCase() : "controller")
    .replace(/\[action\]/gi, action ? action.toLowerCase() : "action")
    .replace(/\{([^}:]+):[^}]+\}/g, "{$1}")
    .replace(/\/+/g, "/");
}

function mapearTipoRotaDotnet(tipo?: string): ParametroRotaBackend["tipoSema"] {
  const normalizado = (tipo ?? "").toLowerCase();
  if (/(^|\.)(int|int32|int64|long|short)$/.test(normalizado)) {
    return "Inteiro";
  }
  if (/(^|\.)(float|double|decimal)$/.test(normalizado)) {
    return "Decimal";
  }
  if (/guid|uuid|id$/i.test(normalizado)) {
    return "Id";
  }
  return "Texto";
}

function extrairParametrosRota(caminho: string, assinatura: string): ParametroRotaBackend[] {
  const tiposAssinatura = new Map<string, string>();
  for (const parametroBruto of assinatura.split(",")) {
    const parametro = parametroBruto.trim();
    if (!parametro) {
      continue;
    }
    const semPadrao = parametro.split("=")[0]?.trim() ?? parametro;
    const partes = semPadrao.split(/\s+/).filter(Boolean);
    if (partes.length < 2) {
      continue;
    }
    const nome = partes.at(-1)!;
    const tipo = partes.slice(0, -1).join(" ");
    tiposAssinatura.set(nome, tipo);
  }

  return [...caminho.matchAll(/\{([^}:]+)(?::[^}]+)?\}/g)].map((match) => {
    const nome = match[1]!;
    return {
      nome,
      tipoSema: mapearTipoRotaDotnet(tiposAssinatura.get(nome)),
    };
  });
}

function extrairTextoAtributo(atributo: string): string | undefined {
  return atributo.match(/"([^"]+)"/)?.[1];
}

function extrairMetodosAtributo(atributo: string): string[] {
  const direto = atributo.match(/\[\s*Http(Get|Post|Put|Patch|Delete)\b/i)?.[1]?.toUpperCase();
  if (direto && METODOS_HTTP.has(direto)) {
    return [direto];
  }

  const bloco = atributo.match(/\bHttpMethods\.(Get|Post|Put|Patch|Delete)\b/gi)
    ?.map((item) => item.split(".").pop()?.toUpperCase() ?? "")
    .filter((item) => METODOS_HTTP.has(item));
  if (bloco && bloco.length > 0) {
    return [...new Set(bloco)];
  }

  const requestMapping = atributo.match(/\[\s*AcceptVerbs\(([^)]*)\)\s*\]/i)?.[1];
  if (requestMapping) {
    const encontrados = [...requestMapping.matchAll(/"([A-Za-z]+)"/g)]
      .map((match) => match[1]!.toUpperCase())
      .filter((item) => METODOS_HTTP.has(item));
    if (encontrados.length > 0) {
      return [...new Set(encontrados)];
    }
  }

  return [];
}

function contarChar(texto: string, alvo: string): number {
  return [...texto].filter((char) => char === alvo).length;
}

function atualizarPilhaClasses<T extends { profundidade: number }>(pilha: T[], profundidade: number): void {
  while (pilha.length > 0 && profundidade < pilha[pilha.length - 1]!.profundidade) {
    pilha.pop();
  }
}

function extrairAtributos(linhas: string[], inicio: number): { atributos: string[]; proximoIndice: number } {
  const atributos: string[] = [];
  let indice = inicio;

  while (indice < linhas.length) {
    const linha = linhas[indice]!.trim();
    if (!linha.startsWith("[")) {
      break;
    }
    let atual = linha;
    let saldo = contarChar(linha, "[") - contarChar(linha, "]");
    while (saldo > 0 && indice + 1 < linhas.length) {
      indice += 1;
      const complemento = linhas[indice]!.trim();
      atual += ` ${complemento}`;
      saldo += contarChar(complemento, "[") - contarChar(complemento, "]");
    }
    atributos.push(atual);
    indice += 1;
  }

  return { atributos, proximoIndice: indice };
}

export function extrairSimbolosDotnet(codigo: string): SimboloDotnetExtraido[] {
  const simbolos = new Map<string, SimboloDotnetExtraido>();
  const linhas = codigo.split(/\r?\n/);
  const pilhaClasses: Array<{ nome: string; profundidade: number }> = [];
  let classePendente: { nome: string; profundidade: number } | undefined;
  let profundidade = 0;

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linhaOriginal = linhas[indice]!;
    const linha = linhaOriginal.trim();
    if (classePendente && linha.startsWith("{")) {
      pilhaClasses.push(classePendente);
      classePendente = undefined;
    }
    if (!linha || linha.startsWith("//")) {
      profundidade += contarChar(linhaOriginal, "{") - contarChar(linhaOriginal, "}");
      atualizarPilhaClasses(pilhaClasses, profundidade);
      continue;
    }

    const { atributos, proximoIndice } = extrairAtributos(linhas, indice);
    if (atributos.length > 0) {
      indice = proximoIndice;
    }

    const linhaEfetiva = (linhas[indice] ?? "").trim();
    const classe = linhaEfetiva.match(/\bclass\s+([A-Za-z_]\w*)/);
    if (classe) {
      const entrada = { nome: classe[1]!, profundidade: profundidade + 1 };
      if (linhaEfetiva.includes("{")) {
        pilhaClasses.push(entrada);
      } else {
        classePendente = entrada;
      }
      profundidade += contarChar(linhaEfetiva, "{") - contarChar(linhaEfetiva, "}");
      atualizarPilhaClasses(pilhaClasses, profundidade);
      continue;
    }

    const metodo = linhaEfetiva.match(/\b(?:public|internal|protected|private)\s+(?:static\s+|async\s+|virtual\s+|override\s+|sealed\s+|partial\s+)*([A-Za-z0-9_<>,.?[\]\s]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (metodo) {
      const classeAtual = pilhaClasses[pilhaClasses.length - 1];
      const simbolo = classeAtual ? `${classeAtual.nome}.${metodo[2]!}` : metodo[2]!;
      simbolos.set(simbolo, {
        simbolo,
        retorno: metodo[1]!.trim(),
        parametros: metodo[3]!.split(",").flatMap((parametroBruto) => {
          const parametro = parametroBruto.trim();
          if (!parametro) {
            return [];
          }
          const semPadrao = parametro.split("=")[0]?.trim() ?? parametro;
          const partes = semPadrao.split(/\s+/).filter(Boolean);
          if (partes.length < 2) {
            return [];
          }
          return [{
            nome: partes.at(-1)!,
            tipoTexto: partes.slice(0, -1).join(" "),
            obrigatorio: !parametro.includes("="),
          }];
        }),
      });
      profundidade += contarChar(linhaEfetiva, "{") - contarChar(linhaEfetiva, "}");
      atualizarPilhaClasses(pilhaClasses, profundidade);
      continue;
    }

    const funcaoLocal = linhaEfetiva.match(/\b([A-Za-z0-9_<>,.?[\]\s]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*=>/);
    if (funcaoLocal && atributos.length === 0 && pilhaClasses.length === 0) {
      const simbolo = funcaoLocal[2]!;
      simbolos.set(simbolo, {
        simbolo,
        retorno: funcaoLocal[1]!.trim(),
        parametros: [],
      });
    }

    const funcaoTopo = linhaEfetiva.match(/\b(?:static\s+)?([A-Za-z0-9_<>,.?[\]\s]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:\{|$)/);
    if (funcaoTopo && atributos.length === 0 && pilhaClasses.length === 0 && !["if", "for", "while", "switch"].includes(funcaoTopo[2]!)) {
      const simbolo = funcaoTopo[2]!;
      if (!simbolos.has(simbolo)) {
        simbolos.set(simbolo, {
          simbolo,
          retorno: funcaoTopo[1]!.trim(),
          parametros: funcaoTopo[3]!.split(",").flatMap((parametroBruto) => {
            const parametro = parametroBruto.trim();
            if (!parametro) {
              return [];
            }
            const semPadrao = parametro.split("=")[0]?.trim() ?? parametro;
            const partes = semPadrao.split(/\s+/).filter(Boolean);
            if (partes.length < 2) {
              return [];
            }
            return [{
              nome: partes.at(-1)!,
              tipoTexto: partes.slice(0, -1).join(" "),
              obrigatorio: !parametro.includes("="),
            }];
          }),
        });
      }
    }

    profundidade += contarChar(linhaEfetiva, "{") - contarChar(linhaEfetiva, "}");
    atualizarPilhaClasses(pilhaClasses, profundidade);
  }

  return [...simbolos.values()];
}

export function extrairRotasDotnet(codigo: string): RotaDotnetExtraida[] {
  const rotas = new Map<string, RotaDotnetExtraida>();
  const linhas = codigo.split(/\r?\n/);
  const pilhaClasses: Array<{ nome: string; profundidade: number; rotaBase?: string; apiController: boolean }> = [];
  let classePendente: { nome: string; profundidade: number; rotaBase?: string; apiController: boolean } | undefined;
  let profundidade = 0;

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linhaOriginal = linhas[indice]!;
    const linha = linhaOriginal.trim();
    if (classePendente && linha.startsWith("{")) {
      pilhaClasses.push(classePendente);
      classePendente = undefined;
    }
    if (!linha || linha.startsWith("//")) {
      profundidade += contarChar(linhaOriginal, "{") - contarChar(linhaOriginal, "}");
      atualizarPilhaClasses(pilhaClasses, profundidade);
      continue;
    }

    const { atributos, proximoIndice } = extrairAtributos(linhas, indice);
    if (atributos.length > 0) {
      indice = proximoIndice;
    }

    const linhaEfetiva = (linhas[indice] ?? "").trim();
    const classe = linhaEfetiva.match(/\bclass\s+([A-Za-z_]\w*)/);
    if (classe) {
      const rotaBase = atributos
        .map((atributo) => extrairTextoAtributo(atributo))
        .find(Boolean);
      const entrada = {
        nome: classe[1]!,
        profundidade: profundidade + 1,
        rotaBase,
        apiController: atributos.some((atributo) => /\[\s*ApiController\s*\]/i.test(atributo)),
      };
      if (linhaEfetiva.includes("{")) {
        pilhaClasses.push(entrada);
      } else {
        classePendente = entrada;
      }
      profundidade += contarChar(linhaEfetiva, "{") - contarChar(linhaEfetiva, "}");
      atualizarPilhaClasses(pilhaClasses, profundidade);
      continue;
    }

    const classeAtual = pilhaClasses[pilhaClasses.length - 1];
    const metodo = linhaEfetiva.match(/\b(?:public|internal|protected)\s+(?:async\s+|virtual\s+|override\s+|static\s+)*([A-Za-z0-9_<>,.?[\]\s]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (metodo && classeAtual) {
      const atributosMetodo = atributos.filter((atributo) => /\[\s*(?:Http|AcceptVerbs)/i.test(atributo));
      for (const atributo of atributosMetodo) {
        const metodos = extrairMetodosAtributo(atributo);
        const rotaMetodo = extrairTextoAtributo(atributo);
        for (const httpMetodo of metodos) {
          const caminho = normalizarCaminhoAspNet(
            juntarCaminho(classeAtual.rotaBase, rotaMetodo),
            classeAtual.nome,
            metodo[2]!,
          );
          const registro: RotaDotnetExtraida = {
            origem: "dotnet",
            metodo: httpMetodo,
            caminho,
            simbolo: `${classeAtual.nome}.${metodo[2]!}`,
            parametros: extrairParametrosRota(caminho, metodo[3] ?? ""),
            retorno: metodo[1]!.trim(),
          };
          rotas.set(`${registro.metodo}:${registro.caminho}:${registro.simbolo}`, registro);
        }
      }
    }

    for (const match of linhaEfetiva.matchAll(/\b\w+\.Map(Get|Post|Put|Patch|Delete)\(\s*"([^"]+)"\s*,\s*([A-Za-z_][\w.]*)/g)) {
      const httpMetodo = match[1]!.toUpperCase();
      const caminho = normalizarCaminhoAspNet(match[2]!);
      const simbolo = match[3]!;
      const registro: RotaDotnetExtraida = {
        origem: "dotnet",
        metodo: httpMetodo,
        caminho,
        simbolo,
        parametros: extrairParametrosRota(caminho, ""),
      };
      rotas.set(`${registro.metodo}:${registro.caminho}:${registro.simbolo}`, registro);
    }

    profundidade += contarChar(linhaEfetiva, "{") - contarChar(linhaEfetiva, "}");
    atualizarPilhaClasses(pilhaClasses, profundidade);
  }

  return [...rotas.values()];
}
