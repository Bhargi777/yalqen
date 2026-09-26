import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Pages to open from a command line, as passed by the system when the browser
 * opens a link or a file: web and file addresses, and paths of existing files.
 * The executable, the app folder and switches are skipped.
 */
export function externalUrls(args: readonly string[], cwd: string, isFile: (file: string) => boolean): string[] {
  const urls: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    if (/^(https?|file):/i.test(arg)) {
      try {
        urls.push(new URL(arg).toString());
      } catch {
        // Not a valid address.
      }
      continue;
    }
    const file = path.resolve(cwd, arg);
    if (isFile(file)) urls.push(pathToFileURL(file).toString());
  }
  return urls;
}
