import { contextBridge, ipcRenderer, webUtils } from 'electron';

export interface IElectronAPI {
  compressFiles: (paths: string[], options: { mode: 'lossy' | 'lossless', quality: number }) => Promise<any>;
  onProgress: (callback: (event: any, data: { done: number, total: number, result: any }) => void) => void;
  removeProgressListeners: () => void;
  getPathForFile: (file: File) => string;
  selectFiles: () => Promise<string[]>;
  scanPaths: (paths: string[]) => Promise<string[]>;
}

const api: IElectronAPI = {
  compressFiles: (paths, options) => ipcRenderer.invoke('compress-files', paths, options),
  onProgress: (callback) => ipcRenderer.on('compression-progress', callback),
  removeProgressListeners: () => ipcRenderer.removeAllListeners('compression-progress'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  selectFiles: () => ipcRenderer.invoke('open-file-dialog'),
  scanPaths: (paths) => ipcRenderer.invoke('scan-paths', paths),
};

contextBridge.exposeInMainWorld('electronAPI', api);
