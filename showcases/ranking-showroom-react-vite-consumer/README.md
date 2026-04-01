# Ranking Showroom React Vite Consumer

Este showcase companion abre a trilha oficial `react-vite-consumer` da Sema usando o mesmo showroom de ranking ja provado no backend Flask.

## Slice oficial

- `consumer bridge` canonico em `src/lib/sema_consumer_bridge.ts`
- rotas explicitas em `src/router.tsx`
- superficies consumer em `src/pages/**/*.tsx`
- `impl` apontando so para bridge exportado
- `vinculos` rastreando bridge, arquivos e superficie `/ranking`

## Limite honesto

Isto nao promete geracao completa de UI nem visual drift. O slice aqui e `consumer bridge + react-router surfaces`.
