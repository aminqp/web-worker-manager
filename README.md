# web-worker-manager

A lightweight TypeScript utility for running CPU-intensive functions off the main thread using the Web Workers API — with built-in support for concurrency, data partitioning, automatic retries, and zero-copy `Transferable` transfers.

---

## Why

JavaScript is single-threaded. Heavy computation — matrix math, image processing, log analysis, batch jobs — blocks the main thread and freezes the UI. Web Workers solve this, but the raw API is verbose and error-prone to manage at scale.

`MainWorkerFactory` wraps that complexity:

- define your functions once as plain TypeScript
- register them as named workers with a concurrency and retry policy
- call `foreman.runWorker(name, data)` from anywhere — results come back as a settled `Promise`
- the UI stays responsive throughout

---

## How it works

```
┌─────────────────────────────────────────────────────┐
│  Main Thread                                        │
│                                                     │
│  foreman.runWorker('myTask', { srcData: [...] })    │
│       │                                             │
│       ▼                                             │
│  MainWorkerFactory                                  │
│  ├─ partitions data into N chunks (if partition:true)│
│  ├─ spawns N WorkerFactory instances                │
│  ├─ postMessage (Transferable where possible)       │
│  └─ Promise.allSettled → returns all results        │
│                                                     │
│  Worker 1 │ Worker 2 │ … │ Worker N  (parallel)    │
│  fn(chunk)│ fn(chunk)│   │ fn(chunk)               │
└─────────────────────────────────────────────────────┘
```

Each worker is a self-contained `Blob` URL — no separate worker files needed. The function you register is serialised via `.toString()` and injected into the worker template at runtime.

---

## Installation

```bash
pnpm install   # or npm install / yarn
```

---

## Quick start

```ts
import { MainWorkerFactory } from './src/tools';
import initiator from './src/workers/initiator';

// 1. Define your CPU-bound function
function processChunk({ data }: { data: number[] }): number[] {
  return data.map(n => n * 2);
}

// 2. Register it as a named worker
const foreman = new MainWorkerFactory(initiator, {
  workers: [
    {
      name: 'processChunk',
      role: 'computation',
      func: processChunk,
      partition: true,      // split srcData across workers
      maxConcurrency: 4,    // spawn up to 4 parallel workers
      retries: 2,           // retry failed workers up to 2 times
    },
  ],
});

// 3. Call it — the main thread is never blocked
const results = await foreman.runWorker('processChunk', {
  srcData: [1, 2, 3, 4, 5, 6, 7, 8],
});

// 4. Collect results from all settled shards
const output = results
  .filter(r => r.status === 'fulfilled')
  .flatMap(r => r.value.successResult.data);

console.log(output); // [2, 4, 6, 8, 10, 12, 14, 16]
```

---

## Worker function signature

Every function registered with `MainWorkerFactory` receives its arguments wrapped in a `data` envelope:

```ts
// What you pass:
foreman.runWorker('myTask', { srcData: { foo: 'bar' } })

// What your function receives:
function myTask({ data }: { data: { foo: string } }) {
  // data === { foo: 'bar' }
}
```

When `partition: true` and `srcData` is an array with more than one element, each worker receives one chunk:

```ts
// srcData = [a, b, c, d], maxConcurrency = 2
// Worker 1 receives: { data: [a, b] }
// Worker 2 receives: { data: [c, d] }

function myTask({ data }: { data: string[] }) {
  // data is the chunk assigned to this worker
}
```

> **Important:** functions are serialised via `.toString()` — they must be self-contained. No closures over external variables, no imports inside the function body.

---

## `WorkerConfig` options

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | required | Unique identifier used in `runWorker()` |
| `role` | `string` | required | Descriptive role label |
| `func` | `WorkerFunction` | required | The function to run in the worker |
| `maxConcurrency` | `number` | `navigator.hardwareConcurrency` | Max parallel worker instances |
| `partition` | `boolean` | `false` | Split array `srcData` across workers |
| `retries` | `number` | `2` | Retry count per worker on failure |

---

## `runWorker` API

```ts
foreman.runWorker(
  workerName: string,
  { srcData, ...otherParams }: { srcData: unknown } & Record<string, unknown>
): Promise<PromiseSettledResult<WorkerResult>[]>
```

- `srcData` — the primary data payload. If `partition: true` and it's an array with length > 1, it is split across workers.
- `...otherParams` — any additional params (e.g. `options`, `count`) are forwarded to every worker alongside the data chunk.
- Returns `Promise.allSettled` — fulfilled and rejected results are both present, so partial failures never throw.

### Result shape

```ts
// Fulfilled shard
result.status === 'fulfilled'
result.value.index           // shard index (0-based)
result.value.successResult.data  // return value of your function

// Rejected shard (after all retries exhausted)
result.status === 'rejected'
result.reason.index
result.reason.failedResult   // the ErrorEvent from the worker
```

---

## Transferable support

Large `ArrayBuffer` and typed array payloads are automatically transferred (zero-copy) rather than cloned — both from main thread to worker and back. This eliminates serialisation overhead for binary data like image buffers.

No changes needed in your code — `extractTransferables` runs automatically on every `postMessage` call.

---

## Partitioning

When `partition: true`, `MainWorkerFactory` splits the input array into up to `maxConcurrency` evenly-sized chunks before dispatching:

```
srcData = [1..100], maxConcurrency = 4
→ Worker 0: [1..25]
→ Worker 1: [26..50]
→ Worker 2: [51..75]
→ Worker 3: [76..100]
```

Remainder elements are distributed across the leading chunks so no worker is idle.

Partitioning is skipped when:
- `srcData` is not an array
- `srcData` has only one element
- `partition` is `false` or unset

---

## Error handling and retries

Each worker shard is retried independently up to `retries` times on failure. `runWorker` always resolves (never rejects) — use `Promise.allSettled` semantics to inspect each shard:

```ts
const results = await foreman.runWorker('myTask', { srcData: items });

const succeeded = results.filter(r => r.status === 'fulfilled');
const failed    = results.filter(r => r.status === 'rejected');

console.log(`${succeeded.length} shards OK, ${failed.length} failed`);
```

Set `retries: 0` to surface failures immediately without retrying (useful for intentional partial-result scenarios).

---

## Running the demo

```bash
pnpm dev
```

Open `http://localhost:5173`. The demo page includes 10 interactive cards covering:

| Card | Demonstrates |
|---|---|
| Benchmark | Main thread vs workers side-by-side with speedup ratio |
| Expensive Computation | Single long-running task, UI stays responsive |
| Generate Random Data | High-concurrency data generation (13 workers) |
| Transform Array | Two-stage pipeline with partitioning |
| Large List Transform | Structured record normalisation at scale |
| Image Processing | Binary data pipeline with Transferable buffers |
| Server Log Analyser | 500 000 entries partitioned across 8 workers |
| Concurrent Batch Jobs | Long-delayed tasks running in parallel |
| Flaky Tasks + Auto-Retry | Transient failures with automatic retry |
| Distributed Search | Partial results when some shards fail |

---

## Running tests

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
```

Tests cover `WorkerFactory`, `MainWorkerFactory` (partitioning, concurrency, retries, error handling), and the `initiator` worker.

---

## Project structure

```
src/
├── tools/
│   ├── main-worker-factory/   # MainWorkerFactory class + types
│   └── worker-factory/        # WorkerFactory (blob worker wrapper)
├── workers/
│   └── initiator.ts           # Worker bootstrap function
├── examples/                  # Demo worker functions
└── main.ts                    # Demo app entry point
```

---

## License

MIT
