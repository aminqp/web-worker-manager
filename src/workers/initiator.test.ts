import { describe, it, expect, vi, beforeEach } from 'vitest';
import initiator from '../workers/initiator';

// Minimal self mock
function makeSelfMock() {
  const listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  return {
    addEventListener: vi.fn((type: string, handler: (e: MessageEvent) => void) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(handler);
    }),
    postMessage: vi.fn(),
    dispatch(type: string, data: unknown) {
      listeners[type]?.forEach((fn) => fn({ data } as MessageEvent));
    },
  };
}

describe('initiator', () => {
  let selfMock: ReturnType<typeof makeSelfMock>;

  beforeEach(() => {
    selfMock = makeSelfMock();
    vi.stubGlobal('self', selfMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  // --- positive tests ---

  it('registers a message event listener on self', () => {
    initiator();
    expect(selfMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('echoes back a string payload', () => {
    initiator();
    selfMock.dispatch('message', 'hello');
    expect(selfMock.postMessage).toHaveBeenCalledWith('hello');
  });

  it('echoes back an object payload', () => {
    initiator();
    const payload = { foo: 'bar', count: 42 };
    selfMock.dispatch('message', payload);
    expect(selfMock.postMessage).toHaveBeenCalledWith(payload);
  });

  it('echoes back an array payload', () => {
    initiator();
    const payload = [1, 2, 3];
    selfMock.dispatch('message', payload);
    expect(selfMock.postMessage).toHaveBeenCalledWith(payload);
  });

  // --- native behaviour tests ---

  it('logs "Initiator: " on invocation', () => {
    initiator();
    expect(console.log).toHaveBeenCalledWith('Initiator: ');
  });

  it('each call to initiator() registers an independent listener', () => {
    initiator();
    initiator();
    expect(selfMock.addEventListener).toHaveBeenCalledTimes(2);
  });

  it('postMessage is called once per dispatched message', () => {
    initiator();
    selfMock.dispatch('message', 'a');
    selfMock.dispatch('message', 'b');
    expect(selfMock.postMessage).toHaveBeenCalledTimes(2);
  });

  // --- edge cases ---

  it('echoes back null', () => {
    initiator();
    selfMock.dispatch('message', null);
    expect(selfMock.postMessage).toHaveBeenCalledWith(null);
  });

  it('echoes back undefined', () => {
    initiator();
    selfMock.dispatch('message', undefined);
    expect(selfMock.postMessage).toHaveBeenCalledWith(undefined);
  });

  it('echoes back 0', () => {
    initiator();
    selfMock.dispatch('message', 0);
    expect(selfMock.postMessage).toHaveBeenCalledWith(0);
  });

  it('echoes back an empty object', () => {
    initiator();
    selfMock.dispatch('message', {});
    expect(selfMock.postMessage).toHaveBeenCalledWith({});
  });

  it('echoes back an empty array', () => {
    initiator();
    selfMock.dispatch('message', []);
    expect(selfMock.postMessage).toHaveBeenCalledWith([]);
  });

  it('does not call postMessage when no message is dispatched', () => {
    initiator();
    expect(selfMock.postMessage).not.toHaveBeenCalled();
  });
});
