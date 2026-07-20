// SEMA-GOVERNED: sema.produto.sistemas_interativos.ir
// Contratos: contratos/sema/sistemas_interativos_ir.sema e sistemas_interativos_ir_semantica.sema
// Descrição: Experience IR v1 content-addressed; valida e projeta sem executar engine ou escrever no workspace.

import { createHash } from "node:crypto";
import {
  EXPERIENCE_IR_SEMANTIC_ROLE_SCHEMA,
  obterPapeisSemanticosExperienceIr,
  obterReferenciasConceituaisExperienceIr,
  validarSemanticaExperienceIr,
  valorSensivelExperienceIr,
} from "./experienceIrSemantics.js";
import type {
  ExperienceIrBoundary,
  ExperienceIrChunkEntry,
  ExperienceIrChunkResult,
  ExperienceIrDocumentV1,
  ExperienceIrIndex,
  ExperienceIrIndexEntry,
  ExperienceIrIndexPartition,
  ExperienceIrIndexQueryResult,
  ExperienceIrIndexResult,
  ExperienceIrIssue,
  ExperienceIrJsonValue,
  ExperienceIrKind,
  ExperienceIrNode,
  ExperienceIrSerializationDescriptorResult,
  ExperienceIrSerializationV1,
  ExperienceIrSha256,
  ExperienceIrValidationResult,
} from "./experienceIrTypes.js";
export * from "./experienceIrTypes.js";
export {
  EXPERIENCE_IR_SEMANTIC_ROLE_SCHEMA,
  EXPERIENCE_IR_SEMANTIC_ROLES_SCHEMA_VERSION,
  validarSemanticaExperienceIr,
} from "./experienceIrSemantics.js";

export const EXPERIENCE_IR_SCHEMA_VERSION = "sema.experience-ir/v1" as const;
export const EXPERIENCE_IR_INDEX_SCHEMA_VERSION = "sema.experience-ir.index/v1" as const;
export const EXPERIENCE_IR_CHUNK_SCHEMA_VERSION = "sema.experience-ir.chunk/v1" as const;
export const EXPERIENCE_IR_SERIALIZATION_SCHEMA_VERSION = "sema.experience-ir.serialization/v1" as const;

const MAX_NODES = 20_000;
const MAX_REFS = 2_000;
const MAX_DEPTH = 64;
const MAX_VALUES = 250_000;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ISSUES = 256;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const SEMANTIC_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const EXTENSION_NAME = /^[a-z][a-z0-9]*(?:[._/-][a-z0-9]+)+$/u;
const EXTENSION_MEDIA_TYPE = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/u;
const SENSITIVE_KEY = /(?:password|passwd|senha|secret|token|api.?key|private.?key|credential|authorization|cookie)/iu;

const KIND_PREFIX: Readonly<Record<ExperienceIrKind, string>> = {
  PROJECT: "project", WORLD: "world", SCENE: "scene", ENTITY: "entity",
  COMPONENT: "component", TRANSFORM: "transform", CAMERA: "camera", LIGHT: "light",
  MATERIAL: "material", TEXTURE: "texture", AUDIO: "audio", PHYSICS: "physics",
  CONSTRAINT: "constraint", ANIMATION: "animation", VFX: "vfx", TIMELINE: "timeline",
  INPUT: "input", SAVE: "save", NETWORK: "network", BUILD: "build",
};

const COLLECTIONS = [
  ["WORLD", "worlds"], ["SCENE", "scenes"], ["ENTITY", "entities"],
  ["COMPONENT", "components"], ["TRANSFORM", "transforms"], ["CAMERA", "cameras"],
  ["LIGHT", "lights"], ["MATERIAL", "materials"], ["TEXTURE", "textures"],
  ["AUDIO", "audio"], ["PHYSICS", "physics"], ["CONSTRAINT", "constraints"],
  ["ANIMATION", "animations"], ["VFX", "vfx"], ["TIMELINE", "timelines"],
  ["INPUT", "inputs"], ["SAVE", "saves"], ["NETWORK", "networks"], ["BUILD", "builds"],
] as const satisfies readonly (readonly [ExperienceIrKind, string])[];

const ALL_KINDS = Object.freeze(Object.keys(KIND_PREFIX) as ExperienceIrKind[]);
const TARGET_KINDS = ALL_KINDS.filter((kind) => kind !== "PROJECT");
const ASSET_KINDS: readonly ExperienceIrKind[] = ["TEXTURE", "AUDIO", "ANIMATION", "VFX"];
const BASE_KEYS = ["semanticId", "kind", "references", "extensions"] as const;
const NODE_KEYS: Readonly<Record<ExperienceIrKind, readonly string[]>> = {
  PROJECT: [...BASE_KEYS, "name", "worldIds", "defaultSceneId"],
  WORLD: [...BASE_KEYS, "name", "sceneIds"],
  SCENE: [...BASE_KEYS, "name", "semanticRole", "entityIds", "cameraId", "lightIds"],
  ENTITY: [...BASE_KEYS, "name", "componentIds", "transformId", "parentEntityId"],
  COMPONENT: [...BASE_KEYS, "ownerEntityId", "componentType", "properties"],
  TRANSFORM: [...BASE_KEYS, "semanticRole", "parentTransformId", "translation", "rotation", "scale"],
  CAMERA: [...BASE_KEYS, "transformId", "projection", "near", "far", "fieldOfViewRadians"],
  LIGHT: [...BASE_KEYS, "transformId", "lightType", "color", "intensity"],
  MATERIAL: [...BASE_KEYS, "shadingModel", "textureIds", "parameters"],
  TEXTURE: [...BASE_KEYS, "usage", "colorSpace", "provenance"],
  AUDIO: [...BASE_KEYS, "ownerEntityId", "spatial", "loop", "provenance"],
  PHYSICS: [...BASE_KEYS, "ownerEntityId", "bodyType", "massKilograms", "collider", "colliders"],
  CONSTRAINT: [...BASE_KEYS, "constraintType", "sourceId", "targetId", "parameters"],
  ANIMATION: [...BASE_KEYS, "targetIds", "durationSeconds", "provenance"],
  VFX: [...BASE_KEYS, "ownerEntityId", "materialIds", "provenance", "emitters"],
  TIMELINE: [...BASE_KEYS, "durationSeconds", "tracks"],
  INPUT: [...BASE_KEYS, "contextEntityId", "actions"],
  SAVE: [...BASE_KEYS, "semanticRole", "strategy", "schemaRevision", "stateSemanticIds"],
  NETWORK: [...BASE_KEYS, "mode", "authority", "replicatedSemanticIds", "tickRateHz"],
  BUILD: [...BASE_KEYS, "target", "entrySceneId", "assetIds", "options"],
};

const SERIALIZATION: ExperienceIrSerializationV1 = {
  json: {
    version: "1",
    mediaType: "application/vnd.sema.experience-ir+json",
    canonicalization: "SEMA_CANONICAL_JSON_V1",
  },
  cbor: {
    mode: "EXTERNAL_CODEC_REQUIRED",
    mediaType: "application/cbor",
    encoded: false,
    deterministicEncodingRequired: true,
    codec: null,
  },
};

const BOUNDARY: ExperienceIrBoundary = {
  executed: false,
  workspaceMutated: false,
  authoritative: false,
};

interface InternalNode {
  readonly value: Record<string, unknown>;
  readonly kind: ExperienceIrKind;
  readonly path: string;
}

interface TypedReference {
  readonly id: string;
  readonly expectedKinds: readonly ExperienceIrKind[];
  readonly path: string;
}

interface ReferenceRule {
  readonly field: string;
  readonly kinds: readonly ExperienceIrKind[];
  readonly many?: boolean;
  readonly optional?: boolean;
}

class Issues {
  private readonly list: ExperienceIrIssue[] = [];
  private truncated = false;

  add(code: string, path: string, message: string): void {
    if (this.list.length >= MAX_ISSUES) {
      this.truncated = true;
      return;
    }
    this.list.push({ code, path, message });
  }

  finish(): ExperienceIrIssue[] {
    const output = [...this.list];
    if (this.truncated) output.push({ code: "IR_ISSUE_LIMIT", path: "$", message: "Issue limit reached." });
    return output.sort((a, b) => (
      a.path.localeCompare(b.path, "en") || a.code.localeCompare(b.code, "en") ||
      a.message.localeCompare(b.message, "en")
    ));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJson(value: unknown, issues: Issues): boolean {
  const seen = new WeakSet<object>();
  let count = 0;
  let valid = true;
  const visit = (current: unknown, path: string, depth: number): void => {
    count += 1;
    if (count > MAX_VALUES) {
      valid = false;
      issues.add("IR_JSON_VALUE_LIMIT", "$", "JSON value limit exceeded.");
      return;
    }
    if (depth > MAX_DEPTH) {
      valid = false;
      issues.add("IR_JSON_DEPTH", path, "JSON depth limit exceeded.");
      return;
    }
    if (typeof current === "string") {
      if (valorSensivelExperienceIr(current)) {
        valid = false;
        issues.add("IR_SENSITIVE_VALUE", path, "Sensitive string values are not accepted in Experience IR.");
      }
      return;
    }
    if (current === null || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        valid = false;
        issues.add("IR_JSON_NUMBER", path, "JSON numbers must be finite.");
      }
      return;
    }
    if (typeof current !== "object") {
      valid = false;
      issues.add("IR_JSON_TYPE", path, "Only JSON values are accepted.");
      return;
    }
    if (seen.has(current)) {
      valid = false;
      issues.add("IR_JSON_GRAPH", path, "Cycles and shared aliases are not accepted.");
      return;
    }
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (!isRecord(current)) {
      valid = false;
      issues.add("IR_JSON_OBJECT", path, "Objects must use a plain JSON prototype.");
      return;
    }
    const descriptors = Object.getOwnPropertyDescriptors(current);
    Object.keys(descriptors).sort().forEach((key, index) => {
      const descriptor = descriptors[key];
      const childPath = `${path}.*[${index}]`;
      if (UNSAFE_KEYS.has(key)) {
        valid = false;
        issues.add("IR_JSON_UNSAFE_KEY", childPath, "Unsafe JSON key rejected.");
      } else if (SENSITIVE_KEY.test(key)) {
        valid = false;
        issues.add("IR_SENSITIVE_KEY", childPath, "Sensitive data keys are not accepted in Experience IR.");
      } else if (descriptor.get || descriptor.set || !("value" in descriptor)) {
        valid = false;
        issues.add("IR_JSON_ACCESSOR", childPath, "JSON accessors are not accepted.");
      } else visit(descriptor.value, childPath, depth + 1);
    });
  };
  visit(value, "$", 0);
  return valid;
}

function allowedKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: Issues): void {
  const whitelist = new Set(allowed);
  Object.keys(value).sort().forEach((key, index) => {
    if (!whitelist.has(key)) issues.add("IR_UNKNOWN_FIELD", `${path}.*[${index}]`, "Unknown Experience IR v1 field.");
  });
}

function validateExtensions(value: unknown, path: string, issues: Issues): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.add("IR_EXTENSIONS", path, "Extensions must be a JSON object.");
    return;
  }
  Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).forEach(([name, descriptor], index) => {
    const entryPath = `${path}.*[${index}]`;
    if (!EXTENSION_NAME.test(name) || SENSITIVE_KEY.test(name)) {
      issues.add("IR_EXTENSION_NAME", entryPath, "Extension name must be a non-sensitive public namespace.");
    }
    if (!isRecord(descriptor)) {
      issues.add("IR_EXTENSION_DESCRIPTOR", entryPath, "Extension must be a content-addressed descriptor.");
      return;
    }
    allowedKeys(descriptor, ["schemaVersion", "payloadDigest", "mediaType"], entryPath, issues);
    const schemaVersion = text(descriptor, "schemaVersion", entryPath, issues);
    if (schemaVersion && !EXTENSION_NAME.test(schemaVersion)) {
      issues.add("IR_EXTENSION_SCHEMA", `${entryPath}.schemaVersion`, "Extension schema version is invalid.");
    }
    const payloadDigest = text(descriptor, "payloadDigest", entryPath, issues);
    if (payloadDigest && !SHA256.test(payloadDigest)) {
      issues.add("IR_EXTENSION_DIGEST", `${entryPath}.payloadDigest`, "Extension payload must be referenced by SHA-256 digest.");
    }
    const mediaType = text(descriptor, "mediaType", entryPath, issues, true);
    if (mediaType && !EXTENSION_MEDIA_TYPE.test(mediaType)) {
      issues.add("IR_EXTENSION_MEDIA_TYPE", `${entryPath}.mediaType`, "Extension media type is invalid.");
    }
  });
}

function text(value: Record<string, unknown>, key: string, path: string, issues: Issues, optional = false): string | null {
  if (optional && value[key] === undefined) return null;
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.trim() === "") {
    issues.add("IR_REQUIRED_STRING", `${path}.${key}`, "Required non-empty string is missing.");
    return null;
  }
  return candidate;
}

function numberValue(
  value: Record<string, unknown>, key: string, path: string, issues: Issues,
  positive = false, optional = false,
): number | null {
  if (optional && value[key] === undefined) return null;
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || (positive && candidate <= 0)) {
    issues.add("IR_REQUIRED_NUMBER", `${path}.${key}`, "Required finite number is invalid.");
    return null;
  }
  return candidate;
}

function booleanValue(value: Record<string, unknown>, key: string, path: string, issues: Issues): boolean | null {
  if (typeof value[key] !== "boolean") {
    issues.add("IR_REQUIRED_BOOLEAN", `${path}.${key}`, "Required boolean is missing.");
    return null;
  }
  return value[key] as boolean;
}

function objectValue(value: Record<string, unknown>, key: string, path: string, issues: Issues): Record<string, unknown> | null {
  if (!isRecord(value[key])) {
    issues.add("IR_REQUIRED_OBJECT", `${path}.${key}`, "Required object is missing.");
    return null;
  }
  return value[key];
}

function enumValue(
  value: Record<string, unknown>, key: string, options: readonly string[], path: string, issues: Issues,
): string | null {
  const candidate = text(value, key, path, issues);
  if (candidate !== null && !options.includes(candidate)) {
    issues.add("IR_ENUM", `${path}.${key}`, "Value is outside the supported enum.");
    return null;
  }
  return candidate;
}

function stringList(
  value: Record<string, unknown>, key: string, path: string, issues: Issues, optional = false,
): string[] {
  if (optional && value[key] === undefined) return [];
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    issues.add("IR_REQUIRED_ARRAY", `${path}.${key}`, "Required string array is missing.");
    return [];
  }
  if (candidate.length > MAX_REFS) issues.add("IR_REFERENCE_LIMIT", `${path}.${key}`, "Reference limit exceeded.");
  const result: string[] = [];
  const seen = new Set<string>();
  candidate.forEach((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      issues.add("IR_STRING_ARRAY_ITEM", `${path}.${key}[${index}]`, "String array item is invalid.");
    } else if (seen.has(item)) {
      issues.add("IR_DUPLICATE_ARRAY_ITEM", `${path}.${key}[${index}]`, "String array items must be unique.");
    } else {
      seen.add(item);
      result.push(item);
    }
  });
  return result;
}

function tuple(value: unknown, length: number, path: string, issues: Issues, positive = false): void {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => (
    typeof item !== "number" || !Number.isFinite(item) || (positive && item <= 0)
  ))) issues.add("IR_NUMERIC_TUPLE", path, "Numeric tuple is invalid.");
}

function validateCoordinateSystem(document: Record<string, unknown>, issues: Issues): void {
  const coordinate = objectValue(document, "coordinateSystem", "$", issues);
  if (!coordinate) return;
  allowedKeys(coordinate, ["units", "axes", "worldScaleMetersPerUnit"], "$.coordinateSystem", issues);
  const units = objectValue(coordinate, "units", "$.coordinateSystem", issues);
  if (units) {
    allowedKeys(units, ["length", "mass", "time", "angle"], "$.coordinateSystem.units", issues);
    enumValue(units, "length", ["METER", "CENTIMETER", "MILLIMETER", "KILOMETER"], "$.coordinateSystem.units", issues);
    enumValue(units, "mass", ["KILOGRAM", "GRAM"], "$.coordinateSystem.units", issues);
    enumValue(units, "time", ["SECOND", "MILLISECOND"], "$.coordinateSystem.units", issues);
    enumValue(units, "angle", ["RADIAN", "DEGREE"], "$.coordinateSystem.units", issues);
  }
  const axes = objectValue(coordinate, "axes", "$.coordinateSystem", issues);
  if (axes) {
    const axisOptions = ["X", "Y", "Z", "NEGATIVE_X", "NEGATIVE_Y", "NEGATIVE_Z"];
    allowedKeys(axes, ["handedness", "up", "forward"], "$.coordinateSystem.axes", issues);
    enumValue(axes, "handedness", ["RIGHT_HANDED", "LEFT_HANDED"], "$.coordinateSystem.axes", issues);
    const up = enumValue(axes, "up", axisOptions, "$.coordinateSystem.axes", issues);
    const forward = enumValue(axes, "forward", axisOptions, "$.coordinateSystem.axes", issues);
    if (up && forward && up.replace("NEGATIVE_", "") === forward.replace("NEGATIVE_", "")) {
      issues.add("IR_AXES_COLLINEAR", "$.coordinateSystem.axes", "Up and forward axes must not be collinear.");
    }
  }
  numberValue(coordinate, "worldScaleMetersPerUnit", "$.coordinateSystem", issues, true);
}

function validateSerialization(document: Record<string, unknown>, issues: Issues): void {
  const serialization = objectValue(document, "serialization", "$", issues);
  if (!serialization) return;
  allowedKeys(serialization, ["json", "cbor"], "$.serialization", issues);
  const json = objectValue(serialization, "json", "$.serialization", issues);
  if (json) {
    allowedKeys(json, ["version", "mediaType", "canonicalization"], "$.serialization.json", issues);
    if (json.version !== SERIALIZATION.json.version || json.mediaType !== SERIALIZATION.json.mediaType ||
      json.canonicalization !== SERIALIZATION.json.canonicalization) {
      issues.add("IR_JSON_DESCRIPTOR", "$.serialization.json", "JSON v1 descriptor is invalid.");
    }
  }
  const cbor = objectValue(serialization, "cbor", "$.serialization", issues);
  if (cbor) {
    allowedKeys(cbor, ["mode", "mediaType", "encoded", "deterministicEncodingRequired", "codec"], "$.serialization.cbor", issues);
    if (cbor.mode !== SERIALIZATION.cbor.mode || cbor.mediaType !== SERIALIZATION.cbor.mediaType ||
      cbor.encoded !== false || cbor.deterministicEncodingRequired !== true || cbor.codec !== null) {
      issues.add("IR_CBOR_DESCRIPTOR", "$.serialization.cbor", "CBOR must remain an external-codec descriptor.");
    }
  }
}

function validateProvenance(value: unknown, path: string, issues: Issues): void {
  if (!isRecord(value)) {
    issues.add("IR_PROVENANCE", path, "Asset provenance is required.");
    return;
  }
  allowedKeys(value, ["source", "license", "hash", "derivations"], path, issues);
  const source = objectValue(value, "source", path, issues);
  const sourceKind = source
    ? enumValue(source, "kind", ["ORIGINAL", "GENERATED", "DERIVED", "VENDOR"], `${path}.source`, issues)
    : null;
  if (source) {
    allowedKeys(source, ["kind", "uri"], `${path}.source`, issues);
    text(source, "uri", `${path}.source`, issues);
  }
  const license = objectValue(value, "license", path, issues);
  if (license) {
    allowedKeys(license, ["name", "spdxId", "uri", "attributionRequired"], `${path}.license`, issues);
    text(license, "name", `${path}.license`, issues);
    text(license, "spdxId", `${path}.license`, issues, true);
    text(license, "uri", `${path}.license`, issues, true);
    booleanValue(license, "attributionRequired", `${path}.license`, issues);
  }
  const hash = text(value, "hash", path, issues);
  if (hash && !SHA256.test(hash)) issues.add("IR_ASSET_HASH", `${path}.hash`, "Asset hash must be lowercase SHA-256.");
  if (!Array.isArray(value.derivations)) {
    issues.add("IR_DERIVATIONS", `${path}.derivations`, "Asset derivations must be an array.");
    return;
  }
  if (sourceKind === "DERIVED" && value.derivations.length === 0) {
    issues.add("IR_DERIVATION_REQUIRED", `${path}.derivations`, "Derived assets require derivation evidence.");
  }
  let finalHash: string | null = null;
  value.derivations.forEach((item, index) => {
    const itemPath = `${path}.derivations[${index}]`;
    if (!isRecord(item)) {
      issues.add("IR_DERIVATION", itemPath, "Derivation must be an object.");
      return;
    }
    allowedKeys(item, ["operation", "tool", "toolVersion", "inputHashes", "parametersDigest", "outputHash"], itemPath, issues);
    text(item, "operation", itemPath, issues);
    text(item, "tool", itemPath, issues);
    text(item, "toolVersion", itemPath, issues, true);
    stringList(item, "inputHashes", itemPath, issues).forEach((digest, digestIndex) => {
      if (!SHA256.test(digest)) issues.add("IR_DERIVATION_HASH", `${itemPath}.inputHashes[${digestIndex}]`, "Derivation hash must be lowercase SHA-256.");
    });
    const parameters = text(item, "parametersDigest", itemPath, issues);
    finalHash = text(item, "outputHash", itemPath, issues);
    if (parameters && !SHA256.test(parameters)) issues.add("IR_DERIVATION_HASH", `${itemPath}.parametersDigest`, "Derivation hash must be lowercase SHA-256.");
    if (finalHash && !SHA256.test(finalHash)) issues.add("IR_DERIVATION_HASH", `${itemPath}.outputHash`, "Derivation hash must be lowercase SHA-256.");
  });
  if (finalHash !== null && hash !== null && finalHash !== hash) {
    issues.add("IR_DERIVATION_FINAL_HASH", `${path}.derivations`, "Final derivation output must match the asset hash.");
  }
}

const REF_RULES: Readonly<Record<ExperienceIrKind, readonly ReferenceRule[]>> = {
  PROJECT: [
    { field: "worldIds", kinds: ["WORLD"], many: true },
    { field: "defaultSceneId", kinds: ["SCENE"] },
  ],
  WORLD: [{ field: "sceneIds", kinds: ["SCENE"], many: true }],
  SCENE: [
    { field: "entityIds", kinds: ["ENTITY"], many: true },
    { field: "cameraId", kinds: ["CAMERA"] },
    { field: "lightIds", kinds: ["LIGHT"], many: true },
  ],
  ENTITY: [
    { field: "componentIds", kinds: ["COMPONENT"], many: true },
    { field: "transformId", kinds: ["TRANSFORM"] },
    { field: "parentEntityId", kinds: ["ENTITY"], optional: true },
  ],
  COMPONENT: [{ field: "ownerEntityId", kinds: ["ENTITY"] }],
  TRANSFORM: [{ field: "parentTransformId", kinds: ["TRANSFORM"], optional: true }],
  CAMERA: [{ field: "transformId", kinds: ["TRANSFORM"] }],
  LIGHT: [{ field: "transformId", kinds: ["TRANSFORM"] }],
  MATERIAL: [{ field: "textureIds", kinds: ["TEXTURE"], many: true }],
  TEXTURE: [],
  AUDIO: [{ field: "ownerEntityId", kinds: ["ENTITY"], optional: true }],
  PHYSICS: [{ field: "ownerEntityId", kinds: ["ENTITY"] }],
  CONSTRAINT: [
    { field: "sourceId", kinds: TARGET_KINDS },
    { field: "targetId", kinds: TARGET_KINDS },
  ],
  ANIMATION: [{ field: "targetIds", kinds: TARGET_KINDS, many: true }],
  VFX: [
    { field: "ownerEntityId", kinds: ["ENTITY"], optional: true },
    { field: "materialIds", kinds: ["MATERIAL"], many: true },
  ],
  TIMELINE: [],
  INPUT: [{ field: "contextEntityId", kinds: ["ENTITY"], optional: true }],
  SAVE: [{ field: "stateSemanticIds", kinds: TARGET_KINDS, many: true }],
  NETWORK: [{ field: "replicatedSemanticIds", kinds: TARGET_KINDS, many: true }],
  BUILD: [
    { field: "entrySceneId", kinds: ["SCENE"] },
    { field: "assetIds", kinds: ASSET_KINDS, many: true },
  ],
};

function addReference(
  references: TypedReference[], id: string | null, expectedKinds: readonly ExperienceIrKind[], path: string,
): void {
  if (id !== null) references.push({ id, expectedKinds, path });
}

function validateReferenceFields(node: InternalNode, issues: Issues): TypedReference[] {
  const references: TypedReference[] = [];
  for (const rule of REF_RULES[node.kind]) {
    if (rule.many) {
      stringList(node.value, rule.field, node.path, issues, rule.optional).forEach((id, index) => {
        addReference(references, id, rule.kinds, `${node.path}.${rule.field}[${index}]`);
      });
    } else {
      addReference(
        references,
        text(node.value, rule.field, node.path, issues, rule.optional),
        rule.kinds,
        `${node.path}.${rule.field}`,
      );
    }
  }
  return references;
}

function validateTimeline(node: InternalNode, issues: Issues, references: TypedReference[]): void {
  const duration = numberValue(node.value, "durationSeconds", node.path, issues, true);
  if (!Array.isArray(node.value.tracks)) {
    issues.add("IR_REQUIRED_ARRAY", `${node.path}.tracks`, "Timeline tracks must be an array.");
    return;
  }
  const trackIds = new Set<string>();
  node.value.tracks.forEach((track, trackIndex) => {
    const trackPath = `${node.path}.tracks[${trackIndex}]`;
    if (!isRecord(track)) {
      issues.add("IR_TIMELINE_TRACK", trackPath, "Timeline track must be an object.");
      return;
    }
    allowedKeys(track, ["semanticRole", "trackId", "trackType", "targetId", "keyframes", "clips", "events"], trackPath, issues);
    const trackId = text(track, "trackId", trackPath, issues);
    if (trackId && trackIds.has(trackId)) issues.add("IR_DUPLICATE_TRACK", `${trackPath}.trackId`, "Track IDs must be unique.");
    if (trackId) trackIds.add(trackId);
    addReference(references, text(track, "targetId", trackPath, issues), TARGET_KINDS, `${trackPath}.targetId`);
    if (!Array.isArray(track.keyframes)) {
      issues.add("IR_REQUIRED_ARRAY", `${trackPath}.keyframes`, "Timeline keyframes must be an array.");
      return;
    }
    let previous = -Infinity;
    track.keyframes.forEach((keyframe, keyframeIndex) => {
      const keyframePath = `${trackPath}.keyframes[${keyframeIndex}]`;
      if (!isRecord(keyframe)) {
        issues.add("IR_TIMELINE_KEYFRAME", keyframePath, "Timeline keyframe must be an object.");
        return;
      }
      allowedKeys(keyframe, ["atSeconds", "value"], keyframePath, issues);
      const at = numberValue(keyframe, "atSeconds", keyframePath, issues);
      if (at !== null && (at < 0 || (duration !== null && at > duration) || at < previous)) {
        issues.add("IR_TIMELINE_TIME", `${keyframePath}.atSeconds`, "Keyframe time must be ordered and inside the timeline.");
      }
      if (at !== null) previous = at;
      if (!("value" in keyframe)) issues.add("IR_TIMELINE_VALUE", `${keyframePath}.value`, "Keyframe value is required.");
    });
  });
}

function validateInput(node: InternalNode, issues: Issues): void {
  if (!Array.isArray(node.value.actions)) {
    issues.add("IR_REQUIRED_ARRAY", `${node.path}.actions`, "Input actions must be an array.");
    return;
  }
  const actionIds = new Set<string>();
  node.value.actions.forEach((action, index) => {
    const actionPath = `${node.path}.actions[${index}]`;
    if (!isRecord(action)) {
      issues.add("IR_INPUT_ACTION", actionPath, "Input action must be an object.");
      return;
    }
    allowedKeys(action, ["actionId", "bindings"], actionPath, issues);
    const actionId = text(action, "actionId", actionPath, issues);
    if (actionId && actionIds.has(actionId)) issues.add("IR_DUPLICATE_ACTION", `${actionPath}.actionId`, "Action IDs must be unique.");
    if (actionId) actionIds.add(actionId);
    stringList(action, "bindings", actionPath, issues);
  });
}

function validateSpecificFields(node: InternalNode, issues: Issues, references: TypedReference[]): void {
  const value = node.value;
  switch (node.kind) {
    case "PROJECT": case "WORLD": case "SCENE": case "ENTITY":
      text(value, "name", node.path, issues);
      break;
    case "COMPONENT":
      text(value, "componentType", node.path, issues);
      objectValue(value, "properties", node.path, issues);
      break;
    case "TRANSFORM":
      tuple(value.translation, 3, `${node.path}.translation`, issues);
      tuple(value.rotation, 4, `${node.path}.rotation`, issues);
      tuple(value.scale, 3, `${node.path}.scale`, issues, true);
      break;
    case "CAMERA": {
      enumValue(value, "projection", ["PERSPECTIVE", "ORTHOGRAPHIC"], node.path, issues);
      const near = numberValue(value, "near", node.path, issues, true);
      const far = numberValue(value, "far", node.path, issues, true);
      numberValue(value, "fieldOfViewRadians", node.path, issues, true, true);
      if (near !== null && far !== null && near >= far) issues.add("IR_CAMERA_RANGE", node.path, "Camera near must be smaller than far.");
      break;
    }
    case "LIGHT": {
      enumValue(value, "lightType", ["DIRECTIONAL", "POINT", "SPOT", "AREA"], node.path, issues);
      const color = text(value, "color", node.path, issues);
      if (color && !/^#[0-9a-f]{6}$/iu.test(color)) issues.add("IR_LIGHT_COLOR", `${node.path}.color`, "Light color must use hexadecimal RGB.");
      const intensity = objectValue(value, "intensity", node.path, issues);
      if (intensity) {
        allowedKeys(intensity, ["value", "unit"], `${node.path}.intensity`, issues);
        numberValue(intensity, "value", `${node.path}.intensity`, issues, true);
        enumValue(intensity, "unit", ["LUMEN", "LUX", "CANDELA"], `${node.path}.intensity`, issues);
      }
      break;
    }
    case "MATERIAL":
      text(value, "shadingModel", node.path, issues);
      objectValue(value, "parameters", node.path, issues);
      break;
    case "TEXTURE":
      enumValue(value, "usage", ["ALBEDO", "NORMAL", "EMISSIVE", "ROUGHNESS", "METALLIC", "UI", "OTHER"], node.path, issues);
      enumValue(value, "colorSpace", ["SRGB", "LINEAR"], node.path, issues);
      validateProvenance(value.provenance, `${node.path}.provenance`, issues);
      break;
    case "AUDIO":
      booleanValue(value, "spatial", node.path, issues);
      booleanValue(value, "loop", node.path, issues);
      validateProvenance(value.provenance, `${node.path}.provenance`, issues);
      break;
    case "PHYSICS": {
      enumValue(value, "bodyType", ["STATIC", "KINEMATIC", "DYNAMIC"], node.path, issues);
      const mass = numberValue(value, "massKilograms", node.path, issues);
      if (mass !== null && mass < 0) issues.add("IR_PHYSICS_MASS", `${node.path}.massKilograms`, "Physics mass cannot be negative.");
      objectValue(value, "collider", node.path, issues);
      break;
    }
    case "CONSTRAINT":
      text(value, "constraintType", node.path, issues);
      objectValue(value, "parameters", node.path, issues);
      break;
    case "ANIMATION":
      numberValue(value, "durationSeconds", node.path, issues, true);
      validateProvenance(value.provenance, `${node.path}.provenance`, issues);
      break;
    case "VFX":
      validateProvenance(value.provenance, `${node.path}.provenance`, issues);
      break;
    case "TIMELINE":
      validateTimeline(node, issues, references);
      break;
    case "INPUT":
      validateInput(node, issues);
      break;
    case "SAVE":
      enumValue(value, "strategy", ["SNAPSHOT", "EVENT_LOG", "HYBRID"], node.path, issues);
      text(value, "schemaRevision", node.path, issues);
      break;
    case "NETWORK":
      enumValue(value, "mode", ["OFFLINE", "CLIENT_SERVER", "PEER_TO_PEER", "LOCKSTEP"], node.path, issues);
      enumValue(value, "authority", ["NONE", "SERVER", "OWNER", "DISTRIBUTED"], node.path, issues);
      numberValue(value, "tickRateHz", node.path, issues);
      break;
    case "BUILD":
      text(value, "target", node.path, issues);
      objectValue(value, "options", node.path, issues);
      break;
  }
}

function validateNode(
  node: InternalNode, issues: Issues, conceptReferences: readonly TypedReference[] = [],
): TypedReference[] {
  allowedKeys(node.value, NODE_KEYS[node.kind], node.path, issues);
  const semanticId = text(node.value, "semanticId", node.path, issues);
  if (semanticId && (!SEMANTIC_ID.test(semanticId) || !semanticId.startsWith(`${KIND_PREFIX[node.kind]}.`))) {
    issues.add("IR_SEMANTIC_ID", `${node.path}.semanticId`, "Semantic ID format or kind prefix is invalid.");
  }
  if (node.value.kind !== node.kind) issues.add("IR_NODE_KIND", `${node.path}.kind`, "Node kind does not match its collection.");
  validateExtensions(node.value.extensions, `${node.path}.extensions`, issues);
  const typed = [...validateReferenceFields(node, issues), ...conceptReferences];
  validateSpecificFields(node, issues, typed);
  const declared = stringList(node.value, "references", node.path, issues);
  declared.forEach((id, index) => {
    if (!SEMANTIC_ID.test(id)) issues.add("IR_REFERENCE_ID", `${node.path}.references[${index}]`, "Reference semantic ID is invalid.");
  });
  const expected = [...new Set(typed.map((reference) => reference.id))].sort();
  if (JSON.stringify([...declared].sort()) !== JSON.stringify(expected)) {
    issues.add("IR_REFERENCE_DECLARATION", `${node.path}.references`, "Declared references must exactly match typed relationships.");
  }
  return typed;
}

interface InternalValidation {
  readonly document: ExperienceIrDocumentV1 | null;
  readonly documentDigest: ExperienceIrSha256 | null;
  readonly nodes: readonly InternalNode[];
  readonly issues: readonly ExperienceIrIssue[];
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Object.is(value, -0) ? "0" : JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function digest(value: unknown): ExperienceIrSha256 {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function cloneCanonical<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function toJsonPointer(path: string): string {
  return path.replace(/^\$\.?/u, "/").replace(/\[(\d+)\]/gu, "/$1").replace(/\./gu, "/");
}

function collectNodes(document: Record<string, unknown>, issues: Issues): InternalNode[] {
  const nodes: InternalNode[] = [];
  if (!isRecord(document.project)) {
    issues.add("IR_PROJECT", "$.project", "Project node is required.");
  } else nodes.push({ value: document.project, kind: "PROJECT", path: "$.project" });
  for (const [kind, collection] of COLLECTIONS) {
    const value = document[collection];
    if (!Array.isArray(value)) {
      issues.add("IR_COLLECTION", `$.${collection}`, "Required node collection is missing.");
      continue;
    }
    if (value.length === 0) issues.add("IR_COLLECTION_EMPTY", `$.${collection}`, "Required node collection cannot be empty.");
    value.forEach((item, index) => {
      const path = `$.${collection}[${index}]`;
      if (!isRecord(item)) issues.add("IR_NODE", path, "Collection item must be an object.");
      else nodes.push({ value: item, kind, path });
    });
  }
  if (nodes.length > MAX_NODES) issues.add("IR_NODE_LIMIT", "$", "Node limit exceeded.");
  return nodes;
}

function validateInternal(input: unknown): InternalValidation {
  const issues = new Issues();
  if (!validateJson(input, issues) || !isRecord(input)) {
    if (!isRecord(input)) issues.add("IR_DOCUMENT", "$", "Experience IR document must be a plain object.");
    return { document: null, documentDigest: null, nodes: [], issues: issues.finish() };
  }
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) issues.add("IR_BYTE_LIMIT", "$", "Document byte limit exceeded.");
  allowedKeys(input, [
    "schemaVersion", "revision", "coordinateSystem", "serialization", "project", "worlds", "scenes",
    "entities", "components", "transforms", "cameras", "lights", "materials", "textures", "audio",
    "physics", "constraints", "animations", "vfx", "timelines", "inputs", "saves", "networks", "builds",
    "extensions",
  ], "$", issues);
  if (input.schemaVersion !== EXPERIENCE_IR_SCHEMA_VERSION) issues.add("IR_SCHEMA_VERSION", "$.schemaVersion", "Unsupported Experience IR schema version.");
  text(input, "revision", "$", issues);
  validateExtensions(input.extensions, "$.extensions", issues);
  validateCoordinateSystem(input, issues);
  validateSerialization(input, issues);
  const nodes = collectNodes(input, issues);
  const semantics = validarSemanticaExperienceIr(nodes);
  semantics.issues.forEach((issue) => issues.add(issue.code, issue.path, issue.message));
  const byId = new Map<string, InternalNode>();
  const typedByNode = new Map<InternalNode, readonly TypedReference[]>();
  for (const node of nodes) {
    const conceptReferences = obterReferenciasConceituaisExperienceIr(node).map((reference) => ({
      id: reference.id,
      expectedKinds: reference.expectedKinds,
      path: reference.path,
    }));
    const typed = validateNode(node, issues, conceptReferences);
    typedByNode.set(node, typed);
    const id = typeof node.value.semanticId === "string" ? node.value.semanticId : null;
    if (id !== null) {
      if (byId.has(id)) issues.add("IR_DUPLICATE_SEMANTIC_ID", `${node.path}.semanticId`, "Semantic IDs must be globally unique.");
      else byId.set(id, node);
    }
  }
  for (const node of nodes) {
    const declared = Array.isArray(node.value.references) ? node.value.references : [];
    declared.forEach((id, index) => {
      if (typeof id === "string" && !byId.has(id)) issues.add("IR_DANGLING_REFERENCE", `${node.path}.references[${index}]`, "Declared reference target does not exist.");
    });
    for (const reference of typedByNode.get(node) ?? []) {
      const target = byId.get(reference.id);
      if (!target) issues.add("IR_DANGLING_REFERENCE", reference.path, "Typed reference target does not exist.");
      else if (!reference.expectedKinds.includes(target.kind)) issues.add("IR_REFERENCE_KIND", reference.path, "Typed reference target kind is invalid.");
    }
  }
  const finished = issues.finish();
  if (finished.length > 0) return { document: null, documentDigest: null, nodes, issues: finished };
  const document = input as unknown as ExperienceIrDocumentV1;
  return { document, documentDigest: digest(document), nodes, issues: finished };
}

function buildIndex(validation: InternalValidation): ExperienceIrIndex {
  const entries: ExperienceIrIndexEntry[] = validation.nodes.map((node) => ({
    semanticId: node.value.semanticId as string,
    kind: node.kind,
    semanticRoles: obterPapeisSemanticosExperienceIr(node.value, node.kind),
    path: toJsonPointer(node.path),
    contentDigest: digest(node.value),
    references: [...(node.value.references as string[])].sort(),
  })).sort((a, b) => a.semanticId.localeCompare(b.semanticId, "en"));
  const grouped = new Map<string, ExperienceIrIndexEntry[]>();
  entries.forEach((entry) => {
    const prefix = entry.semanticId.split(/[._-]/u, 1)[0];
    grouped.set(prefix, [...(grouped.get(prefix) ?? []), entry]);
  });
  const partitions: ExperienceIrIndexPartition[] = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([prefix, values]) => ({ prefix, entryCount: values.length, contentDigest: digest(values) }));
  return {
    schemaVersion: EXPERIENCE_IR_INDEX_SCHEMA_VERSION,
    documentDigest: validation.documentDigest as ExperienceIrSha256,
    entries,
    partitions,
    authoritative: false,
  };
}

export function validarExperienceIr(input: unknown): ExperienceIrValidationResult {
  const validation = validateInternal(input);
  return {
    sucesso: true,
    valido: validation.document !== null,
    documentDigest: validation.documentDigest,
    issues: validation.issues,
    ...BOUNDARY,
  };
}

export function indexarExperienceIr(input: unknown): ExperienceIrIndexResult {
  const validation = validateInternal(input);
  if (!validation.document) return { sucesso: false, indice: null, issues: validation.issues, ...BOUNDARY };
  return { sucesso: true, indice: buildIndex(validation), issues: [], ...BOUNDARY };
}

export function consultarIndiceExperienceIr(index: ExperienceIrIndex, semanticId: unknown): ExperienceIrIndexQueryResult {
  if (typeof semanticId !== "string" || !SEMANTIC_ID.test(semanticId) || !Array.isArray(index?.entries)) {
    return { sucesso: true, encontrado: false, entry: null, ...BOUNDARY };
  }
  let low = 0;
  let high = index.entries.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const entry = index.entries[middle];
    const comparison = entry.semanticId.localeCompare(semanticId, "en");
    if (comparison === 0) return { sucesso: true, encontrado: true, entry, ...BOUNDARY };
    if (comparison < 0) low = middle + 1;
    else high = middle - 1;
  }
  return { sucesso: true, encontrado: false, entry: null, ...BOUNDARY };
}

export function criarChunkExperienceIr(
  input: unknown, semanticIds: unknown, incluirDependencias = true,
): ExperienceIrChunkResult {
  const validation = validateInternal(input);
  if (!validation.document) return { sucesso: false, chunk: null, issues: validation.issues, ...BOUNDARY };
  const issues = new Issues();
  if (!Array.isArray(semanticIds) || semanticIds.length === 0 || semanticIds.length > MAX_REFS) {
    issues.add("IR_CHUNK_IDS", "$.semanticIds", "A bounded non-empty semantic ID array is required.");
  }
  if (typeof incluirDependencias !== "boolean") issues.add("IR_CHUNK_DEPENDENCIES", "$.incluirDependencias", "Dependency mode must be boolean.");
  const requested: string[] = [];
  const requestedSet = new Set<string>();
  const byId = new Map(validation.nodes.map((node) => [node.value.semanticId as string, node]));
  if (Array.isArray(semanticIds)) semanticIds.forEach((candidate, index) => {
    const path = `$.semanticIds[${index}]`;
    if (typeof candidate !== "string" || !SEMANTIC_ID.test(candidate) || !byId.has(candidate)) {
      issues.add("IR_CHUNK_ID", path, "Requested semantic ID is invalid or unknown.");
    } else if (requestedSet.has(candidate)) {
      issues.add("IR_CHUNK_DUPLICATE_ID", path, "Requested semantic IDs must be unique.");
    } else {
      requestedSet.add(candidate);
      requested.push(candidate);
    }
  });
  const finished = issues.finish();
  if (finished.length > 0) return { sucesso: false, chunk: null, issues: finished, ...BOUNDARY };
  const selected = new Set(requested);
  if (incluirDependencias) {
    const queue = [...requested];
    while (queue.length > 0) {
      const current = byId.get(queue.shift() as string) as InternalNode;
      (current.value.references as string[]).forEach((reference) => {
        if (!selected.has(reference)) {
          selected.add(reference);
          queue.push(reference);
        }
      });
    }
  }
  const index = buildIndex(validation);
  const indexById = new Map(index.entries.map((entry) => [entry.semanticId, entry]));
  const entries: ExperienceIrChunkEntry[] = [...selected].sort().map((id) => {
    const node = byId.get(id) as InternalNode;
    const entry = indexById.get(id) as ExperienceIrIndexEntry;
    return {
      semanticId: id,
      kind: node.kind,
      semanticRoles: entry.semanticRoles,
      contentDigest: entry.contentDigest,
      value: cloneCanonical(node.value) as unknown as ExperienceIrNode,
    };
  });
  const externalReferences = incluirDependencias ? [] : [...new Set(entries.flatMap((entry) => (
    byId.get(entry.semanticId)?.value.references as string[]
  )).filter((reference) => !selected.has(reference)))].sort();
  const payload = {
    schemaVersion: EXPERIENCE_IR_CHUNK_SCHEMA_VERSION,
    documentDigest: validation.documentDigest as ExperienceIrSha256,
    requestedSemanticIdDigests: requested.map((id) => digest(id)).sort(),
    entries,
    externalReferences,
    authoritative: false as const,
  };
  return { sucesso: true, chunk: { ...payload, chunkDigest: digest(payload) }, issues: [], ...BOUNDARY };
}

export function descreverSerializacaoExperienceIr(
  schemaVersion: unknown = EXPERIENCE_IR_SCHEMA_VERSION,
): ExperienceIrSerializationDescriptorResult {
  if (schemaVersion !== EXPERIENCE_IR_SCHEMA_VERSION) {
    return {
      sucesso: false,
      descriptor: null,
      issues: [{ code: "IR_SCHEMA_VERSION", path: "$.schemaVersion", message: "Unsupported Experience IR schema version." }],
      ...BOUNDARY,
    };
  }
  return {
    sucesso: true,
    descriptor: {
      schemaVersion: EXPERIENCE_IR_SERIALIZATION_SCHEMA_VERSION,
      json: { ...SERIALIZATION.json, native: true },
      cbor: { ...SERIALIZATION.cbor, support: "EXTERNAL", installed: false },
      semanticRoles: EXPERIENCE_IR_SEMANTIC_ROLE_SCHEMA,
    },
    issues: [],
    ...BOUNDARY,
  };
}
