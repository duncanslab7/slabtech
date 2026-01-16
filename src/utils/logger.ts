/**
 * Structured Logging Utility
 *
 * Provides a unified logging interface using Pino for structured JSON logs.
 * In development: pretty-printed colored output
 * In production: JSON output ready for log aggregators
 */

import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Pretty print in development, JSON in production
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
    }
  } : undefined,

  // Add base context to all logs
  base: {
    env: process.env.NODE_ENV,
  },

  // Serialize errors and requests properly
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // Custom formatters for better readability
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
})

/**
 * Create a child logger with additional context
 *
 * @param context - Additional fields to include in all logs from this logger
 * @returns Child logger instance
 *
 * @example
 * const log = createLogger({ userId: 'abc123', endpoint: 'process-audio' })
 * log.info('Processing started')
 * // Output: { level: 'info', userId: 'abc123', endpoint: 'process-audio', msg: 'Processing started' }
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context)
}

/**
 * Create a logger for API routes with request context
 *
 * @param method - HTTP method
 * @param path - Request path
 * @param userId - Optional user ID
 * @returns Logger with request context
 */
export function createApiLogger(method: string, path: string, userId?: string) {
  return logger.child({
    type: 'api',
    method,
    path,
    ...(userId && { userId }),
  })
}

/**
 * Log levels guide:
 *
 * logger.debug() - Verbose diagnostic information (only in development)
 * logger.info()  - Normal operations and significant events
 * logger.warn()  - Warning conditions (recoverable issues)
 * logger.error() - Error conditions (failures that affect users)
 * logger.fatal() - Critical failures (application is going down)
 */
