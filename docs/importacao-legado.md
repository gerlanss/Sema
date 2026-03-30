# Importacao de Legado para Sema

A Sema agora consegue importar projetos que **nao nasceram com ela** e gerar um rascunho `.sema` revisavel.

Isso nao e magia nem papo de coach semantico.

Leitura honesta:

- a CLI nao reconstrói perfeitamente toda a intencao do sistema
- ela puxa um rascunho forte a partir de codigo vivo
- esse rascunho serve para adocao incremental
- depois voce revisa, lapida, valida e conecta com o projeto real

## Fontes suportadas

- `nestjs`
- `fastapi`
- `typescript`
- `python`
- `dart`

## Comando

```bash
sema importar <nestjs|fastapi|typescript|python|dart> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]
```

## O que a importacao tenta puxar

- `task`
- `route`, quando a fonte tiver borda publica identificavel
- `entity`
- `enum`
- `error`
- `impl`

## O que ela faz bem

- cortar o trabalho bruto de migracao
- dar um ponto de partida semantico coerente
- transformar service/controller/router/funcao em rascunho de contrato
- acelerar a adocao da Sema em projeto vivo

## O que ela nao promete

- entender toda a intencao do dominio sem revisao humana
- substituir leitura do projeto legado
- inferir perfeitamente regras implicitas espalhadas em if, banco, decorator e middleware

## Fluxo recomendado

1. rode `sema importar`
2. abra os `.sema` gerados
3. ajuste nomes, contratos, `rules`, `guarantees`, `effects` e `flow`
4. rode `sema formatar`
5. rode `sema validar --json`
6. conecte implementacoes reais com `impl`
7. rode `sema compilar` para gerar scaffold quando fizer sentido

## Exemplos

### NestJS

```bash
sema importar nestjs ./backend --saida ./sema/importado --json
```

### FastAPI

```bash
sema importar fastapi ./app --saida ./sema/importado --json
```

### Python generico

```bash
sema importar python ./servicos --saida ./sema/importado
```

### TypeScript generico

```bash
sema importar typescript ./src --saida ./sema/importado
```

### Dart

```bash
sema importar dart ./lib --saida ./sema/importado
```

## Quando isso vale muito a pena

- backend legado com regra critica
- projeto onde o contrato esta espalhado e mal documentado
- migracao incremental para NestJS ou FastAPI governados por contrato
- onboarding de IA em projeto velho sem jogar a coitada no pantano sem mapa

## Regra de ouro

Use a importacao como **ponte para governanca semantica**, nao como desculpa para confiar cegamente em inferencia automatica.
