import { WebContentsView, ipcMain, type BaseWindow, type IpcMainEvent, type Rectangle } from 'electron';
import { FindBarChannel, type FindBarAction, type FindResult } from '../shared/types.js';

/** Size of the view, including room around the bar for its shadow. */
const WIDTH = 380;
const HEIGHT = 60;
/** Gap between the view and the top and right edges of the page area. */
const INSET = 4;

export interface FindBarOptions {
  window: BaseWindow;
  preload: string;
  page: string;
  /** Searches the page; `next` moves within the current matches. An empty text clears the search. */
  onFind: (text: string, forward: boolean, next: boolean) => void;
  /** Called after the user closed the bar. */
  onClose: () => void;
}

/**
 * Find in page box shown over the top right corner of the page area. Like the
 * command bar, the view is loaded up front and attached only while open.
 */
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

  /** Shows the bar and selects its text; the bar repeats its last search. */
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

  /** Moves to the next or previous match, opening the bar when there is no search yet. */
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

  /** The page area the bar is placed in. */
  setArea(area: Rectangle): void {
    this.area = area;
    if (this.opened) this.layout();
  }

  /** Views added while the bar is open would cover it; move it back on top. */
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
