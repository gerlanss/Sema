import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = process.cwd();
const manifest = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
const versao = manifest.version;
const tarball = path.join(raiz, ".tmp", "pacotes-publicos", `sema-cli-${versao}.tgz`);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tagIndex = args.findIndex((arg) => arg === "--tag");
const tag = tagIndex >= 0 ? args[tagIndex + 1] : "latest";

function executar(comando, argumentos, cwd) {
  if (process.platform === "win32" && comando === "npm") {
    execFileSync("powershell", ["-NoProfile", "-Command", [comando, ...argumentos].join(" ")], {
      cwd,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(comando, argumentos, {
    cwd,
    stdio: "inherit",
  });
}

const argumentosPublish = [
  "publish",
  tarball,
  "--access",
  "public",
  "--tag",
  tag,
];

if (dryRun) {
  argumentosPublish.push("--dry-run");
}

console.log(`${dryRun ? "Validando" : "Publicando"} a CLI publica da Sema no npm...`);
console.log(`Tarball: ${tarball}`);
console.log(`Tag npm: ${tag}`);

executar("npm", argumentosPublish, raiz);
