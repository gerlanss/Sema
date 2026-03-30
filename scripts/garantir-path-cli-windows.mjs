import { execFileSync } from "node:child_process";

function literalPowerShell(valor) {
  return `'${valor.replace(/'/g, "''")}'`;
}

function lerSaida(comando, argumentos) {
  return execFileSync(comando, argumentos, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function lerSaidaPowerShell(comando) {
  return lerSaida("powershell", ["-NoProfile", "-Command", comando]);
}

if (process.platform !== "win32") {
  console.log("Ambiente nao e Windows. Nenhum ajuste de PATH foi necessario.");
  process.exit(0);
}

let prefixoGlobal;

try {
  prefixoGlobal = lerSaidaPowerShell("& npm config get prefix");
} catch (erro) {
  console.error("Nao foi possivel descobrir o prefixo global do npm no Windows.");
  console.error(erro instanceof Error ? erro.message : String(erro));
  process.exit(1);
}

if (!prefixoGlobal) {
  console.error("O npm nao retornou um prefixo global valido.");
  process.exit(1);
}

let pathUsuarioAtual = "";

try {
  pathUsuarioAtual = lerSaida("powershell", [
    "-NoProfile",
    "-Command",
    "[Environment]::GetEnvironmentVariable('Path','User')",
  ]);
} catch (erro) {
  console.error("Nao foi possivel ler o PATH do usuario no Windows.");
  console.error(erro instanceof Error ? erro.message : String(erro));
  process.exit(1);
}

const entradasAtuais = pathUsuarioAtual
  .split(";")
  .map((item) => item.trim())
  .filter(Boolean);

const jaExiste = entradasAtuais.some((item) => item.toLowerCase() === prefixoGlobal.toLowerCase());

if (jaExiste) {
  console.log(`O PATH do usuario ja contem o prefixo global do npm: ${prefixoGlobal}`);
  process.exit(0);
}

const novoPath = entradasAtuais.length > 0 ? `${entradasAtuais.join(";")};${prefixoGlobal}` : prefixoGlobal;

try {
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `[Environment]::SetEnvironmentVariable('Path', ${literalPowerShell(novoPath)}, 'User')`,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (erro) {
  console.error("Falha ao atualizar o PATH do usuario no Windows.");
  console.error(erro instanceof Error ? erro.message : String(erro));
  process.exit(1);
}

console.log(`Prefixo global do npm adicionado ao PATH do usuario: ${prefixoGlobal}`);
console.log("Feche e abra o terminal de novo para garantir que o comando `sema` apareca no PowerShell.");
