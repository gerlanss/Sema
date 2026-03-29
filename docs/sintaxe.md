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

