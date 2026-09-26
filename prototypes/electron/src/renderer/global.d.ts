/// <reference types="vite/client" />
import type { CommandBarApi, FindBarApi, SettingsApi, YalqenApi } from '../shared/types';

declare global {
  interface Window {
    /** Present in the browser window. */
    yalqen: YalqenApi;
    /** Present in the settings window. */
    yalqenSettings: SettingsApi;
    /** Present in the command bar overlay. */
    yalqenCommand: CommandBarApi;
    /** Present in the find bar overlay. */
    yalqenFind: FindBarApi;
  }
}
