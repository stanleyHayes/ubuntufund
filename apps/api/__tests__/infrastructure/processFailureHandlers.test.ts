import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { installProcessFailureHandlers } from '../../src/infrastructure/logging/processFailureHandlers.js';

describe('installProcessFailureHandlers', () => {
  it('logs an unhandled rejection through the structured logger, then exits non-zero', () => {
    const target = new EventEmitter();
    const fatal = vi.fn();
    const exit = vi.fn();
    installProcessFailureHandlers(target, { fatal } as never, exit);

    const reason = new Error('boom');
    target.emit('unhandledRejection', reason);

    expect(fatal).toHaveBeenCalledWith({ err: reason }, 'Unhandled promise rejection; exiting');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('logs an uncaught exception, then exits non-zero', () => {
    const target = new EventEmitter();
    const fatal = vi.fn();
    const exit = vi.fn();
    installProcessFailureHandlers(target, { fatal } as never, exit);

    const error = new TypeError('bad');
    target.emit('uncaughtException', error);

    expect(fatal).toHaveBeenCalledWith({ err: error }, 'Uncaught exception; exiting');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
