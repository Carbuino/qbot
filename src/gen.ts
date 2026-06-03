import { execFileSync } from 'child_process';
import { appendFileSync, writeFileSync } from 'fs';

const logFile = '/home/container/prisma-generate.log';
writeFileSync(logFile, '');
const log = (message: string) => appendFileSync(logFile, `${message}\n`);
const run = (command: string, args: string[]) => {
    log(`$ ${command} ${args.join(' ')}`);
    try {
        const output = execFileSync(command, args, {
            cwd: '/home/container',
            env: process.env,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        log(output || '(no stdout)');
    } catch (error: any) {
        log(`EXIT ${error.status ?? 'unknown'}`);
        if (error.stdout) log(`STDOUT\n${error.stdout}`);
        if (error.stderr) log(`STDERR\n${error.stderr}`);
        throw error;
    }
};

run('/usr/local/bin/npx', ['prisma', 'generate', '--schema', '/home/container/src/database/schema.prisma']);
run('/usr/local/bin/npx', ['prisma', 'db', 'push', '--schema', '/home/container/src/database/schema.prisma']);
log('done');