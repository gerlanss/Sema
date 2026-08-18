// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: infere frameworks e fontes legadas a partir dos diret?rios de c?digo descobertos.

import path from 'node:path';
import type { FonteLegado } from './tipos.js';
import type { ConfiguracaoProjetoCarregada } from './projetoTipos.js';
import {
  lerConteudoSeExistir,
  listarArquivosRecursivosLimitado,
  procurarArquivosPorNome,
} from './projetoBusca.js';
import { normalizarFonteLegado } from './projetoConfig.js';

export async function inferirFontesLegado(
  diretoriosCodigo: string[],
  baseProjeto: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<FonteLegado[]> {
  if (configCarregada?.config.fontesLegado?.length) {
    return [...new Set(configCarregada.config.fontesLegado
      .map((fonte) => normalizarFonteLegado(fonte))
      .filter((fonte): fonte is FonteLegado => Boolean(fonte)))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const encontrados = new Set<FonteLegado>();
  const packageJsonRaiz = await lerConteudoSeExistir(path.join(baseProjeto, "package.json"));
  const marcadoresFirebaseProjeto = await procurarArquivosPorNome(baseProjeto, ["firebase.json", "firestore.rules"], 3);

  if (packageJsonRaiz) {
    if (/@nestjs\/common|@nestjs\/core/.test(packageJsonRaiz)) {
      encontrados.add("nestjs");
    }
    if (/"express"\s*:/.test(packageJsonRaiz)) {
      encontrados.add("express");
      encontrados.add("typescript");
    }
    if (/"fastify"\s*:/.test(packageJsonRaiz)) {
      encontrados.add("fastify");
      encontrados.add("typescript");
    }
    if (/"koa"\s*:|@koa\/router|"koa-router"/.test(packageJsonRaiz)) {
      encontrados.add("koa");
      encontrados.add("typescript");
    }
    if (/typescript/.test(packageJsonRaiz)) {
      encontrados.add("typescript");
    }
    if (/"next"\s*:/.test(packageJsonRaiz)) {
      encontrados.add("nextjs");
      encontrados.add("typescript");
    }
    if (/firebase-admin|firebase-functions|firebase\b/.test(packageJsonRaiz)) {
      encontrados.add("firebase");
      encontrados.add("typescript");
    }
  }

  if (marcadoresFirebaseProjeto.length > 0) {
    encontrados.add("firebase");
  }

  for (const diretorio of diretoriosCodigo) {
    const arquivosTs = await listarArquivosRecursivosLimitado(diretorio, [".ts", ".tsx"], 5, 40);
    const arquivosJs = await listarArquivosRecursivosLimitado(diretorio, [".js", ".jsx", ".mjs", ".cjs"], 5, 40);
    const arquivosTsJs = [...arquivosTs, ...arquivosJs];
    const arquivosPy = await listarArquivosRecursivosLimitado(diretorio, [".py"], 5, 20);
    const arquivosDart = await listarArquivosRecursivosLimitado(diretorio, [".dart"], 5, 20);
    const arquivosLua = await listarArquivosRecursivosLimitado(diretorio, [".lua"], 5, 20);
    const arquivosCs = await listarArquivosRecursivosLimitado(diretorio, [".cs"], 5, 20);
    const arquivosJava = await listarArquivosRecursivosLimitado(diretorio, [".java"], 5, 20);
    const arquivosGo = await listarArquivosRecursivosLimitado(diretorio, [".go"], 5, 20);
    const arquivosRust = await listarArquivosRecursivosLimitado(diretorio, [".rs"], 5, 20);
    const arquivosCppBrutos = await listarArquivosRecursivosLimitado(diretorio, [".cpp", ".cc", ".cxx", ".hpp", ".h"], 5, 30);
    const arquivosCpp = arquivosCppBrutos.filter((arquivo) => !/(^|[\\/])(windows|linux|macos|runner|flutter|ephemeral|build|vendor)([\\/]|$)/i.test(arquivo));
    const arquivosPhp = (await listarArquivosRecursivosLimitado(diretorio, [".php"], 5, 30))
      .filter((arquivo) => !/(^|[\\/])(vendor|storage|bootstrap[\\/]cache|cache|tests?)([\\/]|$)/i.test(arquivo));

    if (arquivosTs.length > 0) {
      encontrados.add("typescript");
    }
    if (arquivosJs.length > 0) {
      encontrados.add("javascript");
    }
    if (arquivosTsJs.length > 0) {

      const packageJsons = await procurarArquivosPorNome(diretorio, ["package.json"], 3);
      const nextConfigs = await procurarArquivosPorNome(diretorio, ["next.config.js", "next.config.ts", "next.config.mjs"], 3);
      const viteConfigs = await procurarArquivosPorNome(diretorio, ["vite.config.ts", "vite.config.js", "vite.config.mjs"], 3);
      const angularConfigs = await procurarArquivosPorNome(diretorio, ["angular.json"], 3);
      const firebaseLocais = await procurarArquivosPorNome(diretorio, ["firebase.json", "firestore.rules"], 3);
      const textosPackage = await Promise.all(packageJsons.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const amostrasTs = await Promise.all(arquivosTsJs.slice(0, 10).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const relacoesTs = arquivosTsJs.map((arquivo) => path.relative(diretorio, arquivo).replace(/\\/g, "/"));

      const temNest = textosPackage.some((texto) => /@nestjs\/common|@nestjs\/core/.test(texto ?? ""))
        || amostrasTs.some((texto) => /@nestjs\/common|@nestjs\/core|@Controller\(|@Get\(|@Post\(|@Put\(|@Patch\(|@Delete\(/.test(texto ?? ""));
      const temExpress = textosPackage.some((texto) => /"express"\s*:/.test(texto ?? ""))
        || amostrasTs.some((texto) => /(?:from\s+["']express["']|require\(\s*["']express["']\s*\)|\bexpress\s*\(\s*\))/.test(texto ?? ""));
      const temFastify = textosPackage.some((texto) => /"fastify"\s*:/.test(texto ?? ""))
        || amostrasTs.some((texto) => /(?:from\s+["']fastify["']|require\(\s*["']fastify["']\s*\)|\bfastify\s*\(\s*\{)/.test(texto ?? ""));
      const temKoa = textosPackage.some((texto) => /"koa"\s*:|@koa\/router|"koa-router"/.test(texto ?? ""))
        || amostrasTs.some((texto) => /(?:from\s+["'](?:@koa\/router|koa-router|koa)["']|require\(\s*["'](?:@koa\/router|koa-router|koa)["']\s*\)|new\s+Router\s*\()/.test(texto ?? ""));
      const temNext = textosPackage.some((texto) => /"next"\s*:/.test(texto ?? ""))
        || nextConfigs.length > 0
        || relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/api\/.+\/route\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temNextConsumer = relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temSuperficieReactViteConsumer = relacoesTs.some((relacao) => /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/.test(relacao))
        || relacoesTs.some((relacao) => /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/.test(relacao))
        || relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temBridgeReactViteConsumer = relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temReactViteConsumer = temSuperficieReactViteConsumer
        || ((textosPackage.some((texto) => /"react"\s*:|"vite"\s*:|react-router-dom/.test(texto ?? "")) || viteConfigs.length > 0) && temBridgeReactViteConsumer);
      const temSuperficieAngularConsumer = relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/.+\.component\.(?:ts|js)$/.test(relacao))
        || relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app(?:\/.+)?\/[^/]+\.routes\.(?:ts|js)$/.test(relacao));
      const temBridgeAngularConsumer = relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|js)$/.test(relacao));
      const temAngularConsumer = temSuperficieAngularConsumer
        || ((textosPackage.some((texto) => /@angular\/core|@angular\/router/.test(texto ?? "")) || angularConfigs.length > 0) && temBridgeAngularConsumer);
      const temFirebase = marcadoresFirebaseProjeto.length > 0
        || firebaseLocais.length > 0
        || textosPackage.some((texto) => /firebase-admin|firebase-functions/.test(texto ?? ""))
        || amostrasTs.some((texto) => /firebase-admin|getFirestore|initializeApp|from\s+["']firebase-admin["']/.test(texto ?? ""));

      if (temNest) {
        encontrados.add("nestjs");
      }
      if (temExpress) {
        encontrados.add("express");
      }
      if (temFastify) {
        encontrados.add("fastify");
      }
      if (temKoa) {
        encontrados.add("koa");
      }
      if (temNext) {
        encontrados.add("nextjs");
      }
      if (temNextConsumer) {
        encontrados.add("nextjs-consumer");
      }
      if (temReactViteConsumer) {
        encontrados.add("react-vite-consumer");
      }
      if (temAngularConsumer) {
        encontrados.add("angular-consumer");
      }
      if (temFirebase) {
        encontrados.add("firebase");
      }
    }

    if (arquivosPy.length > 0) {
      encontrados.add("python");
      const amostrasPython = await Promise.all(
        arquivosPy
          .slice(0, 8)
          .map((arquivo) => lerConteudoSeExistir(arquivo)),
      );

      const temFastapi = amostrasPython.some((texto) => /from\s+fastapi\s+import|APIRouter|FastAPI/.test(texto ?? ""));
      const temFlask = amostrasPython.some((texto) => /from\s+flask\s+import|import\s+flask\b|Blueprint\s*\(|Flask\s*\(|@\w+\.route\s*\(/.test(texto ?? ""));

      if (temFastapi) {
        encontrados.add("fastapi");
      }
      if (temFlask) {
        encontrados.add("flask");
      }
    }

    if (arquivosDart.length > 0) {
      encontrados.add("dart");
      const pubspecs = await procurarArquivosPorNome(diretorio, ["pubspec.yaml"], 3);
      const textosPubspec = await Promise.all(pubspecs.slice(0, 4).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const amostrasDart = await Promise.all(arquivosDart.slice(0, 10).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const relacoesDart = arquivosDart.map((arquivo) => path.relative(diretorio, arquivo).replace(/\\/g, "/"));
      const temBridgeFlutterConsumer = relacoesDart.some((relacao) =>
        /(?:^|\/)(?:lib\/)?(?:sema_consumer_bridge|api\/sema_contract_bridge|sema\/.+)\.dart$/i.test(relacao));
      const temSuperficieFlutterConsumer = relacoesDart.some((relacao) =>
        /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(relacao)
        || /(?:^|\/)(?:lib\/)?(?:router|app_router|routes|main)\.dart$/i.test(relacao));
      const temFlutterRuntime = textosPubspec.some((texto) => /\nflutter:\s*$|sdk:\s*flutter|dependencies:\s*[\s\S]*\bflutter:\s*$/m.test(texto ?? ""))
        || amostrasDart.some((texto) => /MaterialApp(?:\.router)?\s*\(|CupertinoApp(?:\.router)?\s*\(|GoRouter\s*\(/.test(texto ?? ""));
      const temFlutterConsumer = temSuperficieFlutterConsumer
        || (temFlutterRuntime && temBridgeFlutterConsumer);

      if (temFlutterConsumer) {
        encontrados.add("flutter-consumer");
      }
    }
    if (arquivosDart.length > 0) {
      encontrados.add("dart");
    }

    if (arquivosLua.length > 0) {
      encontrados.add("lua");
    }

    if (arquivosCs.length > 0) {
      encontrados.add("dotnet");
      const marcadores = await procurarArquivosPorNome(diretorio, ["appsettings.json", "Program.cs"], 4);
      const amostrasCs = await Promise.all(arquivosCs.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        marcadores.length > 0
        || amostrasCs.some((texto) => /\bWebApplication\.CreateBuilder\b|\[ApiController\]|\[Http(Get|Post|Put|Patch|Delete)\]|\bMap(Get|Post|Put|Patch|Delete)\(/.test(texto ?? ""))
      ) {
        encontrados.add("dotnet");
      }
    }

    if (arquivosJava.length > 0) {
      encontrados.add("java");
      const marcadoresJava = await procurarArquivosPorNome(diretorio, ["pom.xml", "build.gradle", "build.gradle.kts"], 4);
      const amostrasJava = await Promise.all(arquivosJava.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        marcadoresJava.length > 0
        || amostrasJava.some((texto) => /@RestController|@GetMapping|@PostMapping|@RequestMapping/.test(texto ?? ""))
      ) {
        encontrados.add("java");
      }
    }

    if (arquivosGo.length > 0) {
      encontrados.add("go");
      const goMod = await procurarArquivosPorNome(diretorio, ["go.mod"], 3);
      const amostrasGo = await Promise.all(arquivosGo.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        goMod.length > 0
        || amostrasGo.some((texto) => /\bhttp\.HandleFunc\b|\bNewServeMux\b|\.GET\(|\.POST\(|gin\.Default\(/.test(texto ?? ""))
      ) {
        encontrados.add("go");
      }
    }

    if (arquivosRust.length > 0) {
      encontrados.add("rust");
      const cargo = await procurarArquivosPorNome(diretorio, ["Cargo.toml"], 3);
      const amostrasRust = await Promise.all(arquivosRust.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        cargo.length > 0
        || amostrasRust.some((texto) => /\bRouter::new\b|\.route\(|\bnest\(/.test(texto ?? ""))
      ) {
        encontrados.add("rust");
      }
    }

    if (arquivosCpp.length > 0) {
      encontrados.add("cpp");
    }

    if (arquivosPhp.length > 0) {
      encontrados.add("php");
      const composer = await procurarArquivosPorNome(diretorio, ["composer.json"], 4);
      const amostrasPhp = await Promise.all(arquivosPhp.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        composer.length > 0
        || amostrasPhp.some((texto) => /Route::(?:get|post|put|patch|delete)|#\[\s*Route\s*\(|namespace\s+App\\|use\s+Illuminate\\|use\s+Symfony\\/i.test(texto ?? ""))
      ) {
        encontrados.add("php");
      }
    }
  }

  return [...encontrados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
