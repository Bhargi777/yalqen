/// <reference types="vite/client" />
import type { CommandBarApi, SettingsApi, YalqenApi } from '../shared/types';

declare global {
  interface Window {
    /** Present in the browser window. */
    yalqen: YalqenApi;
    /** Present in the settings window. */
    yalqenSettings: SettingsApi;
    /** Present in the command bar overlay. */
    yalqenCommand: CommandBarApi;
  }
}
