import {
  MainWorkerFactoryOptions,
  MainWorkerFactoryWorker,
  WorkerFunction,
  WorkerInstanceConfig,
  WorkerResult,
} from './types.ts';
import { WorkerFactory } from '../worker-factory';

enum RESULT_STATUS {
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

const threadHasError = function () {
  let seconds = 5;
  seconds *= Math.random() + 0.5;
  let start = new Date();
  while ((new Date().valueOf() - start.valueOf()) / 1000 < seconds);

  throw new Error('someErrorThread');
};

class MainWorkerFactory {
  private readonly _worker: Worker;
  private readonly _workers: MainWorkerFactoryOptions['workers'];
  private _activeWorkers: MainWorkerFactoryWorker[] = [];
  private _workersResult: unknown[] = [];
  private readonly _threads: number;

  constructor(workerFunction: any, options: MainWorkerFactoryOptions) {
    const workerCode: string = workerFunction.toString();
    const workerBlob = new Blob([`(${workerCode})()`], {
      type: 'application/javascript',
    });

    this._workers = options.workers;
    this._worker = new Worker(URL.createObjectURL(workerBlob));

    this._threads = navigator.hardwareConcurrency;
  }

  initWorkers() {
    this._activeWorkers = this._workers.map((worker) => ({
      ...worker,
      worker: new WorkerFactory(worker.func),
    }));
  }

  initWorker(workerFunction: WorkerFunction) {
    return new WorkerFactory(workerFunction);
  }

  runWorker(workerName: string, data: unknown) {
    return new Promise((resolve, reject) => {
      const foundWorker = this._workers.find(
        (worker) => worker.name === workerName,
      );

      if (!foundWorker) {
        reject(new Error(`Worker ${workerName} not found`));

        throw new Error(`Worker ${workerName} not found`);
      }

      const threads = foundWorker.maxConcurrency || this._threads;

      const preparedWorkers = Array(threads)
        .fill(0)
        .map((_, index) => {
          return this.runWorkerWithRetry(
            {
              workerFunc: foundWorker.func,
              workerName,
              index,
              data,
            },
            foundWorker.retries,
          );
        });

      Promise.allSettled(preparedWorkers).then((res) => {
        resolve(res);
      });
    });
  }

  runWorkerWithRetry(
    workerConfigs: WorkerInstanceConfig,
    retryCount = 2,
  ): Promise<WorkerResult> {
    return this.initiateWorker(workerConfigs)
      .then((result: WorkerResult) => {
        return Promise.resolve(result);
      })
      .catch((error) => {
        if (retryCount > 0) {
          console.error(
            `Worker ${workerConfigs.index} failed, retrying (${retryCount} attempts remaining):`,
            error,
          );
          return this.runWorkerWithRetry(
            {
              ...workerConfigs,
              index:
                workerConfigs.index === 3
                  ? workerConfigs.index - 1
                  : workerConfigs.index,
            },
            retryCount - 1,
          );
        } else {
          console.error(`Worker failed after multiple retries:`, error);
          return Promise.reject(error); // Re-throw the error after exhausting retries
        }
      });
  }

  initiateWorker({
    workerFunc,
    workerName,
    index,
    data,
  }: WorkerInstanceConfig): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      // let worker = this.initWorker(workerFunc);

      let worker =
        index % 2 === 0
          ? this.initWorker(workerFunc)
          : this.initWorker(threadHasError);

      // TODO-qp:: handle failed threads
      worker.getWorker.onerror = (event) => {
        console.log(
          `\n\n<<<<<  worker.getWorker.onerror >>>>> => event -> `,
          index,
          event,
        );
        worker.getWorker.terminate();

        console.log(
          `\n\n<<<<<  worker.getWorker.onerror >>>>> => worker -> `,
          worker,
        );
        reject({
          index,
          workerConfigs: {
            workerFunc,
            workerName,
            index,
            data,
          },
          failedResult: event,
        });
      };

      worker.getWorker.onmessage = (event) => {
        console.log(
          index,
          `Worker ${workerName} finished with result: ${event.data}`,
        );
        // this.catchResult({
        //   workerResult: event.data,
        //   index,
        //   resolve,
        // });

        resolve({
          index,
          workerConfigs: {
            workerFunc,
            workerName,
            index,
            data,
          },
          successResult: event,
        });
        worker.getWorker.terminate();
      };

      worker.getWorker.postMessage({ index, ...data });
    });
  }

  catchResult({
    workerResult,
    index,
    resolve,
  }: {
    workerResult: unknown;
    index: number;
    resolve: (value: unknown) => void;
  }) {
    this._workersResult[index] = workerResult;

    if (this._workersResult.length === this._threads) {
      console.log(`\n\n<<<<< IS FINISHED  >>>>> =>  -> `);
      resolve(this._workersResult);
    }
  }

  get getWorker() {
    return this._worker;
  }
}

export default MainWorkerFactory;
