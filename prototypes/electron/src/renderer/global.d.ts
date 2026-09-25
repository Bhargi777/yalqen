/// <reference types="vite/client" />
import type { YalqenApi } from '../shared/types';

declare global {
  interface Window {
    yalqen: YalqenApi;
  }
}
