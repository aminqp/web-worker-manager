//TIP With Search Everywhere, you can find any action, file, or symbol in your project. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/>, type in <b>terminal</b>, and press <shortcut actionId="EditorEnter"/>. Then run <shortcut raw="npm run dev"/> in the terminal and click the link in its output to open the app in the browser.

import initiator from './workers/initiator.ts';
import expensiveComputation1 from './examples/expensive-computation-1.ts';
import { MainWorkerFactory, WorkerConfig } from './tools';

function setupWorkers(workers: WorkerConfig[]) {
  const foreman = new MainWorkerFactory(initiator, { workers });

  console.log(foreman);

  return { foreman };
}

const { foreman } = setupWorkers([
  {
    name: 'exp1',
    role: 'computation',
    func: expensiveComputation1,
    retries: 3,
    // maxConcurrency: navigator.hardwareConcurrency,
  },
]);

const btn = document.getElementById('increaseByOne')!;

btn.onclick = () => {
  const begin = performance.now();
  console.log(`\n\n<<<<< THREAD IS STARTED  >>>>> =>  -> `);

  foreman.runWorker('exp1', { seconds: 10 }).then((res) => {
    console.log(`\n\n<<<<< btn.onclick  >>>>> => res -> `, res);
    console.log(
      `\n\n<<<<<  THREAD IS FINISHED IN >>>>> =>  -> `,
      performance.now() - begin,
      'ms',
    );
  });
};
