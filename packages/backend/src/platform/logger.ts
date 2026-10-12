import pino from 'pino';
import type { LoggerService } from '@nestjs/common';
import type { Environment } from '../config/environment.js';

export function createLogger(environment: Environment, service: 'api' | 'worker'): LoggerService {
  const logger = pino({
    level: environment.LOG_LEVEL,
    base: { service, environment: environment.NODE_ENV },
    redact: [
      'password',
      'token',
      'cookie',
      'authorization',
      'req.headers.cookie',
      'req.headers.authorization',
    ],
  });
  return {
    log: (message: unknown) => logger.info(String(message)),
    error: (message: unknown) => logger.error(String(message)),
    warn: (message: unknown) => logger.warn(String(message)),
    debug: (message: unknown) => logger.debug(String(message)),
    verbose: (message: unknown) => logger.trace(String(message)),
    fatal: (message: unknown) => logger.fatal(String(message)),
  };
}
