import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface ProcessMemory {
  pid: number;
  type: string;
  name: string | null;
  workingSetKB: number;
}

/**
 * Sums the working set of every app process (browser, GPU, utility, UI and
 * page renderers). On macOS this is resident memory, not the "footprint"
 * value Activity Monitor shows, so bench results must be cross-checked.
 */
export function readProcessMemory(): { totalKB: number; processes: ProcessMemory[] } {
  const processes = app.getAppMetrics().map((metric) => ({
    pid: metric.pid,
    type: metric.type,
    name: metric.name ?? null,
    workingSetKB: metric.memory.workingSetSize,
  }));
  const totalKB = processes.reduce((sum, process) => sum + process.workingSetKB, 0);
  return { totalKB, processes };
}

/** Appends one JSON record per line to a dated file in the metrics directory. */
export class MetricsLog {
  constructor(private readonly directory: string) {}

  write(record: Record<string, unknown>): string {
    const file = path.join(this.directory, `electron-${new Date().toISOString().slice(0, 10)}.jsonl`);
    fs.mkdirSync(this.directory, { recursive: true });
    fs.appendFileSync(
      file,
      JSON.stringify({
        ts: new Date().toISOString(),
        candidate: 'electron',
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        platform: `${process.platform}-${process.arch}`,
        metric: 'workingSetSize',
        ...record,
      }) + '\n',
    );
    return file;
  }
}
