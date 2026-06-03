import { appendFileSync } from 'fs';
import { inspect } from 'util';

const logFile = './qbot-startup-debug.log';
const format = (value: unknown) => value instanceof Error ? (value.stack || value.message) : inspect(value, { depth: 6 });
const log = (label: string, value?: unknown) => {
    const detail = value === undefined ? '' : `\n${format(value)}`;
    appendFileSync(logFile, `[${new Date().toISOString()}] ${label}${detail}\n`);
};

const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
    log('console.error', args);
    originalError(...args);
};

process.on('uncaughtException', (error) => {
    log('uncaughtException', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    log('unhandledRejection', reason);
    process.exit(1);
});

process.on('exit', (code) => {
    log(`process exit ${code}`);
});

log('boot importing ./main.ts');
try {
    await import('./main.ts');
    log('main import resolved');
} catch (error) {
    log('main import failed', error);
    console.error(error);
    process.exit(1);
}