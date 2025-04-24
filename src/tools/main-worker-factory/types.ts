import { WorkerFactory } from '../worker-factory';

export type WorkerName = string;
export type WorkerRole = string;
export type WorkerFunction = (...params: any[]) => void;

export interface WorkerConfig {
  name: WorkerName;
  role: WorkerRole;
  func: WorkerFunction;
  maxConcurrency?: number
  retries?: number
  partition?: boolean
};

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
  data: any;
}

export type WorkerSuccessResult = MessageEvent;
export type WorkerFailedResult = MessageEvent;
export interface WorkerResult {
  index: number,
  workerConfigs: WorkerInstanceConfig,
  successResult?: WorkerSuccessResult,
  failedResult?: WorkerFailedResult,
}
