import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compilarProjeto, lerArquivoTexto, listarArquivosSema } from "@sema/nucleo";

function falhar(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

function normalizarCaminho(entrada) {
  return path.resolve(process.cwd(), entrada);
}

function garantirArquivoSema(caminhoArquivo) {
  if (!caminhoArquivo.toLowerCase().endsWith(".sema")) {
    falhar("O caminho informado precisa apontar para um arquivo .sema.");
  }
}

const [, , entradaArquivo, entradaSaida] = process.argv;

if (!entradaArquivo) {
  falhar("Uso: node scripts/preparar-contexto-ia.mjs <arquivo.sema> [pasta-saida]");
}

const arquivo = normalizarCaminho(entradaArquivo);
garantirArquivoSema(arquivo);

const pastaBase = entradaSaida
  ? normalizarCaminho(entradaSaida)
  : path.resolve(process.cwd(), ".tmp", "contexto-ia", path.basename(arquivo, ".sema"));

mkdirSync(pastaBase, { recursive: true });

const pastaProjeto = path.dirname(arquivo);
const arquivosProjeto = await listarArquivosSema(pastaProjeto);
const fontes = [];

for (const caminho of arquivosProjeto) {
  const codigo = await lerArquivoTexto(caminho);
  fontes.push({ caminho, codigo });
}

const resultadoProjeto = compilarProjeto(fontes);
const resultadoModulo = resultadoProjeto.modulos.find((item) => path.resolve(item.caminho) === arquivo);

if (!resultadoModulo) {
  falhar(`Nao foi possivel encontrar o modulo correspondente ao arquivo ${arquivo}.`);
}

const validar = {
  comando: "validar",
  sucesso: !resultadoModulo.diagnosticos.some((item) => item.severidade === "erro"),
  resultados: [
    {
      caminho: arquivo,
      modulo: resultadoModulo.modulo?.nome ?? null,
      sucesso: !resultadoModulo.diagnosticos.some((item) => item.severidade === "erro"),
      diagnosticos: resultadoModulo.diagnosticos,
    },
  ],
};

const diagnosticos = {
  comando: "diagnosticos",
  caminho: arquivo,
  modulo: resultadoModulo.modulo?.nome ?? null,
  diagnosticos: resultadoModulo.diagnosticos,
};

const ast = {
  comando: "ast",
  caminho: arquivo,
  modulo: resultadoModulo.modulo?.nome ?? null,
  sucesso: !resultadoModulo.diagnosticos.some((item) => item.severidade === "erro"),
  diagnosticos: resultadoModulo.diagnosticos,
  ast: resultadoModulo.modulo ?? null,
};

const ir = {
  comando: "ir",
  caminho: arquivo,
  modulo: resultadoModulo.modulo?.nome ?? null,
  sucesso: !resultadoModulo.diagnosticos.some((item) => item.severidade === "erro"),
  diagnosticos: resultadoModulo.diagnosticos,
  ir: resultadoModulo.ir ?? null,
};

const modulo = resultadoModulo.modulo?.nome ?? path.basename(arquivo, ".sema");

writeFileSync(path.join(pastaBase, "validar.json"), `${JSON.stringify(validar, null, 2)}\n`, "utf-8");
writeFileSync(
  path.join(pastaBase, "diagnosticos.json"),
  `${JSON.stringify(diagnosticos, null, 2)}\n`,
  "utf-8",
);
writeFileSync(path.join(pastaBase, "ast.json"), `${JSON.stringify(ast, null, 2)}\n`, "utf-8");
writeFileSync(path.join(pastaBase, "ir.json"), `${JSON.stringify(ir, null, 2)}\n`, "utf-8");

const resumo = `# Contexto de IA para ${modulo}

- Arquivo alvo: \`${arquivo}\`
- Modulo: \`${modulo}\`
- Sucesso em validar: \`${validar.sucesso === true}\`
- Quantidade de diagnosticos: \`${Array.isArray(diagnosticos.diagnosticos) ? diagnosticos.diagnosticos.length : 0}\`

## Arquivos gerados neste pacote

- \`validar.json\`
- \`diagnosticos.json\`
- \`ast.json\`
- \`ir.json\`

## Fluxo recomendado para o agente

1. Ler \`ast.json\` para entender a forma escrita.
2. Ler \`ir.json\` para entender a forma semantica resolvida.
3. Ler \`diagnosticos.json\` se houver falha ou aviso relevante.
4. Editar o arquivo \`.sema\`.
5. Rodar \`sema formatar "${arquivo}"\`.
6. Rodar \`sema validar "${arquivo}" --json\`.
7. Fechar com \`sema verificar <arquivo-ou-pasta> --json --saida ./.tmp/verificacao-ia\`.

## Documentos que ajudam a IA

- \`docs/AGENT_STARTER.md\`
- \`docs/sintaxe.md\`
- \`docs/integracao-com-ia.md\`
- \`docs/como-ensinar-a-sema-para-ia.md\`
- \`docs/prompt-base-ia-sema.md\`
- \`docs/fluxo-pratico-ia-sema.md\`
`;

writeFileSync(path.join(pastaBase, "README.md"), resumo, "utf-8");

console.log(
  JSON.stringify(
    {
      sucesso: true,
      arquivo,
      modulo,
      pastaSaida: pastaBase,
      artefatos: [
        "validar.json",
        "diagnosticos.json",
        "ast.json",
        "ir.json",
        "README.md",
      ],
    },
    null,
    2,
  ),
);
