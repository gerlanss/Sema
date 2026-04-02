# Sema Language Tools

Sema Language Tools e a extensao oficial do VS Code para a Sema, a camada semantica que auxilia IA a entender melhor contrato, fluxo, erro, efeito, garantia, vinculos, execucao e `drift` em backend vivo.

Ela nao tenta virar uma IA. Ela ajuda voce a preparar contexto utilizavel por qualquer IA, sem depender de adivinhacao ou de conversa magica entre extensao e agente.

## O que a extensao entrega

- associacao automatica de arquivos `.sema`
- destaque de sintaxe para os blocos centrais da linguagem
- snippets para `module`, `task`, `flow`, `route` e `state`
- hover basico para palavras-chave da linguagem
- diagnosticos semanticos no editor
- validacao com contexto de projeto, incluindo `use` cross-module
- formatacao de documento
- painel `Sema Contexto` com estado do projeto, alvo atual, drift, prompt e artefatos recentes
- comandos para copiar prompt, gerar `contexto-ia`, inspecionar, medir drift, importar, compilar, testar e preparar handoff para IA externa
- integracao com a CLI oficial da Sema como backend unico da camada semantica

## O que ela nao tenta fazer

- substituir a CLI
- fingir que a extensao fala sozinha com qualquer IA externa
- duplicar a semantica pesada da Sema dentro do VS Code

O fluxo bom e simples: editor para escrever, extensao para preparar contexto e CLI para operar a verdade semantica.

## Fluxo recomendado

1. abra o projeto no VS Code
2. abra `Sema Contexto` na Activity Bar
3. deixe a extensao tentar o bootstrap automatico da CLI no primeiro carregamento
4. se a CLI nao subir sozinha, use `Sema: Diagnosticar CLI` ou `Sema: Autoconfigurar CLI`
5. rode `Sema: Preparar Contexto para IA Externa`
6. cole o prompt copiado na IA que voce quiser
7. se houver um contrato `.sema` ativo, abra tambem o handoff gerado em `.tmp/vscode-sema/`

## Comandos da extensao

- `Sema: Abrir Painel de Contexto`
- `Sema: Atualizar Contexto Sema`
- `Sema: Preparar Contexto para IA Externa`
- `Sema: Diagnosticar CLI`
- `Sema: Autoconfigurar CLI`
- `Sema: Copiar Prompt para IA`
- `Sema: Executar Acao Sema`

## Settings

- `sema.ai.autoSeedOnOpen`
- `sema.ai.sidebarEnabled`
- `sema.ai.seedScope`
- `sema.cliPath`
- `sema.diagnosticosAoDigitar`

## Instale a extensao

GitHub Releases:

- [Baixar a VSIX mais recente](https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix)
- [Abrir a pagina de releases da Sema](https://github.com/gerlanss/Sema/releases/latest)

Depois de baixar:

```bash
code --install-extension ./sema-language-tools-latest.vsix --force
```

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix -OutFile sema-language-tools-latest.vsix
code --install-extension .\sema-language-tools-latest.vsix --force
```

## Instale a CLI da Sema

Para usar a Sema direito no projeto, instale tambem a CLI oficial:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Opcionalmente, voce tambem pode instalar pela release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

## Como a extensao encontra a CLI

1. `sema.cliPath`, se voce configurar manualmente
2. bin `sema` disponivel no sistema
3. prefixo global do npm, como `C:\Users\<usuario>\AppData\Roaming\npm\sema.cmd` no Windows
4. `node_modules/.bin/sema` do projeto atual
5. CLI local do proprio repositorio da Sema

Quando `sema.cliPath` esta vazio e a extensao encontra uma unica CLI valida, ela grava esse caminho automaticamente nas configuracoes do usuario.

## O que sai no handoff

Quando voce usa `Sema: Preparar Contexto para IA Externa`, a extensao:

- atualiza o seed local do workspace
- copia um prompt pronto para a area de transferencia
- gera um arquivo `SEMA_EXTERNAL_AI.md`
- se houver um `.sema` ativo, roda `sema contexto-ia` e salva o pacote na pasta `.tmp/vscode-sema/contexto/<alvo>`

Isso te da um ponto de entrada concreto para Codex, ChatGPT, Claude ou qualquer outra IA sem depender de integração especial do editor.

## Links diretos

- [Repositorio oficial](https://github.com/gerlanss/Sema)
- [README principal](https://github.com/gerlanss/Sema/blob/main/README.md)
- [Sintaxe da linguagem](https://github.com/gerlanss/Sema/blob/main/docs/sintaxe.md)
- [Integracao com IA](https://github.com/gerlanss/Sema/blob/main/docs/integracao-com-ia.md)
- [Issues](https://github.com/gerlanss/Sema/issues)
