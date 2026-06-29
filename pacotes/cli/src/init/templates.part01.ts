// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

export interface TemplateInit {
  nome: string;
  categoria: string;
  descricao: string;
  linhasBase: number;
  camposEditaveis: string[];
  conteudo: (moduloNome: string) => string;
}

export const templateCrudSimples = (moduloNome: string) => `module ${moduloNome} {
  entity Item {
    fields {
      id: Id
      nome: Texto
      descricao: Texto
      ativo: Booleano
      criado_em: Timestamp
    }
  }

  task criar_item {
    input {
      nome: Texto required
      descricao: Texto optional
    }
    output {
      item: Item
    }
    rules {
      nome deve_ser preenchido
    }
    effects {
      persistencia Item
      auditoria item_criado
    }
    guarantees {
      item existe
    }
    tests {
      caso "cria item basico" {
        given {
          nome: "Novo Item"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task listar_itens {
    input {
      ativo: Booleano optional
      pagina: Inteiro optional
      limite: Inteiro optional
    }
    output {
      itens: Lista<Item>
      total: Inteiro
    }
    effects {
      consulta Item
    }
    guarantees {
      itens existe
    }
  }

  route itens {
    metodo: POST
    caminho: /itens
    task: criar_item
    finalidade: criar_novo_item
    input {
      nome: Texto
      descricao: Texto
    }
    output {
      item: Item
    }
    auth {
      modo: obrigatorio
    }
    authz {
      escopo: ${moduloNome}.criar
    }
    audit {
      evento: ${moduloNome}.item.criado
      ator: auth.usuario
      retencao: "90d"
    }
  }
}`;

export const templateAuthCompleto = (moduloNome: string) => `module ${moduloNome} {
  entity Usuario {
    fields {
      id: Id
      email: Email
      senha_hash: Texto
      papel: Texto
      ativo: Booleano
      ultimo_login: Timestamp
    }
  }

  task autenticar_usuario {
    input {
      email: Email required
      senha: Texto required
    }
    output {
      token: Texto
      usuario: Usuario
      expiracao: Timestamp
    }
    rules {
      email deve_ser email_valido
      senha deve_ter tamanho >= 8
    }
    effects {
      consulta Usuario
      auditoria login_tentativa
    }
    forbidden {
      expor_senha_em_log
      retornar_senha_hash
      permitir_credencial_inativa
    }
    guarantees {
      token existe
      expiracao > agora
    }
    error {
      credenciais_invalidas: "Email ou senha incorretos."
      conta_inativa: "Conta desativada. Contate o administrador."
      senha_fraca: "Senha nao atende aos requisitos minimos."
    }
    tests {
      caso "login com sucesso" {
        given {
          email: "user@exemplo.com"
          senha: "senha123"
        }
        expect {
          sucesso: verdadeiro
          token existe
        }
      }
    }
  }

  task registrar_usuario {
    input {
      email: Email required
      senha: Texto required
      confirmar_senha: Texto required
    }
    output {
      usuario: Usuario
    }
    rules {
      email deve_ser email_valido
      email deve_ser unico em Usuario.email
      senha deve_ter tamanho >= 8
      senha deve_coincidir com confirmar_senha
    }
    effects {
      persistencia Usuario
      evento usuario_registrado
      auditoria cadastro_novo
    }
    forbidden {
      armazenar_senha_texto_plano
      permitir_email_duplicado
    }
    guarantees {
      usuario existe
      usuario.senha_hash nao_eh_texto_plano
    }
    error {
      email_duplicado: "Ja existe conta com este email."
      senha_fraca: "Senha deve ter pelo menos 8 caracteres."
      senhas_diferentes: "As senhas nao coincidem."
    }
  }
}`;

export const templateApiRest = (moduloNome: string) => `module ${moduloNome} {
  docs {
    resumo: "API REST completa com CRUD, autenticacao e paginacao."
    versao: "1.0.0"
  }

  entity Recurso {
    fields {
      id: Id
      titulo: Texto
      conteudo: Texto
      status: Texto
      criado_por: Id
      criado_em: Timestamp
      atualizado_em: Timestamp
    }
  }

  task criar_recurso {
    input {
      titulo: Texto required
      conteudo: Texto required
    }
    output {
      recurso: Recurso
    }
    rules {
      titulo deve_ser preenchido
      conteudo deve_ser preenchido
    }
    effects {
      persistencia Recurso
      auditoria recurso_criado
    }
    auth {
      modo: obrigatorio
    }
    authz {
      escopo: ${moduloNome}.escrever
      papeis: [admin, editor]
    }
    dados {
      input {
        titulo: publico
        conteudo: interno
      }
    }
    audit {
      evento: ${moduloNome}.recurso.criado
      ator: auth.usuario
      retencao: "90d"
    }
    guarantees {
      recurso existe
      recurso.criado_por == auth.usuario_id
    }
  }

  task obter_recurso {
    input {
      id: Id required
    }
    output {
      recurso: Recurso
    }
    rules {
      id deve_ser valido
    }
    effects {
      consulta Recurso
    }
    auth {
      modo: opcional
    }
    authz {
      escopo: ${moduloNome}.ler
    }
    guarantees {
      recurso existe
    }
    error {
      nao_encontrado: "Recurso nao encontrado."
    }
  }

  task listar_recursos {
    input {
      status: Texto optional
      pagina: Inteiro optional
      limite: Inteiro optional
      ordenar_por: Texto optional
    }
    output {
      recursos: Lista<Recurso>
      total: Inteiro
      pagina: Inteiro
      total_paginas: Inteiro
    }
    rules {
      limite quando preenchido deve_ser <= 100
      pagina quando preenchido deve_ser >= 1
    }
    effects {
      consulta Recurso
    }
    auth {
      modo: anonimo
    }
    guarantees {
      recursos existe
    }
  }

  task atualizar_recurso {
    input {
      id: Id required
      titulo: Texto optional
      conteudo: Texto optional
      status: Texto optional
    }
    output {
      recurso: Recurso
    }
    rules {
      id deve_ser valido
      pelo_menos_um_campo_preenchido
    }
    effects {
      persistencia Recurso
      auditoria recurso_atualizado
    }
    auth {
      modo: obrigatorio
    }
    authz {
      escopo: ${moduloNome}.escrever
      regra: recurso.criado_por == auth.usuario_id ou auth.papel == admin
    }
    guarantees {
      recurso existe
      atualizado_em atualizado
    }
    error {
      nao_encontrado: "Recurso nao encontrado."
      sem_permissao: "Voce nao tem permissao para editar este recurso."
    }
  }

  task excluir_recurso {
    input {
      id: Id required
      confirmar: Booleano required
    }
    output {
      excluido: Booleano
    }
    rules {
      id deve_ser valido
      confirmar == verdadeiro
    }
    effects {
      persistencia Recurso criticidade = alta
      auditoria recurso_excluido criticidade = alta
    }
    forbidden {
      excluir_sem_confirmacao
      cascade_delete_sem_backup
    }
    auth {
      modo: obrigatorio
    }
    authz {
      escopo: ${moduloNome}.deletar
      regra: auth.papel == admin ou recurso.criado_por == auth.usuario_id
    }
    guarantees {
      excluido == verdadeiro
    }
    error {
      nao_encontrado: "Recurso nao encontrado."
      sem_confirmacao: "Exclusao requer confirmacao explicita."
    }
  }

  route recursos_criar {
    metodo: POST
    caminho: /recursos
    task: criar_recurso
    finalidade: criar_recurso_api
  }

  route recursos_listar {
    metodo: GET
    caminho: /recursos
    task: listar_recursos
    finalidade: listar_recursos_api
  }

  route recursos_obter {
    metodo: GET
    caminho: /recursos/:id
    task: obter_recurso
    finalidade: obter_recurso_api
  }

  route recursos_atualizar {
    metodo: PUT
    caminho: /recursos/:id
    task: atualizar_recurso
    finalidade: atualizar_recurso_api
  }

  route recursos_excluir {
    metodo: DELETE
    caminho: /recursos/:id
    task: excluir_recurso
    finalidade: excluir_recurso_api
  }
}`;
