const { execFile, spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const executarArquivo = promisify(execFile);

function obterNomeExecutavelSema(platform = process.platform) {
  return platform === "win32" ? "sema.cmd" : "sema";
}

function criarExecucaoPorCaminho(caminhoExecutavel, origem) {
  const finalizaEmJs = caminhoExecutavel.toLowerCase().endsWith(".js") || caminhoExecutavel.toLowerCase().endsWith(".mjs");
  if (finalizaEmJs) {
    return {
      comando: "node",
      argumentosBase: [caminhoExecutavel],
      origem,
      caminhoExecutavel,
    };
  }

  return {
    comando: caminhoExecutavel,
    argumentosBase: [],
    origem,
    caminhoExecutavel,
  };
}

function deduplicarCandidatos(candidatos) {
  const vistos = new Set();
  return candidatos.filter((candidato) => {
    const chave = JSON.stringify({
      comando: candidato.comando,
      argumentosBase: candidato.argumentosBase,
      origem: candidato.origem,
      caminhoExecutavel: candidato.caminhoExecutavel,
    });
    if (vistos.has(chave)) {
      return false;
    }
    vistos.add(chave);
    return true;
  });
}

function obterCandidatosCli({
  cliConfigurada,
  workspaceRoot,
  shellResolvedPath,
  globalPrefix,
  appData = process.env.APPDATA,
  platform = process.platform,
} = {}) {
  const candidatos = [];
  const nomeExecutavel = obterNomeExecutavelSema(platform);

  if (typeof cliConfigurada === "string" && cliConfigurada.trim().length > 0) {
    return [criarExecucaoPorCaminho(cliConfigurada.trim(), "configuracao sema.cliPath")];
  }

  candidatos.push({
    comando: nomeExecutavel,
    argumentosBase: [],
    origem: "bin global ou shell atual",
  });

  if (shellResolvedPath && existsSync(shellResolvedPath)) {
    candidatos.push(criarExecucaoPorCaminho(shellResolvedPath, "resolvido do shell"));
  }

  if (typeof globalPrefix === "string" && globalPrefix.trim().length > 0) {
    const globalBinary = path.join(globalPrefix.trim(), nomeExecutavel);
    if (existsSync(globalBinary)) {
      candidatos.push(criarExecucaoPorCaminho(globalBinary, "prefixo global do npm"));
    }
  }

  if (platform === "win32" && typeof appData === "string" && appData.trim().length > 0) {
    const windowsUserBinary = path.join(appData.trim(), "npm", "sema.cmd");
    if (existsSync(windowsUserBinary)) {
      candidatos.push(criarExecucaoPorCaminho(windowsUserBinary, "AppData do usuario no Windows"));
    }
  }

  if (workspaceRoot) {
    const binLocal = path.join(workspaceRoot, "node_modules", ".bin", nomeExecutavel);
    if (existsSync(binLocal)) {
      candidatos.push(criarExecucaoPorCaminho(binLocal, "bin local do projeto"));
    }
  }

  return deduplicarCandidatos(candidatos);
}

function ehWrapperCmdNoWindows(candidato, platform = process.platform) {
  return platform === "win32" && /\.(cmd|bat)$/i.test(candidato.comando);
}

async function executarCandidato(candidato, argumentos, opcoes = {}) {
  const {
    cwd,
    timeout = 120000,
    windowsHide = true,
    ...restante
  } = opcoes;

  if (!ehWrapperCmdNoWindows(candidato)) {
    return executarArquivo(candidato.comando, [...candidato.argumentosBase, ...argumentos], {
      cwd,
      timeout,
      windowsHide,
      ...restante,
    });
  }

  return new Promise((resolve, reject) => {
    const processo = spawn(candidato.comando, [...candidato.argumentosBase, ...argumentos], {
      cwd,
      windowsHide,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: true,
    });

    let stdout = "";
    let stderr = "";
    let finalizado = false;
    let timer = undefined;

    if (typeof timeout === "number" && timeout > 0) {
      timer = setTimeout(() => {
        if (finalizado) {
          return;
        }
        finalizado = true;
        processo.kill();
        reject(Object.assign(new Error(`Command failed: ${candidato.comando}\nProcesso excedeu o timeout de ${timeout}ms.`), {
          stdout,
          stderr,
          code: 124,
        }));
      }, timeout);
    }

    processo.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    processo.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    processo.on("error", (erro) => {
      if (finalizado) {
        return;
      }
      finalizado = true;
      if (timer) {
        clearTimeout(timer);
      }
      reject(Object.assign(erro, { stdout, stderr }));
    });

    processo.on("close", (code) => {
      if (finalizado) {
        return;
      }
      finalizado = true;
      if (timer) {
        clearTimeout(timer);
      }

      if ((code ?? 0) === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(Object.assign(new Error(`Command failed: ${candidato.comando}`), {
        stdout,
        stderr,
        code: code ?? 1,
      }));
    });
  });
}

module.exports = {
  criarExecucaoPorCaminho,
  executarCandidato,
  obterCandidatosCli,
  obterNomeExecutavelSema,
};
