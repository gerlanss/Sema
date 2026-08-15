// SEMA-GOVERNED: sema.produto.geradores_nativos, sema.produto.fronteira_repositorios
// Consulte contratos/sema/geradores_nativos.sema antes de editar.
// Descricao: prova geracao governada e runners locais das toolchains distribuidas no pacote instalado.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function listarArquivosRecursivos(pasta) {
  const saida = [];
  for (const entrada of await readdir(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...await listarArquivosRecursivos(caminho));
    } else if (entrada.isFile()) {
      saida.push(caminho);
    }
  }
  return saida;
}

export async function validarGeradoresInstalados({
  semaBin,
  basePacote,
  sandbox,
  executarComSaida,
}) {
  const contrato = path.join(basePacote, "exemplos", "calculadora.sema");
  const alvos = [
    { alvo: "typescript", argumento: "typescript" },
    { alvo: "php", argumento: "php" },
    { alvo: "dotnet", argumento: "cs" },
    { alvo: "cpp", argumento: "c++" },
  ];
  for (const { alvo, argumento } of alvos) {
    const saida = path.join(sandbox, `gerado-${alvo}`);
    executarComSaida(
      process.execPath,
      [semaBin, "compilar", contrato, "--alvo", argumento, "--saida", saida, "--estrutura", "modulos"],
      sandbox,
    );
    const arquivos = await listarArquivosRecursivos(saida);
    const extensao = alvo === "php" ? ".php" : alvo === "dotnet" ? ".cs" : alvo === "cpp" ? ".cpp" : ".ts";
    const gerados = arquivos.filter((arquivo) => arquivo.endsWith(extensao));
    if (gerados.length === 0) {
      throw new Error(`The installed CLI did not generate any ${extensao} file for ${alvo}.`);
    }
    const governado = await Promise.all(gerados.map((arquivo) => readFile(arquivo, "utf8")));
    if (!governado.some((conteudo) => conteudo.includes("SEMA-GOVERNED"))) {
      throw new Error(`The installed ${alvo} generator omitted the SEMA-GOVERNED marker.`);
    }

    if (alvo === "php") {
      const testePhp = gerados.find((arquivo) => /^test_.*\.php$/i.test(path.basename(arquivo)));
      if (!testePhp) {
        throw new Error("The installed PHP generator did not emit its executable test artifact.");
      }
      executarComSaida("php", [testePhp], path.dirname(testePhp));
    }

    if (alvo === "dotnet" || alvo === "cpp") {
      const saidaTeste = path.join(sandbox, `testado-${alvo}`);
      executarComSaida(
        process.execPath,
        [semaBin, "testar", contrato, "--alvo", argumento, "--saida", saidaTeste, "--estrutura", "modulos"],
        sandbox,
      );
    }
  }
}
