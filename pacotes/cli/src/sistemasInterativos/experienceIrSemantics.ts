// SEMA-GOVERNED: sema.produto.sistemas_interativos.ir_semantica
// Contratos: contratos/sema/sistemas_interativos_ir.sema e sistemas_interativos_ir_semantica.sema
// Descrição: papéis tipados e invariantes transversais, sem executar ou ecoar valores controlados.

import type {
  ExperienceIrKind,
  ExperienceIrSemanticRole,
  ExperienceIrSemanticRoleSchema,
} from "./experienceIrTypes.js";

export const EXPERIENCE_IR_SEMANTIC_ROLES_SCHEMA_VERSION =
  "sema.experience-ir.semantic-roles/v1" as const;

export const EXPERIENCE_IR_SEMANTIC_ROLE_SCHEMA: ExperienceIrSemanticRoleSchema = Object.freeze({
  schemaVersion: EXPERIENCE_IR_SEMANTIC_ROLES_SCHEMA_VERSION,
  compatibility: "OPTIONAL_TYPED_ROLES",
  nodeKindCount: 20,
  mappings: Object.freeze([
    { role: "LEVEL", containerKind: "SCENE", field: "semanticRole", cardinality: "ONE" },
    { role: "PIVOT", containerKind: "TRANSFORM", field: "semanticRole", cardinality: "ONE" },
    { role: "COLLIDER", containerKind: "PHYSICS", field: "colliders", cardinality: "MANY" },
    { role: "EMITTER", containerKind: "VFX", field: "emitters", cardinality: "MANY" },
    { role: "TRACK", containerKind: "TIMELINE", field: "tracks[].semanticRole", cardinality: "MANY" },
    { role: "CLIP", containerKind: "TIMELINE", field: "tracks[].clips", cardinality: "MANY" },
    { role: "EVENT", containerKind: "TIMELINE", field: "tracks[].events", cardinality: "MANY" },
    { role: "GAME_STATE", containerKind: "SAVE", field: "semanticRole", cardinality: "ONE" },
  ] as const),
});

const VALOR_SENSIVEL =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}/iu;
const QUERY_URI_SENSIVEL =
  /[?&](?:access[_-]?token|api[_-]?key|token|signature|sig|credential|x-amz-[a-z0-9-]+)=/iu;
const ID_LOCAL = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const ALL_KINDS: readonly ExperienceIrKind[] = [
  "PROJECT", "WORLD", "SCENE", "ENTITY", "COMPONENT", "TRANSFORM", "CAMERA", "LIGHT", "MATERIAL",
  "TEXTURE", "AUDIO", "PHYSICS", "CONSTRAINT", "ANIMATION", "VFX", "TIMELINE", "INPUT",
  "SAVE", "NETWORK", "BUILD",
];
const TARGET_KINDS = ALL_KINDS.filter((kind) => kind !== "PROJECT");
const KIND_SET = new Set<string>(ALL_KINDS);
const ROLE_ORDER = EXPERIENCE_IR_SEMANTIC_ROLE_SCHEMA.mappings.map((item) => item.role);

export interface ExperienceIrSemanticNodeProjection {
  readonly kind: ExperienceIrKind;
  readonly value: Record<string, unknown>;
  readonly path: string;
}

export interface ExperienceIrSemanticIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ExperienceIrConceptReference {
  readonly id: string;
  readonly expectedKinds: readonly ExperienceIrKind[];
  readonly path: string;
}

export interface ExperienceIrSemanticValidationResult {
  readonly valido: boolean;
  readonly semanticRoles: readonly ExperienceIrSemanticRole[];
  readonly issues: readonly ExperienceIrSemanticIssue[];
  readonly executed: false;
  readonly workspaceMutated: false;
  readonly authoritative: false;
}

export function valorSensivelExperienceIr(value: string): boolean {
  return VALOR_SENSIVEL.test(value) || QUERY_URI_SENSIVEL.test(value);
}

function contemValorSensivel(value: unknown): boolean {
  const pending: unknown[] = [value];
  const seen = new WeakSet<object>();
  let inspected = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string" && valorSensivelExperienceIr(current)) return true;
    if (current === null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    inspected += 1;
    if (inspected > 100_000) return true;
    try {
      Object.values(Object.getOwnPropertyDescriptors(current)).forEach((descriptor) => {
        if ("value" in descriptor) pending.push(descriptor.value);
      });
    } catch {
      return true;
    }
  }
  return false;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown, positive = false): value is number {
  return typeof value === "number" && Number.isFinite(value) && (!positive || value > 0);
}

function addUnknownFields(
  value: Record<string, unknown>, allowed: readonly string[], path: string, issues: ExperienceIrSemanticIssue[],
): void {
  const accepted = new Set(allowed);
  Object.keys(value).sort().forEach((key, index) => {
    if (!accepted.has(key)) issues.push({
      code: "IR_CONCEPT_UNKNOWN_FIELD",
      path: `${path}.*[${index}]`,
      message: "Unknown typed semantic-role field.",
    });
  });
}

function validateRole(
  value: unknown, expected: ExperienceIrSemanticRole, path: string, issues: ExperienceIrSemanticIssue[], optional = false,
): boolean {
  if (value === undefined && optional) return false;
  if (value !== expected) {
    issues.push({ code: "IR_SEMANTIC_ROLE", path, message: "Typed semantic role is invalid for its container." });
    return false;
  }
  return true;
}

function validateLocalId(
  value: unknown, prefix: string, path: string, issues: ExperienceIrSemanticIssue[], seen: Set<string>,
): void {
  if (typeof value !== "string" || !ID_LOCAL.test(value) || !value.startsWith(`${prefix}.`)) {
    issues.push({ code: "IR_CONCEPT_ID", path, message: "Typed semantic-role ID is invalid." });
  } else if (seen.has(value)) {
    issues.push({ code: "IR_CONCEPT_ID_DUPLICATE", path, message: "Typed semantic-role IDs must be unique." });
  } else seen.add(value);
}

function validateColliders(node: ExperienceIrSemanticNodeProjection, issues: ExperienceIrSemanticIssue[]): void {
  const { colliders } = node.value;
  if (colliders === undefined) return;
  if (!Array.isArray(colliders)) {
    issues.push({ code: "IR_COLLIDERS", path: `${node.path}.colliders`, message: "Colliders must be an array." });
    return;
  }
  const ids = new Set<string>();
  colliders.forEach((item, index) => {
    const path = `${node.path}.colliders[${index}]`;
    if (!record(item)) {
      issues.push({ code: "IR_COLLIDER", path, message: "Collider must be a typed object." });
      return;
    }
    addUnknownFields(item, [
      "semanticRole", "colliderId", "shape", "trigger", "halfExtentsMeters", "radiusMeters", "heightMeters",
    ], path, issues);
    validateRole(item.semanticRole, "COLLIDER", `${path}.semanticRole`, issues);
    validateLocalId(item.colliderId, "collider", `${path}.colliderId`, issues, ids);
    if (typeof item.trigger !== "boolean") issues.push({ code: "IR_COLLIDER_TRIGGER", path: `${path}.trigger`, message: "Collider trigger must be boolean." });
    if (item.shape === "BOX") {
      if (!Array.isArray(item.halfExtentsMeters) || item.halfExtentsMeters.length !== 3
        || !item.halfExtentsMeters.every((value) => finite(value, true))
        || item.radiusMeters !== undefined || item.heightMeters !== undefined) {
        issues.push({ code: "IR_COLLIDER_SHAPE", path: `${path}.halfExtentsMeters`, message: "BOX collider dimensions are invalid." });
      }
    } else if (item.shape === "SPHERE") {
      if (!finite(item.radiusMeters, true) || item.halfExtentsMeters !== undefined || item.heightMeters !== undefined) {
        issues.push({ code: "IR_COLLIDER_SHAPE", path: `${path}.radiusMeters`, message: "SPHERE collider radius is invalid." });
      }
    } else if (item.shape === "CAPSULE") {
      if (!finite(item.radiusMeters, true) || !finite(item.heightMeters, true) || item.halfExtentsMeters !== undefined) {
        issues.push({ code: "IR_COLLIDER_SHAPE", path, message: "CAPSULE collider dimensions are invalid." });
      }
    } else issues.push({ code: "IR_COLLIDER_SHAPE", path: `${path}.shape`, message: "Collider shape is invalid." });
  });
}

function validateEmitters(node: ExperienceIrSemanticNodeProjection, issues: ExperienceIrSemanticIssue[]): void {
  const { emitters } = node.value;
  if (emitters === undefined) return;
  if (!Array.isArray(emitters)) {
    issues.push({ code: "IR_EMITTERS", path: `${node.path}.emitters`, message: "Emitters must be an array." });
    return;
  }
  const ids = new Set<string>();
  emitters.forEach((item, index) => {
    const path = `${node.path}.emitters[${index}]`;
    if (!record(item)) {
      issues.push({ code: "IR_EMITTER", path, message: "Emitter must be a typed object." });
      return;
    }
    addUnknownFields(item, ["semanticRole", "emitterId", "ratePerSecond", "maxParticles", "enabled"], path, issues);
    validateRole(item.semanticRole, "EMITTER", `${path}.semanticRole`, issues);
    validateLocalId(item.emitterId, "emitter", `${path}.emitterId`, issues, ids);
    if (!finite(item.ratePerSecond) || (item.ratePerSecond as number) < 0) issues.push({ code: "IR_EMITTER_RATE", path: `${path}.ratePerSecond`, message: "Emitter rate is invalid." });
    if (!Number.isInteger(item.maxParticles) || !finite(item.maxParticles, true)) issues.push({ code: "IR_EMITTER_BUDGET", path: `${path}.maxParticles`, message: "Emitter particle budget is invalid." });
    if (typeof item.enabled !== "boolean") issues.push({ code: "IR_EMITTER_ENABLED", path: `${path}.enabled`, message: "Emitter enabled state must be boolean." });
  });
}

function validateTimelineConcepts(
  node: ExperienceIrSemanticNodeProjection, issues: ExperienceIrSemanticIssue[], references: ExperienceIrConceptReference[],
): void {
  if (!Array.isArray(node.value.tracks)) return;
  const clipIds = new Set<string>();
  const eventIds = new Set<string>();
  const duration = finite(node.value.durationSeconds) ? node.value.durationSeconds : null;
  node.value.tracks.forEach((track, trackIndex) => {
    const trackPath = `${node.path}.tracks[${trackIndex}]`;
    if (!record(track)) return;
    const hasTypedChildren = Array.isArray(track.clips) || Array.isArray(track.events);
    validateRole(track.semanticRole, "TRACK", `${trackPath}.semanticRole`, issues, !hasTypedChildren);
    if (track.trackType !== undefined && ![
      "ANIMATION", "AUDIO", "VFX", "EVENT", "GAME_STATE", "CUSTOM",
    ].includes(track.trackType as string)) {
      issues.push({ code: "IR_TRACK_TYPE", path: `${trackPath}.trackType`, message: "Timeline track type is invalid." });
    }
    if (track.clips !== undefined && !Array.isArray(track.clips)) {
      issues.push({ code: "IR_CLIPS", path: `${trackPath}.clips`, message: "Timeline clips must be an array." });
    }
    if (Array.isArray(track.clips)) track.clips.forEach((clip, clipIndex) => {
      const path = `${trackPath}.clips[${clipIndex}]`;
      if (!record(clip)) {
        issues.push({ code: "IR_CLIP", path, message: "Timeline clip must be a typed object." });
        return;
      }
      addUnknownFields(clip, ["semanticRole", "clipId", "targetId", "startSeconds", "endSeconds"], path, issues);
      validateRole(clip.semanticRole, "CLIP", `${path}.semanticRole`, issues);
      validateLocalId(clip.clipId, "clip", `${path}.clipId`, issues, clipIds);
      const start = finite(clip.startSeconds) ? clip.startSeconds : null;
      const end = finite(clip.endSeconds) ? clip.endSeconds : null;
      if (start === null || end === null || start < 0 || end <= start || (duration !== null && end > duration)) {
        issues.push({ code: "IR_CLIP_TIME", path, message: "Timeline clip range is invalid." });
      }
      if (typeof clip.targetId !== "string" || !ID_LOCAL.test(clip.targetId)) {
        issues.push({ code: "IR_CLIP_TARGET", path: `${path}.targetId`, message: "Timeline clip target is invalid." });
      } else references.push({ id: clip.targetId, expectedKinds: TARGET_KINDS, path: `${path}.targetId` });
    });
    if (track.events !== undefined && !Array.isArray(track.events)) {
      issues.push({ code: "IR_EVENTS", path: `${trackPath}.events`, message: "Timeline events must be an array." });
    }
    if (Array.isArray(track.events)) track.events.forEach((event, eventIndex) => {
      const path = `${trackPath}.events[${eventIndex}]`;
      if (!record(event)) {
        issues.push({ code: "IR_EVENT", path, message: "Timeline event must be a typed object." });
        return;
      }
      addUnknownFields(event, ["semanticRole", "eventId", "eventType", "atSeconds", "payload"], path, issues);
      validateRole(event.semanticRole, "EVENT", `${path}.semanticRole`, issues);
      validateLocalId(event.eventId, "event", `${path}.eventId`, issues, eventIds);
      if (typeof event.eventType !== "string" || event.eventType.trim().length === 0) issues.push({ code: "IR_EVENT_TYPE", path: `${path}.eventType`, message: "Timeline event type is invalid." });
      if (!finite(event.atSeconds) || (event.atSeconds as number) < 0 || (duration !== null && (event.atSeconds as number) > duration)) issues.push({ code: "IR_EVENT_TIME", path: `${path}.atSeconds`, message: "Timeline event time is invalid." });
      if (!record(event.payload)) issues.push({ code: "IR_EVENT_PAYLOAD", path: `${path}.payload`, message: "Timeline event payload must be an object." });
    });
  });
}

function validateNetwork(node: ExperienceIrSemanticNodeProjection, issues: ExperienceIrSemanticIssue[]): void {
  const { mode, authority, replicatedSemanticIds, tickRateHz } = node.value;
  if (!Array.isArray(replicatedSemanticIds) || typeof mode !== "string" || typeof authority !== "string"
    || typeof tickRateHz !== "number" || !Number.isFinite(tickRateHz)) return;
  const onlineTick = Number.isInteger(tickRateHz) && tickRateHz > 0;
  const hasReplication = replicatedSemanticIds.length > 0;
  const valid = mode === "OFFLINE"
    ? authority === "NONE" && !hasReplication && tickRateHz === 0
    : mode === "CLIENT_SERVER"
      ? authority === "SERVER" && hasReplication && onlineTick
      : mode === "PEER_TO_PEER"
        ? (authority === "OWNER" || authority === "DISTRIBUTED") && hasReplication && onlineTick
        : mode === "LOCKSTEP" && authority === "DISTRIBUTED" && hasReplication && onlineTick;
  if (!valid) issues.push({
    code: "IR_NETWORK_POLICY",
    path: `${node.path}.mode`,
    message: "Network mode, authority, replication and tick policy are inconsistent.",
  });
}

function hierarchyHasCycle(nodes: readonly ExperienceIrSemanticNodeProjection[], kind: ExperienceIrKind, parentField: string): boolean {
  const parents = new Map<string, string>();
  nodes.filter((node) => node.kind === kind).forEach((node) => {
    const id = node.value.semanticId;
    const parent = node.value[parentField];
    if (typeof id === "string" && typeof parent === "string") parents.set(id, parent);
  });
  const completed = new Set<string>();
  for (const start of parents.keys()) {
    const active = new Set<string>();
    let current: string | undefined = start;
    while (current !== undefined && parents.has(current) && !completed.has(current)) {
      if (active.has(current)) return true;
      active.add(current);
      current = parents.get(current);
    }
    active.forEach((id) => completed.add(id));
  }
  return false;
}

export function obterPapeisSemanticosExperienceIr(
  value: Record<string, unknown>, kind: ExperienceIrKind,
): readonly ExperienceIrSemanticRole[] {
  const roles = new Set<ExperienceIrSemanticRole>();
  if (kind === "SCENE" && value.semanticRole === "LEVEL") roles.add("LEVEL");
  if (kind === "TRANSFORM" && value.semanticRole === "PIVOT") roles.add("PIVOT");
  if (kind === "SAVE" && value.semanticRole === "GAME_STATE") roles.add("GAME_STATE");
  if (kind === "PHYSICS" && Array.isArray(value.colliders)
    && value.colliders.some((item) => record(item) && item.semanticRole === "COLLIDER")) roles.add("COLLIDER");
  if (kind === "VFX" && Array.isArray(value.emitters)
    && value.emitters.some((item) => record(item) && item.semanticRole === "EMITTER")) roles.add("EMITTER");
  if (kind === "TIMELINE" && Array.isArray(value.tracks)) value.tracks.forEach((track) => {
    if (!record(track)) return;
    if (track.semanticRole === "TRACK") roles.add("TRACK");
    if (Array.isArray(track.clips) && track.clips.some((item) => record(item) && item.semanticRole === "CLIP")) roles.add("CLIP");
    if (Array.isArray(track.events) && track.events.some((item) => record(item) && item.semanticRole === "EVENT")) roles.add("EVENT");
  });
  return ROLE_ORDER.filter((role) => roles.has(role));
}

export function obterReferenciasConceituaisExperienceIr(
  node: ExperienceIrSemanticNodeProjection,
): readonly ExperienceIrConceptReference[] {
  if (node.kind !== "TIMELINE") return [];
  const references: ExperienceIrConceptReference[] = [];
  const ignored: ExperienceIrSemanticIssue[] = [];
  validateTimelineConcepts(node, ignored, references);
  return references;
}

export function validarSemanticaExperienceIr(
  nodes: readonly ExperienceIrSemanticNodeProjection[],
): ExperienceIrSemanticValidationResult {
  const issues: ExperienceIrSemanticIssue[] = [];
  const roles = new Set<ExperienceIrSemanticRole>();
  const normalizedNodes: ExperienceIrSemanticNodeProjection[] = [];
  if (!Array.isArray(nodes)) {
    issues.push({ code: "IR_SEMANTIC_NODES", path: "$", message: "Semantic nodes must be an array." });
  } else nodes.forEach((candidate, index) => {
    if (!record(candidate) || !KIND_SET.has(candidate.kind as string) || !record(candidate.value)) {
      issues.push({ code: "IR_SEMANTIC_NODE", path: `$.nodes[${index}]`, message: "Semantic node projection is invalid." });
      return;
    }
    normalizedNodes.push({
      kind: candidate.kind as ExperienceIrKind,
      value: candidate.value,
      path: `$.nodes[${index}]`,
    });
  });
  if (normalizedNodes.some((node) => contemValorSensivel(node.value))) issues.push({
    code: "IR_SENSITIVE_VALUE", path: "$", message: "Sensitive string values are not accepted in Experience IR.",
  });
  normalizedNodes.forEach((node) => {
    if (node.kind === "SCENE") validateRole(node.value.semanticRole, "LEVEL", `${node.path}.semanticRole`, issues, true);
    if (node.kind === "TRANSFORM") validateRole(node.value.semanticRole, "PIVOT", `${node.path}.semanticRole`, issues, true);
    if (node.kind === "SAVE") {
      const hasRole = validateRole(node.value.semanticRole, "GAME_STATE", `${node.path}.semanticRole`, issues, true);
      if (hasRole && (!Array.isArray(node.value.stateSemanticIds) || node.value.stateSemanticIds.length === 0)) {
        issues.push({ code: "IR_GAME_STATE", path: `${node.path}.stateSemanticIds`, message: "GAME_STATE requires declared state semantic IDs." });
      }
    }
    if (node.kind === "PHYSICS") validateColliders(node, issues);
    if (node.kind === "VFX") validateEmitters(node, issues);
    if (node.kind === "TIMELINE") validateTimelineConcepts(node, issues, []);
    if (node.kind === "NETWORK") validateNetwork(node, issues);
    obterPapeisSemanticosExperienceIr(node.value, node.kind).forEach((role) => roles.add(role));
  });
  if (hierarchyHasCycle(normalizedNodes, "ENTITY", "parentEntityId")) issues.push({
    code: "IR_ENTITY_HIERARCHY_CYCLE", path: "$.entities", message: "Entity parent hierarchy must be acyclic.",
  });
  if (hierarchyHasCycle(normalizedNodes, "TRANSFORM", "parentTransformId")) issues.push({
    code: "IR_TRANSFORM_HIERARCHY_CYCLE", path: "$.transforms", message: "Transform parent hierarchy must be acyclic.",
  });
  const sorted = [...issues].sort((a, b) => a.path.localeCompare(b.path, "en") || a.code.localeCompare(b.code, "en"));
  return {
    valido: sorted.length === 0,
    semanticRoles: ROLE_ORDER.filter((role) => roles.has(role)),
    issues: sorted,
    executed: false,
    workspaceMutated: false,
    authoritative: false,
  };
}
