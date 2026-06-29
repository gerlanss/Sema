// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { TemplateInit, templateApiRest, templateAuthCompleto, templateCrudSimples } from "./templates.part01.js";

export const templateWorkflow = (moduloNome: string) => `module ${moduloNome} {
  docs {
    resumo: "Workflow de automacao com trigger, acoes e condicoes."
  }

  entity Workflow {
    fields {
      id: Id
      nome: Texto
      ativo: Booleano
      trigger_tipo: Texto
      trigger_config: Texto
      acoes: Lista<Texto>
      criado_em: Timestamp
    }
  }

  task executar_workflow {
    input {
      workflow_id: Id required
      payload: Texto required
      contexto: Mapa<Texto, Texto> optional
    }
    output {
      execucao_id: Id
      resultado: Texto
      status: Texto
      duracao_ms: Inteiro
    }
    rules {
      workflow_id deve_ser valido
      payload deve_ser json_valido
    }
    effects {
      consulta Workflow
      consulta workflow_runtime
      persistencia execucao_log
      auditoria workflow_executado
    }
    execucao {
      timeout: "30s"
      retry: "ate 3 tentativas"
      idempotencia: verdadeiro
    }
    guarantees {
      execucao_id existe
      status em ["sucesso", "falha", "timeout"]
    }
    error {
      workflow_nao_encontrado: "Workflow nao encontrado."
      workflow_inativo: "Workflow esta desativado."
      execucao_timeout: "Workflow excedeu tempo limite."
    }
  }

  flow orquestracao_workflow {
    workflow_id: Id
    payload: Texto
    etapa validar usa executar_workflow com workflow_id = workflow_id, payload = payload em_sucesso processar em_erro registrar_falha
    etapa processar usa processar_resultado com execucao_id = validar.execucao_id depende_de validar
    etapa registrar_falha usa log_erro_workflow com workflow_id = workflow_id, erro = validar.error depende_de validar
  }
}`;

export const templatePedido = (moduloNome: string) => `module ${moduloNome} {
  entity Pedido {
    fields {
      id: Id
      cliente_id: Id
      itens: Lista<Texto>
      valor_total: Decimal
      status: Texto
      criado_em: Timestamp
    }
  }

  task criar_pedido {
    input {
      cliente_id: Id required
      itens: Lista<Texto> required
    }
    output {
      pedido: Pedido
    }
    rules {
      cliente_id deve_ser valido
      itens deve_ser nao_vazio
    }
    effects {
      persistencia Pedido
      evento pedido_criado
    }
    guarantees {
      pedido existe
      pedido.status == "pendente"
    }
  }
}`;

export const templateUsuario = (moduloNome: string) => `module ${moduloNome} {
  entity Usuario {
    fields {
      id: Id
      nome: Texto
      email: Email
      ativo: Booleano
    }
  }

  task criar_usuario {
    input {
      nome: Texto required
      email: Email required
    }
    output {
      usuario: Usuario
    }
    rules {
      nome deve_ser preenchido
      email deve_ser email_valido
      email deve_ser unico em Usuario.email
    }
    effects {
      persistencia Usuario
      evento usuario_criado
      auditoria cadastro_usuario
    }
    guarantees {
      usuario existe
      persistencia concluida
    }
    error {
      email_duplicado: "Ja existe usuario com este email."
      entrada_invalida: "Os dados informados nao atendem as regras."
    }
    tests {
      caso "cria usuario valido" {
        given {
          nome: "Ana"
          email: "ana@empresa.com"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}`;

export const templateUpload = (moduloNome: string) => `module ${moduloNome} {
  entity Arquivo {
    fields {
      id: Id
      nome_original: Texto
      mime_type: Texto
      tamanho_bytes: Inteiro
      url: Texto
      upload_por: Id
      criado_em: Timestamp
    }
  }

  task upload_arquivo {
    input {
      arquivo_binario: Texto required
      nome_original: Texto required
      mime_type: Texto required
    }
    output {
      arquivo: Arquivo
      url_acesso: Texto
    }
    rules {
      tamanho_bytes deve_ser <= 10485760  // 10MB
      mime_type em ["image/jpeg", "image/png", "application/pdf", "text/plain"]
    }
    effects {
      persistencia Arquivo
      storage.write arquivo_binario
      auditoria arquivo_uploadado
    }
    forbidden {
      executar_arquivo_uploadado
      armazenar_exe_ou_script
      permitir_upload_anonimo_sem_rate_limit
    }
    guarantees {
      arquivo existe
      url_acesso existe
    }
    error {
      arquivo_muito_grande: "Arquivo excede 10MB."
      tipo_nao_permitido: "Tipo de arquivo nao permitido."
    }
  }
}`;

export const templatesDisponiveis: Record<string, TemplateInit> = {
  "crud-simples": {
    nome: "crud-simples",
    categoria: "basico",
    descricao: "CRUD simples com entity, tasks basicas e route POST",
    linhasBase: 45,
    camposEditaveis: ["nome_modulo", "nome_entity", "nome_task"],
    conteudo: templateCrudSimples
  },
  "auth-completo": {
    nome: "auth-completo",
    categoria: "seguranca",
    descricao: "Autenticacao completa com login, registro, tokens e senha",
    linhasBase: 60,
    camposEditaveis: ["nome_modulo", "escopos_authz"],
    conteudo: templateAuthCompleto
  },
  "api-rest": {
    nome: "api-rest",
    categoria: "api",
    descricao: "API REST completa com CRUD, paginacao, autenticacao e 5 routes",
    linhasBase: 180,
    camposEditaveis: ["nome_modulo", "nome_entity", "campos_entity"],
    conteudo: templateApiRest
  },
  "workflow": {
    nome: "workflow",
    categoria: "automation",
    descricao: "Workflow de automacao com trigger, execucao e flow",
    linhasBase: 60,
    camposEditaveis: ["nome_modulo", "triggers", "acoes"],
    conteudo: templateWorkflow
  },
  "pedido": {
    nome: "pedido",
    categoria: "ecommerce",
    descricao: "Template simplificado de pedido para ecommerce",
    linhasBase: 30,
    camposEditaveis: ["nome_modulo", "campos_pedido"],
    conteudo: templatePedido
  },
  "usuario": {
    nome: "usuario",
    categoria: "cadastro",
    descricao: "Cadastro de usuario com email unico e validacoes",
    linhasBase: 40,
    camposEditaveis: ["nome_modulo", "campos_usuario"],
    conteudo: templateUsuario
  },
  "upload": {
    nome: "upload",
    categoria: "arquivos",
    descricao: "Upload de arquivos com validacao de tipo e tamanho",
    linhasBase: 50,
    camposEditaveis: ["nome_modulo", "tipos_permitidos", "tamanho_maximo"],
    conteudo: templateUpload
  }
};

export function listarTemplates(categoriaFiltro?: string): TemplateInit[] {
  const templates = Object.values(templatesDisponiveis);
  if (categoriaFiltro) {
    return templates.filter(t => t.categoria === categoriaFiltro);
  }
  return templates;
}

export function obterTemplate(nome: string): TemplateInit | null {
  return templatesDisponiveis[nome] || null;
}
