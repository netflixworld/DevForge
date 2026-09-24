import type { LogLevel } from './config.js';

const weights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  public constructor(private readonly minimum: LogLevel) {}

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorMeta =
      error instanceof Error
        ? { error: error.message, stack: error.stack }
        : error === undefined
          ? {}
          : { error: String(error) };
    this.write('error', message, { ...errorMeta, ...meta });
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (weights[level] < weights[this.minimum]) return;
    const output = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ?? {}),
    });
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  }
}
