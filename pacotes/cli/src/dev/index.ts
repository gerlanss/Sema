// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.cli_dev_mode, sema.produto.cli_invocacao_publica.handlers
// Descricao: codigo governado pelo Sema; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// Modo dev --watch para paralelizacao
// Contrato: cli_dev_mode.sema

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'node:url';

export function resolverCaminhoBinCliDev(urlModulo: string = import.meta.url): string {
  return fileURLToPath(new URL('../bin.js', urlModulo));
}

const CAMINHO_BIN_CLI = resolverCaminhoBinCliDev();

const CHAVES_RESULTADO_CLI_V1 = [
  'code',
  'command',
  'exitCode',
  'kind',
  'message',
  'ok',
  'payload',
  'schemaVersion'
] as const;

interface PayloadValidacaoCli {
  readonly bloqueia_acao?: boolean;
  readonly erros?: Array<{ codigo: string }>;
}

function extrairPayloadValidacaoCli(saida: string, codigoProcesso: number | null): PayloadValidacaoCli {
  const envelope = JSON.parse(saida) as Record<string, unknown>;
  if (
    typeof envelope !== 'object'
    || envelope === null
    || Array.isArray(envelope)
    || envelope.schemaVersion !== 'sema.cli.result/v1'
    || envelope.command !== 'validar'
    || !Number.isSafeInteger(envelope.exitCode)
    || envelope.exitCode !== codigoProcesso
    || JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(CHAVES_RESULTADO_CLI_V1)
  ) {
    throw new TypeError('Resultado público de validação inválido.');
  }

  const sucesso = envelope.exitCode === 0;
  if (
    envelope.ok !== sucesso
    || envelope.kind !== (sucesso ? 'SUCCESS' : 'DOMAIN_ERROR')
    || envelope.code !== (sucesso ? 'CLI_SUCCESS' : 'CLI_DOMAIN_ERROR')
    || (sucesso ? envelope.message !== null : typeof envelope.message !== 'string')
  ) {
    throw new TypeError('Resultado público de validação incoerente.');
  }

  const payload = envelope.payload;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new TypeError('Payload público de validação inválido.');
  }
  const schemaPayload = (payload as Record<string, unknown>).schemaVersion;
  if (schemaPayload === 'sema.cli.result/v1' || schemaPayload === 'sema.cli.control/v1') {
    throw new TypeError('Payload público de validação não pode conter envelope CLI aninhado.');
  }
  return payload as PayloadValidacaoCli;
}

export interface SessaoDev {
  id: string;
  pastaObservada: string;
  modo: 'rigoroso' | 'permissivo';
  contratosEmDraft: string[];
  ultimaValidacao: Date;
}

const sessoes: Map<string, SessaoDev> = new Map();

export async function iniciarModoDev(
  pastaContratos: string,
  alvoCodigo?: string,
  modoInicial: 'rigoroso' | 'permissivo' = 'permissivo'
): Promise<{ sessao: SessaoDev; arquivosObservados: number; statusWatch: string }> {
  // Validar pasta
  if (!fs.existsSync(pastaContratos)) {
    throw new Error(`Diretorio nao existe: ${pastaContratos}`);
  }

  // Contar arquivos .sema
  const arquivos = fs.readdirSync(pastaContratos);
  const contratos = arquivos.filter(f => f.endsWith('.sema'));

  if (contratos.length === 0) {
    throw new Error(`Nenhum arquivo .sema encontrado em ${pastaContratos}`);
  }

  // Criar sessao
  const sessao: SessaoDev = {
    id: `dev_${Date.now()}`,
    pastaObservada: path.resolve(pastaContratos),
    modo: modoInicial,
    contratosEmDraft: contratos.map(c => path.join(pastaContratos, c)),
    ultimaValidacao: new Date()
  };

  sessoes.set(sessao.id, sessao);

  console.log(`\n🔍 Modo DEV iniciado (${modoInicial})`);
  console.log(`   📁 Observando: ${sessao.pastaObservada}`);
  console.log(`   📄 Contratos: ${contratos.length}`);
  console.log(`   💡 Alteracoes serao validadas em tempo real\n`);

  // Iniciar watcher simples
  iniciarWatcher(sessao);

  return {
    sessao,
    arquivosObservados: contratos.length,
    statusWatch: 'ativo'
  };
}

function iniciarWatcher(sessao: SessaoDev): void {
  let timeout: NodeJS.Timeout | null = null;

  fs.watch(sessao.pastaObservada, { recursive: true }, (evento, nomeArquivo) => {
    if (!nomeArquivo || !nomeArquivo.endsWith('.sema')) return;

    // Debounce
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      const caminhoCompleto = path.join(sessao.pastaObservada, nomeArquivo);

      if (fs.existsSync(caminhoCompleto)) {
        console.log(`\n📝 Alteracao detectada: ${nomeArquivo}`);
        validarAlteracao(caminhoCompleto, sessao.modo);
      }
    }, 500);
  });
}

async function validarAlteracao(caminhoArquivo: string, modo: 'rigoroso' | 'permissivo'): Promise<void> {
  // Executar validacao via CLI
  const args = ['validar', caminhoArquivo];

  if (modo === 'permissivo') {
    console.log('   🟡 Modo permissivo: mostrando apenas warnings\n');
  }

  const processo = spawn(process.execPath, [CAMINHO_BIN_CLI, ...args], {
    stdio: 'inherit',
    shell: false
  });

  processo.on('close', (codigo) => {
    if (codigo === 0) {
      console.log('   ✅ Validacao OK\n');
    } else if (modo === 'permissivo') {
      console.log('   ⚠️  Warnings encontrados (nao bloqueia no modo draft)\n');
    } else {
      console.log('   ❌ Erros encontrados\n');
    }
  });
}

export async function promoverParaProduction(
  caminhoContrato: string,
  verificacoesPendentes?: string[]
): Promise<{ promovido: boolean; checksRestantes: string[]; scoreDrift: number }> {
  console.log(`\n🚀 Promovendo ${path.basename(caminhoContrato)} para PRODUCTION...`);

  // Validar rigorosamente
  return new Promise((resolve) => {
    const processo = spawn(process.execPath, [CAMINHO_BIN_CLI, 'validar', caminhoContrato, '--json'], {
      shell: false
    });

    let saida = '';
    processo.stdout?.on('data', (data) => { saida += data; });

    processo.on('close', (codigo) => {
      try {
        const resultado = extrairPayloadValidacaoCli(saida, codigo);
        const temErros = resultado.bloqueia_acao === true;

        if (temErros) {
          console.log('   ❌ Bloqueado: resolva os erros antes de promover\n');
          resolve({
            promovido: false,
            checksRestantes: resultado.erros?.map((e: {codigo: string}) => e.codigo) || [],
            scoreDrift: 50
          });
        } else {
          console.log('   ✅ Promovido com sucesso!\n');
          resolve({ promovido: true, checksRestantes: [], scoreDrift: 95 });
        }
      } catch {
        console.log('   ⚠️  Erro ao verificar status\n');
        resolve({ promovido: false, checksRestantes: ['erro_verificacao'], scoreDrift: 0 });
      }
    });
  });
}

// Handler CLI
export async function comandoDev(args: string[]): Promise<void> {
  const promoverFlag = args.includes('--promover') || args.includes('-p');

  if (promoverFlag) {
    const idx = args.findIndex(a => a === '--promover' || a === '-p');
    const caminhoContrato = args[idx + 1];

    if (!caminhoContrato) {
      console.error('Uso: sema dev --promover <caminho-contrato>');
      process.exit(1);
    }

    const resultado = await promoverParaProduction(caminhoContrato);
    process.exit(resultado.promovido ? 0 : 1);
    return;
  }

  // Modo watch normal
  const pastaIdx = args.findIndex(a => a === '--pasta' || a === '-d');
  const pasta = pastaIdx !== -1 ? args[pastaIdx + 1] : 'contratos/';

  const modoIdx = args.findIndex(a => a === '--modo' || a === '-m');
  const modo = modoIdx !== -1 ? args[modoIdx + 1] as 'rigoroso' | 'permissivo' : 'permissivo';

  try {
    await iniciarModoDev(pasta, undefined, modo);

    // Manter processo vivo
    console.log('Pressione Ctrl+C para parar\n');
    process.stdin.resume();
  } catch (err) {
    console.error(`Erro: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
