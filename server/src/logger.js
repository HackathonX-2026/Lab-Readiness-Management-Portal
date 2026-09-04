import { config } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

function log(level, msg, meta) {
  if ((LEVELS[level] ?? 0) < threshold) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta || {})
  };
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(JSON.stringify(line) + '\n');
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info:  (msg, meta) => log('info', msg, meta),
  warn:  (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta)
};
