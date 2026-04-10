import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const raiz = process.cwd();
const manifestRaiz = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
const manifestMcp = JSON.parse(await readFile(path.join(raiz, "pacotes", "mcp", "package.json"), "utf8"));
const manifestExtensao = JSON.parse(await readFile(path.join(raiz, "pacotes", "editor-vscode", "package.json"), "utf8"));
const versao = manifestRaiz.version;

if (manifestExtensao.version !== versao) {
  throw new Error(`A extensao esta em ${manifestExtensao.version}, mas a release publica esta em ${versao}.`);
}

if (manifestMcp.version !== versao) {
  throw new Error(`O MCP esta em ${manifestMcp.version}, mas a release publica esta em ${versao}.`);
}

const pastaPacotes = path.join(raiz, ".tmp", "pacotes-publicos");
const pastaVsix = path.join(raiz, ".tmp", "editor-vscode");
const pastaRelease = path.join(raiz, ".tmp", "release-assets");

const cliVersionado = path.join(pastaPacotes, `semacode-cli-${versao}.tgz`);
const cliLatest = path.join(pastaRelease, "sema-cli-latest.tgz");
const vsixVersionado = path.join(pastaVsix, `sema-language-tools-${versao}.vsix`);
const vsixLatest = path.join(pastaRelease, "sema-language-tools-latest.vsix");
const installSh = path.join(raiz, "install-sema.sh");
const installPs1 = path.join(raiz, "install-sema.ps1");

async function sha256(caminho) {
  const conteudo = await readFile(caminho);
  return createHash("sha256").update(conteudo).digest("hex");
}

async function main() {
  await rm(pastaRelease, { recursive: true, force: true });
  await mkdir(pastaRelease, { recursive: true });

  await copyFile(cliVersionado, path.join(pastaRelease, `sema-cli-${versao}.tgz`));
  await copyFile(cliVersionado, cliLatest);
  await copyFile(vsixVersionado, path.join(pastaRelease, `sema-language-tools-${versao}.vsix`));
  await copyFile(vsixVersionado, vsixLatest);
  await copyFile(installSh, path.join(pastaRelease, "install-sema.sh"));
  await copyFile(installPs1, path.join(pastaRelease, "install-sema.ps1"));

  const arquivos = [
    `sema-cli-${versao}.tgz`,
    "sema-cli-latest.tgz",
    `sema-language-tools-${versao}.vsix`,
    "sema-language-tools-latest.vsix",
    "install-sema.sh",
    "install-sema.ps1",
  ];

  const checksums = await Promise.all(
    arquivos.map(async (arquivo) => `${await sha256(path.join(pastaRelease, arquivo))}  ${arquivo}`),
  );

  const notas = `# Sema ${versao}

Sema e um Protocolo de Governanca de Intencao para IA sobre software vivo em backend e front consumer.

## Destaques

- persistencia vendor-first de primeira classe para \`postgres\`, \`mysql\`, \`sqlite\`, \`mongodb\` e \`redis\`
- extensao VS Code com snippets e exemplos separados para cada engine
- \`sema drift\` e importacao legada com leitura viva de recursos reais de banco
- \`@semacode/mcp\` alinhado com a mesma versao publica da CLI
- docs, instaladores e onboarding revisados para o fluxo atual

## Antes de instalar a CLI

Instale Node.js LTS primeiro. O \`npm\` vem junto no instalador oficial:

- [nodejs.org](https://nodejs.org/)
- Windows com \`winget\`: \`winget install OpenJS.NodeJS.LTS\`
- macOS com Homebrew: \`brew install node\`
- checagem rapida: \`node -v\` e \`npm -v\`

## Instalar a CLI

Linux, Windows PowerShell e macOS:

\`\`\`bash
npm install -g @semacode/cli
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
sema resumo contratos/pedidos.sema --micro --para onboarding
sema doctor
\`\`\`

## Instalar o MCP da Sema

Se voce usa Claude Code, Cursor, VS Code ou outro cliente MCP:

\`\`\`bash
npm install -g @semacode/mcp
sema-mcp
\`\`\`

Ou rode sem instalar:

\`\`\`bash
npx -y @semacode/mcp
\`\`\`

Instalacao local ao projeto:

\`\`\`bash
npm install @semacode/cli
npx sema --help
\`\`\`

Instalacao alternativa por GitHub Release:

\`\`\`bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
\`\`\`

## Instalar a extensao VS Code

Linux/macOS:

\`\`\`bash
curl -L -o sema-language-tools.vsix https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix
code --install-extension ./sema-language-tools.vsix --force
\`\`\`

Windows PowerShell:

\`\`\`powershell
Invoke-WebRequest -Uri https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix -OutFile sema-language-tools.vsix
code --install-extension .\\sema-language-tools.vsix --force
\`\`\`

## Artefatos

- \`sema-cli-${versao}.tgz\`
- \`sema-cli-latest.tgz\`
- \`sema-language-tools-${versao}.vsix\`
- \`sema-language-tools-latest.vsix\`
- \`install-sema.sh\`
- \`install-sema.ps1\`
- MCP npm: \`@semacode/mcp@${versao}\`
`;

  await writeFile(path.join(pastaRelease, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`, "utf8");
  await writeFile(path.join(pastaRelease, "release-notes.md"), notas, "utf8");
  console.log(`Release publica preparada em ${pastaRelease}`);
}

main().catch((erro) => {
  console.error("Falha ao preparar os artefatos da release publica.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
