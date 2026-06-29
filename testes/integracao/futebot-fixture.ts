// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { criarDiretoriosBaseFutebot } from "./futebot-fixture.base.js";
import { escreverFutebotFixtureParte01 } from "./futebot-fixture.parte01.js";
import { escreverFutebotFixtureParte02 } from "./futebot-fixture.parte02.js";

export const DIRETORIOS_CODIGO_FUTEBOT_FIXTURE = ["data", "models", "pipeline", "services"];

export async function criarProjetoPythonEstiloFuteBot(base: string): Promise<void> {
  await criarDiretoriosBaseFutebot(base);
  await escreverFutebotFixtureParte01(base);
  await escreverFutebotFixtureParte02(base);
}
export { criarProjetoFlaskEstiloGestech } from "./futebot-fixture.flask-estilo-gestech.js";
export { criarProjetoNextJsAppRouter } from "./futebot-fixture.next-js-app-router.js";
export { criarProjetoNextJsConsumer } from "./futebot-fixture.next-js-consumer.js";
export { criarProjetoReactViteConsumer } from "./futebot-fixture.react-vite-consumer.js";
export { criarProjetoAngularConsumer } from "./futebot-fixture.angular-consumer.js";
export { criarProjetoAngularStandaloneConsumer } from "./futebot-fixture.angular-standalone-consumer.js";
export { criarProjetoNextJsAppRouterSemantico } from "./futebot-fixture.next-js-app-router-semantico.js";
export { criarProjetoFirebaseWorker } from "./futebot-fixture.firebase-worker.js";
export { criarProjetoFlutterConsumer } from "./futebot-fixture.flutter-consumer.js";
export { criarProjetoBridgeDart } from "./futebot-fixture.bridge-dart.js";
export { criarProjetoDotnetAspNet } from "./futebot-fixture.dotnet-asp-net.js";
export { criarProjetoSpringBoot } from "./futebot-fixture.spring-boot.js";
export { criarProjetoGoHttp } from "./futebot-fixture.go-http.js";
export { criarProjetoRustAxum } from "./futebot-fixture.rust-axum.js";
export { criarProjetoCppBridge } from "./futebot-fixture.cpp-bridge.js";
export { criarProjetoLuaBridge } from "./futebot-fixture.lua-bridge.js";
