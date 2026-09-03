type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

function getRequestId(): string | undefined {
  try {
    // next/headers is async in Next 16 (returns Promise), sync in older.
    // Fail-open: if Promise, skip.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maybeHeaders = (require('next/headers') as unknown as { headers: () => unknown }).headers() as unknown
    if (maybeHeaders && typeof (maybeHeaders as Promise<unknown>).then === 'function') return undefined
    const hdrs = maybeHeaders as { get: (k: string) => string | null }
    return hdrs.get('x-request-id') ?? undefined
  } catch {
    return undefined
  }
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const requestId = getRequestId()
  const prefix = requestId
    ? `[${timestamp}] [${level.toUpperCase()}] [${requestId}]`
    : `[${timestamp}] [${level.toUpperCase()}]`
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`
  }
  return `${prefix} ${message}`
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', message, context))
    }
  },

  info(message: string, context?: LogContext) {
    console.info(formatMessage('info', message, context))
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatMessage('warn', message, context))
  },

  error(message: string, context?: LogContext) {
    console.error(formatMessage('error', message, context))
  },
}
