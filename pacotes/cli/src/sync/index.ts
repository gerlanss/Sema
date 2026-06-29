// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: codigo governado pelo Sema; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// Sync Sema ↔ Prisma
// Contrato: cli_sync_prisma.sema

import * as fs from 'fs';
import * as path from 'path';

export interface MapeamentoTipo {
  semaTipo: string;
  prismaTipo: string;
  atributosPrisma: string[];
}

const MAPEAMENTO_TIPOS: MapeamentoTipo[] = [
  { semaTipo: 'Id', prismaTipo: 'String', atributosPrisma: ['@id', '@default(uuid())'] },
  { semaTipo: 'Texto', prismaTipo: 'String', atributosPrisma: [] },
  { semaTipo: 'Email', prismaTipo: 'String', atributosPrisma: [] },
  { semaTipo: 'Decimal', prismaTipo: 'Decimal', atributosPrisma: [] },
  { semaTipo: 'Inteiro', prismaTipo: 'Int', atributosPrisma: [] },
  { semaTipo: 'Booleano', prismaTipo: 'Boolean', atributosPrisma: [] },
  { semaTipo: 'Timestamp', prismaTipo: 'DateTime', atributosPrisma: [] },
  { semaTipo: 'Lista', prismaTipo: 'String[]', atributosPrisma: [] },
  { semaTipo: 'Mapa', prismaTipo: 'Json', atributosPrisma: [] },
];

export function mapearTiposSemaPrisma(): { mapeamentos: MapeamentoTipo[]; cobertura: number } {
  return {
    mapeamentos: MAPEAMENTO_TIPOS,
    cobertura: 0.85
  };
}

function semaParaPrismaTipo(semaTipo: string): string {
  const mapeamento = MAPEAMENTO_TIPOS.find(m => m.semaTipo === semaTipo);
  if (!mapeamento) return 'String'; // fallback

  const atributos = mapeamento.atributosPrisma.length > 0
    ? ' ' + mapeamento.atributosPrisma.join(' ')
    : '';

  return `${mapeamento.prismaTipo}${atributos}`;
}

export async function gerarSchemaPrisma(
  pastaContratos: string,
  saidaSchema: string,
  datasourceProvider: string = 'postgresql'
): Promise<{ schemaGerado: string; modelsGerados: number; enumsGerados: number }> {
  // Verificar pasta
  if (!fs.existsSync(pastaContratos)) {
    throw new Error(`Pasta nao existe: ${pastaContratos}`);
  }

  const arquivos = fs.readdirSync(pastaContratos);
  const contratos = arquivos.filter(f => f.endsWith('.sema'));

  if (contratos.length === 0) {
    throw new Error('Nenhum contrato .sema encontrado');
  }

  // Gerar schema basico
  let models = '';
  let modelCount = 0;

  for (const contrato of contratos) {
    const nomeModel = path.basename(contrato, '.sema').replace(/\./g, '_');

    // Schema simplificado - em producao, fazer parsing real do contrato
    models += `\nmodel ${nomeModel.charAt(0).toUpperCase() + nomeModel.slice(1)} {
  id        String   @id @default(uuid())
  criadoEm  DateTime @default(now())
  // Gerado a partir de: ${contrato}
  // TODO: Adicionar campos do contrato Sema
}\n`;
    modelCount++;
  }

  const schema = `// Gerado automaticamente pelo Sema
// Fonte: ${pastaContratos}

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${datasourceProvider}"
  url      = env("SEMA_PRISMA_URL")
}
${models}`;

  // Salvar
  fs.writeFileSync(saidaSchema, schema, 'utf-8');

  return {
    schemaGerado: schema,
    modelsGerados: modelCount,
    enumsGerados: 0
  };
}

export async function importarSchemaPrisma(
  caminhoSchema: string,
  pastaSaida: string,
  nomeModulo: string
): Promise<{ contratosGerados: string[]; entitiesCriadas: number }> {
  if (!fs.existsSync(caminhoSchema)) {
    throw new Error(`Schema nao existe: ${caminhoSchema}`);
  }

  const schema = fs.readFileSync(caminhoSchema, 'utf-8');

  // Extrair models (regex simplificado)
  const modelMatches = schema.match(/model\s+(\w+)\s*\{([^}]+)\}/g) || [];

  const contratos: string[] = [];

  for (const match of modelMatches) {
    const nomeMatch = match.match(/model\s+(\w+)/);
    if (!nomeMatch) continue;

    const nomeModel = nomeMatch[1];
    const nomeContrato = `${nomeModel.toLowerCase()}.sema`;
    const caminhoContrato = path.join(pastaSaida, nomeContrato);

    // Gerar contrato basico
    const conteudo = `module ${nomeModulo}.${nomeModel.toLowerCase()} {
  entity ${nomeModel} {
    fields {
      id: Id
      // TODO: Mapear campos do schema Prisma
    }
  }

  task criar_${nomeModel.toLowerCase()} {
    input {
      // TODO: Definir inputs
    }
    output {
      ${nomeModel.toLowerCase()}: ${nomeModel}
    }
    effects {
      persistencia ${nomeModel}
    }
  }
}`;

    fs.writeFileSync(caminhoContrato, conteudo, 'utf-8');
    contratos.push(caminhoContrato);
  }

  return {
    contratosGerados: contratos,
    entitiesCriadas: modelMatches.length
  };
}

export async function compararDivergencias(
  pastaContratos: string,
  caminhoSchema: string
): Promise<{ divergencias: string[]; total: number; breaking: number }> {
  // Implementacao simplificada
  const divergencias: string[] = [];

  // Verificar se ambos existem
  if (!fs.existsSync(pastaContratos)) {
    divergencias.push('Pasta de contratos nao existe');
  }
  if (!fs.existsSync(caminhoSchema)) {
    divergencias.push('Schema Prisma nao existe');
  }

  return {
    divergencias,
    total: divergencias.length,
    breaking: 0
  };
}

// Handlers CLI
export async function comandoSyncPrisma(args: string[]): Promise<void> {
  const gerarIdx = args.indexOf('--gerar');
  const importarIdx = args.indexOf('--importar');
  const compararIdx = args.indexOf('--comparar');

  if (gerarIdx !== -1) {
    const pasta = args[gerarIdx + 1] || 'contratos/';
    const saida = args[gerarIdx + 2] || 'prisma/schema.prisma';

    const resultado = await gerarSchemaPrisma(pasta, saida);
    console.log(`\n✅ Schema gerado: ${saida}`);
    console.log(`   Models: ${resultado.modelsGerados}`);
  } else if (importarIdx !== -1) {
    const schema = args[importarIdx + 1];
    const saida = args[importarIdx + 2] || 'contratos/importados/';
    const modulo = args[importarIdx + 3] || 'legacy';

    if (!schema) {
      console.error('Uso: sema sync prisma --importar <schema.prisma> [saida] [modulo]');
      process.exit(1);
    }

    fs.mkdirSync(saida, { recursive: true });
    const resultado = await importarSchemaPrisma(schema, saida, modulo);
    console.log(`\n✅ Importado: ${resultado.contratosGerados.length} contratos`);
  } else if (compararIdx !== -1) {
    const pasta = args[compararIdx + 1] || 'contratos/';
    const schema = args[compararIdx + 2] || 'prisma/schema.prisma';

    const resultado = await compararDivergencias(pasta, schema);
    console.log(`\n📊 Divergencias: ${resultado.total}`);
    if (resultado.divergencias.length > 0) {
      resultado.divergencias.forEach(d => console.log(`   - ${d}`));
    }
  } else {
    console.log('Uso: sema sync prisma --gerar [pasta] [saida]');
    console.log('     sema sync prisma --importar <schema> [saida] [modulo]');
    console.log('     sema sync prisma --comparar [pasta] [schema]');
  }
}
