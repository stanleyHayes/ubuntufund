import type { Logger } from 'pino';

interface ProcessLike {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown;
  on(event: 'uncaughtException', listener: (error: Error) => void): unknown;
}

/**
 * Crash loudly and in the structured log. Node already exits on an unhandled
 * rejection or uncaught exception, but it prints the raw error to stderr —
 * outside the JSON log stream, and without the privacy filter that keeps
 * tokens, URIs and submitted data out of diagnostics. Log through the logger
 * (synchronous to stdout in production), then exit non-zero so Render restarts
 * the instance: state after an unexpected throw cannot be trusted.
 */
export function installProcessFailureHandlers(
  target: ProcessLike,
  log: Pick<Logger, 'fatal'>,
  exit: (code: number) => void = (code) => process.exit(code),
): void {
  target.on('unhandledRejection', (reason) => {
    log.fatal({ err: reason }, 'Unhandled promise rejection; exiting');
    exit(1);
  });
  target.on('uncaughtException', (error) => {
    log.fatal({ err: error }, 'Uncaught exception; exiting');
    exit(1);
  });
}
