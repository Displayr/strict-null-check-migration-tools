import { sep } from 'path'

const isWindows = sep === '\\'

export function normalizePath(path: string): string {
  return isWindows ? path.replace(/\\/g, '/') : path;
}