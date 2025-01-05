import {
  MainWorkerFactoryOptions,
  MainWorkerFactoryWorker,
  WorkerFunction,
  WorkerName,
} from './types.ts';
import { WorkerFactory } from '../worker-factory';

const threadHasError =  function () {
  let seconds = 5
  seconds *= Math.random() + 0.5;
  let start = new Date();
  while (((new Date()).valueOf() - start.valueOf()) / 1000 < seconds);

  throw new Error('someErrorThread');
};

class MainWorkerFactory {
  private readonly _worker: Worker;
  private readonly _workers: MainWorkerFactoryOptions['workers'];
  private _activeWorkers: MainWorkerFactoryWorker[] = [];
  private _workersResult: unknown[] = [];
  private _threads: number;

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

      this._threads =
        foundWorker.maxConcurrency || navigator.hardwareConcurrency;

      const res = Promise.allSettled(
        Array(this._threads)
          .fill(0)
          .map((_, index) => {
            return this.initiateWorker({
              workerFunc: foundWorker.func,
              workerName,
              index,
              data,
            });
          }),
      ).catch((err) => {
        console.log(`\n\n<<<<<  runWorker  >>>>> => err -> `, err);
        reject(err);
      });

      console.log(`\n\n<<<<< runWorker  >>>>> => res -> `, res);

      resolve(res);
    });
  }

  initiateWorker({
    workerFunc,
    workerName,
    index,
    data,
  }: {
    workerName: WorkerName;
    workerFunc: WorkerFunction;
    index: number;
    data: any;
  }) {
    return new Promise((resolve, reject) => {
      // let worker = this.initWorker(workerFunc);

      let worker =
        index % 2 !== 0
          ? this.initWorker(workerFunc)
          : this.initWorker(threadHasError);

      // TODO-qp:: handle failed threads
      worker.getWorker.onerror = (event) => {
        console.log(
          `\n\n<<<<<  worker.getWorker.onerror >>>>> => event -> `,index,
          event,
        );
        worker.getWorker.terminate();

        console.log(
          `\n\n<<<<<  worker.getWorker.onerror >>>>> => worker -> `,
          worker,
        );
        reject(event);
      };

      worker.getWorker.onmessage = (event) => {
        console.log(index,`Worker ${workerName} finished with result: ${event.data}`);
        // this.catchResult({
        //   workerResult: event.data,
        //   index,
        //   resolve,
        // });

        resolve(event.data);
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
