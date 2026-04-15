import { WorkerFactory } from '../worker-factory';

export type WorkerName = string;
export type WorkerRole = string;
export type WorkerFunction = (...params: unknown[]) => void;

export interface WorkerConfig {
  name: WorkerName;
  role: WorkerRole;
  func: WorkerFunction;
  maxConcurrency?: number;
  retries?: number;
  partition?: boolean;
}

export interface MainWorkerFactoryOptions {
  workers: WorkerConfig[];
}

export interface MainWorkerFactoryWorker extends WorkerConfig {
  worker: WorkerFactory;
}

export interface WorkerInstanceConfig {
  workerName: WorkerName;
  workerFunc: WorkerFunction;
  index: number;
  data: unknown;
}

export type WorkerSuccessResult = MessageEvent;
export type WorkerFailedResult = MessageEvent;
export interface WorkerResult {
  index: number;
  workerConfigs: WorkerInstanceConfig;
  successResult?: WorkerSuccessResult;
  failedResult?: WorkerFailedResult;
}

/** Options for collectResults */
export interface CollectOptions<T, R = T[]> {
  /**
   * Custom reducer applied to the array of fulfilled shard values.
   * Runs inside a worker — must be self-contained (no external references).
   * Defaults to a flat array of all shard data values.
   *
   * @example
   * // sum all numbers across shards
   * reducer: (shards) => shards.flat().reduce((a, b) => a + b, 0)
   */
  reducer?: (shards: T[]) => R;
}

/** Result returned by collectResults */
export interface CollectedResult<R> {
  /** The merged output produced by the reducer */
  data: R;
  /** Number of shards that succeeded */
  succeeded: number;
  /** Number of shards that failed (after all retries) */
  failed: number;
  /** Raw rejected results, if any */
  errors: PromiseRejectedResult[];
}
