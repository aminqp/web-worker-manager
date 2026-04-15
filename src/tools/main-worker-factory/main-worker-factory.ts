import {
  CollectOptions,
  CollectedResult,
  MainWorkerFactoryOptions,
  WorkerConfig,
  WorkerFunction,
  WorkerInstanceConfig,
  WorkerResult,
} from './types.ts';
import { WorkerFactory } from '../worker-factory';

/**
 * Recursively collects all Transferable objects from a value.
 * Transferables (ArrayBuffer, MessagePort, ImageBitmap, OffscreenCanvas)
 * are zero-copy — they are moved to the worker instead of cloned.
 */
export function extractTransferables(
  value: unknown,
  seen = new Set<object>(),
): Transferable[] {
  if (value === null || typeof value !== 'object') return [];
  if (seen.has(value as object)) return [];
  seen.add(value as object);

  if (
    value instanceof ArrayBuffer ||
    value instanceof MessagePort ||
    (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas)
  ) {
    return [value as Transferable];
  }

  if (ArrayBuffer.isView(value)) {
    return [value.buffer];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTransferables(item, seen));
  }

  return Object.values(value as object).flatMap((v) =>
    extractTransferables(v, seen),
  );
}

class MainWorkerFactory {
  private readonly _workers: WorkerConfig[];
  private readonly _threads: number;

  constructor(_initiator: WorkerFunction, options: MainWorkerFactoryOptions) {
    this._workers = options.workers;
    this._threads = navigator.hardwareConcurrency;
  }

  private initWorker(workerFunction: WorkerFunction): WorkerFactory {
    return new WorkerFactory(workerFunction);
  }

  /**
   * Partitions an array into up to numChunks evenly-sized chunks.
   */
  partitionArray<T>(array: T[], numChunks: number): T[][] {
    if (!array.length) return [];
    if (numChunks <= 0) throw new Error('numChunks must be positive');

    const chunks = Math.min(numChunks, array.length);
    const chunkSize = Math.floor(array.length / chunks);
    const remainder = array.length % chunks;
    const result: T[][] = [];
    let start = 0;

    for (let i = 0; i < chunks; i++) {
      const size = chunkSize + (i < remainder ? 1 : 0);
      result.push(array.slice(start, start + size));
      start += size;
    }

    return result;
  }

  private findWorkerByName(name: string): WorkerConfig | undefined {
    return this._workers.find((w) => w.name === name);
  }

  async runWorker(
    workerName: string,
    { srcData, ...otherParams }: { srcData: unknown } & Record<string, unknown>,
  ): Promise<PromiseSettledResult<WorkerResult>[]> {
    const config = this.findWorkerByName(workerName);
    if (!config)
      return Promise.reject(new Error(`Worker "${workerName}" not found`));

    const threadCount = config.maxConcurrency ?? this._threads;
    const shouldPartition = Boolean(
      Array.isArray(srcData) && srcData.length > 1 && config.partition,
    );

    const processedData = shouldPartition
      ? this.partitionArray(srcData as unknown[], threadCount)
      : srcData;

    const promises = this.createWorkerPromises(
      config,
      workerName,
      { data: processedData, ...otherParams },
      threadCount,
      shouldPartition,
    );

    return Promise.allSettled(promises);
  }

  private createWorkerPromises(
    config: WorkerConfig,
    workerName: string,
    srcWorkerData: { data: unknown } & Record<string, unknown>,
    threadCount: number,
    isPartitioned: boolean,
  ): Promise<WorkerResult>[] {
    const { data: srcData, ...otherParams } = srcWorkerData;

    return Array.from({ length: threadCount }, (_, index) => {
      const data =
        isPartitioned && Array.isArray(srcData) ? srcData[index] : srcData;
      return this.runWorkerWithRetry(
        {
          workerFunc: config.func,
          workerName,
          index,
          data: { data, ...otherParams },
        },
        config.retries,
      );
    });
  }

  private async runWorkerWithRetry(
    instanceConfig: WorkerInstanceConfig,
    retryCount = 2,
  ): Promise<WorkerResult> {
    try {
      return await this.initiateWorker(instanceConfig);
    } catch (error) {
      if (retryCount > 0) {
        console.error(
          `Worker ${instanceConfig.index} failed, retrying (${retryCount} left):`,
          error,
        );
        return this.runWorkerWithRetry(instanceConfig, retryCount - 1);
      }
      console.error(`Worker failed after all retries:`, error);
      throw error;
    }
  }

  private initiateWorker({
    workerFunc,
    workerName,
    index,
    data,
  }: WorkerInstanceConfig): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const worker = this.initWorker(workerFunc);
      const raw = worker.getWorker;

      raw.onerror = (event) => {
        raw.terminate();
        reject({
          index,
          workerConfigs: { workerFunc, workerName, index, data },
          failedResult: event,
        });
      };

      raw.onmessage = (event) => {
        resolve({
          index,
          workerConfigs: { workerFunc, workerName, index, data },
          successResult: event,
        });
        raw.terminate();
      };

      const payload = {
        index,
        ...(Array.isArray(data) ? { data } : (data as Record<string, unknown>)),
      };
      raw.postMessage(payload, extractTransferables(payload));
    });
  }

  /**
   * Collects and merges the settled results from `runWorker` — off the main thread.
   *
   * @param settled  The `PromiseSettledResult[]` returned by `runWorker`
   * @param options  Optional `reducer` function (must be self-contained)
   *
   * @example
   * // default: flat array of all shard data
   * const { data, succeeded, failed } = await foreman.collectResults(res);
   *
   * @example
   * // custom reducer: sum numbers across shards
   * const { data } = await foreman.collectResults<number[], number>(res, {
   *   reducer: (shards) => shards.flat().reduce((a, b) => a + b, 0),
   * });
   */
  async collectResults<T = unknown, R = T[]>(
    settled: PromiseSettledResult<WorkerResult>[],
    options: CollectOptions<T, R> = {},
  ): Promise<CollectedResult<R>> {
    const fulfilled = settled.filter(
      (r) => r.status === 'fulfilled',
    ) as PromiseFulfilledResult<WorkerResult>[];
    const errors = settled.filter(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult[];

    const shards = fulfilled.map((r) => r.value.successResult!.data as T);

    // Build a self-contained merge function for the worker
    const reducerSrc = options.reducer
      ? options.reducer.toString()
      : '(shards) => shards.flat()';

    const mergeResult = await new Promise<R>((resolve, reject) => {
      const workerSrc = `
        const reducer = ${reducerSrc};
        self.addEventListener('message', (event) => {
          try {
            const result = reducer(event.data);
            self.postMessage({ ok: true, data: result });
          } catch (err) {
            self.postMessage({ ok: false, error: String(err) });
          }
        });
      `;
      const blob = new Blob([workerSrc], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      worker.onmessage = (e) => {
        worker.terminate();
        if (e.data.ok) resolve(e.data.data);
        else reject(new Error(e.data.error));
      };
      worker.onerror = (e) => {
        worker.terminate();
        reject(e);
      };
      worker.postMessage(shards);
    });

    return {
      data: mergeResult,
      succeeded: fulfilled.length,
      failed: errors.length,
      errors,
    };
  }
}

export default MainWorkerFactory;
