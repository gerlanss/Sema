# Sema — Regras obrigatorias para IA

O Sema e o protocolo de governanca de intencao deste projeto.
Toda IA deve consultar o Sema antes de qualquer acao sobre codigo ou contratos.

## Mentalidade

Pense como IA, nao como humano. Voce nao esta "programando" — esta consumindo e produzindo contratos semanticos estruturados. Ao ler um arquivo .sema, trate cada bloco como um no de grafo com entradas, saidas, efeitos e garantias. Ao gerar codigo, derive tudo do contrato — nunca invente logica que nao esteja declarada. O Sema existe para que voce opere com precisao, rastreabilidade e zero adivinhacao.

## Regras

1. Ao abrir o projeto, chame sema_resumo para entender o estado atual.
2. Antes de criar qualquer modulo, rota, task ou contrato, chame sema_inspecionar no arquivo .sema mais proximo.
3. Antes de editar codigo existente, chame sema_drift para verificar divergencias entre contrato e implementacao.
4. Ao criar ou editar um arquivo .sema, chame sema_validar ao final.
5. Nunca invente contratos — use o Sema para descobrir o que ja existe.
6. Se qualquer ferramenta Sema retornar erro, corrija o problema antes de prosseguir — nao avance com codigo enquanto houver erros Sema pendentes.

## MCP

O servidor MCP do Sema roda localmente via: npx -y @semacode/mcp
Use as ferramentas: sema_resumo, sema_validar, sema_drift, sema_impacto, sema_renomear_semantico, sema_inspecionar, sema_ir, sema_verificar, sema_contexto_ia, sema_prompt_ia.

## Contratos e exemplos

- Sempre salve arquivos .sema na pasta `contratos/` do projeto.
- Crie um arquivo .sema por modulo ou contexto de negocio. Exemplo: `contratos/pedido.sema`, `contratos/pagamento.sema`, `contratos/usuario.sema`. Nunca coloque modulos de contextos diferentes no mesmo arquivo.
- Antes de criar qualquer arquivo .sema, leia todos os arquivos da pasta `exemplos/` para entender o formato correto da linguagem.
- Nunca edite os arquivos da pasta `exemplos/`.

## Quando o projeto nao tem .sema

Pergunte ao usuario se deseja semantizar o projeto e sugira: sema iniciar

## Exemplos de arquivos .sema (referencia de formato)

### 1. Task simples com testes
```
module exemplos.calculadora {
  task somar {
    input {
      a: Numero required
      b: Numero required
    }
    output {
      resultado: Numero
    }
    rules {
      a deve_ser numero_valido
      b deve_ser numero_valido
    }
    effects {
      auditoria operacao soma
    }
    guarantees {
      resultado existe
    }
    error {
      entrada_invalida: "Os valores precisam ser numericos."
    }
    tests {
      caso "soma basica" {
        given { a: 2  b: 3 }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
```

### 2. Entity + CRUD com route
```
module exemplos.crud.simples {
  entity Produto {
    fields {
      id: Id
      nome: Texto
      preco: Decimal
      ativo: Booleano
    }
  }

  task criar_produto {
    input {
      nome: Texto required
      preco: Decimal required
    }
    output {
      produto: Produto
    }
    rules {
      nome deve_ser preenchido
      preco deve_ser positivo
    }
    effects {
      persistencia Produto
      auditoria produto_criado
    }
    guarantees {
      produto existe
    }
    tests {
      caso "cria produto" {
        given { nome: "Caneca"  preco: 39.9 }
        expect { sucesso: verdadeiro }
      }
    }
  }

  route produtos {
    metodo: POST
    caminho: /produtos
    task: criar_produto
    finalidade: cadastro_produto
    input { nome: Texto  preco: Decimal }
    output { produto: Produto }
  }
}
```

### 3. Cadastro com validacoes e unicidade
```
module exemplos.cadastro.usuario {
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
        given { nome: "Ana"  email: "ana@empresa.com" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
```

### 4. Pagamento com state e flow
```
module exemplos.pagamento {
  task processar_pagamento {
    input {
      pagamento_id: Id required
      valor: Decimal required
      token: Texto required
    }
    output {
      pagamento: Pagamento
      status: StatusPagamento
    }
    rules {
      valor > 0
      token deve_ser valido
    }
    effects {
      consulta gateway_pagamento criticidade = alta
      persistencia Pagamento criticidade = alta
      evento pagamento_autorizado criticidade = media
      auditoria pagamento criticidade = alta
    }
    state ciclo_pagamento {
      transitions {
        PENDENTE -> AUTORIZADO
        AUTORIZADO -> PROCESSADO
      }
    }
    guarantees {
      pagamento existe
      status em [AUTORIZADO, PROCESSADO]
    }
    error {
      autorizacao_negada: "Recusado pelo gateway."
      timeout_gateway: "Gateway nao respondeu."
    }
    tests {
      caso "pagamento autorizado" {
        given { pagamento_id: "pag_1"  valor: 199.9  token: "tok_ok" }
        expect { sucesso: verdadeiro }
      }
      caso "pagamento recusado" {
        given { pagamento_id: "pag_err"  valor: 10  token: "tok_recusado" }
        expect { sucesso: falso }
        error { tipo: "autorizacao_negada" }
      }
    }
  }

  flow orquestracao_pagamento {
    pagamento_id: Id
    valor: Decimal
    token: Texto
    etapa autorizar usa processar_pagamento com pagamento_id = pagamento_id, valor = valor, token = token em_sucesso confirmar em_erro registrar_falha
    etapa confirmar usa confirmar_pagamento com pagamento_id = pagamento_id depende_de autorizar
    etapa registrar_falha usa registrar_timeout_pagamento com pagamento_id = pagamento_id depende_de autorizar
  }
}
```

### 5. Tratamento de erro com flow ramificado
```
module exemplos.tratamento.erro {
  task executar_operacao_sensivel {
    input {
      chave: Texto required
    }
    output {
      protocolo: Id
    }
    rules {
      chave deve_ser preenchida
    }
    effects {
      consulta cofre
      auditoria falha_operacao_sensivel
    }
    guarantees {
      protocolo existe
    }
    error {
      acesso_negado: "A chave nao tem permissao."
      recurso_indisponivel: "Servico temporariamente indisponivel."
    }
    tests {
      caso "falha por acesso negado" {
        given { chave: "sem_permissao" }
        expect { sucesso: falso }
        error { tipo: "acesso_negado" }
      }
    }
  }

  flow resposta_segura {
    chave: Texto
    etapa tentar usa executar_operacao_sensivel com chave = chave em_sucesso concluir em_erro registrar_falha por_erro acesso_negado = tratar_acesso_negado, recurso_indisponivel = agendar_retentativa
    etapa tratar_acesso_negado usa responder_acesso_negado com chave = chave depende_de tentar
    etapa agendar_retentativa usa responder_retentativa com chave = chave depende_de tentar
    etapa registrar_falha usa registrar_auditoria_falha com chave = chave depende_de tentar
    etapa concluir usa registrar_sucesso com protocolo = tentar.protocolo depende_de tentar
  }
}
```
