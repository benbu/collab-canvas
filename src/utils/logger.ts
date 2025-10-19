/**
 * Centralized logging utility that respects URL-based log level configuration.
 * 
 * Usage: Add ?logLevel=<level> to URL where level is one of:
 * - debug: Show all logs (debug, info, warn, error)
 * - info: Show info, warn, error
 * - warn: Show warn, error
 * - error: Show only errors
 * - (no parameter): Show nothing (default)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

class Logger {
  private currentLevel: number;

  constructor() {
    // Parse log level from URL once on initialization
    const params = new URLSearchParams(window.location.search);
    const levelParam = params.get('logLevel') as LogLevel | null;
    
    this.currentLevel = levelParam && LOG_LEVELS[levelParam] !== undefined
      ? LOG_LEVELS[levelParam]
      : LOG_LEVELS.none;
  }

  private shouldLog(level: number): boolean {
    return this.currentLevel >= level;
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog(LOG_LEVELS.debug)) {
      console.log(...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog(LOG_LEVELS.info)) {
      console.info(...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog(LOG_LEVELS.warn)) {
      console.warn(...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog(LOG_LEVELS.error)) {
      console.error(...args);
    }
  }

  // Alias for backwards compatibility - maps to debug level
  log(...args: unknown[]): void {
    this.debug(...args);
  }
}

export const logger = new Logger();

