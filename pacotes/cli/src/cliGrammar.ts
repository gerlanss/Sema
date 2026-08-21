// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.argumentos, sema.produto.cli_invocacao_publica.handlers
// Descrição: valida a gramática pública da CLI sem consultar handlers, filesystem, ambiente ou rede.

import {
  erroArgumentoInvalido,
  erroComandoDesconhecido,
  type CategoriaFalhaControleCli,
} from "./cliControlError.js";

interface EspecificacaoArgumentos {
  readonly opcoes?: readonly string[];
  readonly flags?: readonly string[];
  readonly aliases?: Readonly<Record<string, string>>;
  readonly repetiveis?: readonly string[];
  readonly minPosicionais?: number;
  readonly maxPosicionais?: number;
}

interface ArgumentosParseados {
  readonly posicionais: readonly string[];
  readonly opcoes: ReadonlyMap<string, readonly string[]>;
  readonly flags: ReadonlySet<string>;
}

export interface ResultadoSintaxeInvocacaoPublica {
  readonly comando: string;
  readonly sintaxeValida: true;
  readonly dispatchPermitido: boolean;
  readonly handlerResolvido: false;
  readonly efeitosPermitidos: boolean;
  readonly categoriaFalha: CategoriaFalhaControleCli | null;
  readonly codigoPublico: string | null;
}

const FLAGS_VERSAO = new Set(["--version", "--versao", "-v"]);
const FLAGS_JSON = ["--json"] as const;
const COMANDOS_PUBLICOS = new Set([
  "ajuda-ia", "author", "capabilities", "compilar", "conteudo", "contexto-ia",
  "descobrir", "dev", "diagnosticos", "docs-impacto", "doctor", "drift",
  "exemplos-prompt-ia", "finalizar-mudanca", "formatar", "gerar", "guard",
  "impacto", "importar", "iniciar", "init", "inspecionar", "instalar-exemplos",
  "interativo", "ir", "pipeline", "profile", "prompt-curto", "prompt-ia",
  "prompt-ia-react", "prompt-ia-sema-primeiro", "prompt-ia-ui", "renomear-semantico",
  "resumo", "rule-packs", "sessao", "skill", "starter-ia", "sync", "sync-codex", "testar",
  "validar", "verificar", "ast",
]);

const TEMPLATES_INICIAR = new Set([
  "base", "nestjs", "fastapi", "nextjs-api", "nextjs-consumer", "react-vite-consumer",
  "angular-consumer", "flutter-consumer", "node-firebase-worker", "aspnet-api",
  "springboot-api", "go-http-api", "rust-axum-api", "cpp-service-bridge",
]);
const TEMPLATES_INIT = new Set([
  "crud-simples", "auth-completo", "api-rest", "workflow", "pedido", "usuario", "upload",
]);
const FONTES_IMPORTACAO = new Set([
  "nestjs", "express", "fastify", "koa", "fastapi", "flask", "nextjs", "nextjs-consumer", "react-vite-consumer",
  "angular-consumer", "flutter-consumer", "sveltekit-consumer", "nuxt-consumer", "firebase", "typescript", "javascript",
  "python", "dart", "lua", "dotnet", "java", "go", "rust", "cpp", "php",
]);
const ALVOS_GERACAO = new Set([
  "typescript", "python", "dart", "lua", "javascript", "js", "html", "css", "php",
  "dotnet", "cs", "csharp", "cpp", "c++", "cxx", "cc",
]);
const FRAMEWORKS = new Set(["base", "nestjs", "fastapi"]);
const ESTRUTURAS = new Set(["flat", "modulos", "backend"]);
const ESCOPOS = new Set(["arquivo", "modulo", "projeto"]);
const MODOS_CACHE = new Set(["none", "cache", "fresh", "off", "auto", "refresh"]);
const MODOS_RESUMO = new Set(["resumo", "onboarding", "review", "mudanca", "bug", "arquitetura"]);
const MATURIDADES = new Set([
  "draft", "rascunho", "prototype", "prototipo", "production", "producao",
  "critical", "critico", "critica",
]);

const PERFIS: Readonly<Record<string, string>> = Object.freeze({
  software: "software", codigo: "software", code: "software",
  workflow: "workflow", workflow_ops: "workflow", workflows: "workflow", n8n: "workflow",
  automacao: "workflow", orquestracao: "workflow",
  ops: "ops", operacao: "ops", operacional: "ops", devops: "ops",
  game: "game", jogo: "game", games: "game",
  simulation: "simulation", simulations: "simulation", simulacao: "simulation",
  simulacoes: "simulation", simulador: "simulation", simuladores: "simulation",
  legal: "legal", juridico: "legal", research: "research", pesquisa: "research",
  redacao: "redacao", redator: "redacao", redigir: "redacao", editorial: "redacao",
  materia: "redacao", materia_seo: "redacao",
  propostas: "propostas", proposta: "propostas", propostas_comerciais: "propostas",
  proposta_comercial: "propostas", freela: "propostas", marketplace: "propostas",
  conversas: "conversas", conversa: "conversas", atendimento: "conversas",
  atendimento_conversacional: "conversas", bot: "conversas", chatbot: "conversas", chat: "conversas",
  author: "author", autor: "author", escrita: "author",
});

const PRESETS_PROFILE: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  software: new Set(["api", "modulo", "refactor", "persistencia", "security"]),
  workflow: new Set(["webhook", "fila", "n8n", "cron", "integracao"]),
  ops: new Set(["deploy", "migration", "incidente", "rollback", "critical"]),
  legal: new Set(["lgpd", "contrato", "dpa", "termos_uso", "privacidade", "due_diligence", "compliance"]),
  research: new Set(["rapida", "tecnica", "decisoria", "critica"]),
  redacao: new Set(["editorial", "materia", "blog", "seo", "reescrita"]),
  propostas: new Set(["marketplace", "freela", "consultiva", "diagnostico", "score90"]),
  game: new Set(["casual", "arcade", "rpg", "economia", "playtest"]),
  simulation: new Set(["model", "scenario", "calibration", "deterministic", "batch", "safety"]),
  conversas: new Set(["atendimento", "vendas", "suporte", "qualificacao", "retencao", "cobranca"]),
});

function chaveNormalizada(valor: string): string {
  return valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");
}

function parsearArgumentos(
  args: readonly string[],
  especificacao: EspecificacaoArgumentos,
): ArgumentosParseados | null {
  const aliases = especificacao.aliases ?? {};
  const opcoesPermitidas = new Set(especificacao.opcoes ?? []);
  const flagsPermitidas = new Set([...(especificacao.flags ?? []), ...FLAGS_JSON]);
  const repetiveis = new Set(especificacao.repetiveis ?? []);
  const posicionais: string[] = [];
  const opcoes = new Map<string, string[]>();
  const flags = new Set<string>();

  for (let indice = 0; indice < args.length; indice += 1) {
    const token = args[indice]!;
    if (!token.startsWith("-")) {
      posicionais.push(token);
      continue;
    }

    const separador = token.indexOf("=");
    const nomeBruto = separador > 0 ? token.slice(0, separador) : token;
    const nome = aliases[nomeBruto] ?? nomeBruto;
    const valorInline = separador > 0 ? token.slice(separador + 1) : undefined;

    if (flagsPermitidas.has(nome)) {
      if (valorInline !== undefined || flags.has(nome)) return null;
      flags.add(nome);
      continue;
    }
    if (!opcoesPermitidas.has(nome)) return null;
    if (!repetiveis.has(nome) && opcoes.has(nome)) return null;

    const valor = valorInline ?? args[indice + 1];
    if (!valor || (valorInline === undefined && valor.startsWith("-"))) return null;
    if (valorInline === undefined) indice += 1;
    const valores = opcoes.get(nome) ?? [];
    valores.push(valor);
    opcoes.set(nome, valores);
  }

  const minimo = especificacao.minPosicionais ?? 0;
  const maximo = especificacao.maxPosicionais ?? minimo;
  if (posicionais.length < minimo || posicionais.length > maximo) return null;
  return { posicionais, opcoes, flags };
}

function valorOpcao(args: ArgumentosParseados, nome: string): string | undefined {
  return args.opcoes.get(nome)?.[0];
}

function usaSomenteOpcoes(args: ArgumentosParseados, permitidas: readonly string[]): boolean {
  const conjunto = new Set(permitidas);
  return [...args.opcoes.keys()].every((opcao) => conjunto.has(opcao));
}

function usaSomenteFlags(args: ArgumentosParseados, permitidas: readonly string[]): boolean {
  const conjunto = new Set(["--json", ...permitidas]);
  return [...args.flags].every((flag) => conjunto.has(flag));
}

function perfilCanonico(valor: string | undefined): string | null {
  if (!valor) return null;
  return PERFIS[chaveNormalizada(valor)] ?? null;
}

function validarModoCache(
  args: ArgumentosParseados,
  flagPermitida?: "--cache" | "--drift",
): boolean {
  const cache = valorOpcao(args, "--cache");
  const drift = valorOpcao(args, "--drift");
  if (cache && !MODOS_CACHE.has(cache)) return false;
  if (drift && !MODOS_CACHE.has(drift)) return false;
  if (flagPermitida === "--cache" && drift) return false;
  if (flagPermitida === "--drift" && cache) return false;
  if (cache && drift) return false;
  if (args.flags.has("--com-drift") && (cache || drift)) return false;
  return true;
}

function validarSemArgumentos(args: readonly string[]): boolean {
  return parsearArgumentos(args, { maxPosicionais: 0 }) !== null;
}

function validarIniciar(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, {
    opcoes: ["--template"], flags: ["--force", "--com-exemplos"], maxPosicionais: 0,
  });
  const template = parsed ? valorOpcao(parsed, "--template") : undefined;
  return parsed !== null && (template === undefined || TEMPLATES_INICIAR.has(template));
}

function validarInit(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, {
    opcoes: ["--template", "--saida", "--modulo"],
    flags: ["--listar", "--force"],
    aliases: { "-t": "--template", "-o": "--saida", "-m": "--modulo", "-l": "--listar", "-f": "--force" },
    maxPosicionais: 0,
  });
  if (!parsed) return false;
  if (parsed.flags.has("--listar")) {
    return parsed.opcoes.size === 0 && !parsed.flags.has("--force");
  }
  const template = valorOpcao(parsed, "--template");
  return template !== undefined && TEMPLATES_INIT.has(template)
    && valorOpcao(parsed, "--saida") !== undefined
    && valorOpcao(parsed, "--modulo") !== undefined;
}

function validarDev(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, {
    opcoes: ["--promover", "--pasta", "--modo"],
    aliases: { "-p": "--promover", "-d": "--pasta", "-m": "--modo" },
    maxPosicionais: 0,
  });
  if (!parsed) return false;
  const modo = valorOpcao(parsed, "--modo");
  if (modo && modo !== "rigoroso" && modo !== "permissivo") return false;
  const promover = valorOpcao(parsed, "--promover");
  if (parsed.flags.has("--json") && !promover) return false;
  return !promover || (!valorOpcao(parsed, "--pasta") && !modo);
}

function validarSync(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, {
    flags: ["--gerar", "--importar", "--comparar"], minPosicionais: 1, maxPosicionais: 4,
  });
  if (!parsed || parsed.posicionais[0] !== "prisma") return false;
  const operacoes = ["--gerar", "--importar", "--comparar"].filter((flag) => parsed.flags.has(flag));
  if (operacoes.length !== 1) return false;
  if (operacoes[0] === "--gerar") return parsed.posicionais.length <= 3;
  if (operacoes[0] === "--importar") return parsed.posicionais.length >= 2 && parsed.posicionais.length <= 4;
  return parsed.posicionais.length <= 3;
}

function validarGuard(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, { maxPosicionais: 1 });
  return parsed !== null && (parsed.posicionais.length === 0
    || new Set(["on", "off", "status"]).has(parsed.posicionais[0]!));
}

const OPCOES_PROFILE = [
  "--profile", "--arquivo", "--maturidade", "--preset", "--artefato", "--artifact",
  "--artefato-arquivo", "--artifact-file",
] as const;

function validarProfile(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, { opcoes: OPCOES_PROFILE, minPosicionais: 1, maxPosicionais: 3 });
  if (!parsed) return false;
  const subcomando = chaveNormalizada(parsed.posicionais[0]!).replaceAll("_", "-");
  if (subcomando === "help" || subcomando === "ajuda") {
    return parsed.posicionais.length === 1 && parsed.opcoes.size === 0;
  }
  if (["capabilities", "capability-matrix", "matrix"].includes(subcomando)) {
    return parsed.posicionais.length === 1 && parsed.opcoes.size === 0;
  }
  if (["rule-packs", "packs"].includes(subcomando)) {
    const filtro = valorOpcao(parsed, "--profile");
    return parsed.posicionais.length === 1
      && usaSomenteOpcoes(parsed, ["--profile"])
      && (filtro === undefined || perfilCanonico(filtro) !== null);
  }
  if (subcomando !== "validar") return false;
  const profile = perfilCanonico(parsed.posicionais[1] ?? valorOpcao(parsed, "--profile"));
  const entrada = parsed.posicionais[2] ?? valorOpcao(parsed, "--arquivo");
  if (!profile || profile === "author" || !entrada) return false;
  const maturidade = valorOpcao(parsed, "--maturidade");
  if (maturidade && !MATURIDADES.has(chaveNormalizada(maturidade))) return false;
  const preset = valorOpcao(parsed, "--preset");
  return !preset || PRESETS_PROFILE[profile]?.has(chaveNormalizada(preset)) === true;
}

const OPCOES_AUTHOR = [
  "--saida", "--arquivo", "--preset", "--texto", "--texto-arquivo",
  "--texto-anterior", "--texto-anterior-arquivo",
] as const;

function validarAuthor(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, {
    opcoes: OPCOES_AUTHOR, flags: ["--tema-sensivel"], minPosicionais: 1, maxPosicionais: 2,
  });
  if (!parsed) return false;
  const subcomando = chaveNormalizada(parsed.posicionais[0]!).replaceAll("_", "-");
  if (subcomando === "help" || subcomando === "ajuda") {
    return parsed.posicionais.length === 1 && parsed.opcoes.size === 0 && usaSomenteFlags(parsed, []);
  }
  if (subcomando === "iniciar") {
    return parsed.posicionais.length === 1
      && usaSomenteOpcoes(parsed, ["--saida"])
      && usaSomenteFlags(parsed, ["--tema-sensivel"]);
  }
  const validos = new Set(["validar", "briefing", "revisar-cliches", "validar-narrativa", "validar-proibicoes"]);
  if (!validos.has(subcomando)) return false;
  if (!(parsed.posicionais[1] ?? valorOpcao(parsed, "--arquivo"))) return false;
  if (parsed.flags.has("--tema-sensivel") || valorOpcao(parsed, "--saida")) return false;
  const preset = valorOpcao(parsed, "--preset");
  return !preset || new Set(["conto", "romance", "roteiro", "lore", "campanha"]).has(chaveNormalizada(preset));
}

function validarRulePacks(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, { opcoes: ["--profile"], maxPosicionais: 1 });
  if (!parsed) return false;
  const profile = valorOpcao(parsed, "--profile") ?? parsed.posicionais[0];
  return profile === undefined || perfilCanonico(profile) !== null;
}

function validarSkill(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, { maxPosicionais: 1 });
  return parsed !== null && (parsed.posicionais.length === 0
    || new Set(["status", "sync"]).has(parsed.posicionais[0]!.toLowerCase()));
}

const OPCOES_CONTEUDO = [
  "--alvos-arquivo", "--envelope-arquivo", "--confianca-arquivo", "--payload-type",
  "--capability", "--scope", "--ledger-id", "--expected-head", "--politica-arquivo",
  "--ledger-arquivo", "--saida", "--trust-root-digest", "--revocation-digest",
] as const;

function validarConteudo(args: readonly string[]): boolean {
  const parsed = parsearArgumentos(args, {
    opcoes: OPCOES_CONTEUDO, flags: ["--development-local-trust"], maxPosicionais: 2,
  });
  if (!parsed) return false;
  const subcomando = parsed.posicionais[0] ?? "capabilities";
  if (["help", "ajuda", "capabilities"].includes(subcomando)) {
    return parsed.posicionais.length <= 1 && parsed.opcoes.size === 0 && usaSomenteFlags(parsed, []);
  }
  if (subcomando === "validar") {
    return parsed.posicionais.length === 2 && parsed.opcoes.size === 0 && usaSomenteFlags(parsed, []);
  }
  if (subcomando === "planejar") {
    return parsed.posicionais.length === 2
      && usaSomenteOpcoes(parsed, ["--alvos-arquivo"])
      && valorOpcao(parsed, "--alvos-arquivo") !== undefined
      && usaSomenteFlags(parsed, []);
  }
  if (subcomando === "validar-envelope") {
    return parsed.posicionais.length === 1
      && ["--envelope-arquivo", "--confianca-arquivo", "--payload-type"]
        .every((opcao) => valorOpcao(parsed, opcao) !== undefined)
      && usaSomenteOpcoes(parsed, ["--envelope-arquivo", "--confianca-arquivo", "--payload-type", "--trust-root-digest", "--revocation-digest", "--capability", "--scope"]);
  }
  if (subcomando === "registrar") {
    return parsed.posicionais.length === 2
      && ["--envelope-arquivo", "--politica-arquivo", "--confianca-arquivo", "--ledger-id", "--expected-head"]
        .every((opcao) => valorOpcao(parsed, opcao) !== undefined)
      && usaSomenteOpcoes(parsed, ["--envelope-arquivo", "--politica-arquivo", "--confianca-arquivo", "--trust-root-digest", "--revocation-digest", "--ledger-id", "--expected-head"]);
  }
  if (subcomando === "status" || subcomando === "projetar") {
    const permitidas = ["--politica-arquivo", "--confianca-arquivo", "--trust-root-digest", "--revocation-digest", "--ledger-arquivo", "--expected-head", ...(subcomando === "projetar" ? ["--saida"] : [])];
    return parsed.posicionais.length === 2
      && ["--politica-arquivo", "--confianca-arquivo", "--ledger-arquivo", "--expected-head"]
        .every((opcao) => valorOpcao(parsed, opcao) !== undefined)
      && usaSomenteOpcoes(parsed, permitidas);
  }
  return false;
}

function validarDescoberta(args: readonly string[], comando: "descobrir" | "pipeline" | "capabilities"): boolean {
  const opcoes = ["--tipo", "--id", "--dominio", "--intencao", "--limite"];
  const parsed = parsearArgumentos(args, { opcoes, maxPosicionais: 2 });
  if (!parsed) return false;
  if (comando === "capabilities") {
    return parsed.posicionais.length === 0 && usaSomenteOpcoes(parsed, ["--tipo", "--id", "--dominio"]);
  }
  const subcomando = comando === "pipeline" ? parsed.posicionais[0] : parsed.posicionais[0];
  if (!subcomando) return false;
  if (comando === "pipeline") {
    if (subcomando === "listar") return parsed.posicionais.length === 1 && parsed.opcoes.size === 0;
    if (subcomando !== "descrever") return false;
    return parsed.posicionais.length <= 2
      && usaSomenteOpcoes(parsed, ["--id"])
      && Boolean(parsed.posicionais[1] ?? valorOpcao(parsed, "--id"));
  }
  if (subcomando === "catalogo") {
    return parsed.posicionais.length === 1 && usaSomenteOpcoes(parsed, ["--tipo", "--id", "--dominio"]);
  }
  if (subcomando === "recomendar") {
    const limite = valorOpcao(parsed, "--limite");
    return parsed.posicionais.length === 1
      && usaSomenteOpcoes(parsed, ["--intencao", "--limite"])
      && valorOpcao(parsed, "--intencao") !== undefined
      && (limite === undefined || (/^\d+$/u.test(limite) && Number(limite) >= 1 && Number(limite) <= 10));
  }
  if (subcomando === "explicar") {
    return parsed.posicionais.length <= 2
      && usaSomenteOpcoes(parsed, ["--id"])
      && Boolean(parsed.posicionais[1] ?? valorOpcao(parsed, "--id"));
  }
  return false;
}

interface RegraInterativa {
  readonly posicionais: number;
  readonly opcoes?: readonly string[];
  readonly flags?: readonly string[];
  readonly obrigatorias?: readonly string[];
}

const REGRAS_INTERATIVO: Readonly<Record<string, RegraInterativa>> = Object.freeze({
  capabilities: { posicionais: 0 }, capacidades: { posicionais: 0 }, schema: { posicionais: 0 }, esquema: { posicionais: 0 },
  pipelines: { posicionais: 0, opcoes: ["--kind", "--spatial-model", "--render-mode", "--visual-profile", "--control-mode", "--fidelity"] },
  adapters: { posicionais: 0, opcoes: ["--kind", "--spatial-model", "--render-mode", "--visual-profile", "--control-mode", "--fidelity", "--role", "--time-model"] },
  adaptadores: { posicionais: 0, opcoes: ["--kind", "--spatial-model", "--render-mode", "--visual-profile", "--control-mode", "--fidelity", "--role", "--time-model"] },
  validar: { posicionais: 1 }, planejar: { posicionais: 1 },
  "validar-evidencias": { posicionais: 1, opcoes: ["--plano-arquivo", "--bundle-arquivo", "--evidencias-arquivo"] },
  status: { posicionais: 1, opcoes: ["--plano-arquivo", "--bundle-arquivo", "--evidencias-arquivo"] },
  "validar-protocolo": { posicionais: 1 },
  "validar-control-run": { posicionais: 1, opcoes: ["--definition-arquivo", "--plano-arquivo", "--contrato-arquivo", "--entrada-arquivo", "--entrada-auxiliar-arquivo", "--evidencia-arquivo", "--resultado-arquivo"] },
  "validar-ir": { posicionais: 1 }, "indexar-ir": { posicionais: 1 },
  "consultar-ir": { posicionais: 1, opcoes: ["--semantic-id"], obrigatorias: ["--semantic-id"] },
  "chunk-ir": { posicionais: 1, opcoes: ["--semantic-id"], flags: ["--raso"], obrigatorias: ["--semantic-id"] },
  "descrever-ir": { posicionais: 0 }, "validar-engine-snapshot": { posicionais: 1 },
  "diff-engine-snapshots": { posicionais: 2 }, "validar-asset-provenance": { posicionais: 1 },
  "validar-editor-state": { posicionais: 1 }, "planejar-jobs": { posicionais: 1 },
  "validar-acceptance": { posicionais: 1 },
  "operar-acceptance": { posicionais: 1, opcoes: ["--operation", "--context-file"], obrigatorias: ["--operation", "--context-file"] },
  "validar-multimodal": { posicionais: 1 }, "validar-temporal": { posicionais: 1 },
  "validar-evidencia-temporal": { posicionais: 1, opcoes: ["--bundle-arquivo", "--evidencias-arquivo"] },
  "validar-autonomia": { posicionais: 1 }, "validar-playtest-fuzz": { posicionais: 1 },
  "validar-multiplayer": { posicionais: 1 }, "analisar-portabilidade": { posicionais: 1 },
  "validar-workers": { posicionais: 1 },
});

function validarInterativo(args: readonly string[]): boolean {
  if (args.length === 0 || (args.length === 1 && args[0] === "--json")) return true;
  const primeiroPosicional = args.find((token) => !token.startsWith("-"));
  if (!primeiroPosicional) return false;
  const subcomando = primeiroPosicional.toLowerCase().replaceAll("_", "-");
  const regra = REGRAS_INTERATIVO[subcomando];
  if (!regra) return false;
  const indice = args.indexOf(primeiroPosicional);
  const restantes = [...args.slice(0, indice), ...args.slice(indice + 1)];
  const parsed = parsearArgumentos(restantes, {
    opcoes: regra.opcoes, flags: regra.flags, minPosicionais: regra.posicionais, maxPosicionais: regra.posicionais,
  });
  if (!parsed || regra.obrigatorias?.some((opcao) => valorOpcao(parsed, opcao) === undefined)) return false;
  if (subcomando === "validar-evidencia-temporal"
    && !valorOpcao(parsed, "--bundle-arquivo") && !valorOpcao(parsed, "--evidencias-arquivo")) return false;
  const operacao = valorOpcao(parsed, "--operation");
  return !operacao || new Set(["VALIDATE", "EVALUATE", "INVALIDATE"]).has(operacao);
}

function validarResumo(args: readonly string[], promptCurto: boolean): boolean {
  const parsed = parsearArgumentos(args, {
    opcoes: promptCurto ? ["--para"] : ["--para", "--saida", "--drift", "--cache"],
    flags: promptCurto ? ["--micro", "--curto", "--medio"] : ["--micro", "--curto", "--medio", "--raiz", "--com-drift"],
    maxPosicionais: 1,
  });
  if (!parsed) return false;
  const tamanhos = ["--micro", "--curto", "--medio"].filter((flag) => parsed.flags.has(flag));
  const modo = valorOpcao(parsed, "--para");
  return tamanhos.length <= 1 && (!modo || MODOS_RESUMO.has(modo)) && (promptCurto || validarModoCache(parsed, "--drift"));
}

function validarComandoBasico(comando: string, args: readonly string[]): boolean {
  const aliasesGeracao = { "-a": "--alvo", "-s": "--saida" };
  switch (comando) {
    case "validar": return parsearArgumentos(args, { maxPosicionais: 1 }) !== null;
    case "ast":
    case "ir":
    case "diagnosticos": return parsearArgumentos(args, { minPosicionais: 1, maxPosicionais: 1 }) !== null;
    case "contexto-ia": return parsearArgumentos(args, { opcoes: ["--saida"], minPosicionais: 1, maxPosicionais: 1 }) !== null;
    case "compilar":
    case "testar": {
      const parsed = parsearArgumentos(args, { opcoes: ["--alvo", "--saida", "--estrutura", "--framework"], aliases: aliasesGeracao, minPosicionais: comando === "testar" ? 1 : 0, maxPosicionais: 1 });
      if (!parsed) return false;
      const alvo = valorOpcao(parsed, "--alvo"), estrutura = valorOpcao(parsed, "--estrutura"), framework = valorOpcao(parsed, "--framework");
      return (!alvo || ALVOS_GERACAO.has(alvo)) && (!estrutura || ESTRUTURAS.has(estrutura)) && (!framework || FRAMEWORKS.has(framework));
    }
    case "gerar": {
      const parsed = parsearArgumentos(args, { opcoes: ["--alvo", "--saida", "--estrutura", "--framework"], aliases: aliasesGeracao, minPosicionais: 1, maxPosicionais: 2 });
      if (!parsed) return false;
      const alvo = parsed.posicionais[0] ?? valorOpcao(parsed, "--alvo");
      const estrutura = valorOpcao(parsed, "--estrutura"), framework = valorOpcao(parsed, "--framework");
      return Boolean(alvo && ALVOS_GERACAO.has(alvo)) && (!estrutura || ESTRUTURAS.has(estrutura)) && (!framework || FRAMEWORKS.has(framework));
    }
    case "verificar": return parsearArgumentos(args, { opcoes: ["--saida", "--alvo"], flags: ["--sem-cache"], maxPosicionais: 1 }) !== null;
    case "sessao": return parsearArgumentos(args, { flags: ["--json"], maxPosicionais: 2 }) !== null;
    case "formatar": return parsearArgumentos(args, { flags: ["--check"], maxPosicionais: 1 }) !== null;
    case "inspecionar": {
      const parsed = parsearArgumentos(args, { opcoes: ["--drift", "--cache"], flags: ["--com-drift"], maxPosicionais: 1 });
      return parsed !== null && validarModoCache(parsed, "--drift");
    }
    case "drift": {
      const parsed = parsearArgumentos(args, { opcoes: ["--escopo", "--cache", "--drift"], flags: ["--incluir-worktrees", "--incluir-consumidores-laterais"], maxPosicionais: 1 });
      const escopo = parsed ? valorOpcao(parsed, "--escopo") : undefined;
      return parsed !== null && (!escopo || ESCOPOS.has(escopo)) && validarModoCache(parsed, "--cache");
    }
    case "impacto": {
      const parsed = parsearArgumentos(args, { opcoes: ["--alvo", "--mudanca", "--escopo", "--cache"], flags: ["--incluir-worktrees", "--incluir-consumidores-laterais"], maxPosicionais: 1 });
      const escopo = parsed ? valorOpcao(parsed, "--escopo") : undefined;
      return parsed !== null && valorOpcao(parsed, "--alvo") !== undefined && (!escopo || ESCOPOS.has(escopo)) && validarModoCache(parsed, "--cache");
    }
    case "renomear-semantico": {
      const parsed = parsearArgumentos(args, { opcoes: ["--de", "--para", "--escopo", "--cache"], flags: ["--incluir-worktrees", "--incluir-consumidores-laterais"], maxPosicionais: 1 });
      const escopo = parsed ? valorOpcao(parsed, "--escopo") : undefined;
      return parsed !== null && valorOpcao(parsed, "--de") !== undefined && valorOpcao(parsed, "--para") !== undefined && (!escopo || ESCOPOS.has(escopo)) && validarModoCache(parsed, "--cache");
    }
    case "importar": {
      const parsed = parsearArgumentos(args, { opcoes: ["--saida", "--namespace"], aliases: { "-s": "--saida" }, minPosicionais: 2, maxPosicionais: 2 });
      return parsed !== null && FONTES_IMPORTACAO.has(parsed.posicionais[0]!);
    }
    case "docs-impacto": {
      const parsed = parsearArgumentos(args, { opcoes: ["--intencao", "--arquivo"], flags: ["--criar-ausentes", "--completo"], repetiveis: ["--arquivo"], maxPosicionais: 64 });
      return parsed !== null && Boolean(valorOpcao(parsed, "--intencao") ?? parsed.posicionais[0]);
    }
    case "finalizar-mudanca": {
      const parsed = parsearArgumentos(args, { opcoes: ["--intencao", "--arquivo", "--doc-lida"], repetiveis: ["--arquivo", "--doc-lida"], maxPosicionais: 64 });
      return parsed !== null && Boolean(valorOpcao(parsed, "--intencao") ?? parsed.posicionais[0]);
    }
    default: return false;
  }
}

function sintaxeValida(comando: string, args: readonly string[]): boolean {
  if (new Set(["doctor", "ajuda-ia", "starter-ia", "prompt-ia", "prompt-ia-ui", "prompt-ia-react", "prompt-ia-sema-primeiro", "exemplos-prompt-ia", "sync-codex", "instalar-exemplos"]).has(comando)) {
    return validarSemArgumentos(args);
  }
  switch (comando) {
    case "iniciar": return validarIniciar(args);
    case "init": return validarInit(args);
    case "dev": return validarDev(args);
    case "sync": return validarSync(args);
    case "guard": return validarGuard(args);
    case "profile": return validarProfile(args);
    case "author": return validarAuthor(args);
    case "rule-packs": return validarRulePacks(args);
    case "skill": return validarSkill(args);
    case "conteudo": return validarConteudo(args);
    case "descobrir": return validarDescoberta(args, "descobrir");
    case "pipeline": return validarDescoberta(args, "pipeline");
    case "capabilities": return validarDescoberta(args, "capabilities");
    case "interativo": return validarInterativo(args);
    case "resumo": return validarResumo(args, false);
    case "prompt-curto": return validarResumo(args, true);
    default: return validarComandoBasico(comando, args);
  }
}

export function validarSintaxeInvocacaoPublica(
  argv: readonly string[],
): ResultadoSintaxeInvocacaoPublica {
  if (argv.length === 0) {
    return {
      comando: "",
      sintaxeValida: true,
      dispatchPermitido: false,
      handlerResolvido: false,
      efeitosPermitidos: false,
      categoriaFalha: null,
      codigoPublico: null,
    };
  }
  if (FLAGS_VERSAO.has(argv[0]!) && argv.length === 1) {
    return {
      comando: argv[0]!,
      sintaxeValida: true,
      dispatchPermitido: false,
      handlerResolvido: false,
      efeitosPermitidos: false,
      categoriaFalha: null,
      codigoPublico: null,
    };
  }

  const comando = argv[0]!;
  if (!COMANDOS_PUBLICOS.has(comando)) throw erroComandoDesconhecido();
  if (!sintaxeValida(comando, argv.slice(1))) throw erroArgumentoInvalido();

  return {
    comando,
    sintaxeValida: true,
    dispatchPermitido: true,
    handlerResolvido: false,
    efeitosPermitidos: true,
    categoriaFalha: null,
    codigoPublico: null,
  };
}
