import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const backupDir = path.resolve('backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const destZip = path.join(backupDir, 'shs-ez_v7.1.0_backup_2026-10-23.zip');
if (fs.existsSync(destZip)) {
  fs.unlinkSync(destZip);
}

const output = fs.createWriteStream(destZip);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Backup created successfully: ${destZip} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Ignore directories
archive.glob('**/*', {
  cwd: process.cwd(),
  ignore: [
    'node_modules/**',
    '.git/**',
    'backups/**',
    'dist/**',
    '.gemini/**',
    'android/app/build/**',
    'android/.gradle/**',
    'android/build/**'
  ],
  dot: true
});

archive.finalize();
