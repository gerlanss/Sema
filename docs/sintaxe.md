# Sintaxe Inicial

O MVP da Sema usa blocos declarativos com chaves. A escolha e deliberada: facilita parser, diff, serializacao de AST e leitura por humanos e IA.

## Regras de forma

- um arquivo `.sema` contem um `module` principal
- cada bloco abre com palavra-chave e fecha com `}`
- campos usam `nome: valor`
- linhas declarativas podem expressar regras, efeitos e garantias
- `tests` contem blocos `caso`

## Blocos principais

- `module`
- `use`
- `type`
- `entity`
- `enum`
- `task`
- `input`
- `output`
- `rules`
- `effects`
- `impl`
- `guarantees`
- `state`
- `flow`
- `route`
- `tests`
- `error`
- `docs`
- `comments`

## Exemplo resumido

```sema
module cadastro.usuario {
  entity Usuario {
    fields {
      id: Id
      nome: Texto
      email: Email
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
      email deve_ser unico em Usuario.email
    }
    effects {
      grava Usuario
    }
    guarantees {
      usuario existe
    }
  }
}
```

## Anatomia curta de uma `task`

Os subblocos mais comuns de uma `task` aparecem assim:

```sema
task criar_usuario {
  input {
    nome: Texto required
    email: Email required
  }
  output {
    usuario: Usuario
  }
  rules {
    email deve_ser unico em Usuario.email
  }
  effects {
    grava Usuario
  }
  impl {
    ts: app.usuarios.criar
  }
  guarantees {
    usuario existe
  }
  error {
    email_duplicado: "usuario ja cadastrado"
  }
  tests {
    caso "cadastro basico" {
      given {
        nome: "Ada"
        email: "ada@acme.test"
      }
      expect {
        sucesso: verdadeiro
      }
    }
  }
}
```

## Sintaxe de `impl`

`impl` e o bloco que liga a intencao da `task` ao simbolo real do runtime.

Forma canonica:

```sema
impl {
  ts: app.usuarios.criar
}
```

Regras:

- `impl` so existe dentro de `task`
- cada linha usa `origem: caminho`
- a origem aceita `ts|typescript`, `py|python`, `dart`, `cs|csharp|dotnet`, `java`, `go|golang`, `rust|rs`, `cpp|cxx|cc|c++`
- cada origem pode aparecer no maximo uma vez por `task`
- o caminho usa identificadores separados por ponto
- o caminho aponta para simbolo, nao para chamada com `()`

Exemplos validos:

```sema
impl {
  ts: app.pagamentos.processar
  py: servicos.pagamentos.processar
  cs: Pagamentos.Api.Controllers.PedidosController.Criar
}
```

Exemplos invalidos:

```sema
impl: app.pagamentos.processar
```

```sema
impl {
  ts: app/pagamentos/processar
}
```

```sema
impl {
  ts: app.pagamentos.processar()
}
```
