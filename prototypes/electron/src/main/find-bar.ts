import { WebContentsView, ipcMain, type BaseWindow, type IpcMainEvent, type Rectangle } from 'electron';
import { FindBarChannel, type FindBarAction, type FindResult } from '../shared/types.js';

const WIDTH = 380;
const HEIGHT = 60;
const INSET = 4;

export interface FindBarOptions {
  window: BaseWindow;
  preload: string;
  page: string;
  onFind: (text: string, forward: boolean, next: boolean) => void;
  onClose: () => void;
}

export class FindBar {
  private readonly view: WebContentsView;
  private opened = false;
  private area: Rectangle = { x: 0, y: 0, width: 0, height: 0 };
  private text = '';

  constructor(private readonly options: FindBarOptions) {
    this.view = new WebContentsView({
      webPreferences: {
        preload: options.preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    this.view.setBackgroundColor('#00000000');
    const contents = this.view.webContents;
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    ipcMain.on(FindBarChannel.action, this.onAction);
    void contents.loadFile(options.page);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (!this.opened) {
      this.opened = true;
      this.layout();
      this.options.window.contentView.addChildView(this.view);
    } else {
      this.keepOnTop();
    }
    this.options.window.focus();
    this.view.webContents.focus();
    this.view.webContents.send(FindBarChannel.open);
  }

  findNext(forward: boolean): void {
    if (!this.opened || this.text === '') {
      this.open();
      return;
    }
    this.options.onFind(this.text, forward, true);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.options.window.contentView.removeChildView(this.view);
  }

  showResult(result: FindResult): void {
    if (this.opened) this.view.webContents.send(FindBarChannel.result, result);
  }

  setArea(area: Rectangle): void {
    this.area = area;
    if (this.opened) this.layout();
  }

  keepOnTop(): void {
    if (!this.opened) return;
    const children = this.options.window.contentView.children;
    if (children[children.length - 1] !== this.view) {
      this.options.window.contentView.addChildView(this.view);
    }
  }

  destroy(): void {
    ipcMain.off(FindBarChannel.action, this.onAction);
    this.close();
    if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
  }

  private layout(): void {
    const width = Math.max(0, Math.min(WIDTH, this.area.width - 2 * INSET));
    this.view.setBounds({
      x: this.area.x + this.area.width - width - INSET,
      y: this.area.y + INSET,
      width,
      height: HEIGHT,
    });
  }

  private readonly onAction = (event: IpcMainEvent, action: FindBarAction): void => {
    if (event.sender !== this.view.webContents || !this.opened) return;
    if (action.type === 'close') {
      this.close();
      this.options.onClose();
      return;
    }
    if (typeof action.text !== 'string') return;
    this.text = action.text;
    this.options.onFind(action.text, action.forward !== false, action.next === true);
  };
}
