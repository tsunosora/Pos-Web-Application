/**
 * One-shot CLI: restore PosPro database & uploads from a backup zip.
 *
 * Usage:
 *   npx ts-node prisma/scripts/restore-from-zip.ts <path-to-zip> [skip|overwrite]
 *
 * Bootstraps a standalone Nest app context just to reuse BackupService.importBackup.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { BackupService } from '../../src/backup/backup.service';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const [, , zipPath, modeArg] = process.argv;
    if (!zipPath) {
        console.error('Usage: ts-node restore-from-zip.ts <zip-path> [skip|overwrite]');
        process.exit(1);
    }
    const mode: 'skip' | 'overwrite' = modeArg === 'overwrite' ? 'overwrite' : 'skip';
    const absPath = path.resolve(zipPath);
    if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        process.exit(1);
    }
    const buf = fs.readFileSync(absPath);
    console.log(`Restoring from ${absPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB) — mode=${mode}`);

    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const svc = app.get(BackupService);
    const result = await svc.importBackup(buf, true, mode);
    console.log(JSON.stringify(result, null, 2));
    await app.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
