# Web Worker Manager - Development Guidelines

This document provides essential information for developers working on the Web Worker Manager project.

## Build/Configuration Instructions

### Setup

1. This project uses pnpm as the package manager. If you don't have pnpm installed, you can install it with:
   ```bash
   npm install -g pnpm
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```
   This will start a Vite development server. Open the URL displayed in the terminal (typically http://localhost:5173) to view the application.

### Building for Production

To build the project for production:

```bash
pnpm build
```

This will:
- Compile TypeScript files
- Bundle the application with Vite
- Output the production-ready files to the `dist` directory

To preview the production build:

```bash
pnpm preview
```

## Testing Information

### Running Tests

The project uses Vitest for testing. To run tests:

```bash
# Run tests once
pnpm test

# Run tests in watch mode (for development)
pnpm test:watch
```

### Adding New Tests

1. Create test files in the `src/tests` directory
2. Name test files with the `.test.ts` extension (e.g., `feature-name.test.ts`)
3. Use the Vitest API for writing tests:

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../path/to/function';

describe('functionToTest', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'some input';
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

### Testing Web Workers

When testing functions that will be used in web workers:

1. Test the function directly without the worker wrapper
2. Mock any browser-specific APIs if needed
3. For testing the actual worker integration, consider using JSDOM environment

Example test for a worker function:

```typescript
import { describe, it, expect } from 'vitest';
import { transformArray, TransformOptions } from '../examples/list-transformer';

describe('transformArray', () => {
  it('should transform an array of numbers', () => {
    const data = [1, 2, 3, 4, 5];
    const options: TransformOptions = {
      multiplier: 2,
      round: true
    };
    
    const result = transformArray({ data, index: 0, options });
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(data.length);
  });
});
```

## Additional Development Information

### Project Structure

- `src/`: Source code
  - `examples/`: Example implementations of worker functions
  - `tools/`: Core utilities for the web worker manager
    - `main-worker-factory/`: Factory for creating and managing workers
    - `worker-factory/`: Base worker factory implementation
  - `workers/`: Worker initialization code
  - `tests/`: Test files

### Web Worker Implementation

The project uses a factory pattern for creating and managing web workers:

1. Define a worker function that takes parameters and returns a result
2. Register the worker function with the `MainWorkerFactory`
3. Use the factory to run the worker function in a separate thread

Example:

```typescript
// Define worker function
function myWorkerFunction(params) {
  // Do some work
  return result;
}

// Setup workers
const { foreman } = setupWorkers([
  {
    name: 'myWorker',
    role: 'computation',
    func: myWorkerFunction,
    retries: 3,
    maxConcurrency: 4,
    partition: true, // Enable data partitioning for parallel processing
  },
]);

// Run worker
foreman.runWorker('myWorker', { srcData: inputData, options: {} })
  .then(result => {
    console.log('Worker completed:', result);
  });
```

### Worker Configuration Options

- `name`: Unique identifier for the worker
- `role`: Category/role of the worker (e.g., 'computation')
- `func`: The function to execute in the worker thread
- `retries`: Number of retry attempts if the worker fails
- `maxConcurrency`: Maximum number of concurrent worker instances
- `partition`: Whether to partition input data for parallel processing

### Code Style

The project uses:
- ESLint for linting (run with `pnpm lint`)
- Prettier for code formatting
- TypeScript for type checking

Follow the existing code style and ensure all new code passes linting and type checking.
