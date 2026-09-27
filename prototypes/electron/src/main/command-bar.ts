import { WebContentsView, ipcMain, type BaseWindow, type IpcMainEvent } from 'electron';
import {
  CommandBarChannel,
  type AddressSuggestion,
  type CommandBarAction,
  type CommandBarOpen,
  type TabId,
} from '../shared/types.js';

export interface CommandBarOptions {
  preload: string;
  page: string;
}

export interface CommandBarHost {
  window: BaseWindow;
  onSubmit: (input: string, mode: CommandBarOpen['mode']) => void;
  onDismiss: () => void;
  onInput: (input: string) => void;
  onSwitchTab: (id: TabId) => void;
}

export class CommandBar {
  private view: WebContentsView | null = null;
  private host: CommandBarHost | null = null;
  private opened = false;
  private mode: CommandBarOpen['mode'] = 'navigate';
  private ready = false;
  private lastOpen: CommandBarOpen | null = null;

  constructor(private readonly options: CommandBarOptions) {
    ipcMain.on(CommandBarChannel.action, this.onAction);
  }

  open(host: CommandBarHost, open: CommandBarOpen): void {
    const view = this.ensureView();
    if (this.host && this.host.window !== host.window) this.close();
    this.host = host;
    this.fitWindow(host.window);
    this.mode = open.mode;
    this.lastOpen = open;
    if (!this.opened) {
      this.opened = true;
      host.window.contentView.addChildView(view);
    } else {
      this.keepOnTop(host.window);
    }
    host.window.focus();
    view.webContents.focus();
    if (this.ready) view.webContents.send(CommandBarChannel.open, open);
  }

  showSuggestions(window: BaseWindow, input: string, suggestions: AddressSuggestion[]): void {
    if (this.isOpenIn(window)) this.view?.webContents.send(CommandBarChannel.suggestions, { input, suggestions });
  }

  close(window?: BaseWindow): void {
    if (!this.opened || !this.view || !this.host) return;
    if (window && this.host.window !== window) return;
    this.opened = false;
    this.lastOpen = null;
    if (!this.host.window.isDestroyed()) this.host.window.contentView.removeChildView(this.view);
  }

  release(window: BaseWindow): void {
    if (this.host?.window !== window) return;
    this.close();
    this.host = null;
  }

  fitWindow(window: BaseWindow): void {
    if (!this.view || this.host?.window !== window) return;
    const { width, height } = window.getContentBounds();
    this.view.setBounds({ x: 0, y: 0, width, height });
  }

  keepOnTop(window: BaseWindow): void {
    if (!this.view || !this.isOpenIn(window)) return;
    const children = window.contentView.children;
    if (children[children.length - 1] !== this.view) window.contentView.addChildView(this.view);
  }

  destroy(): void {
    ipcMain.off(CommandBarChannel.action, this.onAction);
    this.close();
    this.host = null;
    if (this.view && !this.view.webContents.isDestroyed()) this.view.webContents.close();
    this.view = null;
  }

  private isOpenIn(window: BaseWindow): boolean {
    return this.opened && this.host?.window === window;
  }

  private ensureView(): WebContentsView {
    if (this.view) return this.view;
    const view = new WebContentsView({
      webPreferences: {
        preload: this.options.preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    view.setBackgroundColor('#00000000');
    const contents = view.webContents;
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.view = view;
    void contents.loadFile(this.options.page).then(() => {
      this.ready = true;
      if (this.opened && this.lastOpen) contents.send(CommandBarChannel.open, this.lastOpen);
    });
    return view;
  }

  private readonly onAction = (event: IpcMainEvent, action: CommandBarAction): void => {
    const host = this.host;
    if (!this.view || event.sender !== this.view.webContents || !this.opened || !host) return;
    if (action.type === 'input') {
      if (typeof action.input === 'string') host.onInput(action.input);
      return;
    }
    this.close();
    if (action.type === 'switch-tab' && typeof action.id === 'string') {
      host.onSwitchTab(action.id);
    } else if (action.type === 'submit' && typeof action.input === 'string' && action.input.trim() !== '') {
      host.onSubmit(action.input, this.mode);
    } else {
      host.onDismiss();
    }
  };
}
