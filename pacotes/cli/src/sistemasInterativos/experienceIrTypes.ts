// SEMA-GOVERNED: sema.produto.sistemas_interativos.ir
// Contratos: contratos/sema/sistemas_interativos_ir.sema e sistemas_interativos_ir_semantica.sema
// Descrição: tipos públicos do Experience IR v1 e de suas projeções content-addressed.

export type ExperienceIrJsonPrimitive = string | number | boolean | null;
export type ExperienceIrJsonValue =
  | ExperienceIrJsonPrimitive
  | readonly ExperienceIrJsonValue[]
  | { readonly [key: string]: ExperienceIrJsonValue };
export type ExperienceIrJsonObject = { readonly [key: string]: ExperienceIrJsonValue };
export type ExperienceIrSha256 = `sha256:${string}`;
export type ExperienceIrSemanticId = string;
export type ExperienceIrSemanticRole =
  | "LEVEL" | "PIVOT" | "COLLIDER" | "EMITTER"
  | "TRACK" | "CLIP" | "EVENT" | "GAME_STATE";

export interface ExperienceIrSemanticRoleMapping {
  readonly role: ExperienceIrSemanticRole;
  readonly containerKind: ExperienceIrKind;
  readonly field: string;
  readonly cardinality: "ONE" | "MANY";
}

export interface ExperienceIrSemanticRoleSchema {
  readonly schemaVersion: "sema.experience-ir.semantic-roles/v1";
  readonly compatibility: "OPTIONAL_TYPED_ROLES";
  readonly nodeKindCount: 20;
  readonly mappings: readonly ExperienceIrSemanticRoleMapping[];
}

export interface ExperienceIrExtensionDescriptor {
  readonly schemaVersion: string;
  readonly payloadDigest: ExperienceIrSha256;
  readonly mediaType?: string;
}

export type ExperienceIrExtensions = Readonly<Record<string, ExperienceIrExtensionDescriptor>>;

export type ExperienceIrKind =
  | "PROJECT" | "WORLD" | "SCENE" | "ENTITY" | "COMPONENT" | "TRANSFORM"
  | "CAMERA" | "LIGHT" | "MATERIAL" | "TEXTURE" | "AUDIO" | "PHYSICS"
  | "CONSTRAINT" | "ANIMATION" | "VFX" | "TIMELINE" | "INPUT" | "SAVE"
  | "NETWORK" | "BUILD";

export type ExperienceIrAxis = "X" | "Y" | "Z" | "NEGATIVE_X" | "NEGATIVE_Y" | "NEGATIVE_Z";

export interface ExperienceIrCoordinateSystem {
  readonly units: {
    readonly length: "METER" | "CENTIMETER" | "MILLIMETER" | "KILOMETER";
    readonly mass: "KILOGRAM" | "GRAM";
    readonly time: "SECOND" | "MILLISECOND";
    readonly angle: "RADIAN" | "DEGREE";
  };
  readonly axes: {
    readonly handedness: "RIGHT_HANDED" | "LEFT_HANDED";
    readonly up: ExperienceIrAxis;
    readonly forward: ExperienceIrAxis;
  };
  readonly worldScaleMetersPerUnit: number;
}

export interface ExperienceIrSerializationV1 {
  readonly json: {
    readonly version: "1";
    readonly mediaType: "application/vnd.sema.experience-ir+json";
    readonly canonicalization: "SEMA_CANONICAL_JSON_V1";
  };
  readonly cbor: {
    readonly mode: "EXTERNAL_CODEC_REQUIRED";
    readonly mediaType: "application/cbor";
    readonly encoded: false;
    readonly deterministicEncodingRequired: true;
    readonly codec: null;
  };
}

export interface ExperienceIrDerivation {
  readonly operation: string;
  readonly tool: string;
  readonly toolVersion?: string;
  readonly inputHashes: readonly ExperienceIrSha256[];
  readonly parametersDigest: ExperienceIrSha256;
  readonly outputHash: ExperienceIrSha256;
}

export interface ExperienceIrAssetProvenance {
  readonly source: {
    readonly kind: "ORIGINAL" | "GENERATED" | "DERIVED" | "VENDOR";
    readonly uri: string;
  };
  readonly license: {
    readonly name: string;
    readonly spdxId?: string;
    readonly uri?: string;
    readonly attributionRequired: boolean;
  };
  readonly hash: ExperienceIrSha256;
  readonly derivations: readonly ExperienceIrDerivation[];
}

export interface ExperienceIrNodeBase<K extends ExperienceIrKind> {
  readonly semanticId: ExperienceIrSemanticId;
  readonly kind: K;
  readonly references: readonly ExperienceIrSemanticId[];
  readonly extensions?: ExperienceIrExtensions;
}

export interface ExperienceIrProject extends ExperienceIrNodeBase<"PROJECT"> {
  readonly name: string;
  readonly worldIds: readonly ExperienceIrSemanticId[];
  readonly defaultSceneId: ExperienceIrSemanticId;
}

export interface ExperienceIrWorld extends ExperienceIrNodeBase<"WORLD"> {
  readonly name: string;
  readonly sceneIds: readonly ExperienceIrSemanticId[];
}

export interface ExperienceIrScene extends ExperienceIrNodeBase<"SCENE"> {
  readonly name: string;
  readonly semanticRole?: "LEVEL";
  readonly entityIds: readonly ExperienceIrSemanticId[];
  readonly cameraId: ExperienceIrSemanticId;
  readonly lightIds: readonly ExperienceIrSemanticId[];
}

export interface ExperienceIrEntity extends ExperienceIrNodeBase<"ENTITY"> {
  readonly name: string;
  readonly componentIds: readonly ExperienceIrSemanticId[];
  readonly transformId: ExperienceIrSemanticId;
  readonly parentEntityId?: ExperienceIrSemanticId;
}

export interface ExperienceIrComponent extends ExperienceIrNodeBase<"COMPONENT"> {
  readonly ownerEntityId: ExperienceIrSemanticId;
  readonly componentType: string;
  readonly properties: ExperienceIrJsonObject;
}

export interface ExperienceIrTransform extends ExperienceIrNodeBase<"TRANSFORM"> {
  readonly semanticRole?: "PIVOT";
  readonly parentTransformId?: ExperienceIrSemanticId;
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
}

export interface ExperienceIrCamera extends ExperienceIrNodeBase<"CAMERA"> {
  readonly transformId: ExperienceIrSemanticId;
  readonly projection: "PERSPECTIVE" | "ORTHOGRAPHIC";
  readonly near: number;
  readonly far: number;
  readonly fieldOfViewRadians?: number;
}

export interface ExperienceIrLight extends ExperienceIrNodeBase<"LIGHT"> {
  readonly transformId: ExperienceIrSemanticId;
  readonly lightType: "DIRECTIONAL" | "POINT" | "SPOT" | "AREA";
  readonly color: string;
  readonly intensity: { readonly value: number; readonly unit: "LUMEN" | "LUX" | "CANDELA" };
}

export interface ExperienceIrMaterial extends ExperienceIrNodeBase<"MATERIAL"> {
  readonly shadingModel: string;
  readonly textureIds: readonly ExperienceIrSemanticId[];
  readonly parameters: ExperienceIrJsonObject;
}

export interface ExperienceIrTexture extends ExperienceIrNodeBase<"TEXTURE"> {
  readonly usage: "ALBEDO" | "NORMAL" | "EMISSIVE" | "ROUGHNESS" | "METALLIC" | "UI" | "OTHER";
  readonly colorSpace: "SRGB" | "LINEAR";
  readonly provenance: ExperienceIrAssetProvenance;
}

export interface ExperienceIrAudio extends ExperienceIrNodeBase<"AUDIO"> {
  readonly ownerEntityId?: ExperienceIrSemanticId;
  readonly spatial: boolean;
  readonly loop: boolean;
  readonly provenance: ExperienceIrAssetProvenance;
}

interface ExperienceIrColliderBase {
  readonly semanticRole: "COLLIDER";
  readonly colliderId: string;
  readonly trigger: boolean;
}

export type ExperienceIrCollider = ExperienceIrColliderBase & (
  | {
    readonly shape: "BOX";
    readonly halfExtentsMeters: readonly [number, number, number];
    readonly radiusMeters?: never;
    readonly heightMeters?: never;
  }
  | {
    readonly shape: "SPHERE";
    readonly radiusMeters: number;
    readonly halfExtentsMeters?: never;
    readonly heightMeters?: never;
  }
  | {
    readonly shape: "CAPSULE";
    readonly radiusMeters: number;
    readonly heightMeters: number;
    readonly halfExtentsMeters?: never;
  }
);

export interface ExperienceIrPhysics extends ExperienceIrNodeBase<"PHYSICS"> {
  readonly ownerEntityId: ExperienceIrSemanticId;
  readonly bodyType: "STATIC" | "KINEMATIC" | "DYNAMIC";
  readonly massKilograms: number;
  readonly collider: ExperienceIrJsonObject;
  readonly colliders?: readonly ExperienceIrCollider[];
}

export interface ExperienceIrConstraint extends ExperienceIrNodeBase<"CONSTRAINT"> {
  readonly constraintType: string;
  readonly sourceId: ExperienceIrSemanticId;
  readonly targetId: ExperienceIrSemanticId;
  readonly parameters: ExperienceIrJsonObject;
}

export interface ExperienceIrAnimation extends ExperienceIrNodeBase<"ANIMATION"> {
  readonly targetIds: readonly ExperienceIrSemanticId[];
  readonly durationSeconds: number;
  readonly provenance: ExperienceIrAssetProvenance;
}

export interface ExperienceIrEmitter {
  readonly semanticRole: "EMITTER";
  readonly emitterId: string;
  readonly ratePerSecond: number;
  readonly maxParticles: number;
  readonly enabled: boolean;
}

export interface ExperienceIrVfx extends ExperienceIrNodeBase<"VFX"> {
  readonly ownerEntityId?: ExperienceIrSemanticId;
  readonly materialIds: readonly ExperienceIrSemanticId[];
  readonly provenance: ExperienceIrAssetProvenance;
  readonly emitters?: readonly ExperienceIrEmitter[];
}

export interface ExperienceIrTimelineClip {
  readonly semanticRole: "CLIP";
  readonly clipId: string;
  readonly targetId: ExperienceIrSemanticId;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface ExperienceIrTimelineEvent {
  readonly semanticRole: "EVENT";
  readonly eventId: string;
  readonly eventType: string;
  readonly atSeconds: number;
  readonly payload: ExperienceIrJsonObject;
}

export interface ExperienceIrTimelineTrack {
  readonly semanticRole?: "TRACK";
  readonly trackId: string;
  readonly trackType?: "ANIMATION" | "AUDIO" | "VFX" | "EVENT" | "GAME_STATE" | "CUSTOM";
  readonly targetId: ExperienceIrSemanticId;
  readonly keyframes: readonly { readonly atSeconds: number; readonly value: ExperienceIrJsonValue }[];
  readonly clips?: readonly ExperienceIrTimelineClip[];
  readonly events?: readonly ExperienceIrTimelineEvent[];
}

export interface ExperienceIrTimeline extends ExperienceIrNodeBase<"TIMELINE"> {
  readonly durationSeconds: number;
  readonly tracks: readonly ExperienceIrTimelineTrack[];
}

export interface ExperienceIrInput extends ExperienceIrNodeBase<"INPUT"> {
  readonly contextEntityId?: ExperienceIrSemanticId;
  readonly actions: readonly { readonly actionId: string; readonly bindings: readonly string[] }[];
}

export interface ExperienceIrSave extends ExperienceIrNodeBase<"SAVE"> {
  readonly semanticRole?: "GAME_STATE";
  readonly strategy: "SNAPSHOT" | "EVENT_LOG" | "HYBRID";
  readonly schemaRevision: string;
  readonly stateSemanticIds: readonly ExperienceIrSemanticId[];
}

export interface ExperienceIrNetwork extends ExperienceIrNodeBase<"NETWORK"> {
  readonly mode: "OFFLINE" | "CLIENT_SERVER" | "PEER_TO_PEER" | "LOCKSTEP";
  readonly authority: "NONE" | "SERVER" | "OWNER" | "DISTRIBUTED";
  readonly replicatedSemanticIds: readonly ExperienceIrSemanticId[];
  readonly tickRateHz: number;
}

export interface ExperienceIrBuild extends ExperienceIrNodeBase<"BUILD"> {
  readonly target: string;
  readonly entrySceneId: ExperienceIrSemanticId;
  readonly assetIds: readonly ExperienceIrSemanticId[];
  readonly options: ExperienceIrJsonObject;
}

export type ExperienceIrNode =
  | ExperienceIrProject | ExperienceIrWorld | ExperienceIrScene | ExperienceIrEntity
  | ExperienceIrComponent | ExperienceIrTransform | ExperienceIrCamera | ExperienceIrLight
  | ExperienceIrMaterial | ExperienceIrTexture | ExperienceIrAudio | ExperienceIrPhysics
  | ExperienceIrConstraint | ExperienceIrAnimation | ExperienceIrVfx | ExperienceIrTimeline
  | ExperienceIrInput | ExperienceIrSave | ExperienceIrNetwork | ExperienceIrBuild;

export interface ExperienceIrDocumentV1 {
  readonly schemaVersion: "sema.experience-ir/v1";
  readonly revision: string;
  readonly coordinateSystem: ExperienceIrCoordinateSystem;
  readonly serialization: ExperienceIrSerializationV1;
  readonly project: ExperienceIrProject;
  readonly worlds: readonly ExperienceIrWorld[];
  readonly scenes: readonly ExperienceIrScene[];
  readonly entities: readonly ExperienceIrEntity[];
  readonly components: readonly ExperienceIrComponent[];
  readonly transforms: readonly ExperienceIrTransform[];
  readonly cameras: readonly ExperienceIrCamera[];
  readonly lights: readonly ExperienceIrLight[];
  readonly materials: readonly ExperienceIrMaterial[];
  readonly textures: readonly ExperienceIrTexture[];
  readonly audio: readonly ExperienceIrAudio[];
  readonly physics: readonly ExperienceIrPhysics[];
  readonly constraints: readonly ExperienceIrConstraint[];
  readonly animations: readonly ExperienceIrAnimation[];
  readonly vfx: readonly ExperienceIrVfx[];
  readonly timelines: readonly ExperienceIrTimeline[];
  readonly inputs: readonly ExperienceIrInput[];
  readonly saves: readonly ExperienceIrSave[];
  readonly networks: readonly ExperienceIrNetwork[];
  readonly builds: readonly ExperienceIrBuild[];
  readonly extensions?: ExperienceIrExtensions;
}

export interface ExperienceIrIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ExperienceIrBoundary {
  readonly executed: false;
  readonly workspaceMutated: false;
  readonly authoritative: false;
}

export interface ExperienceIrValidationResult extends ExperienceIrBoundary {
  readonly sucesso: true;
  readonly valido: boolean;
  readonly documentDigest: ExperienceIrSha256 | null;
  readonly issues: readonly ExperienceIrIssue[];
}

export interface ExperienceIrIndexEntry {
  readonly semanticId: ExperienceIrSemanticId;
  readonly kind: ExperienceIrKind;
  readonly semanticRoles: readonly ExperienceIrSemanticRole[];
  readonly path: string;
  readonly contentDigest: ExperienceIrSha256;
  readonly references: readonly ExperienceIrSemanticId[];
}

export interface ExperienceIrIndexPartition {
  readonly prefix: string;
  readonly entryCount: number;
  readonly contentDigest: ExperienceIrSha256;
}

export interface ExperienceIrIndex {
  readonly schemaVersion: "sema.experience-ir.index/v1";
  readonly documentDigest: ExperienceIrSha256;
  readonly entries: readonly ExperienceIrIndexEntry[];
  readonly partitions: readonly ExperienceIrIndexPartition[];
  readonly authoritative: false;
}

export interface ExperienceIrIndexResult extends ExperienceIrBoundary {
  readonly sucesso: boolean;
  readonly indice: ExperienceIrIndex | null;
  readonly issues: readonly ExperienceIrIssue[];
}

export interface ExperienceIrIndexQueryResult extends ExperienceIrBoundary {
  readonly sucesso: true;
  readonly encontrado: boolean;
  readonly entry: ExperienceIrIndexEntry | null;
}

export interface ExperienceIrChunkEntry {
  readonly semanticId: ExperienceIrSemanticId;
  readonly kind: ExperienceIrKind;
  readonly semanticRoles: readonly ExperienceIrSemanticRole[];
  readonly contentDigest: ExperienceIrSha256;
  readonly value: ExperienceIrNode;
}

export interface ExperienceIrChunk {
  readonly schemaVersion: "sema.experience-ir.chunk/v1";
  readonly chunkDigest: ExperienceIrSha256;
  readonly documentDigest: ExperienceIrSha256;
  readonly requestedSemanticIdDigests: readonly ExperienceIrSha256[];
  readonly entries: readonly ExperienceIrChunkEntry[];
  readonly externalReferences: readonly ExperienceIrSemanticId[];
  readonly authoritative: false;
}

export interface ExperienceIrChunkResult extends ExperienceIrBoundary {
  readonly sucesso: boolean;
  readonly chunk: ExperienceIrChunk | null;
  readonly issues: readonly ExperienceIrIssue[];
}

export interface ExperienceIrSerializationDescriptorResult extends ExperienceIrBoundary {
  readonly sucesso: boolean;
  readonly descriptor: ({
    readonly schemaVersion: "sema.experience-ir.serialization/v1";
    readonly json: ExperienceIrSerializationV1["json"] & { readonly native: true };
    readonly cbor: ExperienceIrSerializationV1["cbor"] & {
      readonly support: "EXTERNAL";
      readonly installed: false;
    };
    readonly semanticRoles: ExperienceIrSemanticRoleSchema;
  }) | null;
  readonly issues: readonly ExperienceIrIssue[];
}
