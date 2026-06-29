// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descri??o: c?digo governado pelo Sema; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// Comando sema init --template
// Contrato: cli_init_templates.sema

import * as fs from 'fs';
import * as path from 'path';
import { listarTemplates, obterTemplate } from './templates.js';

export interface InitInput {
  template_nome: string;
  saida_caminho: string;
  nome_modulo: string;
  parametros?: Record<string, string>;
}

export interface InitOutput {
  contrato_gerado: string;
  caminho_absoluto: string;
  linhas_geradas: number;
  campos_para_editar: string[];
}

export async function listarTemplatesDisponiveis(
  categoriaFiltro?: string
): Promise<{ templates: Array<{nome: string, categoria: string, descricao: string, linhas_base: number}>, total: number }> {
  const templates = listarTemplates(categoriaFiltro);

  return {
    templates: templates.map(t => ({
      nome: t.nome,
      categoria: t.categoria,
      descricao: t.descricao,
      linhas_base: t.linhasBase
    })),
    total: templates.length
  };
}

export async function gerarContratoDeTemplate(
  input: InitInput
): Promise<InitOutput> {
  // Validar template
  const template = obterTemplate(input.template_nome);
  if (!template) {
    throw new Error(`Template '${input.template_nome}' nao encontrado. Use --listar para ver disponiveis.`);
  }

  // Validar caminho de saida
  if (!input.saida_caminho.endsWith('.sema')) {
    throw new Error('O arquivo de saida deve ter extensao .sema');
  }

  // Verificar se arquivo ja existe
  const caminhoAbsoluto = path.resolve(input.saida_caminho);
  if (fs.existsSync(caminhoAbsoluto)) {
    throw new Error(`Arquivo ja existe em ${input.saida_caminho}. Use --force para sobrescrever.`);
  }

  // Validar nome do modulo
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(input.nome_modulo)) {
    throw new Error('Nome do modulo deve ser snake_case (ex: meu_app.pedidos)');
  }

  // Garantir que diretorio existe
  const dir = path.dirname(caminhoAbsoluto);
  if (!fs.existsSync(dir)) {
    throw new Error(`Diretorio de saida nao existe: ${dir}`);
  }

  // Gerar conteudo
  const conteudo = template.conteudo(input.nome_modulo);

  // Escrever arquivo
  fs.writeFileSync(caminhoAbsoluto, conteudo, 'utf-8');

  const linhas = conteudo.split('\n').length;

  return {
    contrato_gerado: conteudo,
    caminho_absoluto: caminhoAbsoluto,
    linhas_geradas: linhas,
    campos_para_editar: template.camposEditaveis
  };
}

// Handler para CLI
export async function comandoInit(args: string[]): Promise<void> {
  const listarFlag = args.includes('--listar') || args.includes('-l');

  if (listarFlag) {
    const { templates, total } = await listarTemplatesDisponiveis();
    console.log(`\n📦 Templates disponiveis (${total}):\n`);

    const categorias = [...new Set(templates.map(t => t.categoria))];
    for (const cat of categorias) {
      console.log(`${cat.toUpperCase()}:`);
      const daCategoria = templates.filter(t => t.categoria === cat);
      for (const t of daCategoria) {
        console.log(`  • ${t.nome.padEnd(15)} - ${t.descricao} (~${t.linhas_base} linhas)`);
      }
      console.log('');
    }
    return;
  }

  // Parse args
  const templateIdx = args.findIndex(a => a === '--template' || a === '-t');
  const saidaIdx = args.findIndex(a => a === '--saida' || a === '-o');
  const moduloIdx = args.findIndex(a => a === '--modulo' || a === '-m');
  const force = args.includes('--force') || args.includes('-f');

  if (templateIdx === -1 || saidaIdx === -1 || moduloIdx === -1) {
    console.error('Uso: sema init --template <nome> --saida <caminho> --modulo <nome_modulo>');
    console.error('     sema init --listar');
    process.exit(1);
  }

  const templateNome = args[templateIdx + 1];
  const saidaCaminho = args[saidaIdx + 1];
  const nomeModulo = args[moduloIdx + 1];

  if (!templateNome || !saidaCaminho || !nomeModulo) {
    console.error('Erro: Todos os parametros --template, --saida e --modulo sao obrigatorios');
    process.exit(1);
  }

  try {
    // Se force, remove arquivo existente
    if (force && fs.existsSync(saidaCaminho)) {
      fs.unlinkSync(saidaCaminho);
    }

    const resultado = await gerarContratoDeTemplate({
      template_nome: templateNome,
      saida_caminho: saidaCaminho,
      nome_modulo: nomeModulo
    });

    console.log(`\n✅ Contrato gerado com sucesso!`);
    console.log(`   📄 ${resultado.caminho_absoluto}`);
    console.log(`   📊 ${resultado.linhas_geradas} linhas`);
    console.log(`   ✏️  Campos para editar: ${resultado.campos_para_editar.join(', ')}`);
    console.log(`\nProximos passos:`);
    console.log(`   1. sema validar ${saidaCaminho}`);
    console.log(`   2. Edite os campos: ${resultado.campos_para_editar.join(', ')}`);
    console.log(`   3. Implemente o codigo vinculado\n`);
  } catch (err) {
    console.error(`\n❌ Erro: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
