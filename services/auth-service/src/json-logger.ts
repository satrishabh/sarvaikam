import { LoggerService, LogLevel } from '@nestjs/common';

const SEVERITY: Record<LogLevel, string> = {
  fatal: 'CRITICAL', error: 'ERROR', warn: 'WARNING', log: 'INFO', debug: 'DEBUG', verbose: 'DEBUG',
};

/** One JSON object per line with the field names Cloud Logging understands (severity, message, time). */
export class JsonLogger implements LoggerService {
  constructor(private levels: LogLevel[], private readonly out: (line: string) => void = line => process.stdout.write(line + '\n')) {}

  log(message: unknown, ...rest: unknown[]) { this.write('log', message, rest); }
  error(message: unknown, ...rest: unknown[]) { this.write('error', message, rest); }
  warn(message: unknown, ...rest: unknown[]) { this.write('warn', message, rest); }
  debug(message: unknown, ...rest: unknown[]) { this.write('debug', message, rest); }
  verbose(message: unknown, ...rest: unknown[]) { this.write('verbose', message, rest); }
  fatal(message: unknown, ...rest: unknown[]) { this.write('fatal', message, rest); }
  setLogLevels(levels: LogLevel[]) { this.levels = levels; }

  private write(level: LogLevel, message: unknown, rest: unknown[]) {
    if (level !== 'fatal' && !this.levels.includes(level)) return;
    // Nest passes the context (class name) last; error() passes a stack trace before it.
    const args = [...rest];
    const context = typeof args[args.length - 1] === 'string' ? args.pop() as string : undefined;
    const stack = level === 'error' && typeof args[0] === 'string' ? args.shift() as string : undefined;
    const entry: Record<string, unknown> = {
      severity: SEVERITY[level],
      message: message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message),
      time: new Date().toISOString(),
    };
    if (context) entry.context = context;
    if (message instanceof Error) entry.stack_trace = message.stack;
    else if (stack) entry.stack_trace = stack;
    this.out(JSON.stringify(entry));
  }
}
