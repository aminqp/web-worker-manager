import { WorkerFunction } from '../main-worker-factory/types';

const workerTemplate = (func: string) => `
const extractTransferables = (value, seen = new Set()) => {
  if (value === null || typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (value instanceof ArrayBuffer || value instanceof MessagePort ||
      (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) ||
      (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas)) {
    return [value];
  }
  if (ArrayBuffer.isView(value)) return [value.buffer];
  if (Array.isArray(value)) return value.flatMap(i => extractTransferables(i, seen));
  return Object.values(value).flatMap(v => extractTransferables(v, seen));
};

self.addEventListener('message', async (event) => {
    const begin = performance.now();
    const output = await ${func}(event.data);
    self.postMessage(output, extractTransferables(output));
  })
`;

class WorkerFactory {
  readonly _worker: Worker;
  constructor(workerFunction: WorkerFunction) {
    const workerCode: string = workerTemplate(workerFunction.toString());
    const workerBlob = new Blob([workerCode], {
      type: 'application/javascript',
    });

    this._worker = new Worker(URL.createObjectURL(workerBlob));
  }

  get getWorker() {
    return this._worker;
  }
}

export default WorkerFactory;
