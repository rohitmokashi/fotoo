export type Archiver = any;
export function createArchiver(): Archiver {
  const archiver = require('archiver');
  return archiver('zip', { zlib: { level: 9 } });
}
