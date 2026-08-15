// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao.orquestracao_jobs
// Descricao: planejamento deterministico de filas, locks, budgets, heartbeat, checkpoint e retomada.

import {
  JOB_ORCHESTRATION_SCHEMA_V1,
  type JobOrchestrationPlanV1,
  type JobOrchestrationRequestV1,
  type OperationIssue,
  type OperationResult,
  type ResourceLock,
} from "./operationsTypes.js";
import {
  digestJsonOperacional,
  failure,
  hasOnlyKeys,
  inspectPlainJson,
  isIntegerIn,
  isOpaqueSha256,
  isRecord,
  isSafeName,
  isSemanticId,
  isSha256,
  isVersion,
  issue,
  success,
} from "./operationPrimitives.js";

const RESOURCE_LOCKS: readonly ResourceLock[] = ["GPU", "EDITOR", "CACHE"];
function validateBudget(value: unknown, field: string, issues: OperationIssue[]): value is {
  ramMb: number; vramMb: number; diskMb: number;
} {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["ramMb", "vramMb", "diskMb"])
    || !isIntegerIn(value.ramMb, 1, 16_777_216)
    || !isIntegerIn(value.vramMb, 0, 16_777_216)
    || !isIntegerIn(value.diskMb, 1, 1_073_741_824)) {
    issues.push(issue("resource_budget_invalid", field));
    return false;
  }
  return true;
}

export function planejarOrquestracaoJobs(input: unknown): OperationResult<JobOrchestrationPlanV1> {
  const issues = inspectPlainJson(input, "jobRequest");
  if (!isRecord(input)) return failure([...issues, issue("job_request_object_required", "jobRequest")]);
  if (!hasOnlyKeys(input, ["schemaVersion", "queueId", "capacity", "lockCapacity", "jobs"])) {
    issues.push(issue("job_request_unknown_field", "jobRequest"));
  }
  if (input.schemaVersion !== JOB_ORCHESTRATION_SCHEMA_V1) issues.push(issue("job_schema_invalid", "schemaVersion"));
  if (!isSemanticId(input.queueId)) issues.push(issue("queue_id_invalid", "queueId"));
  const capacity = input.capacity;
  const capacityValid = validateBudget(capacity, "capacity", issues);
  const lockCapacity = input.lockCapacity;
  if (!isRecord(lockCapacity)
    || !hasOnlyKeys(lockCapacity, RESOURCE_LOCKS)
    || !RESOURCE_LOCKS.every((lock) => isIntegerIn(lockCapacity[lock], 0, 1))) {
    issues.push(issue("lock_capacity_invalid", "lockCapacity"));
  }

  const jobs = input.jobs;
  const ids = new Set<string>();
  if (!Array.isArray(jobs) || jobs.length === 0) {
    issues.push(issue("jobs_required", "jobs"));
  } else {
    for (const job of jobs) {
      if (!isRecord(job) || !hasOnlyKeys(job, [
        "jobId", "kind", "priority", "dependencies", "locks", "budget",
        "heartbeat", "checkpoint", "adapter",
      ])) {
        issues.push(issue("job_invalid", "jobs"));
        continue;
      }
      if (!isSemanticId(job.jobId)) issues.push(issue("job_id_invalid", "jobs"));
      else if (ids.has(job.jobId)) issues.push(issue("job_id_duplicate", "jobs"));
      else ids.add(job.jobId);
      if (!isSafeName(job.kind)) issues.push(issue("job_kind_invalid", "jobs"));
      if (!isIntegerIn(job.priority, 0, 100)) issues.push(issue("job_priority_invalid", "jobs"));
      if (!Array.isArray(job.dependencies)
        || job.dependencies.some((dependency) => !isSemanticId(dependency))
        || new Set(job.dependencies).size !== job.dependencies.length
        || job.dependencies.includes(job.jobId)) issues.push(issue("job_dependencies_invalid", "jobs"));
      if (!Array.isArray(job.locks)
        || job.locks.some((lock) => typeof lock !== "string" || !RESOURCE_LOCKS.includes(lock as ResourceLock))
        || new Set(job.locks).size !== job.locks.length) issues.push(issue("job_locks_invalid", "jobs"));
      const budget = job.budget;
      const budgetValid = validateBudget(budget, "jobs", issues);
      if (budgetValid && capacityValid
        && (budget.ramMb > capacity.ramMb
          || budget.vramMb > capacity.vramMb
          || budget.diskMb > capacity.diskMb)) issues.push(issue("job_budget_exceeds_capacity", "jobs"));
      if (Array.isArray(job.locks) && isRecord(lockCapacity)) {
        for (const lock of job.locks) {
          if (typeof lock === "string"
            && RESOURCE_LOCKS.includes(lock as ResourceLock)
            && lockCapacity[lock] !== 1) issues.push(issue("job_lock_unavailable", "jobs"));
        }
        if (job.locks.includes("GPU") && isRecord(job.budget) && job.budget.vramMb === 0) {
          issues.push(issue("gpu_job_requires_vram", "jobs"));
        }
      }
      if (!isRecord(job.heartbeat)
        || !hasOnlyKeys(job.heartbeat, ["intervalMs", "timeoutMs"])
        || !isIntegerIn(job.heartbeat.intervalMs, 100, 86_400_000)
        || !isIntegerIn(job.heartbeat.timeoutMs, 100, 86_400_000)
        || (typeof job.heartbeat.intervalMs === "number"
          && typeof job.heartbeat.timeoutMs === "number"
          && job.heartbeat.timeoutMs < job.heartbeat.intervalMs * 2)) issues.push(issue("job_heartbeat_invalid", "jobs"));
      if (!isRecord(job.checkpoint)
        || !hasOnlyKeys(job.checkpoint, ["intervalMs", "resume", "checkpointDigest", "recoveryToken"])
        || !isIntegerIn(job.checkpoint.intervalMs, 100, 86_400_000)
        || typeof job.checkpoint.resume !== "boolean"
        || !isOpaqueSha256(job.checkpoint.recoveryToken)
        || (job.checkpoint.checkpointDigest !== undefined && !isSha256(job.checkpoint.checkpointDigest))
        || (job.checkpoint.resume === true && !isSha256(job.checkpoint.checkpointDigest))) {
        issues.push(issue("job_checkpoint_invalid", "jobs"));
      }
      if (!isRecord(job.adapter)
        || !hasOnlyKeys(job.adapter, ["adapterId", "adapterVersion"])
        || !isSafeName(job.adapter.adapterId)
        || !isVersion(job.adapter.adapterVersion)) issues.push(issue("job_adapter_invalid", "jobs"));
    }
    for (const job of jobs) {
      if (!isRecord(job) || !Array.isArray(job.dependencies)) continue;
      for (const dependency of job.dependencies) {
        if (typeof dependency === "string" && !ids.has(dependency)) issues.push(issue("job_dependency_missing", "jobs"));
      }
    }
  }
  if (issues.length > 0) return failure(issues);
  const request = input as unknown as JobOrchestrationRequestV1;
  const byId = new Map(request.jobs.map((job) => [job.jobId, job]));
  const indegree = new Map(request.jobs.map((job) => [job.jobId, job.dependencies.length]));
  const dependents = new Map<string, string[]>();
  for (const job of request.jobs) for (const dependency of job.dependencies) {
    const list = dependents.get(dependency) ?? [];
    list.push(job.jobId);
    dependents.set(dependency, list);
  }
  const compareJobs = (leftId: string, rightId: string): number => {
    const left = byId.get(leftId)!;
    const right = byId.get(rightId)!;
    return right.priority - left.priority || left.jobId.localeCompare(right.jobId);
  };
  const ready = request.jobs.filter((job) => job.dependencies.length === 0)
    .map((job) => job.jobId).sort(compareJobs);
  const ordered: JobOrchestrationRequestV1["jobs"][number][] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    ordered.push(byId.get(id)!);
    for (const dependent of (dependents.get(id) ?? []).sort()) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        ready.push(dependent);
        ready.sort(compareJobs);
      }
    }
  }
  if (ordered.length !== request.jobs.length) return failure([issue("job_dependency_cycle", "jobs")]);
  const normalizedRequest = {
    schemaVersion: request.schemaVersion,
    queueId: request.queueId,
    capacity: { ...request.capacity },
    lockCapacity: Object.fromEntries(RESOURCE_LOCKS.map((lock) => [lock, request.lockCapacity[lock]])),
    jobs: request.jobs.map((job) => ({
      jobId: job.jobId,
      kind: job.kind,
      priority: job.priority,
      dependencies: [...job.dependencies].sort(),
      locks: [...job.locks].sort((a, b) => RESOURCE_LOCKS.indexOf(a) - RESOURCE_LOCKS.indexOf(b)),
      budget: { ...job.budget },
      heartbeat: { ...job.heartbeat },
      checkpoint: {
        intervalMs: job.checkpoint.intervalMs,
        resume: job.checkpoint.resume,
        ...(job.checkpoint.checkpointDigest === undefined ? {} : { checkpointDigest: job.checkpoint.checkpointDigest }),
        recoveryToken: job.checkpoint.recoveryToken,
      },
      adapter: { ...job.adapter },
    })).sort((left, right) => left.jobId.localeCompare(right.jobId)),
  };
  const requestDigest = digestJsonOperacional(normalizedRequest);
  const queue = ordered.map((job, index) => ({
    position: index + 1,
    jobId: job.jobId,
    kind: job.kind,
    priority: job.priority,
    adapter: { ...job.adapter },
    dependencies: [...job.dependencies].sort(),
    locks: [...job.locks].sort((a, b) => RESOURCE_LOCKS.indexOf(a) - RESOURCE_LOCKS.indexOf(b)),
    budget: { ...job.budget },
    heartbeatIntervalMs: job.heartbeat.intervalMs,
    heartbeatTimeoutMs: job.heartbeat.timeoutMs,
    checkpointIntervalMs: job.checkpoint.intervalMs,
    resume: job.checkpoint.resume,
    ...(job.checkpoint.checkpointDigest === undefined ? {} : { checkpointDigest: job.checkpoint.checkpointDigest }),
    recoveryToken: job.checkpoint.recoveryToken,
  }));
  const withoutDigest = {
    schemaVersion: JOB_ORCHESTRATION_SCHEMA_V1,
    queueId: request.queueId,
    queue,
    requestDigest,
    externalRunnerRequired: true as const,
    resourcesReserved: false as const,
    authoritative: false as const,
  };
  const plan: JobOrchestrationPlanV1 = { ...withoutDigest, planDigest: digestJsonOperacional(withoutDigest) };
  return success(plan, plan.planDigest);
}
