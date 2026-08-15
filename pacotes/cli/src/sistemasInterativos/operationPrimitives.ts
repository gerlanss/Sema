// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao
// Descricao: primitivas puras de JSON canonico, digest e redacao para operacoes interativas.

import { createHash } from "node:crypto";
import {
  OPERATION_RESULT_SCHEMA_V1,
  type OpaqueSha256,
  type OperationIssue,
  type OperationResult,
  type Sha256,
} from "./operationsTypes.js";

const BASE_FLAGS = {
  executed: false,
  workspaceMutated: false,
  engineProbed: false,
  editorInspected: false,
  processesInspected: false,
  resourcesReserved: false,
  authoritative: false,
} as const;

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const OPAQUE_SHA256_PATTERN = /^opaque:sha256:[a-f0-9]{64}$/;
const SEMANTIC_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}(?:[.:/][a-z0-9][a-z0-9_-]{0,63})+$/;
const SAFE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._+-]{0,127}$/;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/;
export const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const OPAQUE_SENSITIVE_KEYS = new Set(["recoverytoken", "sourceuriref"]);
const SENSITIVE_KEY_PARTS = [
  "password", "passwd", "secret", "token", "apikey", "privatekey",
  "clientsecret", "accesstoken", "refreshtoken", "credential",
  "authorization", "cookie", "connectionstring",
];
const SENSITIVE_VALUE_PATTERNS = [
  /\bbearer\s+[a-z0-9._~+\/-]{8,}/i,
  /^(?:sk[-_][a-z0-9_-]{8,}|ghp_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,})$/i,
  /^eyJ[a-z0-9_-]{8,}\.eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----/,
  /(?:^|[?&])(?:access_?token|api_?key|aws_?secret_?access_?key|secret|password|passwd|signature|sig|token|credential|authorization)=[^&#\s]+/i,
  /:\/\/[^/\s:@]+:[^/\s@]+@/,
];

export function issue(code: string, field: string): OperationIssue {
  return { code, field };
}

function normalizedIssues(issues: readonly OperationIssue[]): OperationIssue[] {
  const unique = new Map<string, OperationIssue>();
  for (const item of issues) unique.set(item.code + "\u0000" + item.field, item);
  return [...unique.values()].sort((a, b) => (
    a.code.localeCompare(b.code) || a.field.localeCompare(b.field)
  ));
}

export function failure<T>(issues: readonly OperationIssue[]): OperationResult<T> {
  return {
    schemaVersion: OPERATION_RESULT_SCHEMA_V1,
    valid: false,
    issues: normalizedIssues(issues),
    ...BASE_FLAGS,
  };
}

export function success<T>(value: T, digest?: Sha256): OperationResult<T> {
  return {
    schemaVersion: OPERATION_RESULT_SCHEMA_V1,
    valid: true,
    issues: [],
    value,
    ...(digest === undefined ? {} : { digest }),
    ...BASE_FLAGS,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSha256(value: unknown): value is Sha256 {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

export function isOpaqueSha256(value: unknown): value is OpaqueSha256 {
  return typeof value === "string" && OPAQUE_SHA256_PATTERN.test(value);
}

export function isSemanticId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 192 && SEMANTIC_ID_PATTERN.test(value);
}

export function isSafeName(value: unknown): value is string {
  return typeof value === "string" && SAFE_NAME_PATTERN.test(value);
}

export function isVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value);
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function isIntegerIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

export function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowlist = new Set(allowed);
  return Object.keys(value).every((key) => allowlist.has(key));
}

function isSensitiveValue(value: string): boolean {
  if (isSha256(value) || isOpaqueSha256(value)) return false;
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function inspectPlainJson(input: unknown, rootField: string): OperationIssue[] {
  const issues: OperationIssue[] = [];
  const active = new Set<object>();
  let nodes = 0;
  const visit = (value: unknown, field: string, depth: number): void => {
    nodes += 1;
    if (nodes > 20_000) {
      issues.push(issue("json_node_limit_exceeded", rootField));
      return;
    }
    if (depth > 48) {
      issues.push(issue("json_depth_limit_exceeded", rootField));
      return;
    }
    if (typeof value === "string") {
      if (isSensitiveValue(value)) issues.push(issue("sensitive_material_forbidden", field));
      return;
    }
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) issues.push(issue("json_number_invalid", field));
      return;
    }
    if (typeof value !== "object") {
      issues.push(issue("json_type_unsupported", field));
      return;
    }
    if (active.has(value)) {
      issues.push(issue("json_cycle_detected", rootField));
      return;
    }
    active.add(value);
    if (Array.isArray(value)) {
      if (value.length > 10_000) issues.push(issue("json_array_limit_exceeded", field));
      for (const item of value) visit(item, field, depth + 1);
      active.delete(value);
      return;
    }
    if (!isRecord(value)) {
      issues.push(issue("json_object_not_plain", field));
      active.delete(value);
      return;
    }
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (DANGEROUS_KEYS.has(key)) issues.push(issue("json_dangerous_key", field));
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        issues.push(issue("json_accessor_forbidden", field));
        continue;
      }
      const keyNormalized = normalizedKey(key);
      const child = descriptor.value;
      const sensitive = SENSITIVE_KEY_PARTS.some((part) => keyNormalized.includes(part));
      const opaqueException = OPAQUE_SENSITIVE_KEYS.has(keyNormalized) && isOpaqueSha256(child);
      if (sensitive && !opaqueException) issues.push(issue("sensitive_material_forbidden", field));
      visit(child, field, depth + 1);
    }
    active.delete(value);
  };
  visit(input, rootField, 0);
  return normalizedIssues(issues);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (isRecord(value)) {
    return "{" + Object.keys(value).sort().map((key) => (
      JSON.stringify(key) + ":" + canonicalJson(value[key])
    )).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function digestJsonOperacional(value: unknown): Sha256 {
  return ("sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex")) as Sha256;
}

export function criarReferenciaFonteOpaca(sourceUri: unknown): OperationResult<{
  readonly sourceUriRef: OpaqueSha256;
  readonly sourceUriRedacted: true;
}> {
  if (typeof sourceUri !== "string" || sourceUri.length === 0 || sourceUri.length > 4096 || sourceUri.includes("\u0000")) {
    return failure([issue("source_uri_invalid", "sourceUri")]);
  }
  const sourceUriRef = ("opaque:sha256:" + createHash("sha256").update(sourceUri).digest("hex")) as OpaqueSha256;
  return success({ sourceUriRef, sourceUriRedacted: true }, digestJsonOperacional(sourceUriRef));
}
