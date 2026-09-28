import fs from 'node:fs';
import path from 'node:path';

export const SAVE_DELAY_MS = 500;

export class JsonFile {
  private timer: NodeJS.Timeout | null = null;
  private generation = 0;
  private data: (() => unknown) | null = null;
  private dirty = false;

  constructor(
    readonly file: string,
    private readonly label: string,
  ) {}

  schedule(data: () => unknown, delayMs = SAVE_DELAY_MS): void {
    this.data = data;
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.writeInBackground();
    }, delayMs);
  }

  flush(data?: () => unknown): void {
    if (data) {
      this.data = data;
      this.dirty = true;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.dirty || !this.data) return;
    this.generation++;
    const temp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(this.data()));
      fs.renameSync(temp, this.file);
      this.dirty = false;
    } catch (error) {
      console.warn(`[${this.label}] could not save:`, error);
    }
  }

  private async writeInBackground(): Promise<void> {
    if (!this.data) return;
    const generation = ++this.generation;
    const temp = `${this.file}.${generation}.tmp`;
    try {
      const json = JSON.stringify(this.data());
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
      await fs.promises.writeFile(temp, json);
      if (generation !== this.generation) {
        await fs.promises.rm(temp, { force: true });
        return;
      }
      fs.renameSync(temp, this.file);
      if (!this.timer) this.dirty = false;
    } catch (error) {
      console.warn(`[${this.label}] could not save:`, error);
      await fs.promises.rm(temp, { force: true }).catch(() => {});
    }
  }
}
