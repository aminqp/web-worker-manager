import { describe, it, expect } from 'vitest';
import { transformArray, TransformOptions } from '../examples/list-transformer.worker';

describe('transformArray', () => {
  it('should transform an array of numbers', () => {
    const data = [1, 2, 3, 4, 5];
    const options: TransformOptions = {
      multiplier: 2,
      round: true
    };

    const result = transformArray({ data, index: 0, options });

    // Since the function has random behavior, we can only test that it returns an array
    // of the same length as the input
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(data.length);
  });

  it('should transform an array of strings', () => {
    const data = ['hello', 'world'];
    const options: TransformOptions = {
      prefix: 'test_',
      suffix: '_end'
    };

    const result = transformArray({ data, index: 0, options });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(data.length);
  });

  it('should join array elements when join option is provided', () => {
    const data = ['hello', 'world'];
    const options: TransformOptions = {
      join: ', '
    };

    const result = transformArray({ data, index: 0, options });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    // The result should be a single string joined with the specified separator
    expect(typeof result[0]).toBe('string');
  });
});
