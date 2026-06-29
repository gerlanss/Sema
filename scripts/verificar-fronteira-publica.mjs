// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descricao: valida que o repositorio publico contem somente a CLI local e artefatos publicaveis.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = process.cwd();
const emailSuporte = "suporte@otimitare.online";
const extensoesTexto = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".sema",
  ".sh",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);

const ignorarDiretorios = new Set([
  ".git",
  ".tmp",
  "dist",
  "node_modules",
]);

const arquivosObrigatorios = [
  "LICENSE",
  "README.md",
  "pacotes/cli/package.json",
  "pacotes/cli/README.md",
  "scripts/empacotar-cli-publica.mjs",
  "scripts/testar-pacote-cli-publico.mjs",
];

const arquivosIgnoradosConteudo = new Set([
  "scripts/verificar-fronteira-publica.mjs",
]);

const nomesBloqueados = [
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|[/\\])\.env(?:\.|$)/i,
  /(^|[/\\])(?:backup|backups|snapshot|snapshots|dump|dumps)(?:[/\\]|$)/i,
  /\.(?:7z|rar|zip)$/i,
];

const padroesConteudoBloqueados = [
  { regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, motivo: "chave privada PEM" },
  { regex: /\b(?:api[_-]?key|secret|token|password|senha|credential)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i, motivo: "segredo aparente" },
  { regex: /\b(?:AUTH_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PRIVATE_KEY)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}["']/i, motivo: "segredo aparente" },
  { regex: /\bDB_PASSWORD\b|\bDATABASE_URL\b/i, motivo: "credencial de banco" },
  { regex: /\b(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:\d{1,3})){3}\b/, motivo: "IP publico fixo" },
];

function paraRelativo(caminho) {
  return path.relative(raiz, caminho).replaceAll(path.sep, "/");
}

async function existe(caminhoRelativo) {
  try {
    await stat(path.join(raiz, caminhoRelativo));
    return true;
  } catch {
    return false;
  }
}

async function listarArquivos(dir = raiz) {
  const entradas = await readdir(dir, { withFileTypes: true });
  const arquivos = [];

  for (const entrada of entradas) {
    const caminho = path.join(dir, entrada.name);
    const relativo = paraRelativo(caminho);
    if (entrada.isDirectory()) {
      if (ignorarDiretorios.has(entrada.name)) {
        continue;
      }
      arquivos.push(...(await listarArquivos(caminho)));
      continue;
    }
    if (entrada.isFile() && extensoesTexto.has(path.extname(entrada.name).toLowerCase())) {
      arquivos.push(relativo);
    }
  }

  return arquivos;
}

function registrar(lista, caminho, motivo) {
  lista.push({ caminho, motivo });
}

async function verificarFronteiraPublica({ json = false } = {}) {
  const bloqueios = [];
  const avisos = [];

  for (const caminho of arquivosObrigatorios) {
    if (!(await existe(caminho))) {
      registrar(bloqueios, caminho, "arquivo publico obrigatorio ausente");
    }
  }

  const arquivos = await listarArquivos();
  for (const arquivo of arquivos) {
    if (nomesBloqueados.some((regex) => regex.test(arquivo))) {
      registrar(bloqueios, arquivo, "arquivo sensivel nao publicavel");
      continue;
    }
    if (arquivosIgnoradosConteudo.has(arquivo)) {
      continue;
    }

    const conteudo = await readFile(path.join(raiz, arquivo), "utf8");
    for (const padrao of padroesConteudoBloqueados) {
      if (padrao.regex.test(conteudo)) {
        registrar(bloqueios, arquivo, padrao.motivo);
      }
    }
  }

  const license = await readFile(path.join(raiz, "LICENSE"), "utf8").catch(() => "");
  const licencaSemRevendaComercial =
    license.includes("Sell Sema") &&
    license.includes("commercial replica") &&
    license.includes("resale permission");
  if (!licencaSemRevendaComercial || !license.includes(emailSuporte)) {
    registrar(bloqueios, "LICENSE", "licenca publica precisa proibir uso comercial sem permissao e informar suporte oficial");
  }

  const readme = await readFile(path.join(raiz, "README.md"), "utf8").catch(() => "");
  if (!readme.includes(emailSuporte)) {
    registrar(bloqueios, "README.md", "README precisa informar suporte oficial");
  }

  const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8").catch(() => "{}"));
  if (manifestCli.license !== "SEE LICENSE IN LICENSE") {
    registrar(bloqueios, "pacotes/cli/package.json", "manifesto da CLI precisa apontar para a licenca do repositorio");
  }
  if (manifestCli.bugs?.email !== emailSuporte) {
    registrar(bloqueios, "pacotes/cli/package.json", "manifesto da CLI precisa usar o email oficial de suporte");
  }

  const aprovado = bloqueios.length === 0;
  const suporteEmailOficial = manifestCli?.bugs?.email === emailSuporte && readme.includes(emailSuporte) && license.includes(emailSuporte);
  const revendaComercialBloqueada = licencaSemRevendaComercial;
  const result = {
    comando: "verificar-fronteira-publica",
    aprovado,
    bloqueado: !aprovado,
    decisaoAgente: aprovado ? "continuar" : "parar",
    fronteira: "publico_local_only",
    suporte: emailSuporte,
    politica_comercial: "nao_replicar_para_venda_comercial",
    materiais_privados_ausentes: aprovado,
    artefatos_sensiveis_ausentes: aprovado,
    segredos_ausentes: aprovado,
    docs_publicas_em_ingles: aprovado,
    suporte_email_oficial: suporteEmailOficial,
    revenda_comercial_bloqueada: revendaComercialBloqueada,
    bloqueios,
    avisos,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (aprovado) {
    console.log("Fronteira publica local-only aprovada.");
  } else {
    console.error("Fronteira publica local-only bloqueada:");
    for (const bloqueio of bloqueios) {
      console.error(`- ${bloqueio.caminho}: ${bloqueio.motivo}`);
    }
  }

  return result;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const json = process.argv.includes("--json");
  const result = await verificarFronteiraPublica({ json });
  process.exit(result.aprovado ? 0 : 1);
}

export { verificarFronteiraPublica };
