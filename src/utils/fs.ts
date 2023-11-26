import fs from 'fs/promises';
import path from 'path';

export async function findAbove(
  dir: string,
  target: string
): Promise<string | undefined> {
  if (dir === '/') return undefined;
  if (await existsAsync(path.join(dir, target))) return dir;
  return findAbove(path.resolve(path.join(dir, '..')), target);
}

export function isChild(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return Boolean(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative)
  );
}

export async function existsAsync(input: string) {
  return fs
    .access(input)
    .then(() => true)
    .catch(() => false);
}
